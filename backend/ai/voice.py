# backend/ai/voice.py
import openai, os, tempfile
from fastapi import UploadFile

client = openai.AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

SUPPORTED_LANGUAGES = {
    "en": "english", "hi": "hindi", "te": "telugu",
    "ta": "tamil", "kn": "kannada", "ml": "malayalam",
    "bn": "bengali", "mr": "marathi", "es": "spanish",
    "fr": "french", "ar": "arabic"
}

async def transcribe_and_parse(audio_file: UploadFile, language: str, members: list) -> dict:
    # 1. Transcribe with Whisper
    with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as f:
        f.write(await audio_file.read())
        tmp_path = f.name
    
    with open(tmp_path, "rb") as f:
        transcript = await client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            language=language,
            response_format="text"
        )
    
    # 2. Parse transcript into expense
    from .parser import parse_expense_from_text
    parsed = await parse_expense_from_text(transcript, members)
    
    return {
        "transcript": transcript,
        "parsed": parsed,
        "confidence": parsed.get("confidence", 0.8)
    }