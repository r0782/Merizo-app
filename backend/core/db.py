"""Single MongoDB client + db instance shared by every module."""
from motor.motor_asyncio import AsyncIOMotorClient
from . import MONGO_URL, DB_NAME

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


async def ensure_indexes() -> None:
    await db.users.create_index("email", unique=True)
    await db.trips.create_index("id", unique=True)
    await db.trips.create_index("invite_token")
    await db.fx_cache.create_index("pair", unique=True)
    await db.reminders.create_index("user_id")
    await db.smart_limit_cache.create_index("user_id", unique=True)
