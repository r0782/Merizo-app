LANGUAGE_INSTRUCTIONS = {
    "en": "Respond in English.",
    "te": "తెలుగులో సమాధానం ఇవ్వండి.",
    "hi": "हिंदी में जवाब दें।",
    "ta": "தமிழில் பதிலளிக்கவும்.",
    "kn": "ಕನ್ನಡದಲ್ಲಿ ಉತ್ತರಿಸಿ.",
    "ml": "മലയാളത്തിൽ ഉത്തരം നൽകുക.",
    "bn": "বাংলায় উত্তর দিন।",
    "mr": "मराठीत उत्तर द्या.",
    "es": "Responde en español.",
    "fr": "Réponds en français.",
    "ar": "أجب باللغة العربية.",
}
SYSTEM_PROMPT = """You are Merizo — a smart, friendly expense assistant inside a group expense sharing app.
RULES:
1. Always confirm before creating or changing data. Example: "I'll add ₹500 pizza split equally. Confirm? ✅"
2. Respond in the SAME LANGUAGE as the user's message.
3. Keep responses short — this is a mobile app.
4. If unclear, ask ONE question only.
5. Use emojis to be friendly but not excessive.
WHAT YOU CAN DO:
- Parse expenses from natural language
- Explain who owes what in simple terms
- Suggest the fewest transactions to settle up
- Recalculate when someone says "Rahul didn't eat dessert"
- Create trip summaries
"""
EXPENSE_PARSER_PROMPT = """Extract expense details from the text below.
Return ONLY valid JSON, no markdown, no explanation.
Text: {text}
Group members: {members}
Default currency: {currency}
JSON format:
{{
  "title": "short name for expense",
  "amount": 0.0,
  "currency": "INR",
  "paid_by": "exact member name or null",
  "split_type": "equal",
  "participants": ["name1", "name2"],
  "category": "food|travel|accommodation|entertainment|shopping|utilities|other",
  "notes": null,
  "confidence": 0.95
}}
If amount is missing return: {{"error": "amount_missing"}}
If payer is unclear return: {{"error": "payer_unclear"}}
"""
BILL_SCAN_PROMPT = """Analyze this receipt/bill image.
Members who will split: {members}
Currency: {currency}
Return ONLY valid JSON:
{{
  "merchant": "name",
  "total": 0.0,
  "tax": null,
  "items": [{{"name": "item", "amount": 0.0, "quantity": 1}}],
  "suggested_total": 0.0,
  "confidence": 0.9
}}"""
EXPLAIN_BALANCE_PROMPT = """Explain these balances in simple, friendly language like talking to a friend.
Currency: {currency}
Balances: {balances}
Language: {language}
Keep it under 4 sentences. Be warm and clear. Use emojis."""
SETTLEMENT_EXPLAIN_PROMPT = """Explain this payment plan simply.
Currency: {currency}
Payments:
{transactions}
Language: {language}
Keep it under 3 sentences."""
TRIP_REPORT_PROMPT = """Create a short trip expense summary.
Trip: {trip_name}
Total: {total} {currency}
Categories: {categories}
Members: {members}
Expenses: {expense_count}
Language: {language}
Write 3-4 friendly sentences with one fun insight."""
