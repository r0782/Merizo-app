"""Shared environment / config loaded once for the whole app."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "demo@merizo.app")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "Demo@123")
DEMO_NAME = os.environ.get("DEMO_NAME", "Demo User")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"
