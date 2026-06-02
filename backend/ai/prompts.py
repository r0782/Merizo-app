# backend/ai/prompts.py

LANGUAGE_INSTRUCTIONS = {
    "en": "Respond in English.",
    "te": "తెలుగులో సమాధానం ఇవ్వండి. Use Telugu script.",
    "hi": "हिंदी में जवाब दें। Use Devanagari script.",
    "ta": "தமிழில் பதிலளிக்கவும். Use Tamil script.",
    "kn": "ಕನ್ನಡದಲ್ಲಿ ಉತ್ತರಿಸಿ. Use Kannada script.",
    "ml": "മലയാളത്തിൽ ഉത്തരം നൽകുക. Use Malayalam script.",
    "bn": "বাংলায় উত্তর দিন। Use Bengali script.",
    "mr": "मराठीत उत्तर द्या. Use Devanagari script.",
    "es": "Responde en español.",
    "fr": "Réponds en français.",
    "ar": "أجب باللغة العربية. Use Arabic script, RTL."
}

# Auto-detect language from user message
async def detect_language(text: str) -> str:
    model = genai.GenerativeModel("gemini-1.5-flash")
    r = model.generate_content(
        f"Detect language of this text. Return ONLY the 2-letter ISO code: {text}"
    )
    return r.text.strip()[:2].lower()