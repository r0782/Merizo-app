import os, json, re
from google import genai
from .prompts import EXPENSE_PARSER_PROMPT

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))

async def parse_expense_from_text(text: str, members: list, currency: str = "INR") -> dict:
    prompt = EXPENSE_PARSER_PROMPT.format(text=text, members=", ".join(members) if members else "unknown", currency=currency)
    try:
        response = client.models.generate_content(model="gemini-1.5-flash-latest", contents=prompt)
        raw = re.sub(r"```json|```", "", response.text).strip()
        return json.loads(raw)
    except Exception as e:
        return {"error": str(e), "raw_text": text}
