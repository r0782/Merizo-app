# backend/ai/ocr.py
import google.generativeai as genai
import base64, json

async def scan_bill(image_bytes: bytes, members: list, currency: str) -> dict:
    model = genai.GenerativeModel("gemini-1.5-flash")
    
    image_b64 = base64.b64encode(image_bytes).decode()
    
    prompt = f"""Analyze this bill/receipt image.
Members who will split: {', '.join(members)}
Currency: {currency}

Extract and return ONLY valid JSON:
{{
  "merchant": "restaurant/store name",
  "total": number,
  "tax": number or null,
  "tip": number or null,
  "items": [
    {{"name": "item name", "amount": number, "quantity": 1}}
  ],
  "suggested_splits": [
    {{"member": "name", "items": ["item1"], "subtotal": number}}
  ],
  "split_type": "equal|item",
  "confidence": 0.0-1.0
}}"""
    
    response = model.generate_content([
        {"mime_type": "image/jpeg", "data": image_b64},
        prompt
    ])
    
    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    
    return json.loads(text)