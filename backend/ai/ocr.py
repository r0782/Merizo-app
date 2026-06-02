import os, json, re, base64
import google.generativeai as genai
from .prompts import BILL_SCAN_PROMPT
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))
async def scan_bill(image_bytes: bytes, members: list, currency: str = "INR") -> dict:
    model = genai.GenerativeModel("gemini-1.5-flash")
    image_b64 = base64.b64encode(image_bytes).decode()
    prompt = BILL_SCAN_PROMPT.format(members=", ".join(members) if members else "everyone", currency=currency)
    try:
        response = model.generate_content([{"mime_type": "image/jpeg", "data": image_b64}, prompt])
        raw = re.sub(r"```json|```", "", response.text).strip()
        return json.loads(raw)
    except Exception as e:
        return {"error": str(e)}
