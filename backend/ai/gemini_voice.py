"""
Gemini — Speech-to-Text via multimodal generateContent (audio input).

Gemini has no dedicated STT endpoint; audio is passed as inline data
alongside a transcription instruction, same shape as the bill-scan image
call in ocr.py.
"""
import os
import asyncio

from google import genai
from google.genai import types

# "gemini-2.5-flash" (the pin used elsewhere in this codebase) 404s against
# the key actually configured here — Google's own error names this as the
# replacement. Confirmed working live against the real GEMINI_API_KEY.
MODEL = "gemini-3.6-flash"

_MIME_MAP = {
    "m4a": "audio/mp4", "wav": "audio/wav", "mp3": "audio/mpeg",
    "ogg": "audio/ogg", "webm": "audio/webm",
}

_client = None

def _get_client():
    global _client
    if _client is None:
        key = os.environ.get("GEMINI_API_KEY", "")
        if not key:
            raise RuntimeError("GEMINI_API_KEY not configured")
        _client = genai.Client(api_key=key)
    return _client


async def transcribe_audio_gemini(
    audio_bytes: bytes,
    language: str = "en",
    filename: str = "audio.m4a",
) -> str:
    """Transcribe audio using Gemini. Returns the transcript string, or raises on failure."""
    client = _get_client()
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "m4a"
    mime = _MIME_MAP.get(ext, "audio/mp4")

    contents = [
        types.Part(inline_data=types.Blob(mime_type=mime, data=audio_bytes)),
        "Transcribe this audio exactly as spoken, in its original language. "
        "Return only the raw transcript text — no preamble, no quotes, no commentary.",
    ]

    try:
        response = await client.aio.models.generate_content(model=MODEL, contents=contents)
    except Exception:
        response = await asyncio.to_thread(
            client.models.generate_content, model=MODEL, contents=contents
        )

    return (response.text or "").strip()
