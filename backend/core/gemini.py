"""Gemini chat helper + JSON-extraction utilities used by the AI router."""
import asyncio
import hashlib
import json
import logging
import uuid
from typing import Any, Optional

from . import EMERGENT_LLM_KEY, GEMINI_MODEL

logger = logging.getLogger("merizo.gemini")


async def gemini_chat(system: str, user_text: str) -> Optional[str]:
    """Single-shot Gemini call. Returns raw text or None on any failure (graceful)."""
    if not EMERGENT_LLM_KEY:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception:
        return None
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"merizo-{uuid.uuid4()}",
            system_message=system,
        ).with_model("gemini", GEMINI_MODEL)
        msg = UserMessage(text=user_text)
        return await asyncio.wait_for(chat.send_message(msg), timeout=18.0)
    except Exception as e:
        logger.warning(f"Gemini call failed: {e}")
        return None


def strip_json_fence(raw: str) -> str:
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:].strip()
        elif raw[:3].lower() == "txt":
            raw = raw[3:].strip()
    return raw


def parse_json(raw: Optional[str]) -> Optional[Any]:
    if not raw:
        return None
    raw = strip_json_fence(raw)
    try:
        return json.loads(raw)
    except Exception:
        s = raw.find("{")
        e = raw.rfind("}")
        if s < 0:
            s = raw.find("[")
            e = raw.rfind("]")
        if s >= 0 and e > s:
            try:
                return json.loads(raw[s : e + 1])
            except Exception:
                return None
    return None


def expense_signature(trip: dict) -> str:
    items = []
    for e in trip.get("expenses", []):
        if e.get("is_settlement"):
            continue
        items.append(f"{e.get('id','')}:{e.get('amount_base',0)}")
    return hashlib.md5("|".join(items).encode()).hexdigest()[:12]
