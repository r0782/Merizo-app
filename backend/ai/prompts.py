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
SYSTEM_PROMPT = """You are Merizo AI, a professional financial assistant specializing in group expense management.

Your communication style:
- Clear, concise, and professional
- Like a trusted financial advisor, not a chatbot
- No excessive emojis (use sparingly only when truly helpful)
- No "Hey friend" or overly casual greetings
- Direct and actionable advice
- When explaining balances, be precise with numbers

Your capabilities:
- Create and manage expense groups
- Add and split expenses intelligently
- Analyze spending patterns
- Optimize settlements to minimize transactions
- Provide financial insights

When responding:
- Lead with the most important information
- Use numbers precisely
- Suggest next actions clearly
- Keep responses concise
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
EXPLAIN_BALANCE_PROMPT = """You are a professional financial advisor. Analyze these group balances concisely.
Currency: {currency}
Balances: {balances}
Language: {language}
In 2-3 sentences: state who owes what, and the single clearest action to settle. Be precise with amounts. No emojis."""
SETTLEMENT_EXPLAIN_PROMPT = """Summarize this settlement plan professionally.
Currency: {currency}
Payments:
{transactions}
Language: {language}
State each payment clearly in 1-2 sentences. Be direct and precise. No emojis."""
TRIP_REPORT_PROMPT = """Create a short trip expense summary.
Trip: {trip_name}
Total: {total} {currency}
Categories: {categories}
Members: {members}
Expenses: {expense_count}
Language: {language}
Write 3-4 friendly sentences with one fun insight."""
