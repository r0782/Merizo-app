import os
from groq import Groq
from collections import Counter
from .prompts import TRIP_REPORT_PROMPT

_client = None

def _get_client():
    global _client
    if _client is None:
        key = os.environ.get("GROQ_API_KEY", "")
        if not key:
            raise RuntimeError("GROQ_API_KEY not configured")
        _client = Groq(api_key=key)
    return _client

async def generate_trip_report(
    trip: dict, expenses: list, members: list, language: str = "en"
) -> str:
    total      = sum(e.get("amount", 0) for e in expenses)
    categories = Counter(e.get("category", "other") for e in expenses)
    top_cats   = ", ".join([f"{cat}({count})" for cat, count in categories.most_common(3)])
    response = _get_client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": TRIP_REPORT_PROMPT.format(
            trip_name=trip.get("name", "Trip"),
            total=total,
            currency=trip.get("currency", "INR"),
            categories=top_cats,
            members=", ".join([m.get("name", "") for m in members]),
            expense_count=len(expenses),
            language=language,
        )}],
        max_tokens=256,
    )
    return response.choices[0].message.content
