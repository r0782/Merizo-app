import os, json, re
from groq import Groq
from .prompts import EXPENSE_PARSER_PROMPT

client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))

async def parse_expense_from_text(text: str, members: list, currency: str = "INR") -> dict:
    prompt = EXPENSE_PARSER_PROMPT.format(
        text=text,
        members=", ".join(members) if members else "unknown",
        currency=currency
    )
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=512,
            temperature=0.1,
        )
        raw = re.sub(r"```json|```", "", response.choices[0].message.content).strip()
        return json.loads(raw)
    except Exception as e:
        return {"error": str(e), "raw_text": text}
