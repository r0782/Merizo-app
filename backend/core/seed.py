"""Demo data seeded on startup so the demo user has 3 splits + reminders."""
import logging
import secrets
import uuid
from datetime import datetime, timezone, timedelta

from . import DEMO_EMAIL, DEMO_PASSWORD, DEMO_NAME
from .db import db
from .security import hash_password, verify_password

logger = logging.getLogger("merizo.seed")

DEMO_SPLITS = [
    {
        "name": "Goa Trip",
        "split_category": "trip",
        "cover_key": "goa",
        "destinations": ["goa"],
        "currency": "INR",
        "start_date": "2026-01-12",
        "end_date": "2026-01-16",
        "budget": 30000.0,
        "members": ["Aman", "Riya"],
        "expenses": [
            {"name": "Flights to Goa", "amount": 12000, "category": "trip", "emoji": "✈️", "paid_by_name": "Demo User", "split_among_names": ["Demo User", "Aman", "Riya"], "days_ago": 18},
            {"name": "Beach Resort 2 nights", "amount": 8400, "category": "home", "emoji": "🏠", "paid_by_name": "Aman", "split_among_names": ["Demo User", "Aman", "Riya"], "days_ago": 11},
            {"name": "Seafood dinner", "amount": 3600, "category": "food", "emoji": "🍽️", "paid_by_name": "Riya", "split_among_names": ["Demo User", "Aman", "Riya"], "days_ago": 4},
            {"name": "Scuba diving", "amount": 4500, "category": "friends", "emoji": "🎉", "paid_by_name": "Demo User", "split_among_names": ["Demo User", "Aman", "Riya"], "days_ago": 2},
            {"name": "Cabs around Goa", "amount": 2100, "category": "trip", "emoji": "🚗", "paid_by_name": "Aman", "split_among_names": ["Demo User", "Aman", "Riya"], "days_ago": 25},
        ],
    },
    {
        "name": "Manali Trip",
        "split_category": "trip",
        "cover_key": "manali",
        "destinations": ["manali"],
        "currency": "INR",
        "start_date": "2026-02-04",
        "end_date": "2026-02-08",
        "budget": 22000.0,
        "members": ["Karan"],
        "expenses": [
            {"name": "Volvo bus", "amount": 3200, "category": "trip", "emoji": "🚌", "paid_by_name": "Demo User", "split_among_names": ["Demo User", "Karan"], "days_ago": 20},
            {"name": "Cottage stay", "amount": 6800, "category": "home", "emoji": "🏠", "paid_by_name": "Karan", "split_among_names": ["Demo User", "Karan"], "days_ago": 14},
            {"name": "Snow trek + gear", "amount": 4400, "category": "friends", "emoji": "⛷️", "paid_by_name": "Demo User", "split_among_names": ["Demo User", "Karan"], "days_ago": 8},
        ],
    },
    {
        "name": "College Buddies",
        "split_category": "friends",
        "cover_key": "friends",
        "destinations": [],
        "currency": "INR",
        "budget": 8000.0,
        "members": ["Neha", "Vikram", "Sana"],
        "expenses": [
            {"name": "Pizza night", "amount": 2400, "category": "food", "emoji": "🍕", "paid_by_name": "Neha", "split_among_names": ["Demo User", "Neha", "Vikram", "Sana"], "days_ago": 6},
            {"name": "Movie tickets", "amount": 1600, "category": "friends", "emoji": "🎬", "paid_by_name": "Demo User", "split_among_names": ["Demo User", "Neha", "Vikram", "Sana"], "days_ago": 13},
        ],
    },
]


async def seed_demo() -> None:
    existing = await db.users.find_one({"email": DEMO_EMAIL})
    if existing:
        if not verify_password(DEMO_PASSWORD, existing["password_hash"]):
            await db.users.update_one(
                {"email": DEMO_EMAIL},
                {"$set": {"password_hash": hash_password(DEMO_PASSWORD), "name": DEMO_NAME}},
            )
        existing_trip_count = await db.trips.count_documents({"owner_id": existing["id"]})
        if existing_trip_count > 0:
            logger.info(f"Demo user already exists with {existing_trip_count} trips. Skipping seed.")
            return
        user_id = existing["id"]
    else:
        user_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": user_id,
            "email": DEMO_EMAIL,
            "name": DEMO_NAME,
            "password_hash": hash_password(DEMO_PASSWORD),
            "avatar": None,
            "created_at": datetime.now(timezone.utc),
        })

    for idx, spec in enumerate(DEMO_SPLITS):
        trip_id = str(uuid.uuid4())
        owner_member_id = str(uuid.uuid4())
        members = [{"id": owner_member_id, "name": DEMO_NAME, "user_id": user_id, "registered": True}]
        name_to_id = {DEMO_NAME: owner_member_id}
        for nm in spec["members"]:
            mid = str(uuid.uuid4())
            members.append({"id": mid, "name": nm, "user_id": None, "registered": False})
            name_to_id[nm] = mid

        expenses = []
        for i, e in enumerate(spec["expenses"]):
            days_ago = e.get("days_ago", i * 6 + idx * 2 + 1)
            exp = {
                "id": str(uuid.uuid4()),
                "name": e["name"],
                "amount": e["amount"],
                "currency": spec["currency"],
                "amount_base": e["amount"],
                "fx_rate": 1.0,
                "category": e["category"],
                "emoji": e["emoji"],
                "paid_by": name_to_id[e["paid_by_name"]],
                "split_among": [name_to_id[n] for n in e["split_among_names"]],
                "created_at": (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat(),
                "added_by": user_id,
            }
            expenses.append(exp)

        trip = {
            "id": trip_id,
            "name": spec["name"],
            "split_category": spec["split_category"],
            "cover_key": spec["cover_key"],
            "destinations": spec["destinations"],
            "currency": spec["currency"],
            "start_date": spec.get("start_date"),
            "end_date": spec.get("end_date"),
            "budget": spec.get("budget"),
            "owner_id": user_id,
            "members": members,
            "expenses": expenses,
            "invite_token": secrets.token_urlsafe(12),
            "created_at": datetime.now(timezone.utc),
        }
        await db.trips.insert_one(trip)
    logger.info(f"Seeded demo user with {len(DEMO_SPLITS)} splits.")


async def seed_demo_reminders() -> None:
    user = await db.users.find_one({"email": DEMO_EMAIL})
    if not user:
        return
    existing = await db.reminders.count_documents({"user_id": user["id"]})
    if existing > 0:
        return
    now = datetime.now(timezone.utc)
    samples = [
        {"title": "Pay Aman for Goa flights", "amount": 4000, "days": 2},
        {"title": "Settle Karan for Manali stay", "amount": 3400, "days": 5},
        {"title": "Collect from Neha for pizza", "amount": 600, "days": 7},
    ]
    for s in samples:
        await db.reminders.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "title": s["title"],
            "amount": s["amount"],
            "due_date": (now + timedelta(days=s["days"])).date().isoformat(),
            "trip_id": None,
            "completed": False,
            "created_at": now,
        })
    logger.info(f"Seeded {len(samples)} demo reminders.")
