"""Pydantic request/response models shared by routers."""
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


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
    paid_by: str
    split_among: List[str]
    emoji: str = "💸"


class MemberAddReq(BaseModel):
    name: str


class SettleReq(BaseModel):
    from_member: str
    to_member: str
    amount: float


class ReminderCreate(BaseModel):
    title: str
    amount: Optional[float] = None
    due_date: Optional[str] = None
    trip_id: Optional[str] = None


class ScanBillReq(BaseModel):
    image_base64: str


class ParseUpiReq(BaseModel):
    text: str


class CurrencyChangeReq(BaseModel):
    currency: str
