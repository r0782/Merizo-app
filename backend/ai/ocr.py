import os, json, re, asyncio, base64
import httpx
from groq import Groq
from .prompts import BILL_SCAN_PROMPT, BILL_SCAN_TEXT_PROMPT

# Groq's current vision-capable model (console.groq.com/docs/vision).
MODEL = "qwen/qwen3.6-27b"
# Text-only model used to structure OCR'd text into JSON.
TEXT_MODEL = "openai/gpt-oss-120b"

VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate"

_client = None

def _get_client():
    global _client
    if _client is None:
        key = os.environ.get("GROQ_API_KEY", "")
        if not key:
            raise RuntimeError("GROQ_API_KEY not configured")
        _client = Groq(api_key=key)
    return _client

def _strip_json(raw: str) -> dict | None:
    # Qwen's thinking mode can prepend a <think>...</think> block before
    # the actual answer — strip it before hunting for the JSON payload.
    raw = re.sub(r"<think>[\s\S]*?</think>", "", raw)
    raw = re.sub(r"```json|```", "", raw).strip()
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        return None
    return json.loads(match.group())

def _normalise(result: dict) -> dict:
    if "merchant" in result and "vendor" not in result:
        result["vendor"] = result.pop("merchant")
    if "total" in result and "amount" not in result:
        result["amount"] = result.pop("total")
    elif "suggested_total" in result and "amount" not in result:
        result["amount"] = result.pop("suggested_total")
    if "suggested_name" not in result:
        result["suggested_name"] = result.get("vendor", "Bill")
    return result

async def _vision_extract_text(image_bytes: bytes) -> str:
    """OCR via Google Cloud Vision's DOCUMENT_TEXT_DETECTION — handles both
    dense printed text and handwriting, unlike plain TEXT_DETECTION."""
    key = os.environ.get("GOOGLE_CLOUD_VISION_API_KEY", "")
    if not key:
        raise RuntimeError("GOOGLE_CLOUD_VISION_API_KEY not configured")
    b64 = base64.b64encode(image_bytes).decode()
    body = {
        "requests": [{
            "image": {"content": b64},
            "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
        }]
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(VISION_ENDPOINT, params={"key": key}, json=body)
        resp.raise_for_status()
        data = resp.json()
    result = (data.get("responses") or [{}])[0]
    if "error" in result:
        raise RuntimeError(f"Cloud Vision error: {result['error'].get('message', 'unknown')}")
    text = (result.get("fullTextAnnotation") or {}).get("text", "")
    if not text.strip():
        raise RuntimeError("Cloud Vision found no text in the image")
    return text

async def _parse_bill_from_text(ocr_text: str, members: list, currency: str) -> dict:
    prompt = BILL_SCAN_TEXT_PROMPT.format(
        members=", ".join(members) if members else "everyone",
        currency=currency,
        ocr_text=ocr_text,
    )
    client = _get_client()
    response = await asyncio.to_thread(
        client.chat.completions.create,
        model=TEXT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
        temperature=0.1,
    )
    raw = response.choices[0].message.content or ""
    result = _strip_json(raw)
    if result is None:
        raise RuntimeError("Could not parse bill data from OCR'd text")
    return _normalise(result)

async def _scan_bill_via_vision(image_bytes: bytes, members: list, currency: str) -> dict:
    ocr_text = await _vision_extract_text(image_bytes)
    return await _parse_bill_from_text(ocr_text, members, currency)

async def _scan_bill_via_groq_vision(image_bytes: bytes, members: list, currency: str) -> dict:
    prompt = BILL_SCAN_PROMPT.format(
        members=", ".join(members) if members else "everyone", currency=currency
    )
    client = _get_client()
    b64 = base64.b64encode(image_bytes).decode()
    # Groq's client is synchronous — run it off the event loop so a bill
    # scan doesn't block every other in-flight request.
    response = await asyncio.to_thread(
        client.chat.completions.create,
        model=MODEL,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
            ],
        }],
        max_tokens=1024,
        temperature=0.1,
    )
    raw = response.choices[0].message.content or ""
    result = _strip_json(raw)
    if result is None:
        return {"error": "Could not parse bill data from model response"}
    return _normalise(result)

async def scan_bill(image_bytes: bytes, members: list, currency: str = "INR") -> dict:
    # Prefer Cloud Vision OCR (handles handwritten + printed receipts well)
    # feeding into a text-parsing pass; fall back to Groq's vision model
    # reading the image directly if Vision isn't configured or fails.
    if os.environ.get("GOOGLE_CLOUD_VISION_API_KEY"):
        try:
            return await _scan_bill_via_vision(image_bytes, members, currency)
        except Exception:
            pass
    try:
        return await _scan_bill_via_groq_vision(image_bytes, members, currency)
    except Exception as e:
        return {"error": str(e)}
