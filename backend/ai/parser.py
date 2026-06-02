import os, json, re
import google.generativeai as genai
from .prompts import EXPENSE_PARSER_PROMPT
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))
async def parse_expense_from_text(text: str, members: list, currency: str = "INR") -> dict:
    model = genai.GenerativeModel("gemini-1.5-flash")
    prompt = EXPENSE_PARSER_PROMPT.format(text=text, members=", ".join(members) if members else "unknown", currency=currency)
    try:
        response = model.generate_content(prompt)
        raw = re.sub(r"```json|```", "", response.text).strip()
        return json.loads(raw)
    except Exception as e:
        return {"error": str(e), "raw_text": text}
