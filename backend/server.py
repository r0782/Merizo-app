from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import json
import logging
import secrets
import asyncio
import hashlib
import base64
import random
import string
import csv
import io
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import bcrypt
import jwt
import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
import requests

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

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# --- App ---
app = FastAPI(title="Merizo API")
api = APIRouter(prefix="/api")

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer_scheme = HTTPBearer(auto_error=False)

# ===== OTP Storage =====
otp_store: dict = {}  # {phone: {"code": "123456", "expires": datetime}}

# ===== Smart Limit Cache =====
smart_limit_cache: dict = {}  # {user_id: {percent, weekly_budget, current_week_spent, ...}}

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


# ===== OTP HELPERS =====
def generate_otp(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))


def send_sms_otp(phone: str, otp_code: str) -> bool:
    """Simulate SMS sending. In production use Twilio/AWS SNS."""
    print(f"[SMS OTP] Phone: +91{phone} | Code: {otp_code}")
    logger.info(f"OTP sent to +91{phone}: {otp_code}")
    return True


# ===== MODELS =====
class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class Trip(BaseModel):
    name: str
    description: Optional[str] = None
    currency: str = "INR"
    # Accept both field names used across frontend/backend
    category: Optional[str] = "trip"
    group_type: Optional[str] = None
    split_category: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    due_date: Optional[str] = None
    members: List[str] = []
    destinations: Optional[List[str]] = None
    cover_key: Optional[str] = None


class Expense(BaseModel):
    trip_id: str
    paid_by: str
    description: str
    amount: float
    currency: str = "INR"
    split_type: str = "equal"
    split_data: dict = {}
    category: str = "other"
    date: Optional[str] = None


class Settlement(BaseModel):
    trip_id: str
    from_user: str
    to_user: str
    amount: float
    currency: str = "INR"


class ReminderCreate(BaseModel):
    trip_id: Optional[str] = None
    title: str
    message: Optional[str] = None
    due_date: Optional[str] = None


# ===== BALANCE CALCULATION HELPERS =====
async def compute_trip_summary(trip: dict, user_id: str) -> dict:
    """Add my_net, total_spent, member_count to a trip dict."""
    trip_id = trip.get("id")
    expenses = await db.expenses.find({"trip_id": trip_id}).to_list(None)
    settlements = await db.settlements.find({"trip_id": trip_id, "status": "completed"}).to_list(None)

    total_spent = sum(e.get("amount", 0) for e in expenses if not e.get("is_settlement"))
    member_ids = trip.get("members", [])
    n = max(len(member_ids), 1)

    # Simple equal-split balance for current user
    paid = sum(e.get("amount", 0) for e in expenses if e.get("paid_by") == user_id and not e.get("is_settlement"))
    share = total_spent / n
    my_net = paid - share  # positive = owed to me, negative = I owe

    # Adjust for completed settlements
    for s in settlements:
        if s.get("to_user") == user_id:
            my_net += s.get("amount", 0)
        elif s.get("from_user") == user_id:
            my_net -= s.get("amount", 0)

    split_cat = trip.get("split_category") or trip.get("category") or trip.get("group_type") or "trip"

    result = {**trip}
    result["split_category"] = split_cat
    result["my_net"] = round(my_net, 2)
    result["total_spent"] = round(total_spent, 2)
    result["member_count"] = len(member_ids)
    return result


# ===== AUTH ENDPOINTS =====
@api.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(user["id"], user["email"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "avatar": user.get("avatar"),
        },
    }


@api.post("/auth/register")
async def register(req: RegisterRequest):
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": req.email,
        "name": req.name,
        "password_hash": hash_password(req.password),
        "avatar": None,
        "created_at": datetime.utcnow(),
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id, req.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user_id, "email": req.email, "name": req.name, "avatar": None},
    }


@api.post("/auth/demo-login")
async def demo_login():
    user = await db.users.find_one({"email": DEMO_EMAIL})
    if not user:
        user_id = str(uuid.uuid4())
        user_doc = {
            "id": user_id,
            "email": DEMO_EMAIL,
            "name": DEMO_NAME,
            "password_hash": hash_password(DEMO_PASSWORD),
            "avatar": None,
            "created_at": datetime.utcnow(),
        }
        await db.users.insert_one(user_doc)
        user = user_doc

    token = create_token(user["id"], user["email"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "avatar": user.get("avatar"),
        },
    }


@api.get("/auth/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "avatar": current_user.get("avatar"),
    }


# ===== OTP LOGIN ENDPOINTS =====
@app.post("/api/auth/send-otp")
async def send_otp(request: Request):
    try:
        data = await request.json()
        phone = data.get("phone", "").strip()

        if not phone or len(phone) != 10 or not phone.isdigit():
            raise HTTPException(status_code=400, detail="Invalid phone number")

        otp_code = generate_otp()
        otp_store[phone] = {
            "code": otp_code,
            "expires": datetime.utcnow() + timedelta(minutes=10)
        }
        send_sms_otp(phone, otp_code)
        return {"success": True, "message": "OTP sent successfully", "phone": phone}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in send_otp: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/auth/verify-otp")
async def verify_otp(request: Request):
    try:
        data = await request.json()
        phone = data.get("phone", "").strip()
        otp = data.get("otp", "").strip()

        if not phone or len(phone) != 10:
            raise HTTPException(status_code=400, detail="Invalid phone number")
        if not otp or len(otp) != 6:
            raise HTTPException(status_code=400, detail="Invalid OTP")

        if phone not in otp_store:
            raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")

        stored_otp = otp_store[phone]
        if datetime.utcnow() > stored_otp["expires"]:
            del otp_store[phone]
            raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
        if stored_otp["code"] != otp:
            raise HTTPException(status_code=400, detail="Invalid OTP. Please try again.")

        del otp_store[phone]

        user = await db.users.find_one({"phone": phone})
        if not user:
            user_id = str(uuid.uuid4())
            user_doc = {
                "id": user_id,
                "phone": phone,
                "email": f"user_{phone}@merizo.app",
                "name": f"User {phone[-4:]}",
                "password_hash": bcrypt.hashpw(os.urandom(16), bcrypt.gensalt()).decode(),
                "avatar": None,
                "created_at": datetime.utcnow(),
                "verified": True,
            }
            await db.users.insert_one(user_doc)
            user = user_doc

        user_id = user.get("id") or str(user.get("_id", ""))
        user_email = user.get("email", f"user_{phone}@merizo.app")
        token = create_token(user_id, user_email)
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "name": user.get("name"),
                "email": user_email,
                "avatar": user.get("avatar"),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in verify_otp: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/auth/resend-otp")
async def resend_otp(request: Request):
    try:
        data = await request.json()
        phone = data.get("phone", "").strip()

        if not phone or len(phone) != 10 or not phone.isdigit():
            raise HTTPException(status_code=400, detail="Invalid phone number")

        otp_code = generate_otp()
        otp_store[phone] = {
            "code": otp_code,
            "expires": datetime.utcnow() + timedelta(minutes=10),
        }
        send_sms_otp(phone, otp_code)
        return {"success": True, "message": "OTP resent successfully", "phone": phone}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in resend_otp: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/auth/google-login")
async def google_login(request: Request):
    try:
        data = await request.json()
        id_token_val = data.get("id_token")
        access_token_val = data.get("access_token")

        if not id_token_val and not access_token_val:
            raise HTTPException(status_code=400, detail="Missing Google token")

        token_val = id_token_val or access_token_val or ""

        # Attempt to verify the id_token with Google's tokeninfo endpoint
        google_email = None
        google_name = None
        google_id = None

        try:
            async with httpx.AsyncClient(timeout=8) as client_http:
                if id_token_val:
                    r = await client_http.get(
                        f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token_val}"
                    )
                else:
                    r = await client_http.get(
                        f"https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {access_token_val}"}
                    )
                if r.status_code == 200:
                    info = r.json()
                    google_email = info.get("email")
                    google_name = info.get("name") or info.get("given_name", "Google User")
                    google_id = info.get("sub") or info.get("id")
        except Exception:
            pass

        # Fallback if Google verification fails (dev mode)
        if not google_email:
            google_id = hashlib.sha256(token_val[:50].encode()).hexdigest()[:20]
            google_email = f"google_{google_id[:8]}@merizo.app"
            google_name = "Google User"

        user = await db.users.find_one({
            "$or": [{"email": google_email}, {"google_id": google_id}]
        })
        if not user:
            user_id = str(uuid.uuid4())
            user_doc = {
                "id": user_id,
                "email": google_email,
                "name": google_name,
                "google_id": google_id,
                "password_hash": bcrypt.hashpw(os.urandom(16), bcrypt.gensalt()).decode(),
                "avatar": None,
                "created_at": datetime.utcnow(),
                "verified": True,
            }
            await db.users.insert_one(user_doc)
            user = user_doc

        user_id = user.get("id") or str(user.get("_id", ""))
        token = create_token(user_id, user.get("email"))
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "name": user.get("name"),
                "email": user.get("email"),
                "avatar": user.get("avatar"),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in google_login: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== TRIP ENDPOINTS =====
def _is_uuid(s: str) -> bool:
    return len(s) == 36 and s.count("-") == 4


async def _resolve_member(name_or_id: str) -> str:
    """Return a user ID for the given string.
    If it looks like a UUID, use it directly.
    Otherwise create a guest user and return the new ID.
    """
    if _is_uuid(name_or_id):
        return name_or_id
    guest_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": guest_id,
        "name": name_or_id,
        "email": f"guest_{guest_id[:8]}@merizo.app",
        "is_guest": True,
        "avatar": None,
        "created_at": datetime.utcnow(),
    })
    return guest_id


@api.post("/trips")
async def create_trip(trip: Trip, current_user: dict = Depends(get_current_user)):
    trip_id = str(uuid.uuid4())
    split_cat = trip.split_category or trip.category or trip.group_type or "trip"
    invite_token = secrets.token_urlsafe(12)

    # Resolve each member: plain names become guest user records
    resolved = [current_user["id"]]
    for m in trip.members:
        mid = await _resolve_member(m)
        if mid not in resolved:
            resolved.append(mid)

    trip_doc = {
        "id": trip_id,
        "name": trip.name,
        "description": trip.description,
        "currency": trip.currency,
        "split_category": split_cat,
        "start_date": trip.start_date,
        "end_date": trip.end_date,
        "due_date": trip.due_date,
        "destinations": trip.destinations or [],
        "cover_key": trip.cover_key,
        "members": resolved,
        "owner_id": current_user["id"],
        "created_by": current_user["id"],
        "invite_token": invite_token,
        "created_at": datetime.utcnow(),
    }
    await db.trips.insert_one(trip_doc)
    return {"id": trip_id, "message": "Trip created successfully"}


@api.get("/trips")
async def get_trips(current_user: dict = Depends(get_current_user)):
    raw = await db.trips.find({"members": current_user["id"]}).to_list(None)
    result = []
    for t in raw:
        t["_id"] = str(t["_id"])
        summary = await compute_trip_summary(t, current_user["id"])
        result.append(summary)
    return result


@api.get("/trips/{trip_id}")
async def get_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id, "members": current_user["id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    trip["_id"] = str(trip["_id"])

    expenses = await db.expenses.find({"trip_id": trip_id}).to_list(None)
    for e in expenses:
        e["_id"] = str(e["_id"])

    settlements = await db.settlements.find({"trip_id": trip_id}).to_list(None)
    for s in settlements:
        s["_id"] = str(s["_id"])

    all_member_ids = trip.get("members", [])
    members_list = []
    for member_id in all_member_ids:
        member = await db.users.find_one({"id": member_id}, {"_id": 0, "password_hash": 0})
        if member:
            paid = sum(e.get("amount", 0) for e in expenses if e.get("paid_by") == member_id and not e.get("is_settlement"))
            member_share = 0.0
            for e in expenses:
                if e.get("is_settlement"):
                    continue
                split_ids = e.get("split_among") or all_member_ids
                if member_id in split_ids and len(split_ids) > 0:
                    member_share += e.get("amount", 0) / len(split_ids)
            member_share = round(member_share, 2)
            net = round(paid - member_share, 2)
            members_list.append({**member, "paid": paid, "share": member_share, "net": net})

    trip["split_category"] = trip.get("split_category") or trip.get("category") or "trip"
    # Enrich expenses with paid_by_name and split_among_names for frontend
    member_name_map = {m["id"]: m["name"] for m in members_list if "id" in m}
    for e in expenses:
        if not e.get("paid_by_name"):
            e["paid_by_name"] = member_name_map.get(e.get("paid_by", ""), "")
        split_ids = e.get("split_among") or all_member_ids
        e["split_among_names"] = [member_name_map.get(sid, sid) for sid in split_ids if sid in member_name_map]
    trip["expenses"] = expenses
    trip["settlements"] = settlements
    trip["members"] = members_list
    trip["owner_id"] = trip.get("owner_id") or trip.get("created_by")

    # --- Fields the frontend expects ---

    # total_spent
    total_spent = sum(e.get("amount", 0) for e in expenses if not e.get("is_settlement"))
    trip["total_spent"] = round(total_spent, 2)

    # by_category: { category_key: amount }
    by_cat: dict = {}
    for e in expenses:
        if not e.get("is_settlement"):
            cat = e.get("category", "other")
            by_cat[cat] = round(by_cat.get(cat, 0) + e.get("amount", 0), 2)
    trip["by_category"] = by_cat

    # balances: same as members but with member_id alias for frontend compatibility
    trip["balances"] = [
        {**m, "member_id": m.get("id", "")}
        for m in members_list
    ]

    # settlement_transactions: greedy min-transfers algorithm
    creditors = [(m["net"], m.get("id", ""), m.get("name", "")) for m in members_list if m.get("net", 0) > 0.5]
    debtors   = [(-m["net"], m.get("id", ""), m.get("name", "")) for m in members_list if m.get("net", 0) < -0.5]
    creditors.sort(reverse=True)
    debtors.sort(reverse=True)
    txns = []
    ci, di = 0, 0
    while ci < len(creditors) and di < len(debtors):
        c_amt, c_id, c_name = creditors[ci]
        d_amt, d_id, d_name = debtors[di]
        amount = min(c_amt, d_amt)
        txns.append({"from_id": d_id, "from_name": d_name, "to_id": c_id, "to_name": c_name, "amount": round(amount, 2)})
        creditors[ci] = (c_amt - amount, c_id, c_name)
        debtors[di]   = (d_amt - amount, d_id, d_name)
        if creditors[ci][0] < 0.5: ci += 1
        if debtors[di][0] < 0.5:   di += 1
    trip["settlement_transactions"] = txns

    return trip


@api.get("/trips/{trip_id}/invite")
async def get_invite(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id, "members": current_user["id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    token = trip.get("invite_token") or secrets.token_urlsafe(12)
    if not trip.get("invite_token"):
        await db.trips.update_one({"id": trip_id}, {"$set": {"invite_token": token}})
    return {"token": token, "trip_name": trip["name"]}


@api.post("/trips/{trip_id}/join")
async def join_trip(trip_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    data = await request.json()
    token = data.get("token")
    trip = await db.trips.find_one({"id": trip_id, "invite_token": token})
    if not trip:
        raise HTTPException(status_code=404, detail="Invalid invite link")
    if current_user["id"] not in trip.get("members", []):
        await db.trips.update_one({"id": trip_id}, {"$addToSet": {"members": current_user["id"]}})
    return {"message": "Joined successfully"}


@api.post("/trips/{trip_id}/members")
async def add_member(trip_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if current_user["id"] not in trip.get("members", []):
        raise HTTPException(status_code=403, detail="Not a member of this trip")

    data = await request.json()
    raw = (data.get("name") or data.get("id") or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Member name or ID required")

    member_id = await _resolve_member(raw)
    await db.trips.update_one({"id": trip_id}, {"$addToSet": {"members": member_id}})
    member = await db.users.find_one({"id": member_id}, {"_id": 0, "password_hash": 0})
    return {"id": member_id, "member": member, "message": "Member added"}


@api.delete("/trips/{trip_id}/members/{member_id}")
async def delete_member(trip_id: str, member_id: str, current_user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.get("created_by") != current_user["id"] and trip.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only trip owner can remove members")
    await db.trips.update_one({"id": trip_id}, {"$pull": {"members": member_id}})
    return {"message": "Member removed successfully"}


@api.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.get("created_by") != current_user["id"] and trip.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only owner can delete this group")
    await db.trips.delete_one({"id": trip_id})
    await db.expenses.delete_many({"trip_id": trip_id})
    await db.settlements.delete_many({"trip_id": trip_id})
    return {"message": "Group deleted"}


# ===== EXPENSE ENDPOINTS =====
@api.post("/expenses")
async def create_expense(expense: Expense, current_user: dict = Depends(get_current_user)):
    expense_id = str(uuid.uuid4())
    expense_doc = {
        "id": expense_id,
        "trip_id": expense.trip_id,
        "paid_by": expense.paid_by,
        "description": expense.description,
        "amount": expense.amount,
        "currency": expense.currency,
        "split_type": expense.split_type,
        "split_data": expense.split_data,
        "category": expense.category,
        "date": expense.date or datetime.utcnow().strftime("%Y-%m-%d"),
        "created_at": datetime.utcnow(),
    }
    await db.expenses.insert_one(expense_doc)
    return {"id": expense_id, "message": "Expense created successfully"}


@api.post("/trips/{trip_id}/expenses")
async def add_expense_to_trip(trip_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Convenience endpoint: add expense directly to a trip."""
    trip = await db.trips.find_one({"id": trip_id, "members": current_user["id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    data = await request.json()
    expense_id = str(uuid.uuid4())
    paid_by_id = data.get("paid_by", current_user["id"])
    payer_doc = await db.users.find_one({"id": paid_by_id}, {"name": 1})
    paid_by_name = payer_doc.get("name", "") if payer_doc else current_user.get("name", "")
    split_among = data.get("split_among", trip.get("members", []))
    if not split_among:
        split_among = trip.get("members", [])
    expense_doc = {
        "id": expense_id,
        "trip_id": trip_id,
        "paid_by": paid_by_id,
        "paid_by_name": paid_by_name,
        "split_among": split_among,
        "description": data.get("name") or data.get("description") or "Expense",
        "name": data.get("name") or data.get("description") or "Expense",
        "amount": float(data.get("amount", 0)),
        "currency": data.get("currency", trip.get("currency", "INR")),
        "split_type": data.get("split_type", "equal"),
        "split_data": data.get("split_data", {}),
        "category": data.get("category", "other"),
        "date": data.get("date") or datetime.utcnow().strftime("%Y-%m-%d"),
        "created_at": datetime.utcnow(),
    }
    await db.expenses.insert_one(expense_doc)
    return {"id": expense_id, "message": "Expense added"}


@api.get("/expenses/{trip_id}")
async def get_expenses(trip_id: str, current_user: dict = Depends(get_current_user)):
    expenses = await db.expenses.find({"trip_id": trip_id}).to_list(None)
    for e in expenses:
        e["_id"] = str(e["_id"])
    return expenses


@api.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: dict = Depends(get_current_user)):
    expense = await db.expenses.find_one({"id": expense_id})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    await db.expenses.delete_one({"id": expense_id})
    return {"message": "Expense deleted successfully"}


# ===== SETTLEMENT ENDPOINTS =====
@api.post("/settlements")
async def create_settlement(settlement: Settlement, current_user: dict = Depends(get_current_user)):
    settlement_id = str(uuid.uuid4())
    settlement_doc = {
        "id": settlement_id,
        "trip_id": settlement.trip_id,
        "from_user": settlement.from_user,
        "to_user": settlement.to_user,
        "amount": settlement.amount,
        "currency": settlement.currency,
        "status": "pending",
        "created_at": datetime.utcnow(),
    }
    await db.settlements.insert_one(settlement_doc)
    return {"id": settlement_id, "message": "Settlement created successfully"}


@api.get("/settlements/{trip_id}")
async def get_settlements(trip_id: str, current_user: dict = Depends(get_current_user)):
    settlements = await db.settlements.find({"trip_id": trip_id}).to_list(None)
    for s in settlements:
        s["_id"] = str(s["_id"])
    return settlements


@api.patch("/settlements/{settlement_id}")
async def update_settlement(settlement_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    data = await request.json()
    new_status = data.get("status", "completed")
    settlement = await db.settlements.find_one({"id": settlement_id})
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    await db.settlements.update_one({"id": settlement_id}, {"$set": {"status": new_status}})
    return {"message": "Settlement updated successfully"}


# ===== SMART LIMIT =====
@api.get("/smart-limit")
async def get_smart_limit(current_user: dict = Depends(get_current_user)):
    """Calculate weekly smart limit based on past spending."""
    user_id = current_user["id"]
    now = datetime.utcnow()
    # Current week start (Monday)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    # Get user's trips
    trips = await db.trips.find({"members": user_id}).to_list(None)
    trip_ids = [t["id"] for t in trips]

    # Current week spend
    current_week_spent = 0.0
    all_expenses = await db.expenses.find({"trip_id": {"$in": trip_ids}}).to_list(None)
    for e in all_expenses:
        if not e.get("is_settlement") and e.get("paid_by") == user_id:
            try:
                exp_date = datetime.strptime(e.get("date", "")[:10], "%Y-%m-%d")
                if exp_date >= week_start:
                    current_week_spent += e.get("amount", 0)
            except Exception:
                pass

    # Calculate 4-week rolling average for budget
    weekly_totals = {}
    for e in all_expenses:
        if not e.get("is_settlement") and e.get("paid_by") == user_id:
            try:
                exp_date = datetime.strptime(e.get("date", "")[:10], "%Y-%m-%d")
                week_key = (exp_date - timedelta(days=exp_date.weekday())).strftime("%Y-%m-%d")
                weekly_totals[week_key] = weekly_totals.get(week_key, 0) + e.get("amount", 0)
            except Exception:
                pass

    past_weeks = sorted(weekly_totals.keys(), reverse=True)
    has_history = len(past_weeks) >= 2
    if has_history:
        recent = [weekly_totals[w] for w in past_weeks[:4]]
        weekly_budget = sum(recent) / len(recent) * 1.1  # 10% buffer
    else:
        weekly_budget = 3000.0  # AI default for INR

    percent = (current_week_spent / weekly_budget * 100) if weekly_budget > 0 else 0

    return {
        "percent": round(percent, 1),
        "current_week_spent": round(current_week_spent, 2),
        "weekly_budget": round(weekly_budget, 2),
        "currency": "INR",
        "has_history": has_history,
    }


# ===== REMINDERS =====
@api.get("/reminders")
async def get_reminders(current_user: dict = Depends(get_current_user)):
    reminders = await db.reminders.find({"user_id": current_user["id"]}).to_list(None)
    for r in reminders:
        r["_id"] = str(r["_id"])
    return reminders


@api.post("/reminders")
async def create_reminder(reminder: ReminderCreate, current_user: dict = Depends(get_current_user)):
    rem_id = str(uuid.uuid4())
    doc = {
        "id": rem_id,
        "user_id": current_user["id"],
        "trip_id": reminder.trip_id,
        "title": reminder.title,
        "message": reminder.message,
        "due_date": reminder.due_date,
        "status": "active",
        "created_at": datetime.utcnow(),
    }
    await db.reminders.insert_one(doc)
    return {"id": rem_id, "message": "Reminder created"}


@api.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, current_user: dict = Depends(get_current_user)):
    await db.reminders.delete_one({"id": reminder_id, "user_id": current_user["id"]})
    return {"message": "Reminder deleted"}


# ===== INSIGHTS =====
@api.get("/insights")
async def get_insights(period: str = "month", current_user: dict = Depends(get_current_user)):
    """Spending breakdown by category."""
    user_id = current_user["id"]
    now = datetime.utcnow()

    if period == "week":
        cutoff = now - timedelta(days=7)
    elif period == "month":
        cutoff = now - timedelta(days=30)
    else:
        cutoff = datetime(2000, 1, 1)

    trips = await db.trips.find({"members": user_id}).to_list(None)
    trip_ids = [t["id"] for t in trips]
    expenses = await db.expenses.find({"trip_id": {"$in": trip_ids}}).to_list(None)

    by_cat: dict = {}
    total = 0.0
    for e in expenses:
        if e.get("is_settlement"):
            continue
        if e.get("paid_by") != user_id:
            continue
        try:
            exp_date = datetime.strptime(e.get("date", "")[:10], "%Y-%m-%d")
            if exp_date < cutoff:
                continue
        except Exception:
            pass
        cat = e.get("category", "other")
        amt = e.get("amount", 0)
        by_cat[cat] = by_cat.get(cat, 0) + amt
        total += amt

    by_category = [
        {
            "category": cat,
            "amount": round(amt, 2),
            "percent": round(amt / total * 100, 1) if total > 0 else 0,
        }
        for cat, amt in sorted(by_cat.items(), key=lambda x: -x[1])
    ]

    return {
        "period": period,
        "total": round(total, 2),
        "by_category": by_category,
        "currency": "INR",
    }


# ===== SCAN BILL (OCR) =====
@api.post("/scan-bill")
async def scan_bill(request: Request, current_user: dict = Depends(get_current_user)):
    """OCR receipt scan using Gemini 2.5 Flash via Emergent SDK."""
    data = await request.json()
    image_b64 = data.get("image_base64", "")

    if not image_b64:
        raise HTTPException(status_code=400, detail="No image provided")

    result = None

    # Try Gemini OCR
    if EMERGENT_LLM_KEY:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            system = (
                "You are a receipt OCR parser. Extract the total amount, vendor name, date, "
                "and expense category from the receipt image. "
                "Return ONLY valid JSON: {\"amount\": number, \"vendor\": string, \"date\": \"YYYY-MM-DD\", "
                "\"currency\": \"INR\", \"category\": string, \"items\": [], \"suggested_name\": string}. "
                "Category must be one of: food, shopping, travel, bills, home, other."
            )
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"scan-{uuid.uuid4()}",
                system_message=system,
            ).with_model("gemini", "gemini-2.5-flash")
            msg = UserMessage(
                text="Parse this receipt image and return JSON only.",
                filenames=[],
            )
            # Try to pass image if supported
            try:
                msg = UserMessage(text="Parse this receipt.", image_data=image_b64)
            except Exception:
                pass

            raw = await asyncio.wait_for(chat.send_message(msg), timeout=20.0)
            if raw:
                raw = raw.strip().strip("`")
                if raw.startswith("json"):
                    raw = raw[4:].strip()
                result = json.loads(raw)
        except Exception as e:
            logger.warning(f"Gemini OCR failed: {e}")

    # Fallback: simple mock result for development
    if not result:
        result = {
            "amount": 500,
            "vendor": "Unknown Vendor",
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "currency": "INR",
            "category": "food",
            "items": [],
            "suggested_name": "Bill",
        }

    return result


# ===== FILE UPLOAD =====
@api.post("/upload-thumbnail")
async def upload_thumbnail(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    try:
        os.makedirs("uploads", exist_ok=True)
        ext = os.path.splitext(file.filename or "img.jpg")[1] or ".jpg"
        filename = f"{uuid.uuid4()}{ext}"
        filepath = f"uploads/{filename}"
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
        return {"url": filepath, "message": "Uploaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== EXPORT EXPENSES AS CSV =====
@api.get("/trips/{trip_id}/export/csv")
async def export_expenses_csv(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id, "members": current_user["id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    expenses = await db.expenses.find({"trip_id": trip_id}).to_list(None)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["date", "description", "amount", "currency", "category", "paid_by"])
    writer.writeheader()
    for e in expenses:
        if not e.get("is_settlement"):
            writer.writerow({
                "date": e.get("date", ""),
                "description": e.get("description", ""),
                "amount": e.get("amount", 0),
                "currency": e.get("currency", "INR"),
                "category": e.get("category", "other"),
                "paid_by": e.get("paid_by", ""),
            })

    output.seek(0)
    trip_name = trip.get("name", "expenses").replace(" ", "_")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{trip_name}_expenses.csv"'},
    )



# ===== AI SPENDING REPORT =====
@api.get("/trips/{trip_id}/ai-report")
async def ai_spending_report(trip_id: str, current_user: dict = Depends(get_current_user)):
    try:
        trip = await db.trips.find_one({"id": trip_id, "members": current_user["id"]})
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        expenses = await db.expenses.find({"trip_id": trip_id, "is_settlement": {"$ne": True}}).to_list(None)
        member_ids = trip.get("members", [])
        n = max(len(member_ids), 1)
        total = sum(e.get("amount", 0) for e in expenses)
        share_amt = round(total / n, 2)
        members_list = []
        for mid in member_ids:
            user_doc = await db.users.find_one({"id": mid}, {"_id": 0, "password_hash": 0})
            if not user_doc:
                continue
            paid = sum(e.get("amount", 0) for e in expenses if e.get("paid_by") == mid)
            net = round(paid - share_amt, 2)
            if paid >= total * 0.5:
                ins = "Top contributor!"
            elif net < -10:
                ins = "Owes a share."
            else:
                ins = "Balanced."
            members_list.append({"name": user_doc.get("name", "?"), "paid": round(paid, 2), "share": share_amt, "net": net, "insight": ins})
        by_cat: dict = {}
        for e in expenses:
            cat = e.get("category", "other")
            by_cat[cat] = round(by_cat.get(cat, 0) + e.get("amount", 0), 2)
        cat_names = {"food": "Food & Dining", "trip": "Travel", "home": "Home", "friends": "Events", "shopping": "Shopping", "bills": "Bills", "other": "Other"}
        cat_emos  = {"food": "dishes", "trip": "airplane", "home": "house", "friends": "party", "shopping": "bag", "bills": "bolt", "other": "money"}
        categories = [{"name": cat_names.get(c, c), "emoji": cat_emos.get(c, "money"), "amount": a, "pct": round(a / total * 100) if total > 0 else 0, "insight": None} for c, a in sorted(by_cat.items(), key=lambda x: -x[1])]
        score = min(100, max(10, 100 - int((total / n) / 500)))
        top_cat = categories[0]["name"] if categories else "N/A"
        trip_name = trip.get("name", "this trip")
        base = {
            "summary": "Total spent: Rs" + str(round(total)) + " on " + trip_name + ". " + str(len(expenses)) + " expenses, " + str(n) + " members. Top: " + top_cat + ".",
            "members": members_list,
            "categories": categories,
            "recommendations": ["Split recurring bills equally.", "Settle balances weekly.", "Review the top category for savings."],
            "savings_score": score,
            "savings_label": "Good" if score >= 70 else "Average" if score >= 40 else "High spend",
        }
        if EMERGENT_LLM_KEY and members_list:
            try:
                from emergentintegrations.llm.chat import LlmChat, UserMessage
                exp_parts = [str(e.get("name", "?")) + " Rs" + str(round(e.get("amount", 0))) + "[" + str(e.get("category", "other")) + "]" for e in expenses[:20]]
                bal_parts = [str(m["name"]) + " net Rs" + str(round(m["net"])) for m in members_list]
                schema = '{"summary":"str","members":[{"name":"str","paid":0,"share":0,"net":0,"insight":"str"}],"categories":[{"name":"str","emoji":"str","amount":0,"pct":0,"insight":"str"}],"recommendations":["str","str","str"],"savings_score":75,"savings_label":"str"}'
                prompt = "Trip:" + trip_name + " Total:Rs" + str(round(total)) + " " + str(n) + "members Expenses:" + "; ".join(exp_parts) + " Balances:" + "; ".join(bal_parts) + " Return ONLY valid JSON: " + schema
                chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id="rpt-" + str(uuid.uuid4()), system_message="Friendly witty financial analyst.").with_model("gemini", "gemini-2.5-flash")
                raw = await asyncio.wait_for(chat.send_message(UserMessage(text=prompt)), timeout=20.0)
                if raw:
                    raw = raw.strip().strip("`")
                    if raw.startswith("json"):
                        raw = raw[4:].strip()
                    return {**base, **json.loads(raw)}
            except Exception as ex:
                logger.warning("AI report failed: " + str(ex))
        return base
    except HTTPException:
        raise
    except Exception as ex:
        logger.error("AI report error: " + str(ex), exc_info=True)
        raise HTTPException(status_code=500, detail="Report error: " + str(ex))

# ===== AI OVERVIEW (Stub — graceful if Gemini unavailable) =====
@api.get("/trips/{trip_id}/ai/overview")
async def ai_overview(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id, "members": current_user["id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    expenses = await db.expenses.find({"trip_id": trip_id}).to_list(None)
    total = sum(e.get("amount", 0) for e in expenses if not e.get("is_settlement"))
    cat = trip.get("split_category") or trip.get("category") or "trip"

    if not EMERGENT_LLM_KEY:
        # Return a simple stub
        return {
            "category": cat,
            "forecast": {"text": f"Total spend so far: ₹{total:,.0f}"},
        }

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        system = (
            "You are a fun travel & spending analyst. Given trip info return JSON: "
            "{\"forecast\": {\"text\": string}, \"place_facts\": [{\"fact\": string}], "
            "\"food_insight\": {\"text\": string}, \"personality\": {\"label\": string, \"description\": string}}. "
            "Keep it short and friendly. Return ONLY valid JSON."
        )
        prompt = (
            f"Trip: {trip.get('name')}, category: {cat}, "
            f"destinations: {trip.get('destinations', [])}, total spent: {total}"
        )
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ai-{uuid.uuid4()}",
            system_message=system,
        ).with_model("gemini", "gemini-2.5-flash")
        raw = await asyncio.wait_for(chat.send_message(UserMessage(text=prompt)), timeout=15.0)
        if raw:
            raw = raw.strip().strip("`")
            if raw.startswith("json"):
                raw = raw[4:].strip()
            parsed = json.loads(raw)
            parsed["category"] = cat
            return parsed
    except Exception as e:
        logger.warning(f"AI overview failed: {e}")

    return {"category": cat, "forecast": {"text": f"Total spend so far: ₹{total:,.0f}"}}


# ===== CURRENCY CHANGE =====
@api.patch("/trips/{trip_id}/budget")
async def set_trip_budget(trip_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    data = await request.json()
    budget = data.get("budget")
    if budget is None or float(budget) < 0:
        raise HTTPException(status_code=400, detail="Invalid budget amount")
    trip = await db.trips.find_one({"id": trip_id, "members": current_user["id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    await db.trips.update_one({"id": trip_id}, {"$set": {"budget": float(budget)}})
    return {"budget": float(budget)}


@api.patch("/trips/{trip_id}/currency")
async def change_currency(trip_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    data = await request.json()
    new_currency = data.get("currency", "INR")
    await db.trips.update_one({"id": trip_id}, {"$set": {"currency": new_currency}})
    return {"message": "Currency updated"}


# ===== APP STARTUP =====
@app.on_event("startup")
async def startup_event():
    logger.info("Merizo API starting up...")
    app.include_router(api)

    # Ensure demo user exists
    existing = await db.users.find_one({"email": DEMO_EMAIL})
    if not existing:
        user_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": user_id,
            "email": DEMO_EMAIL,
            "name": DEMO_NAME,
            "password_hash": hash_password(DEMO_PASSWORD),
            "avatar": None,
            "created_at": datetime.utcnow(),
        })
        logger.info(f"Demo user created: {DEMO_EMAIL}")


@app.get("/")
async def root():
    return {"message": "Merizo API v2", "status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))