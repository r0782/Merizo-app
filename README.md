# Merizo

Merizo is a group expense-splitting app (trips, shared bills, settlements) with an AI layer for
chat, receipt scanning, and voice input. It's a monorepo: a FastAPI backend and an Expo
(React Native) frontend.

## Tech stack

**Backend** — `backend/`
- FastAPI + uvicorn
- Supabase (Postgres) as the data layer, via `supabase-py`
- App-level JWT auth (separate from Supabase Auth)
- AI providers: Gemini, Groq, Sarvam, OpenAI — chat, receipt OCR, voice transcription, settlement
  explanations, trip reports
- Google Cloud Vision (`DOCUMENT_TEXT_DETECTION`) as the primary OCR path for bill scanning
  (handles printed and handwritten receipts), falling back to Groq's vision model on the raw
  image if Vision isn't configured or fails

**Frontend** — `frontend/`
- Expo SDK 54 + Expo Router (file-based routing), React Native 0.81, TypeScript
- Supabase JS client for Auth (OTP / OAuth), `axios` for the FastAPI backend
- `i18next` / `react-i18next` for localization (11 languages defined; UI coverage is still
  partial — see [Known limitations](#known-limitations))
- A native Android module (`plugins/android-speech-native/`, Java) wrapping
  `android.speech.SpeechRecognizer` for free, on-device, low-latency voice input — this means the
  app needs a **custom dev client**, not plain Expo Go (see below)

## Project structure

```
backend/
  server.py              # FastAPI app — routes, auth, core API
  core/security.py        # rate limiting, validation, sessions, audit log
  ai/                      # chat orchestration, OCR, voice, settlement, report generation
    providers/             # gemini.py, groq_provider.py, sarvam.py
  migrations/              # incremental SQL (base schema lives in Supabase, not checked in)
  tests/

frontend/
  app/                     # Expo Router screens ((tabs)/, auth/, split/[id], invite/[tripId], ...)
  src/
    lib/                   # api client, auth context, i18n, androidSpeech bridge
    components/            # charts, custom UI kit
  plugins/                 # config plugins applied on `expo prebuild`
    android-speech-native/  # native Java SpeechRecognizer module
    withAndroidSpeechRecognizer.js
```

## Prerequisites

- Python 3.11.9 (`backend/.python-version`)
- Node.js + npm (or yarn)
- A Supabase project (Postgres) with the app's tables already created — the base schema isn't
  checked into this repo (see [Known limitations](#known-limitations))
- For Android: Android SDK + platform-tools (`adb`) and a JDK (17), for building the custom dev
  client

## Backend — setup & run

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows; venv/bin/activate on macOS/Linux
pip install -r requirements.txt

copy .env.example .env           # fill in SUPABASE_URL, SUPABASE_KEY (service_role), JWT_SECRET
                                  # AI keys (GEMINI_API_KEY, GROQ_API_KEY, SARVAM_API_KEY,
                                  # GOOGLE_CLOUD_VISION_API_KEY, ...) are optional but unlock
                                  # AI chat / bill scanning / voice features

uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Health check: `GET http://localhost:8000/`. A demo account (`demo@merizo.app` / `Demo@123` by
default, configurable via `DEMO_EMAIL`/`DEMO_PASSWORD`) is auto-seeded on startup.

Run tests: `pytest` (from `backend/`, against a running server).

## Frontend — setup & run

```bash
cd frontend
npm install

copy .env.example .env           # set EXPO_PUBLIC_BACKEND_URL, Supabase anon key, EXPO_PUBLIC_APP_URL
```

**Web / iOS (Expo Go is fine, no native module involved there):**
```bash
npx expo start
```

**Android (requires the custom dev client, because of the native speech module):**
```bash
npx expo run:android      # builds + installs the dev client on a connected/emulated device
```
After the first `run:android`, day-to-day iteration can go back to `npx expo start` — it'll open
the already-installed dev client instead of Expo Go. Re-run `expo run:android` only when native
code changes (i.e. anything under `plugins/`).

### Running on a physical Android device via USB debugging

1. Enable Developer Options → USB debugging on the phone, connect via USB, accept the prompt.
2. `adb devices` should list it as `device` (not `unauthorized`).
3. Forward the backend port so the device can reach `http://localhost:8000` over USB:
   ```bash
   adb reverse tcp:8000 tcp:8000
   ```
   (Metro's port, 8081, is forwarded automatically by the Expo/React Native tooling.)
4. `npx expo run:android` (first time) or `npx expo start` (afterwards), with the backend already
   running.

`adb reverse` rules reset on unplug/replug, so re-run step 3 each session.

## Environment variables

See `backend/.env.example` and `frontend/.env.example` for the full list. Notable ones:

| Variable | Where | Purpose |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_KEY` | backend | Postgres data layer (service_role key, server-side only) |
| `JWT_SECRET` | backend | App-level auth tokens |
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `SARVAM_API_KEY` / `OPENAI_API_KEY` | backend | AI chat, OCR, voice — all optional, features degrade gracefully without them |
| `GOOGLE_CLOUD_VISION_API_KEY` | backend | Primary OCR path for bill scanning (needs billing enabled on the GCP project) |
| `EXPO_PUBLIC_BACKEND_URL` | frontend | Base URL of the FastAPI backend |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON` | frontend | Supabase Auth (anon key only) |

## Known limitations

- **No `schema.sql` in the repo** — the base Postgres schema (`users`, `trips`, `expenses`,
  `settlements`, `reminders`, ...) must already exist in the target Supabase project; only two
  incremental migrations are checked in (`backend/migrations/`).
- **i18n coverage is partial** — the locale infrastructure (`src/lib/i18n.ts`,
  `src/locales/*.json`) covers 11 languages, but only Home, Chat, Login, and the language picker
  itself currently read from it. Other screens are still hardcoded in English.
- **Android speech recognition is on-device only** — quality depends on the phone's Google
  Speech Services; no equivalent on-device path exists for iOS yet (iOS still uses the
  record-and-upload cloud STT flow).

## Deployment

- Backend: Render (`render.yaml`, `rootDir: backend`, `uvicorn server:app --host 0.0.0.0 --port $PORT`).
- Frontend: EAS Build (`frontend/eas.json`) for app store builds; `expo export` for web.
