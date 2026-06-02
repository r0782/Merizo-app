import os
from google import genai
from collections import Counter
from .prompts import TRIP_REPORT_PROMPT

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))

async def generate_trip_report(trip: dict, expenses: list, members: list, language: str = "en") -> str:
    total      = sum(e.get("amount", 0) for e in expenses)
    categories = Counter(e.get("category", "other") for e in expenses)
    top_cats   = ", ".join([f"{cat}({count})" for cat, count in categories.most_common(3)])
    response = client.models.generate_content(model="gemini-2.0-flash", contents=TRIP_REPORT_PROMPT.format(
        trip_name=trip.get("name", "Trip"), total=total, currency=trip.get("currency", "INR"),
        categories=top_cats, members=", ".join([m.get("name","") for m in members]),
        expense_count=len(expenses), language=language
    ))
    return response.text
