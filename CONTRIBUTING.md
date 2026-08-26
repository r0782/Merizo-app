# Contributing to Merizo

Thanks for taking the time to contribute! This is a monorepo: a FastAPI
backend (`backend/`) and an Expo/React Native frontend (`frontend/`).

## Getting set up

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env         # fill in your own Supabase/JWT/API keys — never commit .env
uvicorn server:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env         # fill in EXPO_PUBLIC_BACKEND_URL etc. — never commit .env
npx expo start
```

See the root [README.md](README.md) for the full project structure and tech
stack.

## Making changes

1. Create a branch off `main`: `git checkout -b your-feature-name`.
2. Keep changes focused — a PR that does one thing is much easier to review
   than one that mixes a bug fix with a refactor.
3. Match the existing code style rather than introducing a new one.
4. If you change anything under `backend/migrations/`, note in your PR
   description that it needs to be run manually against Supabase (the base
   schema and migrations aren't auto-applied — see the README's known
   limitations).

## Before opening a PR

**Backend:**
```bash
cd backend
ruff check .          # lint
pytest                 # tests
```

**Frontend:**
```bash
cd frontend
npx tsc --noEmit       # typecheck
npm run lint           # eslint
```

CI runs all four automatically on every PR — please make sure they pass
locally first.

## Commit messages

Write commit messages that explain *why*, not just *what* — the diff already
shows what changed.

## Reporting bugs / requesting features

Please use the issue templates when opening an issue — they help make sure
we have what we need to reproduce or evaluate the request.

## Security issues

Do **not** open a public issue for a security vulnerability. See
[SECURITY.md](SECURITY.md) for how to report it privately.

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By
participating, you're expected to uphold it.
