import os, json, re
from google import genai
from google.genai import types
from .prompts import BILL_SCAN_PROMPT

_client = None

def _get_client():
    global _client
    if _client is None:
        key = os.environ.get("GEMINI_API_KEY", "")
        if not key:
            raise RuntimeError("GEMINI_API_KEY not configured")
        _client = genai.Client(api_key=key)
    return _client

async def scan_bill(image_bytes: bytes, members: list, currency: str = "INR") -> dict:
    prompt = BILL_SCAN_PROMPT.format(
        members=", ".join(members) if members else "everyone", currency=currency
    )
    try:
        client = _get_client()
        response = client.models.generate_content(
            model="gemini-1.5-flash-latest",
            contents=[
                types.Part(inline_data=types.Blob(mime_type="image/jpeg", data=image_bytes)),
                prompt,
            ],
        )
        raw = re.sub(r"```json|```", "", response.text).strip()
        return json.loads(raw)
    except Exception as e:
        return {"error": str(e)}
