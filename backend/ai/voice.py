import os, tempfile
from openai import AsyncOpenAI
from .parser import parse_expense_from_text
client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
async def transcribe_audio(audio_bytes: bytes, language: str = "en") -> str:
    with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name
    with open(tmp_path, "rb") as f:
        transcript = await client.audio.transcriptions.create(model="whisper-1", file=f, language=language)
    return transcript.text
async def transcribe_and_parse(audio_bytes: bytes, members: list, currency: str, language: str = "en") -> dict:
    transcript = await transcribe_audio(audio_bytes, language)
    parsed = await parse_expense_from_text(transcript, members, currency)
    return {"transcript": transcript, "parsed": parsed}
