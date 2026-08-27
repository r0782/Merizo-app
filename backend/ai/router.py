from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

router = APIRouter(prefix="/api/ai", tags=["ai"])

_NOT_CONFIGURED = "AI features are not configured on this server."

class ChatV2Request(BaseModel):
    message: str
    history: list = []
    context: dict = {}
    token: str = ""
    language: str = "en"
    provider: str = "gemini"

class ParseRequest(BaseModel):
    text: str
    members: list = []
    currency: str = "INR"

class SettleRequest(BaseModel):
    balances: dict
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

@router.post("/v2/chat")
async def chat_v2(req: ChatV2Request):
    """
    Orchestrated chat with Gemini 2.5 Flash + native tool calling.
    Falls back to Groq if Gemini is unavailable.
    """
    try:
        from .orchestrator import handle_chat
        result = await handle_chat(
            message=req.message,
            history=req.history,
            context=req.context,
            token=req.token,
            language=req.language,
            provider=req.provider,
        )
        return {
            "reply": result.reply,
            "action_type": result.action_type,
            "action_data": result.action_data,
            "tool_called": result.tool_called,
        }
    except RuntimeError as e:
        return {"reply": "AI assistant is not available right now.", "action_type": None, "action_data": None, "tool_called": None}
    except Exception as e:
        import logging
        logging.getLogger("merizo.router").error(f"Chat v2 error: {e}", exc_info=True)
        return {"reply": "I'm having trouble right now. Please try again in a moment.", "action_type": None, "action_data": None, "tool_called": None}

@router.post("/expense/parse")
async def parse_expense(req: ParseRequest):
    try:
        from .parser import parse_expense_from_text
        return await parse_expense_from_text(req.text, req.members, req.currency)
    except RuntimeError:
        raise HTTPException(503, _NOT_CONFIGURED)
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/settle/optimize")
async def optimize_settlement(req: SettleRequest):
    try:
        from .settle import minimize_transactions, explain_settlement
        transactions = minimize_transactions(req.balances)
        explanation = await explain_settlement(transactions, req.currency, req.language)
        return {"transactions": transactions, "explanation": explanation}
    except RuntimeError:
        from .settle import minimize_transactions
        return {"transactions": minimize_transactions(req.balances), "explanation": ""}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/explain/balances")
async def explain(req: ExplainRequest):
    try:
        from .settle import explain_balances
        return {"explanation": await explain_balances(req.balances, req.currency, req.language)}
    except RuntimeError:
        return {"explanation": ""}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/bill/scan")
async def bill_scan(image: UploadFile = File(...), members: str = Form(""), currency: str = Form("INR")):
    try:
        from .ocr import scan_bill
        return await scan_bill(
            await image.read(),
            [m.strip() for m in members.split(",") if m.strip()],
            currency,
        )
    except RuntimeError:
        raise HTTPException(503, "Bill scan requires GEMINI_API_KEY to be configured.")
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/voice/transcribe")
async def voice_transcribe(
    audio: UploadFile = File(...),
    members: str = Form(""),
    currency: str = Form("INR"),
    language: str = Form("en"),
):
    """
    Transcribe audio and parse it as an expense.

    Only reached when on-device STT fails or isn't available (Android uses
    the native speech recognizer as the primary path — see
    frontend/src/lib/androidSpeech.ts). Gemini is the sole backend fallback.
    """
    from .gemini_voice import transcribe_audio_gemini
    from .parser import parse_expense_from_text
    audio_bytes = await audio.read()
    member_list = [m.strip() for m in members.split(",") if m.strip()]
    try:
        transcript = await transcribe_audio_gemini(
            audio_bytes, language, audio.filename or "audio.m4a"
        )
        parsed = await parse_expense_from_text(transcript, member_list, currency)
        return {"transcript": transcript, "parsed": parsed}
    except RuntimeError:
        raise HTTPException(503, "Voice transcription requires GEMINI_API_KEY to be configured.")
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/trip/report")
async def trip_report(req: ReportRequest):
    try:
        from .report import generate_trip_report
        return {"report": await generate_trip_report(req.trip, req.expenses, req.members, req.language)}
    except RuntimeError:
        raise HTTPException(503, _NOT_CONFIGURED)
    except Exception as e:
        raise HTTPException(500, str(e))
