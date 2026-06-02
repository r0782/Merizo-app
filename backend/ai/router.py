cat > backend/ai/router.py << 'EOF'
import os
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from .chat import get_chat_response
from .parser import parse_expense_from_text
from .settle import minimize_transactions, explain_settlement, explain_balances
from .ocr import scan_bill
from .voice import transcribe_and_parse
from .report import generate_trip_report

router = APIRouter(prefix="/ai", tags=["ai"])

# ── Request models ─────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    history: list = []
    context: dict = {}

class ParseRequest(BaseModel):
    text: str
    members: list = []
    currency: str = "INR"

class SettleRequest(BaseModel):
    balances: dict        # {"Alice": -200, "Bob": 100, "Charlie": 100}
    currency: str = "INR"
    language: str = "en"

class ExplainRequest(BaseModel):
    balances: dict
    currency: str = "INR"
    language: str = "en"

class ReportRequest(BaseModel):
    trip: dict
    expenses: list
    members: list
    language: str = "en"

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(req: ChatRequest):
    try:
        reply = await get_chat_response(req.message, req.history, req.context)
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/expense/parse")
async def parse_expense(req: ParseRequest):
    try:
        result = await parse_expense_from_text(req.text, req.members, req.currency)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/settle/optimize")
async def optimize_settlement(req: SettleRequest):
    try:
        transactions = minimize_transactions(req.balances)
        explanation  = await explain_settlement(transactions, req.currency, req.language)
        return {"transactions": transactions, "explanation": explanation}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/explain/balances")
async def explain(req: ExplainRequest):
    try:
        explanation = await explain_balances(req.balances, req.currency, req.language)
        return {"explanation": explanation}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/bill/scan")
async def bill_scan(
    image: UploadFile = File(...),
    members: str = Form(""),
    currency: str = Form("INR")
):
    try:
        image_bytes  = await image.read()
        members_list = [m.strip() for m in members.split(",") if m.strip()]
        result = await scan_bill(image_bytes, members_list, currency)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/voice/transcribe")
async def voice_transcribe(
    audio: UploadFile = File(...),
    members: str = Form(""),
    currency: str = Form("INR"),
    language: str = Form("en")
):
    try:
        audio_bytes  = await audio.read()
        members_list = [m.strip() for m in members.split(",") if m.strip()]
        result = await transcribe_and_parse(audio_bytes, members_list, currency, language)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/trip/report")
async def trip_report(req: ReportRequest):
    try:
        report = await generate_trip_report(req.trip, req.expenses, req.members, req.language)
        return {"report": report}
    except Exception as e:
        raise HTTPException(500, str(e))
EOF