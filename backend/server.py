from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import json, uuid, json, logging, secrets, asyncio, hashlib, base64, random, string, csv, io
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import bcrypt, jwt, httpx
from fastapi.responses import JSONResponse
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("merizo")

# ── Supabase client ───────────────────────────────────────────────────────────
_raw_url = os.environ["SUPABASE_URL"].rstrip("/")
# Strip accidentally included /rest/v1 suffix
if "/rest/v1" in _raw_url:
    _raw_url = _raw_url.split("/rest/v1")[0]
SUPABASE_URL = _raw_url
SUPABASE_KEY = os.environ["SUPABASE_KEY"]   # use service_role key
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Helpers: wrap sync supabase calls in asyncio.to_thread ───────────────────
async def sb_get(table: str, **filters):
    """Fetch all rows matching filters. Returns list."""
    def _q():
        q = sb.table(table).select("*")
        for k, v in filters.items():
            if k == "_contains":
                for col, val in v.items():
                    q = q.contains(col, [val] if not isinstance(val, list) else val)
            elif k == "_neq":
                for col, val in v.items():
                    q = q.neq(col, val)
            else:
                q = q.eq(k, v)
        return q.execute()
    try:
        r = await asyncio.to_thread(_q)
        return r.data or []
    except Exception as e:
        err = str(e)
        if "PGRST125" in err or "404" in err or "not found" in err.lower():
            logger.error(f"Table '{table}' not found. Did you run schema.sql in Supabase SQL Editor?")
        raise

async def sb_one(table: str, **filters):
    """Fetch single row. Returns dict or None."""
    rows = await sb_get(table, **filters)
    return rows[0] if rows else None

async def sb_insert(table: str, doc: dict):
    r = await asyncio.to_thread(lambda: sb.table(table).insert(doc).execute())
    return r.data[0] if r.data else doc

async def sb_update(table: str, update: dict, **filters):
    def _q():
        q = sb.table(table).update(update)
        for k, v in filters.items():
            q = q.eq(k, v)
        return q.execute()
    await asyncio.to_thread(_q)

async def sb_delete(table: str, **filters):
    def _q():
        q = sb.table(table).delete()
        for k, v in filters.items():
            q = q.eq(k, v)
        return q.execute()
    await asyncio.to_thread(_q)

async def sb_array_append(table: str, row_id: str, col: str, value: str):
    """Append a value to a PostgreSQL text[] column."""
    def _q():
        return sb.rpc("array_append_unique", {
            "p_table": table, "p_id": row_id, "p_col": col, "p_val": value
        }).execute()
    try:
        await asyncio.to_thread(_q)
    except Exception:
        # Fallback: fetch, append, update
        rows = await sb_get(table, id=row_id)
        if rows:
            arr = rows[0].get(col, []) or []
            if value not in arr:
                arr.append(value)
                await sb_update(table, {col: arr}, id=row_id)

# ── Auth / JWT ────────────────────────────────────────────────────────────────
JWT_SECRET    = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

DEMO_EMAIL    = os.environ.get("DEMO_EMAIL", "demo@merizo.app")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "Demo@123")
DEMO_NAME     = os.environ.get("DEMO_NAME", "Demo User")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

def hash_pw(pw): return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
def verify_pw(pw, h):
    try: return bcrypt.checkpw(pw.encode(), h.encode())
    except: return False

def create_token(uid, email):
    return jwt.encode({"sub": uid, "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)},
        JWT_SECRET, algorithm=JWT_ALGORITHM)

app = FastAPI(title="Merizo API")
api = APIRouter(prefix="/api")
bearer_scheme = HTTPBearer(auto_error=False)
otp_store: dict = {}

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

async def get_current_user(request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> dict:
    token = None
    if creds and creds.scheme.lower() == "bearer": token = creds.credentials
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "): token = auth[7:]
    if not token: raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await sb_one("users", id=payload["sub"])
        if not user: raise HTTPException(401, "User not found")
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError: raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError: raise HTTPException(401, "Invalid token")

# ── Models ────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel): email: str; password: str
class RegisterRequest(BaseModel): email: str; password: str; name: str
class Trip(BaseModel):
    name: str; description: Optional[str] = None; currency: str = "INR"
    category: Optional[str] = "trip"; group_type: Optional[str] = None
    split_category: Optional[str] = None; start_date: Optional[str] = None
    end_date: Optional[str] = None; due_date: Optional[str] = None
    members: List[str] = []; cover_key: Optional[str] = None
class ReminderCreate(BaseModel):
    trip_id: Optional[str] = None; title: str
    message: Optional[str] = None; due_date: Optional[str] = None

# ── Member resolution ─────────────────────────────────────────────────────────
async def _resolve_member(name_or_id: str) -> str:
    if len(name_or_id) == 36 and name_or_id.count("-") == 4:
        return name_or_id
    gid = str(uuid.uuid4())
    await sb_insert("users", {"id": gid, "name": name_or_id,
        "email": f"guest_{gid[:8]}@merizo.app", "is_guest": True,
        "created_at": datetime.utcnow().isoformat()})
    return gid

# ── Balance helper ────────────────────────────────────────────────────────────
async def compute_trip_summary(trip: dict, user_id: str) -> dict:
    tid = trip.get("id")
    expenses    = await sb_get("expenses", trip_id=tid)
    settlements = await sb_get("settlements", trip_id=tid, status="completed")
    total  = sum(e.get("amount", 0) for e in expenses if not e.get("is_settlement"))
    mids   = trip.get("members", [])
    paid   = sum(e.get("amount", 0) for e in expenses
                 if e.get("paid_by") == user_id and not e.get("is_settlement"))
    share  = 0.0
    for e in expenses:
        if e.get("is_settlement"): continue
        split_ids = e.get("split_among") or mids
        if user_id in split_ids and split_ids:
            share += e.get("amount", 0) / len(split_ids)
    my_net = paid - share
    for s in settlements:
        if s.get("to_user") == user_id: my_net += s.get("amount", 0)
        elif s.get("from_user") == user_id: my_net -= s.get("amount", 0)
    return {**trip, "split_category": trip.get("split_category") or "trip",
            "my_net": round(my_net, 2), "total_spent": round(total, 2),
            "member_count": len(mids)}

# ══════════════════════════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

class SocialLoginReq(BaseModel):
    supabase_token: str
    email: str = ""
    phone: str = ""
    name:  str = "User"

@api.post("/auth/social-login")
async def social_login(req: SocialLoginReq):
    """Exchange Supabase OTP/OAuth token for our app JWT."""
    # Verify with Supabase by fetching the user
    try:
        result = await asyncio.to_thread(
            lambda: sb.auth.get_user(req.supabase_token)
        )
        sb_user = result.user
        if not sb_user:
            raise HTTPException(401, "Invalid Supabase token")
    except Exception as e:
        raise HTTPException(401, f"Token verification failed: {e}")

    # Determine identifier
    identifier = sb_user.email or req.email or sb_user.phone or req.phone
    if not identifier:
        raise HTTPException(400, "No email or phone from auth provider")

    # Get or create user in our database
    user = None
    if sb_user.email or req.email:
        em = sb_user.email or req.email
        user = await sb_one("users", email=em)
        if not user:
            uid  = str(uuid.uuid4())
            name = req.name or sb_user.user_metadata.get("full_name","") or em.split("@")[0]
            await sb_insert("users", {
                "id": uid, "email": em, "name": name,
                "password_hash": hash_pw(str(uuid.uuid4())),  # random, login via OTP
                "created_at": datetime.utcnow().isoformat(),
            })
            user = await sb_one("users", email=em)
    elif sb_user.phone or req.phone:
        ph = sb_user.phone or req.phone
        user = await sb_one("users", phone=ph)
        if not user:
            uid  = str(uuid.uuid4())
            name = req.name or "User"
            em   = f"phone_{ph.replace('+','')}@merizo.app"
            await sb_insert("users", {
                "id": uid, "email": em, "name": name, "phone": ph,
                "password_hash": hash_pw(str(uuid.uuid4())),
                "created_at": datetime.utcnow().isoformat(),
            })
            user = await sb_one("users", phone=ph)

    if not user:
        raise HTTPException(500, "Could not create user")

    token = make_jwt(user["id"])
    return {
        "token": token,
        "user": {
            "id":    user["id"],
            "name":  user.get("name",""),
            "email": user.get("email",""),
        }
    }

@api.post("/auth/login")
async def login(req: LoginRequest):
    user = await sb_one("users", email=req.email)
    if not user or not verify_pw(req.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid email or password")
    return {"access_token": create_token(user["id"], user["email"]), "token_type": "bearer",
            "user": {k: user[k] for k in ("id","email","name") if k in user}}

@api.post("/auth/register")
async def register(req: RegisterRequest):
    if await sb_one("users", email=req.email):
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    doc = {"id": uid, "email": req.email, "name": req.name,
           "password_hash": hash_pw(req.password), "created_at": datetime.utcnow().isoformat()}
    await sb_insert("users", doc)
    return {"access_token": create_token(uid, req.email), "token_type": "bearer",
            "user": {"id": uid, "email": req.email, "name": req.name}}

@api.post("/auth/demo-login")
async def demo_login():
    user = await sb_one("users", email=DEMO_EMAIL)
    if not user:
        uid = str(uuid.uuid4())
        user = {"id": uid, "email": DEMO_EMAIL, "name": DEMO_NAME,
                "password_hash": hash_pw(DEMO_PASSWORD), "created_at": datetime.utcnow().isoformat()}
        await sb_insert("users", user)
    return {"access_token": create_token(user["id"], user["email"]), "token_type": "bearer",
            "user": {k: user.get(k) for k in ("id","email","name")}}

@api.patch("/auth/profile")
async def update_profile(request: Request, current_user: dict = Depends(get_current_user)):
    data = await request.json()
    update = {k: v for k, v in data.items() if k in ["name","upi_id","avatar_url"] and v is not None}
    if update: await sb_update("users", update, id=current_user["id"])
    user = await sb_one("users", id=current_user["id"])
    user.pop("password_hash", None)
    return user

@api.get("/auth/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {k: current_user.get(k) for k in ("id","email","name","upi_id","avatar_url")}

# OTP endpoints (simplified)
@app.post("/api/auth/send-otp")
async def send_otp(request: Request):
    data = await request.json()
    phone = data.get("phone","").strip()
    if not phone or len(phone) != 10: raise HTTPException(400,"Invalid phone")
    code = ''.join(random.choices(string.digits, k=6))
    otp_store[phone] = {"code": code, "expires": datetime.utcnow() + timedelta(minutes=10)}
    logger.info(f"OTP for {phone}: {code}")
    return {"success": True, "message": "OTP sent"}

@app.post("/api/auth/verify-otp")
async def verify_otp(request: Request):
    data = await request.json()
    phone, otp = data.get("phone","").strip(), data.get("otp","").strip()
    if phone not in otp_store: raise HTTPException(400,"OTP expired")
    stored = otp_store[phone]
    if datetime.utcnow() > stored["expires"]: del otp_store[phone]; raise HTTPException(400,"OTP expired")
    if stored["code"] != otp: raise HTTPException(400,"Invalid OTP")
    del otp_store[phone]
    user = await sb_one("users", phone=phone)
    if not user:
        uid = str(uuid.uuid4())
        user = {"id": uid, "phone": phone, "email": f"user_{phone}@merizo.app",
                "name": f"User {phone[-4:]}", "password_hash": hash_pw(secrets.token_hex(8)),
                "created_at": datetime.utcnow().isoformat()}
        await sb_insert("users", user)
    return {"access_token": create_token(user["id"], user.get("email","")),
            "token_type": "bearer", "user": {k: user.get(k) for k in ("id","name","email")}}

# ══════════════════════════════════════════════════════════════════════════════
# TRIP ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════
@api.post("/trips")
async def create_trip(trip: Trip, current_user: dict = Depends(get_current_user)):
    tid = str(uuid.uuid4())
    resolved = [current_user["id"]]
    for m in trip.members:
        mid = await _resolve_member(m)
        if mid not in resolved: resolved.append(mid)
    doc = {"id": tid, "name": trip.name, "description": trip.description,
           "currency": trip.currency, "split_category": trip.split_category or trip.category or "trip",
           "start_date": trip.start_date, "end_date": trip.end_date, "due_date": trip.due_date,
           "cover_key": trip.cover_key, "members": resolved, "owner_id": current_user["id"],
           "invite_token": secrets.token_urlsafe(12), "created_at": datetime.utcnow().isoformat()}
    await sb_insert("trips", doc)
    return {"id": tid, "message": "Trip created"}

@api.get("/trips")
async def get_trips(current_user: dict = Depends(get_current_user)):
    raw = await sb_get("trips", _contains={"members": current_user["id"]})
    result = []
    for t in raw:
        summary = await compute_trip_summary(t, current_user["id"])
        result.append(summary)
    return result

@api.get("/trips/{trip_id}")
async def get_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await sb_one("trips", id=trip_id)
    if not trip or current_user["id"] not in (trip.get("members") or []):
        raise HTTPException(404, "Trip not found")
    expenses    = await sb_get("expenses", trip_id=trip_id)
    settlements = await sb_get("settlements", trip_id=trip_id)
    all_mids    = trip.get("members", [])

    # Build member list with balances
    members_list = []
    for mid in all_mids:
        member = await sb_one("users", id=mid)
        if not member: continue
        member.pop("password_hash", None)
        paid = sum(e.get("amount",0) for e in expenses
                   if e.get("paid_by")==mid and not e.get("is_settlement"))
        ms = 0.0
        for e in expenses:
            if e.get("is_settlement"): continue
            sids = e.get("split_among") or all_mids
            if mid in sids and sids: ms += e.get("amount",0) / len(sids)
        ms  = round(ms, 2)
        net = round(paid - ms, 2)
        members_list.append({**member, "paid": paid, "share": ms, "net": net})

    # Adjust for completed settlements
    for s in settlements:
        if s.get("status") != "completed": continue
        for m in members_list:
            if m.get("id") == s.get("from_user"):
                m["net"]  = round(m["net"] + s.get("amount",0), 2)
                m["paid"] = round(m["paid"] + s.get("amount",0), 2)
            if m.get("id") == s.get("to_user"):
                m["net"]  = round(m["net"] - s.get("amount",0), 2)

    # Enrich expenses
    nmap = {m["id"]: m["name"] for m in members_list}
    for e in expenses:
        if not e.get("paid_by_name"):
            e["paid_by_name"] = nmap.get(e.get("paid_by",""), "")
        sids = e.get("split_among") or all_mids
        e["split_among_names"] = [nmap.get(s,s) for s in sids if s in nmap]

    total = sum(e.get("amount",0) for e in expenses if not e.get("is_settlement"))
    by_cat: dict = {}
    for e in expenses:
        if not e.get("is_settlement"):
            c = e.get("category","other")
            by_cat[c] = round(by_cat.get(c,0) + e.get("amount",0), 2)

    # Settlement transactions (greedy)
    creds = sorted([(m["net"], m["id"], m["name"]) for m in members_list if m["net"] > 0.5], reverse=True)
    debts = sorted([(-m["net"], m["id"], m["name"]) for m in members_list if m["net"] < -0.5], reverse=True)
    txns, ci, di = [], 0, 0
    while ci < len(creds) and di < len(debts):
        ca,cid,cn = creds[ci]; da,did,dn = debts[di]
        pay = min(ca,da)
        txns.append({"from_id":did,"from_name":dn,"to_id":cid,"to_name":cn,"amount":round(pay,2)})
        creds[ci]=(ca-pay,cid,cn); debts[di]=(da-pay,did,dn)
        if creds[ci][0] < 0.5: ci+=1
        if debts[di][0] < 0.5: di+=1

    return {**trip, "expenses": expenses, "settlements": settlements, "members": members_list,
            "balances": [{**m,"member_id":m["id"]} for m in members_list],
            "total_spent": round(total,2), "by_category": by_cat,
            "settlement_transactions": txns, "owner_id": trip.get("owner_id"),
            "split_category": trip.get("split_category") or "trip"}

@api.get("/trips/{trip_id}/share-summary")
async def share_summary(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await sb_one("trips", id=trip_id)
    if not trip or current_user["id"] not in (trip.get("members") or []):
        raise HTTPException(404)
    expenses = await sb_get("expenses", trip_id=trip_id)
    expenses = [e for e in expenses if not e.get("is_settlement")]
    total = sum(e.get("amount",0) for e in expenses)
    sym = {"INR":"₹","USD":"$","EUR":"€","GBP":"£"}.get(trip.get("currency","INR"),"")
    mids = trip.get("members",[])
    nm = {}
    for mid in mids:
        u = await sb_one("users", id=mid)
        if u: nm[mid] = u
    shares: dict = {}
    for e in expenses:
        sids = e.get("split_among") or mids
        per = e.get("amount",0) / max(len(sids),1)
        pid = e.get("paid_by","")
        shares[pid] = shares.get(pid,0) + e.get("amount",0)
        for sid in sids:
            if sid != pid: shares[sid] = shares.get(sid,0) - per
    debtors   = sorted([(mid,-amt) for mid,amt in shares.items() if amt<-5], key=lambda x:-x[1])
    creditors = sorted([(mid, amt) for mid,amt in shares.items() if amt> 5], key=lambda x:-x[1])
    lines = [f"*{trip.get('name','Group')} — Split Summary*", f"Total: {sym}{int(total):,}", ""]
    if debtors:
        lines.append("*Who pays whom:*")
        for did,damt in debtors:
            dn = nm.get(did,{}).get("name",did)
            for cid,camt in creditors:
                pay = min(damt,camt)
                if pay > 1:
                    cn = nm.get(cid,{}).get("name",cid)
                    upi = nm.get(cid,{}).get("upi_id","")
                    lines.append(f"  {dn} → {cn}: {sym}{int(pay):,}" + (f" (UPI: {upi})" if upi else ""))
                    break
    else: lines.append("✅ All settled up!")
    lines += ["", "Tracked with Merizo — merizo.app"]
    return {"text": "\n".join(lines)}

@api.get("/trips/{trip_id}/invite")
async def get_invite(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await sb_one("trips", id=trip_id)
    if not trip: raise HTTPException(404)
    token = trip.get("invite_token") or secrets.token_urlsafe(12)
    if not trip.get("invite_token"):
        await sb_update("trips", {"invite_token": token}, id=trip_id)
    return {"token": token, "trip_name": trip["name"]}

@api.post("/trips/{trip_id}/join")
async def join_trip(trip_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    data = await request.json()
    trip = await sb_one("trips", id=trip_id, invite_token=data.get("token"))
    if not trip: raise HTTPException(404, "Invalid invite link")
    if current_user["id"] not in (trip.get("members") or []):
        members = list(trip.get("members") or [])
        members.append(current_user["id"])
        await sb_update("trips", {"members": members}, id=trip_id)
    return {"message": "Joined successfully"}

@api.post("/trips/{trip_id}/members")
async def add_member(trip_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    trip = await sb_one("trips", id=trip_id)
    if not trip: raise HTTPException(404)
    data = await request.json()
    raw = (data.get("name") or data.get("id") or "").strip()
    if not raw: raise HTTPException(400, "Name required")
    mid = await _resolve_member(raw)
    members = list(trip.get("members") or [])
    if mid not in members:
        members.append(mid)
        await sb_update("trips", {"members": members}, id=trip_id)
    member = await sb_one("users", id=mid)
    return {"id": mid, "member": member}

@api.delete("/trips/{trip_id}/members/{member_id}")
async def delete_member(trip_id: str, member_id: str, current_user: dict = Depends(get_current_user)):
    trip = await sb_one("trips", id=trip_id)
    if not trip: raise HTTPException(404)
    if trip.get("owner_id") != current_user["id"]: raise HTTPException(403)
    members = [m for m in (trip.get("members") or []) if m != member_id]
    await sb_update("trips", {"members": members}, id=trip_id)
    return {"message": "Removed"}

@api.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await sb_one("trips", id=trip_id)
    if not trip: raise HTTPException(404)
    if trip.get("owner_id") != current_user["id"]: raise HTTPException(403)
    await sb_delete("expenses", trip_id=trip_id)
    await sb_delete("settlements", trip_id=trip_id)
    await sb_delete("trips", id=trip_id)
    return {"message": "Deleted"}

# ══════════════════════════════════════════════════════════════════════════════
# EXPENSE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════
@api.post("/trips/{trip_id}/expenses")
async def add_expense(trip_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    trip = await sb_one("trips", id=trip_id)
    if not trip or current_user["id"] not in (trip.get("members") or []):
        raise HTTPException(404)
    data = await request.json()
    pid = data.get("paid_by", current_user["id"])
    payer = await sb_one("users", id=pid)
    split = data.get("split_among") or trip.get("members") or []
    eid = str(uuid.uuid4())
    doc = {"id": eid, "trip_id": trip_id, "paid_by": pid,
           "paid_by_name": (payer or {}).get("name", current_user.get("name","")),
           "split_among": split,
           "description": data.get("name") or data.get("description") or "Expense",
           "name": data.get("name") or data.get("description") or "Expense",
           "amount": float(data.get("amount",0)), "currency": data.get("currency", trip.get("currency","INR")),
           "category": data.get("category","other"), "is_settlement": False,
           "date": data.get("date") or datetime.utcnow().strftime("%Y-%m-%d"),
           "created_at": datetime.utcnow().isoformat()}
    await sb_insert("expenses", doc)
    return {"id": eid, "message": "Expense added"}

@api.get("/expenses/{trip_id}")
async def get_expenses(trip_id: str, current_user: dict = Depends(get_current_user)):
    return await sb_get("expenses", trip_id=trip_id)

@api.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: dict = Depends(get_current_user)):
    await sb_delete("expenses", id=expense_id)
    return {"message": "Deleted"}

# ══════════════════════════════════════════════════════════════════════════════
# SETTLEMENT ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════
@api.post("/trips/{trip_id}/settle")
async def settle(trip_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    data = await request.json()
    sid = str(uuid.uuid4())
    await sb_insert("settlements", {"id": sid, "trip_id": trip_id,
        "from_user": data.get("from_member"), "to_user": data.get("to_member"),
        "amount": float(data.get("amount",0)), "status": "completed",
        "proof_uri": data.get("proof_uri"), "created_at": datetime.utcnow().isoformat()})
    return {"id": sid, "message": "Settlement recorded"}

@api.get("/settlements/{trip_id}")
async def get_settlements(trip_id: str, current_user: dict = Depends(get_current_user)):
    return await sb_get("settlements", trip_id=trip_id)

# ══════════════════════════════════════════════════════════════════════════════
# INSIGHTS / SMART LIMIT / REMINDERS
# ══════════════════════════════════════════════════════════════════════════════
@api.get("/smart-limit")
async def smart_limit(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    trips = await sb_get("trips", _contains={"members": uid})
    tids  = [t["id"] for t in trips]
    all_exp = []
    for tid in tids:
        all_exp += await sb_get("expenses", trip_id=tid)
    now = datetime.utcnow()
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    cur_week = 0.0
    weekly: dict = {}
    for e in all_exp:
        if e.get("is_settlement") or e.get("paid_by") != uid: continue
        try:
            d = datetime.strptime(e.get("date","")[:10], "%Y-%m-%d")
            if d >= week_start: cur_week += e.get("amount",0)
            wk = (d - timedelta(days=d.weekday())).strftime("%Y-%m-%d")
            weekly[wk] = weekly.get(wk,0) + e.get("amount",0)
        except: pass
    past = sorted(weekly.keys(), reverse=True)
    budget = sum(weekly[w] for w in past[:4]) / max(len(past[:4]),1) * 1.1 if len(past) >= 2 else 3000.0
    return {"percent": round(cur_week/budget*100,1) if budget else 0,
            "current_week_spent": round(cur_week,2), "weekly_budget": round(budget,2),
            "currency": "INR", "has_history": len(past) >= 2}

@api.get("/insights")
async def insights(period: str = "month", current_user: dict = Depends(get_current_user)):
    uid  = current_user["id"]
    now  = datetime.utcnow()
    cuts = {"week": 7, "month": 30}.get(period, 36500)
    cutoff = now - timedelta(days=cuts)
    trips = await sb_get("trips", _contains={"members": uid})
    by_cat: dict = {}; total = 0.0
    for t in trips:
        exps = await sb_get("expenses", trip_id=t["id"])
        for e in exps:
            if e.get("is_settlement") or e.get("paid_by") != uid: continue
            try:
                if datetime.strptime(e.get("date","")[:10],"%Y-%m-%d") < cutoff: continue
            except: pass
            cat = e.get("category","other"); amt = e.get("amount",0)
            by_cat[cat] = by_cat.get(cat,0)+amt; total += amt
    return {"period": period, "total": round(total,2), "currency": "INR",
            "by_category": [{"category":c,"amount":round(a,2),"percent":round(a/total*100,1) if total else 0}
                             for c,a in sorted(by_cat.items(),key=lambda x:-x[1])]}

@api.get("/reminders")
async def get_reminders(current_user: dict = Depends(get_current_user)):
    return await sb_get("reminders", user_id=current_user["id"])

@api.post("/reminders")
async def create_reminder(reminder: ReminderCreate, current_user: dict = Depends(get_current_user)):
    rid = str(uuid.uuid4())
    await sb_insert("reminders", {"id": rid, "user_id": current_user["id"],
        "trip_id": reminder.trip_id, "title": reminder.title,
        "message": reminder.message, "due_date": reminder.due_date,
        "status": "active", "created_at": datetime.utcnow().isoformat()})
    return {"id": rid}

@api.delete("/reminders/{rid}")
async def delete_reminder(rid: str, current_user: dict = Depends(get_current_user)):
    await sb_delete("reminders", id=rid, user_id=current_user["id"])
    return {"message": "Deleted"}

# ══════════════════════════════════════════════════════════════════════════════
# AI REPORT
# ══════════════════════════════════════════════════════════════════════════════
@api.get("/trips/{trip_id}/ai-report")
async def ai_report(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await sb_one("trips", id=trip_id)
    if not trip: raise HTTPException(404)
    expenses = [e for e in await sb_get("expenses", trip_id=trip_id) if not e.get("is_settlement")]
    mids = trip.get("members",[])
    total = sum(e.get("amount",0) for e in expenses)
    n = max(len(mids),1); share = round(total/n,2)
    members_info = []
    for mid in mids:
        u = await sb_one("users", id=mid)
        if not u: continue
        paid = sum(e.get("amount",0) for e in expenses if e.get("paid_by")==mid)
        net  = round(paid-share,2)
        members_info.append({"name":u.get("name","?"),"paid":round(paid,2),"share":share,"net":net,
                              "insight":"Top contributor!" if paid>=total*0.5 else "Owes a share." if net<-10 else "Balanced."})
    by_cat: dict = {}
    for e in expenses:
        c=e.get("category","other"); by_cat[c]=round(by_cat.get(c,0)+e.get("amount",0),2)
    cats=[{"name":c,"amount":a,"pct":round(a/total*100) if total else 0} for c,a in sorted(by_cat.items(),key=lambda x:-x[1])]
    return {"summary":f"Total ₹{round(total)} across {len(expenses)} expenses, {n} members.",
            "members":members_info,"categories":cats,
            "recommendations":["Settle balances weekly.","Split recurring bills equally.","Review top category for savings."],
            "savings_score":min(100,max(10,100-int((total/n)/500)))}

@api.get("/trips/{trip_id}/ai/overview")
async def ai_overview(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await sb_one("trips", id=trip_id)
    if not trip: raise HTTPException(404)
    expenses = await sb_get("expenses", trip_id=trip_id)
    total = sum(e.get("amount",0) for e in expenses if not e.get("is_settlement"))
    return {"category": trip.get("split_category","trip"),
            "forecast": {"text": f"Total spend so far: ₹{total:,.0f}"}}

# ══════════════════════════════════════════════════════════════════════════════
# BUDGET / CURRENCY
# ══════════════════════════════════════════════════════════════════════════════
@api.patch("/trips/{trip_id}/budget")
async def set_budget(trip_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    data = await request.json()
    await sb_update("trips", {"budget": float(data.get("budget",0))}, id=trip_id)
    return {"budget": float(data.get("budget",0))}

@api.patch("/trips/{trip_id}/currency")
async def change_currency(trip_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    data = await request.json()
    await sb_update("trips", {"currency": data.get("currency","INR")}, id=trip_id)
    return {"message": "Currency updated"}

@api.get("/trips/{trip_id}/export/csv")
async def export_csv(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await sb_one("trips", id=trip_id)
    if not trip: raise HTTPException(404)
    expenses = await sb_get("expenses", trip_id=trip_id)
    out = io.StringIO()
    w = csv.DictWriter(out, fieldnames=["date","description","amount","currency","category","paid_by"])
    w.writeheader()
    for e in expenses:
        if not e.get("is_settlement"):
            w.writerow({k:e.get(k,"") for k in ["date","description","amount","currency","category","paid_by"]})
    out.seek(0)
    name = (trip.get("name","expenses") or "expenses").replace(" ","_")
    return StreamingResponse(iter([out.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{name}.csv"'})

@api.post("/scan-bill")
async def scan_bill(request: Request, current_user: dict = Depends(get_current_user)):
    return {"amount":500,"vendor":"Unknown","date":datetime.utcnow().strftime("%Y-%m-%d"),
            "currency":"INR","category":"food","items":[],"suggested_name":"Bill"}

# ══════════════════════════════════════════════════════════════════════════════
# STARTUP
# ══════════════════════════════════════════════════════════════════════════════

class SmartSplitReq(BaseModel):
    conversation: str

@api.post("/smart-split")
async def smart_split(req: SmartSplitReq):
    """AI expense splitting — parses natural language in any language."""
    import httpx
    ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
    if not ANTHROPIC_KEY:
        raise HTTPException(500, "AI not configured")

    system = """You are Smart Split inside Merizo, an AI expense splitting assistant.
You understand ANY language: English, Hindi, Telugu, Tamil, Kannada, Hinglish, mixed languages.

CRITICAL: Always look at the FULL conversation history. If the user gives a single number like "3" or "5",
it is answering your previous question (e.g. how many people). Use that number accordingly.

Examples:
- "i paid 5000 for lunch with four people" → total=5000, INR, people=4, done=true
- "neynu 500 pay cheysa 5 members ki" → total=500, INR, people=5, done=true (Telugu)
- "bhai 4200 ka dinner tha hum 6 the" → total=4200, INR, people=6, done=true (Hinglish)
- "2k petrol split 3 ways" → total=2000, INR, people=3, done=true
- "hotel 6000 five people" → total=6000, INR, people=5, done=true
- Previous AI asked "How many people?" → User says "3" → people=3, use last known amount

Number words: two=2, three=3, four=4, five=5, six=6, seven=7, eight=8, nine=9, ten=10
Telugu: rendu=2, moodu=3, nalugu=4, aidu=5, aaru=6
Hindi: do=2, teen=3, char=4, paanch=5, chhe=6
"2k"=2000, "1.5k"=1500, "1L"/"1 lakh"=100000

Rules:
1. done=true when you have BOTH total amount AND number of people
2. done=false: ask ONE short question (max 10 words)
3. If conversation shows AI already asked for people count and user replied with a number → use it
4. Rows: use names if given, else "Person 1", "Person 2" etc
5. Reply when done=true: "₹X each for N people ✓" (short, warm)
6. ONLY output JSON. No markdown. No extra text.

JSON: {"done":bool,"reply":"string","result":{"total":number,"currency":"INR","people":number,"description":"string","each":number,"rows":[{"name":"string","amount":number}],"tip":number|null}}"""

    try:
        gemini_key = os.environ.get("GEMINI_KEY", "")
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": system + "\n\n" + req.conversation}]}],
                    "generationConfig": {"temperature": 0.1, "maxOutputTokens": 600},
                }
            )
        data = r.json()
        text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
        # Extract JSON
        import re
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            return JSONResponse(content=json.loads(m.group()))
        return {"done": False, "reply": "Could not understand. Try again?"}
    except Exception as e:
        logger.error(f"smart-split error: {e}")
        return {"done": False, "reply": "AI unavailable. Try: '₹500 for 3 people'"}


class SmartSplitReq(BaseModel):
    conversation: str

@api.post("/smart-split")
async def smart_split(req: SmartSplitReq):
    """AI expense parser — uses Google Gemini Flash (FREE: 1M tokens/day)."""
    import httpx, os, re as re2
    key = os.environ.get("GEMINI_KEY", "")
    if not key:
        raise HTTPException(500, "GEMINI_KEY not set in environment")

    system = """You are Smart Split inside Merizo, an AI expense splitting assistant.
Understand ANY language or informal text: English, Hindi, Telugu, Tamil, Kannada, Hinglish.

Examples you MUST understand:
- "i paid 5000 usd for lunch with four people"
- "neynu 500 pay cheysa total 5 memebrs" (Telugu)
- "hotel 6000 rupees 5 log" (Hindi)
- "bhai 4200 ka dinner tha hum 6 the" (Hinglish)
- "cab 850 with ramu and priya" (3 people: me+ramu+priya)
- "2k petrol 3 ways" (2k=2000)
- user says just "3" or "5" as reply = number of people
- user says just "500" or "₹500" as reply = amount

Number understanding: 2k=2000, 1L=100000, "four"=4, "paanch"=5, "aidu"=5(Telugu)
Typos are fine: "memebrs"=members, "peple"=people, "toal"=total

Rules:
1. amount + people both known → done:true, compute each = total/people
2. missing people → ask only "How many people?"
3. missing amount → ask only "What was the total amount?"
4. done reply should be: "₹X each for N people ✓"
5. ALWAYS return valid JSON only, no markdown

Format: {"done":bool,"reply":"string","result":{"total":number,"currency":"INR","people":number,"description":"string","each":number,"rows":[{"name":"string","amount":number}],"tip":null}}"""

    try:
        prompt = system + "\n\nConversation:\n" + req.conversation + "\n\nRespond with JSON only:"
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.1, "maxOutputTokens": 600},
                }
            )
        data = r.json()
        text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
        m = re2.search(r"\{[\s\S]*\}", text)
        return {"ok": True, "data": m.group() if m else "{}"}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.on_event("startup")
async def startup():
    logger.info("Merizo API starting (Supabase backend)...")
    app.include_router(api)
    try:
        user = await sb_one("users", email=DEMO_EMAIL)
        if not user:
            uid = str(uuid.uuid4())
            await sb_insert("users", {"id":uid,"email":DEMO_EMAIL,"name":DEMO_NAME,
                "password_hash":hash_pw(DEMO_PASSWORD),"created_at":datetime.utcnow().isoformat()})
            logger.info(f"Demo user created: {DEMO_EMAIL}")
        else:
            logger.info("Demo user exists ✓")
    except Exception as e:
        logger.warning(f"Startup check failed — have you run schema.sql in Supabase? Error: {e}")
        logger.warning("API will still start. Run schema.sql then restart.")

@app.get("/")
async def root(): return {"message":"Merizo API v2 (Supabase)","status":"ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT",8000)))