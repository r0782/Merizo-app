from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import json, uuid, json, logging, secrets, asyncio, hashlib, base64, random, string, csv, io, time
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import bcrypt, jwt, httpx
import dns.resolver
from core.security import (
    check_rate_limit, check_account_locked, record_failed_login,
    clear_failed_attempts, validate_email, validate_password,
    sanitize_name, sanitize_string, register_session,
    invalidate_all_sessions, require_owner, audit, get_client_ip,
    check_permission
)
from fastapi.responses import JSONResponse
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from ai.router import router as ai_router
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
# Web origin used to build shareable invite links (QR codes, share sheet). Same
# default host as CORS/BACKEND_URL below, overridable per environment.
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://merizo-app.onrender.com").rstrip("/")

def hash_pw(pw): return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
def verify_pw(pw, h):
    try: return bcrypt.checkpw(pw.encode(), h.encode())
    except: return False

def create_token(uid, email):
    return jwt.encode({"sub": uid, "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)},
        JWT_SECRET, algorithm=JWT_ALGORITHM)

FAST2SMS_KEY     = os.getenv("FAST2SMS_API_KEY", "")
MAILBOXLAYER_KEY = os.getenv("MAILBOXLAYER_KEY", "")
GOOGLE_API_KEY   = os.getenv("GOOGLE_API_KEY", "")  # reserved for future Google Cloud API use

# ── SMTP (email OTP for registration + account deletion) ─────────────────────
SMTP_HOST     = os.getenv("SMTP_HOST", "")
SMTP_PORT     = int(os.getenv("SMTP_PORT") or 587)
SMTP_USER     = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
EMAIL_FROM    = os.getenv("EMAIL_FROM", SMTP_USER)

def _send_email_sync(to_email: str, subject: str, body: str) -> bool:
    if not (SMTP_HOST and SMTP_USER and SMTP_PASSWORD):
        return False
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = EMAIL_FROM
    msg["To"] = to_email
    try:
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as s:
                s.login(SMTP_USER, SMTP_PASSWORD)
                s.sendmail(EMAIL_FROM, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as s:
                s.starttls()
                s.login(SMTP_USER, SMTP_PASSWORD)
                s.sendmail(EMAIL_FROM, [to_email], msg.as_string())
        return True
    except Exception as e:
        logger.warning(f"SMTP send failed for ***{to_email[-12:]}: {e}")
        return False

async def send_email(to_email: str, subject: str, body: str) -> bool:
    return await asyncio.to_thread(_send_email_sync, to_email, subject, body)

# ── Email OTP (registration verification + account deletion) ─────────────────
email_otp_store: dict = {}        # "{purpose}:{email}" → {code, expires, attempts}
_email_otp_send_log: dict = {}    # email → [send_timestamps]  (per-email rate limit)

EMAIL_OTP_TTL_MINUTES   = 10
MAX_EMAIL_OTP_PER_HOUR  = 5

EMAIL_OTP_SUBJECTS = {
    "register": "Verify your Merizo account",
    "delete":   "Confirm your Merizo account deletion",
}
EMAIL_OTP_BODIES = {
    "register": "Your Merizo verification code is {code}. It expires in 10 minutes.\n\n"
                 "If you didn't create a Merizo account, you can ignore this email.",
    "delete":   "Your Merizo account deletion code is {code}. It expires in 10 minutes.\n\n"
                 "Enter this code in the app to permanently delete your account. "
                 "If you didn't request this, ignore this email and your account will stay safe.",
}

async def _issue_email_otp(email: str, purpose: str):
    """Generate, store, and email a 6-digit OTP for the given purpose ('register' | 'delete')."""
    now = time.time()
    _email_otp_send_log[email] = [t for t in _email_otp_send_log.get(email, []) if now - t < 3600]
    if len(_email_otp_send_log[email]) >= MAX_EMAIL_OTP_PER_HOUR:
        raise HTTPException(429, "Too many verification emails sent. Please try again in a while.")
    _email_otp_send_log[email].append(now)

    code = "".join(random.choices(string.digits, k=6))
    email_otp_store[f"{purpose}:{email}"] = {
        "code": code,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=EMAIL_OTP_TTL_MINUTES),
        "attempts": 0,
    }
    sent = await send_email(email, EMAIL_OTP_SUBJECTS[purpose], EMAIL_OTP_BODIES[purpose].format(code=code))
    if not sent:
        # Dev / SMTP-not-configured fallback — never log raw codes in production without masking
        logger.info(f"Email OTP ({purpose}) for ***{email[-12:]}: {code}")

def _verify_email_otp(email: str, purpose: str, otp: str):
    key = f"{purpose}:{email}"
    entry = email_otp_store.get(key)
    if not entry:
        raise HTTPException(400, "Code not found or already used — please request a new one")
    if datetime.now(timezone.utc) > entry["expires"]:
        email_otp_store.pop(key, None)
        raise HTTPException(400, "Code expired — please request a new one")
    entry["attempts"] += 1
    if entry["attempts"] > 3:
        email_otp_store.pop(key, None)
        raise HTTPException(400, "Too many incorrect attempts — please request a new code")
    if entry["code"] != otp:
        remaining = 3 - entry["attempts"] + 1
        raise HTTPException(400, f"Invalid code — {max(remaining, 0)} attempt{'s' if remaining != 1 else ''} remaining")
    email_otp_store.pop(key, None)   # consumed — single use

async def check_email_deliverable(email: str):
    """Reject disposable or undeliverable addresses via Mailboxlayer."""
    if not MAILBOXLAYER_KEY:
        return  # key not configured — skip, regex already validated format
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            r = await client.get(
                "https://apilayer.net/api/check",
                params={"access_key": MAILBOXLAYER_KEY, "email": email, "smtp": "1", "format": "1"},
            )
            data = r.json()
        if not data.get("format_valid", True):
            raise HTTPException(422, "Invalid email format")
        if data.get("disposable", False):
            raise HTTPException(422, "Disposable email addresses are not allowed")
    except HTTPException:
        raise
    except Exception:
        pass  # network error — fail open so registration still works

# Google doesn't expose an API-key-only endpoint that verifies an arbitrary
# email address (Gmail API is per-mailbox and needs that user's OAuth
# consent). A real, free, standard way to verify an address is actually
# routed through Google's mail servers is a DNS MX-record lookup — no key
# needed. This also catches typo'd/nonexistent domains for every provider.
_GOOGLE_MX_SUFFIXES = ("google.com", "googlemail.com")

def _resolve_mx_sync(domain: str):
    """Returns (mx_hosts, conclusive). conclusive=False means the DNS lookup
    itself failed (network/resolver issue) — caller should fail open then."""
    try:
        answers = dns.resolver.resolve(domain, "MX", lifetime=5)
        return [str(r.exchange).rstrip(".").lower() for r in answers], True
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
        return [], True
    except Exception:
        return [], False

async def verify_email_domain(email: str):
    """Reject addresses whose domain can't receive mail, and for
    gmail.com/googlemail.com specifically confirm the MX records really
    point at Google's mail servers (catches spoofed/lookalike domains)."""
    domain = email.rsplit("@", 1)[-1].lower()
    mx_hosts, conclusive = await asyncio.to_thread(_resolve_mx_sync, domain)
    if not conclusive:
        return  # DNS itself failed — fail open, don't block registration
    if not mx_hosts:
        raise HTTPException(422, "This email domain can't receive mail — check for a typo")
    if domain in ("gmail.com", "googlemail.com") and not any(h.endswith(_GOOGLE_MX_SUFFIXES) for h in mx_hosts):
        raise HTTPException(422, "This doesn't look like a real Gmail address")

app = FastAPI(title="Merizo API")
api = APIRouter(prefix="/api")
bearer_scheme = HTTPBearer(auto_error=False)
otp_store: dict = {}           # phone → {code, expires, attempts}
_otp_send_log: dict = {}       # phone → [send_timestamps]  (per-phone rate limit)

app.add_middleware(CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_origin_regex=r"http://localhost:\d+",   # any localhost port (Expo web, dev servers)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
class VerifyRegisterOTPRequest(BaseModel): email: str; otp: str
class ResendRegisterOTPRequest(BaseModel): email: str
class ConfirmDeleteRequest(BaseModel): otp: str
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
        "created_at": datetime.now(timezone.utc).isoformat()})
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

    # Supabase reports which provider authenticated this user (e.g. "google",
    # "email" for OTP magic-link/code, "phone"). Falls back sensibly if absent.
    app_meta = getattr(sb_user, "app_metadata", None) or {}
    provider = app_meta.get("provider") or ("phone" if (sb_user.phone or req.phone) else "email")

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
                "email_verified": True,   # Supabase already verified this identity
                "auth_provider": provider,
                "created_at": datetime.now(timezone.utc).isoformat(),
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
                "email_verified": True,
                "auth_provider": provider,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            user = await sb_one("users", phone=ph)

    if not user:
        raise HTTPException(500, "Could not create user")

    # An existing password account (possibly still unverified) that just proved
    # ownership of the same email via Supabase — reflect that: mark it verified
    # and record the provider so the account shows both password + social login.
    if user.get("email_verified") is False or user.get("auth_provider") != provider:
        await sb_update("users", {"email_verified": True, "auth_provider": provider}, id=user["id"])
        user["email_verified"] = True
        user["auth_provider"] = provider

    token = create_token(user["id"], user.get("email", ""))
    return {
        "token": token,
        "user": {
            "id":    user["id"],
            "name":  user.get("name",""),
            "email": user.get("email",""),
        }
    }

@api.post("/auth/login")
async def login(req: LoginRequest, request: Request):
    client_ip = get_client_ip(request)
    check_rate_limit(client_ip, "login")

    email = validate_email(req.email)
    check_account_locked(email)

    user = await sb_one("users", email=email)
    if not user or not verify_pw(req.password, user.get("password_hash", "")):
        record_failed_login(email, client_ip)
        raise HTTPException(401, "Invalid email or password")

    # Accounts created before email verification existed (or via Google/OTP
    # sign-in) have no email_verified field — treat missing/True as verified.
    if user.get("email_verified") is False:
        raise HTTPException(403, {
            "code": "EMAIL_NOT_VERIFIED",
            "message": "Please verify your email before signing in.",
            "email": email,
        })

    clear_failed_attempts(email)
    token = create_token(user["id"], user["email"])
    register_session(user["id"], token)
    return {"access_token": token, "token_type": "bearer",
            "user": {k: user[k] for k in ("id", "email", "name") if k in user}}

@api.post("/auth/register")
async def register(req: RegisterRequest, request: Request):
    """Create the account, then email a 6-digit code that must be verified
    (see /auth/verify-register-otp) before the account can sign in."""
    client_ip = get_client_ip(request)
    check_rate_limit(client_ip, "register")

    email    = validate_email(req.email)
    validate_password(req.password)
    name     = sanitize_name(req.name)

    await check_email_deliverable(email)
    await verify_email_domain(email)

    existing = await sb_one("users", email=email)
    if existing:
        if existing.get("email_verified") is not False:
            raise HTTPException(400, "Email already registered")
        # Unverified account from an earlier attempt — refresh it and resend the code
        await sb_update("users", {"name": name, "password_hash": hash_pw(req.password)}, id=existing["id"])
    else:
        uid = str(uuid.uuid4())
        doc = {"id": uid, "email": email, "name": name,
               "password_hash": hash_pw(req.password), "email_verified": False,
               "created_at": datetime.now(timezone.utc).isoformat()}
        await sb_insert("users", doc)

    await _issue_email_otp(email, "register")
    audit("REGISTER_OTP_SENT", email=email, ip=client_ip)
    return {"pending_verification": True, "email": email,
            "message": "We've sent a 6-digit verification code to your email."}

@api.post("/auth/verify-register-otp")
async def verify_register_otp(req: VerifyRegisterOTPRequest, request: Request):
    client_ip = get_client_ip(request)
    check_rate_limit(client_ip, "verify-register-otp")

    email = validate_email(req.email)
    _verify_email_otp(email, "register", req.otp.strip())

    user = await sb_one("users", email=email)
    if not user:
        raise HTTPException(400, "Account not found — please register again")

    await sb_update("users", {"email_verified": True}, id=user["id"])
    clear_failed_attempts(email)
    token = create_token(user["id"], user["email"])
    register_session(user["id"], token)
    audit("EMAIL_VERIFIED", user_id=user["id"], email=email, ip=client_ip)
    return {"access_token": token, "token_type": "bearer",
            "user": {"id": user["id"], "email": user["email"], "name": user.get("name", "")}}

@api.post("/auth/resend-register-otp")
async def resend_register_otp(req: ResendRegisterOTPRequest, request: Request):
    client_ip = get_client_ip(request)
    check_rate_limit(client_ip, "resend-register-otp")

    email = validate_email(req.email)
    user = await sb_one("users", email=email)
    if not user:
        raise HTTPException(404, "Account not found")
    if user.get("email_verified") is not False:
        raise HTTPException(400, "This email is already verified — please sign in")

    await _issue_email_otp(email, "register")
    return {"message": "Verification code resent"}

@api.post("/auth/demo-login")
async def demo_login(request: Request):
    check_rate_limit(get_client_ip(request), "demo-login")
    user = await sb_one("users", email=DEMO_EMAIL)
    if not user:
        uid  = str(uuid.uuid4())
        user = {"id": uid, "email": DEMO_EMAIL, "name": DEMO_NAME,
                "password_hash": hash_pw(DEMO_PASSWORD),
                "created_at": datetime.now(timezone.utc).isoformat()}
        await sb_insert("users", user)
    token = create_token(user["id"], user["email"])
    return {"access_token": token, "token_type": "bearer",
            "user": {k: user.get(k) for k in ("id", "email", "name")}}

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

@api.post("/auth/account/request-delete-otp")
async def request_delete_otp(request: Request, current_user: dict = Depends(get_current_user)):
    """Email a 6-digit code to the signed-in user's own address to confirm account deletion."""
    client_ip = get_client_ip(request)
    check_rate_limit(client_ip, "delete-otp")
    email = current_user["email"]
    await _issue_email_otp(email, "delete")
    audit("DELETE_OTP_SENT", user_id=current_user["id"], email=email, ip=client_ip)
    return {"message": "We've sent a 6-digit confirmation code to your email."}

@api.post("/auth/account/confirm-delete")
async def confirm_delete_account(req: ConfirmDeleteRequest, request: Request,
                                  current_user: dict = Depends(get_current_user)):
    """Verify the emailed code, then permanently delete the signed-in user's account."""
    client_ip = get_client_ip(request)
    check_rate_limit(client_ip, "verify-delete-otp")
    email = current_user["email"]
    _verify_email_otp(email, "delete", req.otp.strip())

    await sb_delete("users", id=current_user["id"])
    invalidate_all_sessions(current_user["id"])
    audit("ACCOUNT_DELETED", user_id=current_user["id"], email=email, ip=client_ip)
    return {"message": "Your account has been permanently deleted."}

# OTP endpoints
@app.post("/api/auth/send-otp")
async def send_otp(request: Request):
    client_ip = get_client_ip(request)
    check_rate_limit(client_ip, "send-otp")   # 10 requests / 15 min per IP

    data = await request.json()
    phone = data.get("phone", "").strip()
    if not phone or not phone.isdigit() or len(phone) != 10:
        raise HTTPException(400, "Invalid phone number — must be 10 digits")

    # Per-phone rate limit: max 3 OTPs per hour (prevents OTP bombing a victim's number)
    now = time.time()
    _otp_send_log[phone] = [t for t in _otp_send_log.get(phone, []) if now - t < 3600]
    if len(_otp_send_log[phone]) >= 3:
        raise HTTPException(429, "Too many OTP requests for this number. Please try again in an hour.")
    _otp_send_log[phone].append(now)

    code = "".join(random.choices(string.digits, k=6))
    otp_store[phone] = {
        "code": code,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=10),
        "attempts": 0,
    }

    # Send via Fast2SMS
    sms_sent = False
    if FAST2SMS_KEY:
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                r = await client.post(
                    "https://www.fast2sms.com/dev/bulkV2",
                    headers={"authorization": FAST2SMS_KEY},
                    json={"route": "otp", "variables_values": code, "flash": "0", "numbers": phone},
                )
                sms_sent = r.json().get("return", False)
                if not sms_sent:
                    logger.warning(f"Fast2SMS rejected: {r.text}")
        except Exception as e:
            logger.warning(f"Fast2SMS error: {e}")

    if not sms_sent:
        # Dev / fallback — never log raw codes in production without masking
        logger.info(f"OTP (SMS failed) for ***{phone[-4:]}: {code}")

    return {"success": True, "message": "OTP sent"}


@app.post("/api/auth/verify-otp")
async def verify_otp(request: Request):
    client_ip = get_client_ip(request)
    check_rate_limit(client_ip, "verify-otp")   # 10 requests / 15 min per IP

    data = await request.json()
    phone = data.get("phone", "").strip()
    otp   = data.get("otp",   "").strip()

    entry = otp_store.get(phone)
    if not entry:
        raise HTTPException(400, "OTP not found or already used — please request a new one")

    if datetime.now(timezone.utc) > entry["expires"]:
        otp_store.pop(phone, None)
        raise HTTPException(400, "OTP expired — please request a new one")

    # Increment attempts before checking (prevents timing-based enumeration)
    entry["attempts"] += 1
    if entry["attempts"] > 3:
        otp_store.pop(phone, None)
        raise HTTPException(400, "Too many incorrect attempts — please request a new OTP")

    if entry["code"] != otp:
        remaining = 3 - entry["attempts"] + 1
        raise HTTPException(400, f"Invalid OTP — {max(remaining, 0)} attempt{'s' if remaining != 1 else ''} remaining")

    otp_store.pop(phone, None)   # consumed — single use

    user = await sb_one("users", phone=phone)
    if not user:
        uid  = str(uuid.uuid4())
        user = {
            "id": uid, "phone": phone,
            "email": f"user_{phone[-4:]}@merizo.app",
            "name":  f"User {phone[-4:]}",
            "password_hash": hash_pw(secrets.token_hex(16)),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await sb_insert("users", user)

    return {
        "access_token": create_token(user["id"], user.get("email", "")),
        "token_type": "bearer",
        "user": {k: user.get(k) for k in ("id", "name", "email")},
    }

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
    trip_name = sanitize_string(trip.name, max_len=100)
    trip_desc = sanitize_string(trip.description or "", max_len=500) or None
    doc = {"id": tid, "name": trip_name, "description": trip_desc,
           "currency": trip.currency, "split_category": trip.split_category or trip.category or "trip",
           "start_date": trip.start_date, "end_date": trip.end_date, "due_date": trip.due_date,
           "cover_key": trip.cover_key, "members": resolved, "owner_id": current_user["id"],
           "invite_token": secrets.token_urlsafe(12), "created_at": datetime.now(timezone.utc).isoformat()}
    await sb_insert("trips", doc)
    return {"id": tid, "message": "Trip created"}

@api.get("/trips")
async def get_trips(current_user: dict = Depends(get_current_user)):
    raw = await sb_get("trips", _contains={"members": current_user["id"]})
    # Fetch all trip summaries concurrently instead of one-by-one — each
    # summary needs 2 Supabase round trips, so this turns N sequential
    # calls into a single parallel batch.
    result = await asyncio.gather(*[
        compute_trip_summary(t, current_user["id"]) for t in raw
    ])
    return list(result)

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

# ── Invite links (QR / shareable) — backed by trip_invites table ──────────────
INVITE_DEFAULT_TTL_DAYS = 7

class InviteRegenerateRequest(BaseModel):
    ttl_days: Optional[int] = INVITE_DEFAULT_TTL_DAYS   # None/0 = no expiry

def _invite_status(invite: dict) -> str:
    """Resolve effective status: active | expired | revoked | exhausted."""
    if invite.get("status") == "revoked":
        return "revoked"
    exp = invite.get("expires_at")
    if exp and datetime.fromisoformat(exp.replace("Z", "+00:00")) < datetime.now(timezone.utc):
        return "expired"
    max_uses = invite.get("max_uses")
    if max_uses is not None and invite.get("usage_count", 0) >= max_uses:
        return "exhausted"
    return "active"

async def _get_active_invite(trip_id: str) -> Optional[dict]:
    rows = await sb_get("trip_invites", trip_id=trip_id, status="active")
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    for r in rows:
        if _invite_status(r) == "active":
            return r
    return None

async def _create_invite(trip_id: str, user_id: str, ttl_days: Optional[int] = INVITE_DEFAULT_TTL_DAYS) -> dict:
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()), "trip_id": trip_id, "token": secrets.token_urlsafe(12),
        "created_by": user_id, "created_at": now.isoformat(),
        "expires_at": (now + timedelta(days=ttl_days)).isoformat() if ttl_days else None,
        "status": "active", "usage_count": 0, "max_uses": None,
    }
    return await sb_insert("trip_invites", doc)

def _invite_response(invite: dict, trip_name: str) -> dict:
    return {
        "token": invite["token"], "trip_name": trip_name,
        "expires_at": invite.get("expires_at"),
        "usage_count": invite.get("usage_count", 0),
        "max_uses": invite.get("max_uses"),
        "join_url": f"{FRONTEND_URL}/join/{invite['token']}",
    }

async def _perform_join(token: str, current_user: dict, ip: str) -> dict:
    check_rate_limit(ip, "join-trip")
    invite = await sb_one("trip_invites", token=token)
    if not invite:
        raise HTTPException(404, "Invalid invite link")
    st = _invite_status(invite)
    if st == "expired":
        raise HTTPException(410, "This invite link has expired")
    if st in ("revoked", "exhausted"):
        raise HTTPException(409, "This invite link is no longer available")
    trip = await sb_one("trips", id=invite["trip_id"])
    if not trip:
        raise HTTPException(404, "Trip not found")
    if current_user["id"] in (trip.get("members") or []):
        return {"message": "You're already a member of this group", "trip_id": trip["id"],
                "trip_name": trip["name"], "already_member": True}
    members = list(trip.get("members") or [])
    members.append(current_user["id"])
    await sb_update("trips", {"members": members}, id=trip["id"])
    await sb_update("trip_invites", {"usage_count": invite.get("usage_count", 0) + 1}, id=invite["id"])
    audit("TRIP_JOINED", user_id=current_user["id"], ip=ip, detail=f"trip={trip['id']}")
    return {"message": "Joined successfully", "trip_id": trip["id"], "trip_name": trip["name"]}

@api.get("/trips/{trip_id}/invite")
async def get_invite(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await sb_one("trips", id=trip_id)
    if not trip or current_user["id"] not in (trip.get("members") or []):
        raise HTTPException(404, "Trip not found")
    invite = await _get_active_invite(trip_id) or await _create_invite(trip_id, current_user["id"])
    return _invite_response(invite, trip["name"])

@api.post("/trips/{trip_id}/invite/regenerate")
async def regenerate_invite(trip_id: str, body: InviteRegenerateRequest,
                             current_user: dict = Depends(get_current_user)):
    """Revoke any existing link and issue a fresh one — e.g. if a QR was shared too widely."""
    trip = await sb_one("trips", id=trip_id)
    if not trip or current_user["id"] not in (trip.get("members") or []):
        raise HTTPException(404, "Trip not found")
    old = await _get_active_invite(trip_id)
    if old:
        await sb_update("trip_invites", {"status": "revoked"}, id=old["id"])
    invite = await _create_invite(trip_id, current_user["id"], ttl_days=body.ttl_days)
    audit("INVITE_REGENERATED", user_id=current_user["id"], detail=f"trip={trip_id}")
    return _invite_response(invite, trip["name"])

@api.post("/trips/{trip_id}/invite/revoke")
async def revoke_invite(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Turn off the invite link entirely — owner only."""
    trip = await sb_one("trips", id=trip_id)
    if not trip: raise HTTPException(404, "Trip not found")
    if trip.get("owner_id") != current_user["id"]:
        raise HTTPException(403, "Only the trip owner can revoke the invite link")
    invite = await _get_active_invite(trip_id)
    if invite:
        await sb_update("trip_invites", {"status": "revoked"}, id=invite["id"])
    audit("INVITE_REVOKED", user_id=current_user["id"], detail=f"trip={trip_id}")
    return {"message": "Invite link revoked"}

@api.post("/trips/{trip_id}/join")
async def join_trip(trip_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Legacy path: trip_id + token in body. Delegates to the same token validation as /invite/{token}/join."""
    data = await request.json()
    result = await _perform_join(data.get("token", ""), current_user, get_client_ip(request))
    if result.get("trip_id") != trip_id:
        raise HTTPException(404, "Invalid invite link")
    return result

@api.get("/invite/{token}")
async def get_invite_by_token(token: str):
    """Public — look up trip by invite token so a guest can preview it before logging in."""
    invite = await sb_one("trip_invites", token=token)
    if not invite:
        raise HTTPException(404, "Invalid invite link")
    st = _invite_status(invite)
    if st == "expired":
        raise HTTPException(410, "This invite link has expired")
    if st in ("revoked", "exhausted"):
        raise HTTPException(409, "This invite link is no longer available")
    trip = await sb_one("trips", id=invite["trip_id"])
    if not trip:
        raise HTTPException(404, "Trip not found")
    inviter = await sb_one("users", id=invite.get("created_by")) if invite.get("created_by") else None
    return {
        "trip_id": trip["id"],
        "trip_name": trip["name"],
        "member_count": len(trip.get("members") or []),
        "currency": trip.get("currency", "INR"),
        "invited_by": (inviter or {}).get("name"),
    }

@api.post("/invite/{token}/join")
async def join_by_token(token: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Authenticated — join a trip using only its invite token (QR / deep-link path)."""
    return await _perform_join(token, current_user, get_client_ip(request))

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
    existing = trip.get("members") or []
    # Must be a member of the group to manage it
    if current_user["id"] not in existing:
        raise HTTPException(403, "Not a member of this group")
    # Cannot remove yourself — use Leave Group instead
    if member_id == current_user["id"]:
        raise HTTPException(400, "Cannot remove yourself. Use Leave Group instead.")
    members = [m for m in existing if m != member_id]
    await sb_update("trips", {"members": members}, id=trip_id)
    return {"message": "Removed"}

@api.patch("/trips/{trip_id}")
async def update_trip(trip_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    trip = await sb_one("trips", id=trip_id)
    if not trip or current_user["id"] not in (trip.get("members") or []):
        raise HTTPException(404, "Trip not found")
    data = await request.json()
    updates: dict = {}
    if "name" in data:
        updates["name"] = sanitize_string(str(data["name"]), max_len=100)
    if "description" in data:
        updates["description"] = sanitize_string(str(data.get("description") or ""), max_len=500) or None
    if "currency" in data:
        updates["currency"] = str(data["currency"])[:10]
    if not updates:
        raise HTTPException(400, "No valid fields to update")
    await sb_update("trips", updates, id=trip_id)
    return {"message": "Updated", "id": trip_id, **updates}

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
RECURRING_MIN_DAYS = 25

async def _detect_recurring(trip_id: str, name: str, category: str) -> Optional[dict]:
    """
    If a HOME-category expense with the same name was logged >25 days ago in
    this trip, surface it so the frontend can offer a monthly reminder.
    """
    if category != "home":
        return None
    existing = await sb_get("expenses", trip_id=trip_id)
    matches = [
        e for e in existing
        if not e.get("is_settlement") and (e.get("name") or "").strip().lower() == name.strip().lower()
    ]
    if not matches:
        return None
    matches.sort(key=lambda e: e.get("created_at") or "", reverse=True)
    latest = matches[0]
    try:
        prior_dt = datetime.fromisoformat(latest["created_at"])
    except (KeyError, ValueError):
        return None
    if (datetime.now(timezone.utc) - prior_dt).days <= RECURRING_MIN_DAYS:
        return None
    return {"name": name, "expense_id": latest["id"], "previous_at": latest["created_at"]}

@api.post("/trips/{trip_id}/expenses")
async def add_expense(trip_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    trip = await sb_one("trips", id=trip_id)
    if not trip or current_user["id"] not in (trip.get("members") or []):
        raise HTTPException(404)
    data = await request.json()
    pid = data.get("paid_by", current_user["id"])
    payer = await sb_one("users", id=pid)
    split = data.get("split_among") or trip.get("members") or []
    name = sanitize_string(data.get("name") or data.get("description") or "Expense", max_len=200)
    category = data.get("category","other")
    notes = data.get("notes")
    eid = str(uuid.uuid4())
    doc = {"id": eid, "trip_id": trip_id, "paid_by": pid,
           "paid_by_name": (payer or {}).get("name", current_user.get("name","")),
           "split_among": split,
           "description": name,
           "name": name,
           "notes": sanitize_string(str(notes), max_len=500) if notes else None,
           "amount": float(data.get("amount",0)), "currency": data.get("currency", trip.get("currency","INR")),
           "category": category, "is_settlement": False,
           "date": data.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
           "created_at": datetime.now(timezone.utc).isoformat()}
    recurring_suggestion = await _detect_recurring(trip_id, name, category)
    await sb_insert("expenses", doc)
    resp = {"id": eid, "message": "Expense added"}
    if recurring_suggestion:
        resp["recurring_suggestion"] = recurring_suggestion
    return resp

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
    trip = await sb_one("trips", id=trip_id)
    if not trip:
        raise HTTPException(404, "Trip not found")
    data = await request.json()
    from_member = data.get("from_member")
    to_member = data.get("to_member")
    amount = float(data.get("amount",0))
    now_iso = datetime.now(timezone.utc).isoformat()
    sid = str(uuid.uuid4())
    await sb_insert("settlements", {"id": sid, "trip_id": trip_id,
        "from_user": from_member, "to_user": to_member,
        "amount": amount, "status": "completed",
        "proof_uri": data.get("proof_uri"), "created_at": now_iso})

    # Mirror into the expense ledger (flagged is_settlement) so it shows up
    # in the trip's activity feed alongside regular expenses. Excluded from
    # balance/total math wherever is_settlement is checked.
    from_user = await sb_one("users", id=from_member) if from_member else None
    to_user   = await sb_one("users", id=to_member) if to_member else None
    label = f"Settlement to {(to_user or {}).get('name','')}".strip()
    await sb_insert("expenses", {
        "id": str(uuid.uuid4()), "trip_id": trip_id, "paid_by": from_member,
        "paid_by_name": (from_user or {}).get("name",""),
        "split_among": [to_member] if to_member else [],
        "description": label, "name": label,
        "amount": amount, "currency": trip.get("currency","INR"),
        "category": "settlement", "is_settlement": True,
        "date": now_iso[:10], "created_at": now_iso,
    })

    return await get_trip(trip_id, current_user)

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
    exp_lists = await asyncio.gather(*[sb_get("expenses", trip_id=tid) for tid in tids])
    all_exp = [e for lst in exp_lists for e in lst]
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    cur_week = 0.0
    weekly: dict = {}
    for e in all_exp:
        if e.get("is_settlement") or e.get("paid_by") != uid: continue
        try:
            d = datetime.strptime(e.get("date","")[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
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
    now  = datetime.now(timezone.utc)
    period_days = {"week": 7, "1M": 30, "month": 30, "3M": 90, "6M": 180, "1Y": 365}.get(period, 30)
    cutoff = now - timedelta(days=period_days)
    trips = await sb_get("trips", _contains={"members": uid})
    exp_lists, settle_lists = await asyncio.gather(
        asyncio.gather(*[sb_get("expenses", trip_id=t["id"]) for t in trips]),
        asyncio.gather(*[sb_get("settlements", trip_id=t["id"], status="completed") for t in trips]),
    )

    by_cat: dict = {}; monthly: dict = {}; total = 0.0; owed_to_you = 0.0; you_owe = 0.0

    for trip, exps in zip(trips, exp_lists):
        mids = trip.get("members", [])
        for e in exps:
            if e.get("is_settlement"): continue
            sids = e.get("split_among") or mids
            if uid not in sids or not sids: continue
            try:
                d = datetime.strptime(e.get("date","")[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                if d < cutoff: continue
                month_key = d.strftime("%b %Y")
            except:
                month_key = "Other"
            # User's share of this expense
            my_share = e.get("amount", 0) / len(sids)
            cat = e.get("category", "other")
            by_cat[cat] = by_cat.get(cat, 0) + my_share
            total += my_share
            monthly[month_key] = monthly.get(month_key, 0) + my_share

    # Build monthly trend sorted chronologically
    try:
        sorted_months = sorted(monthly.keys(), key=lambda m: datetime.strptime(m, "%b %Y"))
    except:
        sorted_months = list(monthly.keys())
    monthly_trend = [{"month": m, "total": round(monthly[m], 2)} for m in sorted_months]

    # Compute net balances using the same settlement-aware my_net formula as /trips
    for trip, exps, settlements in zip(trips, exp_lists, settle_lists):
        mids = trip.get("members", [])
        paid = sum(e.get("amount", 0) for e in exps if e.get("paid_by") == uid and not e.get("is_settlement"))
        share = 0.0
        for e in exps:
            if e.get("is_settlement"): continue
            sids = e.get("split_among") or mids
            if uid in sids and sids:
                share += e.get("amount", 0) / len(sids)
        my_net = paid - share
        for s in settlements:
            if s.get("to_user") == uid: my_net += s.get("amount", 0)
            elif s.get("from_user") == uid: my_net -= s.get("amount", 0)
        if my_net > 0:
            owed_to_you += my_net
        else:
            you_owe += abs(my_net)

    return {
        "period": period, "total": round(total, 2), "currency": "INR",
        "owed_to_you": round(owed_to_you, 2), "you_owe": round(you_owe, 2),
        "by_category": [
            {"category": c, "amount": round(a, 2), "percent": round(a/total*100, 1) if total else 0}
            for c, a in sorted(by_cat.items(), key=lambda x: -x[1])
        ],
        "monthly_trend": monthly_trend,
    }

@api.get("/reminders")
async def get_reminders(current_user: dict = Depends(get_current_user)):
    return await sb_get("reminders", user_id=current_user["id"])

@api.post("/reminders")
async def create_reminder(reminder: ReminderCreate, current_user: dict = Depends(get_current_user)):
    rid = str(uuid.uuid4())
    await sb_insert("reminders", {"id": rid, "user_id": current_user["id"],
        "trip_id": reminder.trip_id, "title": reminder.title,
        "message": reminder.message, "due_date": reminder.due_date,
        "status": "active", "created_at": datetime.now(timezone.utc).isoformat()})
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
async def scan_bill(image: UploadFile = File(None), request: Request = None,
                    _: dict = Depends(get_current_user)):
    from ai.ocr import scan_bill as ocr_scan_bill
    if image:
        return await ocr_scan_bill(await image.read(), [], "INR")
    # JSON body with base64 image
    try:
        body = await request.json()
        import base64
        img_bytes = base64.b64decode(body.get("image_base64", ""))
        return await ocr_scan_bill(img_bytes, [], body.get("currency", "INR"))
    except Exception:
        return {"amount": 0, "vendor": "Unknown", "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "currency": "INR", "category": "other", "items": [], "suggested_name": "Bill"}

# ══════════════════════════════════════════════════════════════════════════════
# STARTUP
# ══════════════════════════════════════════════════════════════════════════════

class SmartSplitReq(BaseModel):
    conversation: str

@api.post("/smart-split")
async def smart_split(req: SmartSplitReq):
    """AI expense parser — uses Google Gemini Flash (FREE: 1M tokens/day)."""
    import re as re2
    key = os.environ.get("GEMINI_KEY", "")
    if not key:
        return JSONResponse(content={"done": False, "reply": "Smart Split AI is not configured yet. Try: '₹500 for 3 people'"})

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
        if m:
            return JSONResponse(content=json.loads(m.group()))
        return {"done": False, "reply": "Could not understand. Try again?"}
    except Exception as e:
        logger.error(f"smart-split error: {e}")
        return {"done": False, "reply": "AI unavailable. Try: '₹500 for 3 people'"}

@app.on_event("startup")
async def startup():
    logger.info("Merizo API starting (Supabase backend)...")
    try:
        user = await sb_one("users", email=DEMO_EMAIL)
        if not user:
            uid = str(uuid.uuid4())
            await sb_insert("users", {"id": uid, "email": DEMO_EMAIL, "name": DEMO_NAME,
                "password_hash": hash_pw(DEMO_PASSWORD), "created_at": datetime.now(timezone.utc).isoformat()})
            logger.info(f"Demo user created: {DEMO_EMAIL}")
        else:
            logger.info("Demo user exists ✓")
    except Exception as e:
        logger.warning(f"Startup check failed — have you run schema.sql in Supabase? Error: {e}")
        logger.warning("API will still start. Run schema.sql then restart.")

@api.post("/auth/forgot-password")
async def forgot_password(body: dict, request: Request):
    """Send password reset email — generic response always."""
    from core.security import create_reset_token
    ip = get_client_ip(request)
    check_rate_limit(ip, "forgot")
    email = validate_email(body.get("email", ""))
    user = await sb_one("users", email=email)
    if user:
        token = create_reset_token(email)
        # TODO: send email via SMTP
        # For now: return token in dev (remove in production)
        logger.info(f"Password reset token for {email}: {token}")
    # Always return same response — don't reveal if email exists
    return {"message": "If this email is registered, you will receive a reset link shortly."}

@api.post("/auth/reset-password")
async def reset_password(body: dict, request: Request):
    """Reset password using token."""
    from core.security import consume_reset_token, invalidate_all_sessions
    ip = get_client_ip(request)
    check_rate_limit(ip, "reset")
    token = body.get("token", "")
    new_password = body.get("password", "")
    validate_password(new_password)
    email = consume_reset_token(token)
    user = await sb_one("users", email=email)
    if not user:
        raise HTTPException(400, "Invalid reset request")
    # Update password
    await sb_update("users", {"password_hash": hash_pw(new_password)}, email=email)
    # Invalidate all existing sessions
    invalidate_all_sessions(user["id"])
    audit("PASSWORD_RESET", user_id=user["id"], ip=ip)
    return {"message": "Password updated successfully. Please sign in again."}

@api.get("/auth/audit")
async def get_audit_log(user: dict = Depends(get_current_user)):
    """Admin only — view security audit log."""
    check_permission(user, "read_all")
    from core.security import get_recent_audit
    return get_recent_audit(100)

@app.get("/")
async def root(): return {"message":"Merizo API v2 (Supabase)","status":"ok"}

# ── Register routers (must come after all route definitions) ──────────────────
app.include_router(api)
app.include_router(ai_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT",8000)))