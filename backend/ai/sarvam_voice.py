"""
Sarvam AI — Speech-to-Text (STT) and Text-to-Speech (TTS).

STT:  POST /speech-to-text         → transcript string
TTS:  POST /text-to-speech         → list of base64-encoded WAV chunks

Language code map (ISO 639-1 app code → BCP-47 Sarvam code):
  en → en-IN,  hi → hi-IN,  te → te-IN,  ta → ta-IN,
  kn → kn-IN,  ml → ml-IN,  mr → mr-IN,  bn → bn-IN,
  gu → gu-IN,  pa → pa-IN,  ur → ur-IN (fallback: en-IN)
"""
import base64
import io
import logging
import os
import wave

import httpx

logger = logging.getLogger("merizo.sarvam_voice")

SARVAM_BASE = "https://api.sarvam.ai"

# Sarvam BCP-47 code for each app language code
LANG_CODE: dict[str, str] = {
    "en": "en-IN",
    "hi": "hi-IN",
    "te": "te-IN",
    "ta": "ta-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "mr": "mr-IN",
    "bn": "bn-IN",
    "gu": "gu-IN",
    "pa": "pa-IN",
    "ur": "ur-IN",
}

# TTS voice options — bulbul:v2 voices (v1 is retired; its speaker names
# like "meera"/"pavithra"/"arvind" don't exist on v2 and error out).
# Valid v2 speakers: anushka, manisha, vidya, arya, abhilash, karun, hitesh.
TTS_SPEAKERS: dict[str, str] = {
    "en": "anushka",
    "hi": "manisha",
    "te": "vidya",
    "ta": "arya",
    "kn": "abhilash",
    "ml": "karun",
    "mr": "hitesh",
    "bn": "anushka",
    "gu": "manisha",
    "pa": "vidya",
    "ur": "arya",
}


def _api_key() -> str:
    key = os.environ.get("SARVAM_API_KEY", "")
    if not key:
        raise RuntimeError("SARVAM_API_KEY not configured")
    return key


def _bcp47(lang: str) -> str:
    return LANG_CODE.get(lang, "en-IN")


# ── STT ───────────────────────────────────────────────────────────────────────

async def transcribe_audio_sarvam(
    audio_bytes: bytes,
    language: str = "en",
    filename: str = "audio.m4a",
) -> str:
    """
    Transcribe audio using Sarvam saaras:v4 (saarika:v2.5 is on Sarvam's
    deprecation path — saaras is the current recommended STT model).

    Returns the transcript string, or raises on failure.
    """
    key = _api_key()
    lang_code = _bcp47(language)
    # Determine MIME type from filename
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "m4a"
    mime_map = {"m4a": "audio/mp4", "wav": "audio/wav", "mp3": "audio/mpeg", "ogg": "audio/ogg", "webm": "audio/webm"}
    mime = mime_map.get(ext, "audio/mp4")

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{SARVAM_BASE}/speech-to-text",
            headers={"api-subscription-key": key},
            files={"file": (filename, audio_bytes, mime)},
            data={
                "model": "saaras:v4",
                "language_code": lang_code,
                "mode": "transcribe",
            },
        )
        r.raise_for_status()
        data = r.json()
        return data.get("transcript", "") or ""


# ── TTS ───────────────────────────────────────────────────────────────────────

async def text_to_speech_sarvam(
    text: str,
    language: str = "en",
    speed: float = 1.0,
) -> bytes:
    """
    Convert text to speech using Sarvam bulbul:v2.

    Returns raw WAV bytes (16 kHz, mono).
    Sarvam TTS accepts up to 500 chars per input; we chunk automatically.
    """
    if not text.strip():
        return b""

    key = _api_key()
    lang_code = _bcp47(language)
    speaker = TTS_SPEAKERS.get(language, "anushka")

    # Chunk text into ≤500-char segments
    chunks: list[str] = []
    while len(text) > 500:
        split_at = text.rfind(" ", 0, 500)
        if split_at == -1:
            split_at = 500
        chunks.append(text[:split_at].strip())
        text = text[split_at:].strip()
    if text:
        chunks.append(text)

    # Clamp pace (Sarvam accepts 0.5–2.0)
    pace = max(0.5, min(2.0, speed))

    payload = {
        "inputs": chunks,
        "target_language_code": lang_code,
        "speaker": speaker,
        "pitch": 0.0,
        "pace": pace,
        "loudness": 1.0,
        "speech_sample_rate": 16000,
        "enable_preprocessing": True,
        "model": "bulbul:v2",
    }

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{SARVAM_BASE}/text-to-speech",
            json=payload,
            headers={
                "api-subscription-key": key,
                "Content-Type": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()

    # Each chunk comes back as a complete, independent WAV file (its own
    # header). Naively joining the raw bytes glues a second file's header
    # into the middle of the audio stream, which glitches or truncates
    # playback — so decode each WAV's PCM frames and re-encode as one file.
    audio_chunks: list[bytes] = [base64.b64decode(b64) for b64 in data.get("audios", [])]
    return _concat_wavs(audio_chunks)


def _concat_wavs(chunks: list[bytes]) -> bytes:
    if not chunks:
        return b""
    if len(chunks) == 1:
        return chunks[0]

    frames: list[bytes] = []
    params = None
    for chunk in chunks:
        with wave.open(io.BytesIO(chunk), "rb") as w:
            if params is None:
                params = w.getparams()
            frames.append(w.readframes(w.getnframes()))

    out = io.BytesIO()
    with wave.open(out, "wb") as writer:
        writer.setparams(params)
        for f in frames:
            writer.writeframes(f)
    return out.getvalue()


# ── Language detection ────────────────────────────────────────────────────────

async def detect_language_sarvam(text: str) -> str:
    """
    Detect the language of a text string using Sarvam.
    Returns an app language code (e.g. "hi", "te", "en").
    """
    key = _api_key()
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{SARVAM_BASE}/text:detect_language",
            json={"input": text[:300]},
            headers={
                "api-subscription-key": key,
                "Content-Type": "application/json",
            },
        )
        if r.status_code != 200:
            return "en"
        data = r.json()
        # Sarvam returns BCP-47 e.g. "hi-IN" → extract "hi"
        bcp = data.get("language_code", "en-IN")
        code = bcp.split("-")[0].lower()
        return code if code in LANG_CODE else "en"
