from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import secrets
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import bcrypt
import jwt
import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# --- Logging ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("merizo")

# --- DB ---
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "demo@merizo.app")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "Demo@123")
DEMO_NAME = os.environ.get("DEMO_NAME", "Demo User")

# --- App ---
app = FastAPI(title="Merizo API")
api = APIRouter(prefix="/api")

bearer_scheme = HTTPBearer(auto_error=False)


# ===== Helpers =====
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    token = None
    if creds and creds.scheme.lower() == "bearer":
        token = creds.credentials
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ===== Models =====
class RegisterReq(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4)
    name: str = Field(min_length=1)


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    avatar: Optional[str] = None


class AuthResp(BaseModel):
    user: UserPublic
    token: str


class TripCreateReq(BaseModel):
    name: str
    split_category: str = "trip"
    cover_key: Optional[str] = None
    destinations: List[str] = []
    members: List[str] = []
    currency: str = "INR"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget: Optional[float] = None


class ExpenseCreateReq(BaseModel):
    name: str
    amount: float
    currency: str = "INR"
    category: str = "other"
    paid_by: str  # member id
    split_among: List[str]  # member ids
    emoji: str = "💸"


class MemberAddReq(BaseModel):
    name: str


class SettleReq(BaseModel):
    from_member: str
    to_member: str
    amount: float


# ===== FX rates (cached in MongoDB, fawazahmed0/exchange-api) =====
FX_FALLBACK = {
    "USD": 1.0, "INR": 83.0, "EUR": 0.92, "GBP": 0.79, "JPY": 149.0,
    "AUD": 1.52, "CAD": 1.36, "CHF": 0.88, "CNY": 7.25, "SGD": 1.35,
    "AED": 3.67, "THB": 35.5, "MYR": 4.75, "IDR": 15700.0, "KRW": 1370.0,
}


async def get_fx_rate(base: str, target: str) -> float:
    base = base.upper()
    target = target.upper()
    if base == target:
        return 1.0

    cache_key = f"{base}:{target}"
    now = datetime.now(timezone.utc)
    cached = await db.fx_cache.find_one({"pair": cache_key}, {"_id": 0})
    if cached:
        cached_at = cached.get("updated_at")
        if cached_at and isinstance(cached_at, datetime):
            if (now - cached_at.replace(tzinfo=timezone.utc) if cached_at.tzinfo is None else now - cached_at) < timedelta(hours=1):
                return float(cached["rate"])

    rate = None
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as http:
            url = f"https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/{base.lower()}.json"
            r = await http.get(url)
            if r.status_code == 200:
                data = r.json()
                rates = data.get(base.lower(), {})
                if target.lower() in rates:
                    rate = float(rates[target.lower()])
    except Exception as e:
        logger.warning(f"FX fetch failed: {e}")

    if rate is None:
        # static fallback via USD
        if base in FX_FALLBACK and target in FX_FALLBACK:
            rate = FX_FALLBACK[target] / FX_FALLBACK[base]
        else:
            rate = 1.0

    await db.fx_cache.update_one(
        {"pair": cache_key},
        {"$set": {"pair": cache_key, "rate": rate, "updated_at": now}},
        upsert=True,
    )
    return rate


# ===== Balance / Settlement Logic =====
def compute_balances(trip: dict) -> Dict[str, Any]:
    members = trip.get("members", [])
    expenses = trip.get("expenses", [])
    base_currency = trip.get("currency", "INR")

    paid = {m["id"]: 0.0 for m in members}
    share = {m["id"]: 0.0 for m in members}
    total = 0.0
    by_category: Dict[str, float] = {}

    for exp in expenses:
        amt = float(exp.get("amount_base", exp.get("amount", 0)))
        is_settlement = bool(exp.get("is_settlement"))
        if not is_settlement:
            total += amt
            by_category[exp.get("category", "other")] = by_category.get(exp.get("category", "other"), 0) + amt
        if exp.get("paid_by") in paid:
            paid[exp["paid_by"]] += amt
        split = exp.get("split_among") or [m["id"] for m in members]
        if not split:
            continue
        per = amt / len(split)
        for mid in split:
            if mid in share:
                share[mid] += per

    balances = []
    for m in members:
        net = round(paid.get(m["id"], 0) - share.get(m["id"], 0), 2)
        balances.append({"member_id": m["id"], "name": m["name"], "net": net,
                         "paid": round(paid.get(m["id"], 0), 2), "share": round(share.get(m["id"], 0), 2)})

    # Greedy settlement
    creditors = sorted([b for b in balances if b["net"] > 0.01], key=lambda x: -x["net"])
    debtors = sorted([b for b in balances if b["net"] < -0.01], key=lambda x: x["net"])
    creds = [{"id": b["member_id"], "name": b["name"], "amt": b["net"]} for b in creditors]
    debs = [{"id": b["member_id"], "name": b["name"], "amt": -b["net"]} for b in debtors]

    transactions = []
    i = j = 0
    while i < len(debs) and j < len(creds):
        amt = round(min(debs[i]["amt"], creds[j]["amt"]), 2)
        if amt > 0.01:
            transactions.append({
                "from_id": debs[i]["id"], "from_name": debs[i]["name"],
                "to_id": creds[j]["id"], "to_name": creds[j]["name"],
                "amount": amt, "currency": base_currency, "paid": False,
            })
        debs[i]["amt"] -= amt
        creds[j]["amt"] -= amt
        if debs[i]["amt"] < 0.01:
            i += 1
        if creds[j]["amt"] < 0.01:
            j += 1

    return {
        "balances": balances,
        "total": round(total, 2),
        "by_category": {k: round(v, 2) for k, v in by_category.items()},
        "transactions": transactions,
        "currency": base_currency,
    }


# ===== Auth Endpoints =====
@api.post("/auth/register", response_model=AuthResp)
async def register(req: RegisterReq):
    email = req.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": email,
        "name": req.name.strip(),
        "password_hash": hash_password(req.password),
        "avatar": None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user)
    token = create_token(user_id, email)
    return {"user": {"id": user_id, "email": email, "name": req.name.strip(), "avatar": None}, "token": token}


@api.post("/auth/login", response_model=AuthResp)
async def login(req: LoginReq):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"], email)
    return {"user": {"id": user["id"], "email": email, "name": user["name"], "avatar": user.get("avatar")}, "token": token}


@api.get("/auth/me", response_model=UserPublic)
async def me(user=Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"], "avatar": user.get("avatar")}


# ===== Trips =====
def serialize_trip(trip: dict, current_user_id: Optional[str] = None) -> dict:
    if not trip:
        return trip
    trip = {k: v for k, v in trip.items() if k != "_id"}
    summary = compute_balances(trip)
    trip["balances"] = summary["balances"]
    trip["per_member_paid"] = [{"member_id": b["member_id"], "name": b["name"], "paid": b["paid"]} for b in summary["balances"]]
    trip["settlement_transactions"] = summary["transactions"]
    trip["total_spent"] = summary["total"]
    trip["by_category"] = summary["by_category"]
    if current_user_id:
        # find member tied to current user (by user_id)
        my_member = next((m for m in trip.get("members", []) if m.get("user_id") == current_user_id), None)
        my_net = 0.0
        if my_member:
            bal = next((b for b in summary["balances"] if b["member_id"] == my_member["id"]), None)
            if bal:
                my_net = bal["net"]
        trip["my_net"] = round(my_net, 2)
    return trip


@api.get("/trips")
async def list_trips(user=Depends(get_current_user)):
    trips = await db.trips.find(
        {"$or": [{"owner_id": user["id"]}, {"members.user_id": user["id"]}]}
    ).sort("created_at", -1).to_list(200)
    return [serialize_trip(t, user["id"]) for t in trips]


@api.post("/trips")
async def create_trip(req: TripCreateReq, user=Depends(get_current_user)):
    trip_id = str(uuid.uuid4())
    members = []
    # owner first
    owner_member_id = str(uuid.uuid4())
    members.append({
        "id": owner_member_id,
        "name": user["name"],
        "user_id": user["id"],
        "registered": True,
    })
    for m_name in req.members:
        if m_name and m_name.strip() and m_name.strip().lower() != user["name"].lower():
            members.append({
                "id": str(uuid.uuid4()),
                "name": m_name.strip(),
                "user_id": None,
                "registered": False,
            })
    trip = {
        "id": trip_id,
        "name": req.name,
        "split_category": req.split_category,
        "cover_key": req.cover_key or req.split_category,
        "destinations": req.destinations,
        "currency": req.currency,
        "start_date": req.start_date,
        "end_date": req.end_date,
        "budget": req.budget,
        "owner_id": user["id"],
        "members": members,
        "expenses": [],
        "invite_token": secrets.token_urlsafe(12),
        "created_at": datetime.now(timezone.utc),
    }
    await db.trips.insert_one(trip)
    return serialize_trip({**trip}, user["id"])


@api.get("/trips/{trip_id}")
async def get_trip(trip_id: str, user=Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return serialize_trip(trip, user["id"])


@api.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str, user=Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.get("owner_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can delete a split")
    await db.trips.delete_one({"id": trip_id})
    return {"ok": True}


@api.post("/trips/{trip_id}/expenses")
async def add_expense(trip_id: str, req: ExpenseCreateReq, user=Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    member_ids = {m["id"] for m in trip["members"]}
    if req.paid_by not in member_ids:
        raise HTTPException(status_code=400, detail="Invalid payer")
    split_members = [m for m in req.split_among if m in member_ids]
    if not split_members:
        split_members = list(member_ids)

    base_currency = trip.get("currency", "INR")
    rate = await get_fx_rate(req.currency, base_currency)
    amount_base = round(req.amount * rate, 2)

    expense = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "amount": req.amount,
        "currency": req.currency,
        "amount_base": amount_base,
        "fx_rate": rate,
        "category": req.category,
        "emoji": req.emoji,
        "paid_by": req.paid_by,
        "split_among": split_members,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "added_by": user["id"],
    }
    await db.trips.update_one({"id": trip_id}, {"$push": {"expenses": expense}})
    trip = await db.trips.find_one({"id": trip_id})
    await invalidate_smart_limit_for_trip(trip)
    return serialize_trip(trip, user["id"])


@api.delete("/trips/{trip_id}/expenses/{expense_id}")
async def delete_expense(trip_id: str, expense_id: str, user=Depends(get_current_user)):
    res = await db.trips.update_one({"id": trip_id}, {"$pull": {"expenses": {"id": expense_id}}})
    if res.modified_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    trip = await db.trips.find_one({"id": trip_id})
    await invalidate_smart_limit_for_trip(trip)
    return serialize_trip(trip, user["id"])


@api.post("/trips/{trip_id}/members")
async def add_member(trip_id: str, req: MemberAddReq, user=Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    is_member = trip.get("owner_id") == user["id"] or any(m.get("user_id") == user["id"] for m in trip["members"])
    if not is_member:
        raise HTTPException(status_code=403, detail="You must be a member to add others")
    new_member = {
        "id": str(uuid.uuid4()),
        "name": req.name.strip(),
        "user_id": None,
        "registered": False,
    }
    await db.trips.update_one({"id": trip_id}, {"$push": {"members": new_member}})
    trip = await db.trips.find_one({"id": trip_id})
    return serialize_trip(trip, user["id"])


@api.post("/trips/{trip_id}/settle")
async def settle(trip_id: str, req: SettleReq, user=Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    settlement = {
        "id": str(uuid.uuid4()),
        "from_id": req.from_member,
        "to_id": req.to_member,
        "amount": req.amount,
        "settled_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.trips.update_one({"id": trip_id}, {"$push": {"settlements": settlement}})
    # also create a balancing expense to clear debt
    payer = req.from_member
    payee = req.to_member
    # The settlement is recorded; net is computed dynamically – we record as a "settlement expense" so balances reflect
    expense = {
        "id": str(uuid.uuid4()),
        "name": "Settlement",
        "amount": req.amount,
        "currency": trip.get("currency", "INR"),
        "amount_base": req.amount,
        "fx_rate": 1.0,
        "category": "settlement",
        "emoji": "✅",
        "paid_by": payer,
        "split_among": [payee],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "added_by": user["id"],
        "is_settlement": True,
    }
    await db.trips.update_one({"id": trip_id}, {"$push": {"expenses": expense}})
    trip = await db.trips.find_one({"id": trip_id})
    await invalidate_smart_limit_for_trip(trip)
    return serialize_trip(trip, user["id"])


@api.get("/trips/{trip_id}/settlement")
async def get_settlement(trip_id: str, user=Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return serialize_trip(trip, user["id"])


@api.get("/trips/{trip_id}/invite")
async def get_invite(trip_id: str, user=Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"token": trip.get("invite_token"), "trip_id": trip_id, "name": trip.get("name")}


@api.post("/trips/{trip_id}/invite/rotate")
async def rotate_invite(trip_id: str, user=Depends(get_current_user)):
    new_token = secrets.token_urlsafe(12)
    res = await db.trips.update_one({"id": trip_id}, {"$set": {"invite_token": new_token}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"token": new_token}


@api.get("/invite/{token}/preview")
async def invite_preview(token: str):
    trip = await db.trips.find_one({"invite_token": token}, {"_id": 0, "name": 1, "id": 1, "members": 1, "split_category": 1})
    if not trip:
        raise HTTPException(status_code=404, detail="Invalid invite")
    return {"trip_id": trip["id"], "name": trip["name"], "member_count": len(trip.get("members", [])), "split_category": trip.get("split_category")}


@api.post("/invite/{token}/join")
async def invite_join(token: str, user=Depends(get_current_user)):
    trip = await db.trips.find_one({"invite_token": token})
    if not trip:
        raise HTTPException(status_code=404, detail="Invalid invite")
    if any(m.get("user_id") == user["id"] for m in trip.get("members", [])):
        return serialize_trip(trip, user["id"])
    new_member = {
        "id": str(uuid.uuid4()),
        "name": user["name"],
        "user_id": user["id"],
        "registered": True,
    }
    await db.trips.update_one({"id": trip["id"]}, {"$push": {"members": new_member}})
    trip = await db.trips.find_one({"id": trip["id"]})
    return serialize_trip(trip, user["id"])


# ===== Insights =====
@api.get("/insights")
async def insights(period: str = "all", user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    if period == "week":
        cutoff = now - timedelta(days=7)
    elif period == "month":
        cutoff = now - timedelta(days=30)
    else:
        cutoff = None

    trips = await db.trips.find(
        {"$or": [{"owner_id": user["id"]}, {"members.user_id": user["id"]}]}
    ).to_list(500)

    total = 0.0
    by_category: Dict[str, float] = {}
    by_trip = []
    for t in trips:
        trip_total = 0.0
        for exp in t.get("expenses", []):
            if exp.get("is_settlement"):
                continue
            if cutoff:
                ts = exp.get("created_at")
                try:
                    if isinstance(ts, str):
                        ts_dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    else:
                        ts_dt = ts
                    if ts_dt and ts_dt.replace(tzinfo=timezone.utc) if ts_dt.tzinfo is None else ts_dt < cutoff:
                        continue
                except Exception:
                    pass
            amt = float(exp.get("amount_base", exp.get("amount", 0)))
            total += amt
            trip_total += amt
            cat = exp.get("category", "other")
            by_category[cat] = by_category.get(cat, 0) + amt
        by_trip.append({"trip_id": t["id"], "name": t["name"], "total": round(trip_total, 2)})

    return {
        "total": round(total, 2),
        "by_category": [{"category": k, "amount": round(v, 2), "percent": round((v / total * 100) if total > 0 else 0, 1)} for k, v in sorted(by_category.items(), key=lambda x: -x[1])],
        "by_trip": sorted(by_trip, key=lambda x: -x["total"]),
        "period": period,
        "currency": "INR",
    }


# ===== FX endpoint =====
@api.get("/fx/rate")
async def fx_endpoint(base: str, target: str):
    rate = await get_fx_rate(base, target)
    return {"base": base.upper(), "target": target.upper(), "rate": rate}


# ===== Smart Limit (AI-suggested weekly budget) =====
async def compute_smart_limit_for_user(user_id: str) -> dict:
    """Pure compute helper used by both the endpoint and the background pre-warm task."""
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    history_start = week_start - timedelta(days=28)

    trips = await db.trips.find(
        {"$or": [{"owner_id": user_id}, {"members.user_id": user_id}]}
    ).to_list(500)

    week_buckets = [0.0, 0.0, 0.0, 0.0]
    current_week_spent = 0.0

    for t in trips:
        my_member_id = next((m["id"] for m in t.get("members", []) if m.get("user_id") == user_id), None)
        if not my_member_id:
            continue
        for exp in t.get("expenses", []):
            if exp.get("is_settlement"):
                continue
            if exp.get("paid_by") != my_member_id:
                continue
            try:
                ts = exp.get("created_at")
                if isinstance(ts, str):
                    exp_dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                else:
                    exp_dt = ts
                if exp_dt and exp_dt.tzinfo is None:
                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            except Exception:
                continue
            if not exp_dt:
                continue
            amt = float(exp.get("amount_base", exp.get("amount", 0)))
            if exp_dt >= week_start:
                current_week_spent += amt
            elif exp_dt >= history_start:
                weeks_ago = int((week_start - exp_dt).total_seconds() // (7 * 86400))
                if 0 <= weeks_ago < 4:
                    week_buckets[weeks_ago] += amt

    has_history = any(b > 0 for b in week_buckets)
    avg_weekly = sum(week_buckets) / 4 if has_history else 0.0
    budget = round(avg_weekly * 1.1, 2) if has_history and avg_weekly > 0 else 5000.0
    pct = min(150, round((current_week_spent / budget) * 100, 1)) if budget > 0 else 0

    return {
        "current_week_spent": round(current_week_spent, 2),
        "weekly_budget": budget,
        "percent": pct,
        "history_weeks": [round(b, 2) for b in week_buckets],
        "currency": "INR",
        "has_history": has_history,
    }


async def invalidate_smart_limit_for_trip(trip: dict):
    """Invalidate the smart_limit_cache for every registered user that is a member of this trip."""
    try:
        user_ids = [m.get("user_id") for m in trip.get("members", []) if m.get("user_id")]
        if trip.get("owner_id") and trip["owner_id"] not in user_ids:
            user_ids.append(trip["owner_id"])
        if user_ids:
            await db.smart_limit_cache.delete_many({"user_id": {"$in": list(set(user_ids))}})
    except Exception:
        pass


_BG_TASKS: List[Any] = []


async def smart_limit_prewarm_loop():
    """Background task: every 6 hours recompute & cache smart-limit for every user.
    Runs forever in-process. The first pass also runs ~30 seconds after startup."""
    await asyncio.sleep(30)
    while True:
        try:
            users = await db.users.find({}, {"_id": 0, "id": 1}).to_list(5000)
            now = datetime.now(timezone.utc)
            for u in users:
                uid = u.get("id")
                if not uid:
                    continue
                try:
                    payload = await compute_smart_limit_for_user(uid)
                    await db.smart_limit_cache.update_one(
                        {"user_id": uid},
                        {"$set": {"user_id": uid, "payload": payload, "computed_at": now}},
                        upsert=True,
                    )
                except Exception as e:
                    logger.warning(f"Smart-limit prewarm failed for {uid}: {e}")
            logger.info(f"Smart-limit pre-warm completed for {len(users)} users.")
        except Exception as e:
            logger.exception(f"Smart-limit prewarm loop error: {e}")
        await asyncio.sleep(6 * 60 * 60)  # 6 hours


@api.get("/smart-limit")
async def smart_limit(user=Depends(get_current_user)):
    """
    Compute the user's current week spending vs an AI-suggested weekly budget.
    Reads from db.smart_limit_cache when fresh (<6h), otherwise recomputes and refreshes the cache.
    A background task (see startup) also keeps the cache warm for active users every ~6 hours.
    """
    now = datetime.now(timezone.utc)
    cached = await db.smart_limit_cache.find_one({"user_id": user["id"]}, {"_id": 0})
    if cached:
        ts = cached.get("computed_at")
        if isinstance(ts, datetime):
            ts_utc = ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
            if (now - ts_utc) < timedelta(hours=6):
                payload = cached.get("payload") or {}
                if payload:
                    return {**payload, "cache": "hit"}

    payload = await compute_smart_limit_for_user(user["id"])
    await db.smart_limit_cache.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], "payload": payload, "computed_at": now}},
        upsert=True,
    )
    return {**payload, "cache": "miss"}


# ===== Reminders =====
class ReminderCreate(BaseModel):
    title: str
    amount: Optional[float] = None
    due_date: Optional[str] = None  # ISO date
    trip_id: Optional[str] = None


@api.get("/reminders")
async def list_reminders(user=Depends(get_current_user)):
    items = await db.reminders.find(
        {"user_id": user["id"], "completed": {"$ne": True}}
    ).sort("due_date", 1).to_list(200)
    out = []
    for r in items:
        r.pop("_id", None)
        out.append(r)
    return out


@api.post("/reminders")
async def create_reminder(req: ReminderCreate, user=Depends(get_current_user)):
    r = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "title": req.title.strip(),
        "amount": req.amount,
        "due_date": req.due_date,
        "trip_id": req.trip_id,
        "completed": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db.reminders.insert_one(r)
    r.pop("_id", None)
    return r


@api.patch("/reminders/{reminder_id}/complete")
async def complete_reminder(reminder_id: str, user=Depends(get_current_user)):
    res = await db.reminders.update_one(
        {"id": reminder_id, "user_id": user["id"]},
        {"$set": {"completed": True, "completed_at": datetime.now(timezone.utc)}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"ok": True}


@api.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, user=Depends(get_current_user)):
    res = await db.reminders.delete_one({"id": reminder_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"ok": True}


# ===== Scan Bill (OpenAI vision via emergentintegrations) =====
class ScanBillReq(BaseModel):
    image_base64: str


@api.post("/scan-bill")
async def scan_bill(req: ScanBillReq, user=Depends(get_current_user)):
    img = (req.image_base64 or "").strip()
    if "," in img and img.startswith("data:"):
        img = img.split(",", 1)[1]
    if not img or len(img) < 100:
        raise HTTPException(status_code=400, detail="Image is missing or too small")

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    except Exception as e:
        logger.exception(f"emergentintegrations import failed: {e}")
        raise HTTPException(status_code=500, detail="LLM library unavailable")

    system = (
        "You are an expert receipt OCR and structured-data extractor. "
        "From a bill or receipt image, extract a single JSON object with keys: "
        "vendor (short merchant name), amount (final paid amount as a number, no currency symbol), "
        "currency (3-letter ISO code like INR, USD, EUR, GBP, JPY, AUD, CAD, AED, SGD, THB), "
        "category (one of: food, trip, home, friends, shopping, bills, other), "
        "date (YYYY-MM-DD; if not visible use today's date), "
        "suggested_name (a short 2-4 word expense name like 'Pizza dinner' or 'Hotel night'). "
        "Output ONLY the JSON object, no commentary, no markdown fences."
    )

    chat = LlmChat(
        api_key=api_key,
        session_id=f"scan-{user['id']}-{uuid.uuid4()}",
        system_message=system,
    ).with_model("openai", "gpt-4o-mini")

    msg = UserMessage(
        text="Extract the receipt data as a single JSON object only.",
        file_contents=[ImageContent(image_base64=img)],
    )

    try:
        response = await chat.send_message(msg)
    except Exception as e:
        logger.exception(f"LLM scan-bill failed: {e}")
        raise HTTPException(status_code=502, detail="Could not analyse image, please try a clearer photo")

    raw = (response or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:].strip()
    # find json substring if there is extra text
    import json as _json
    parsed: Dict[str, Any] = {}
    try:
        parsed = _json.loads(raw)
    except Exception:
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            try:
                parsed = _json.loads(raw[start : end + 1])
            except Exception:
                parsed = {}

    if not parsed or "amount" not in parsed:
        raise HTTPException(status_code=422, detail="Could not parse the receipt. Try a clearer photo.")

    valid_cats = {"food", "trip", "home", "friends", "shopping", "bills", "other"}
    cat = str(parsed.get("category", "other")).lower()
    if cat not in valid_cats:
        cat = "other"

    try:
        amount_val = float(parsed.get("amount") or 0)
    except Exception:
        amount_val = 0.0

    return {
        "vendor": str(parsed.get("vendor") or "").strip()[:80],
        "amount": amount_val,
        "currency": str(parsed.get("currency") or "INR").upper()[:3],
        "category": cat,
        "date": str(parsed.get("date") or datetime.now(timezone.utc).date().isoformat()),
        "suggested_name": str(parsed.get("suggested_name") or parsed.get("vendor") or "Bill").strip()[:60],
    }


@api.get("/")
async def root():
    return {"app": "Merizo", "version": "1.0", "ok": True}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== Demo Seed =====
DEMO_SPLITS = [
    {
        "name": "Goa Trip",
        "split_category": "trip",
        "cover_key": "goa",
        "destinations": ["goa"],
        "currency": "INR",
        "start_date": "2026-01-12",
        "end_date": "2026-01-16",
        "budget": 30000.0,
        "members": ["Aman", "Riya"],
        "expenses": [
            {"name": "Flights to Goa", "amount": 12000, "category": "trip", "emoji": "✈️", "paid_by_name": "Demo User", "split_among_names": ["Demo User", "Aman", "Riya"], "days_ago": 18},
            {"name": "Beach Resort 2 nights", "amount": 8400, "category": "home", "emoji": "🏠", "paid_by_name": "Aman", "split_among_names": ["Demo User", "Aman", "Riya"], "days_ago": 11},
            {"name": "Seafood dinner", "amount": 3600, "category": "food", "emoji": "🍽️", "paid_by_name": "Riya", "split_among_names": ["Demo User", "Aman", "Riya"], "days_ago": 4},
            {"name": "Scuba diving", "amount": 4500, "category": "friends", "emoji": "🎉", "paid_by_name": "Demo User", "split_among_names": ["Demo User", "Aman", "Riya"], "days_ago": 2},
            {"name": "Cabs around Goa", "amount": 2100, "category": "trip", "emoji": "🚗", "paid_by_name": "Aman", "split_among_names": ["Demo User", "Aman", "Riya"], "days_ago": 25},
        ],
    },
    {
        "name": "Manali Trip",
        "split_category": "trip",
        "cover_key": "manali",
        "destinations": ["manali"],
        "currency": "INR",
        "start_date": "2026-02-04",
        "end_date": "2026-02-08",
        "budget": 22000.0,
        "members": ["Karan"],
        "expenses": [
            {"name": "Volvo bus", "amount": 3200, "category": "trip", "emoji": "🚌", "paid_by_name": "Demo User", "split_among_names": ["Demo User", "Karan"], "days_ago": 20},
            {"name": "Cottage stay", "amount": 6800, "category": "home", "emoji": "🏠", "paid_by_name": "Karan", "split_among_names": ["Demo User", "Karan"], "days_ago": 14},
            {"name": "Snow trek + gear", "amount": 4400, "category": "friends", "emoji": "⛷️", "paid_by_name": "Demo User", "split_among_names": ["Demo User", "Karan"], "days_ago": 8},
        ],
    },
    {
        "name": "College Buddies",
        "split_category": "friends",
        "cover_key": "friends",
        "destinations": [],
        "currency": "INR",
        "budget": 8000.0,
        "members": ["Neha", "Vikram", "Sana"],
        "expenses": [
            {"name": "Pizza night", "amount": 2400, "category": "food", "emoji": "🍕", "paid_by_name": "Neha", "split_among_names": ["Demo User", "Neha", "Vikram", "Sana"], "days_ago": 6},
            {"name": "Movie tickets", "amount": 1600, "category": "friends", "emoji": "🎬", "paid_by_name": "Demo User", "split_among_names": ["Demo User", "Neha", "Vikram", "Sana"], "days_ago": 13},
        ],
    },
]


async def seed_demo():
    existing = await db.users.find_one({"email": DEMO_EMAIL})
    if existing:
        # Make sure the password is up to date and existing trips are intact
        if not verify_password(DEMO_PASSWORD, existing["password_hash"]):
            await db.users.update_one(
                {"email": DEMO_EMAIL},
                {"$set": {"password_hash": hash_password(DEMO_PASSWORD), "name": DEMO_NAME}},
            )
        # Don't reseed trips if user already has them
        existing_trip_count = await db.trips.count_documents({"owner_id": existing["id"]})
        if existing_trip_count > 0:
            logger.info(f"Demo user already exists with {existing_trip_count} trips. Skipping seed.")
            return
        user_id = existing["id"]
    else:
        user_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": user_id,
            "email": DEMO_EMAIL,
            "name": DEMO_NAME,
            "password_hash": hash_password(DEMO_PASSWORD),
            "avatar": None,
            "created_at": datetime.now(timezone.utc),
        })

    for idx, spec in enumerate(DEMO_SPLITS):
        trip_id = str(uuid.uuid4())
        owner_member_id = str(uuid.uuid4())
        members = [{"id": owner_member_id, "name": DEMO_NAME, "user_id": user_id, "registered": True}]
        name_to_id = {DEMO_NAME: owner_member_id}
        for nm in spec["members"]:
            mid = str(uuid.uuid4())
            members.append({"id": mid, "name": nm, "user_id": None, "registered": False})
            name_to_id[nm] = mid

        expenses = []
        for i, e in enumerate(spec["expenses"]):
            # Use explicit days_ago from the spec when present so smart-limit
            # has a realistic mix of current-week and historical activity.
            days_ago = e.get("days_ago", i * 6 + idx * 2 + 1)
            exp = {
                "id": str(uuid.uuid4()),
                "name": e["name"],
                "amount": e["amount"],
                "currency": spec["currency"],
                "amount_base": e["amount"],
                "fx_rate": 1.0,
                "category": e["category"],
                "emoji": e["emoji"],
                "paid_by": name_to_id[e["paid_by_name"]],
                "split_among": [name_to_id[n] for n in e["split_among_names"]],
                "created_at": (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat(),
                "added_by": user_id,
            }
            expenses.append(exp)

        trip = {
            "id": trip_id,
            "name": spec["name"],
            "split_category": spec["split_category"],
            "cover_key": spec["cover_key"],
            "destinations": spec["destinations"],
            "currency": spec["currency"],
            "start_date": spec.get("start_date"),
            "end_date": spec.get("end_date"),
            "budget": spec.get("budget"),
            "owner_id": user_id,
            "members": members,
            "expenses": expenses,
            "invite_token": secrets.token_urlsafe(12),
            "created_at": datetime.now(timezone.utc),
        }
        await db.trips.insert_one(trip)
    logger.info(f"Seeded demo user with {len(DEMO_SPLITS)} splits.")


async def seed_demo_reminders():
    user = await db.users.find_one({"email": DEMO_EMAIL})
    if not user:
        return
    existing = await db.reminders.count_documents({"user_id": user["id"]})
    if existing > 0:
        return
    now = datetime.now(timezone.utc)
    samples = [
        {"title": "Pay Aman for Goa flights", "amount": 4000, "days": 2},
        {"title": "Settle Karan for Manali stay", "amount": 3400, "days": 5},
        {"title": "Collect from Neha for pizza", "amount": 600, "days": 7},
    ]
    for s in samples:
        await db.reminders.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "title": s["title"],
            "amount": s["amount"],
            "due_date": (now + timedelta(days=s["days"])).date().isoformat(),
            "trip_id": None,
            "completed": False,
            "created_at": now,
        })
    logger.info(f"Seeded {len(samples)} demo reminders.")


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.trips.create_index("id", unique=True)
        await db.trips.create_index("invite_token")
        await db.fx_cache.create_index("pair", unique=True)
        await db.reminders.create_index("user_id")
        await db.smart_limit_cache.create_index("user_id", unique=True)
        await seed_demo()
        await seed_demo_reminders()
        # Start background pre-warm loop (in-process). It won't run during pytest because that lifecycle
        # uses a different event loop, but sub-second start-up cost in production.
        try:
            task = asyncio.create_task(smart_limit_prewarm_loop())
            _BG_TASKS.append(task)
        except Exception as e:
            logger.warning(f"Could not start smart-limit prewarm task: {e}")
    except Exception as e:
        logger.exception(f"Startup error: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
