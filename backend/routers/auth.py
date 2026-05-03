"""Auth router — register / login / me."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.models import RegisterReq, LoginReq, AuthResp, UserPublic
from core.security import (
    hash_password,
    verify_password,
    create_token,
    get_current_user,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResp)
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
    return {
        "user": {"id": user_id, "email": email, "name": req.name.strip(), "avatar": None},
        "token": token,
    }


@router.post("/login", response_model=AuthResp)
async def login(req: LoginReq):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"], email)
    return {
        "user": {"id": user["id"], "email": email, "name": user["name"], "avatar": user.get("avatar")},
        "token": token,
    }


@router.get("/me", response_model=UserPublic)
async def me(user=Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"], "avatar": user.get("avatar")}
