cat > backend/ai/report.py << 'EOF'
import os
import google.generativeai as genai
from .prompts import TRIP_REPORT_PROMPT
from collections import Counter

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))

async def generate_trip_report(trip: dict, expenses: list, members: list, language: str = "en") -> str:
    model = genai.GenerativeModel("gemini-1.5-flash")
    
    total = sum(e.get("amount", 0) for e in expenses)
    categories = Counter(e.get("category", "other") for e in expenses)
    top_cats = ", ".join([f"{cat}({count})" for cat, count in categories.most_common(3)])
    member_names = ", ".join([m.get("name","") for m in members])
    
    prompt = TRIP_REPORT_PROMPT.format(
        trip_name=trip.get("name", "Trip"),
        total=total,
        currency=trip.get("currency", "INR"),
        categories=top_cats,
        members=member_names,
        expense_count=len(expenses),
        language=language
    )
    
    response = model.generate_content(prompt)
    return response.text
EOF