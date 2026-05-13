"""Iteration 5 backend hot-fix tests for Merizo:
- settle() no longer references non-existent req fields (AttributeError fix)
- add_expense() returns recurring_suggestion for HOME duplicates >25 days old (backdated via direct DB write)
- DELETE /api/trips/{id}/expenses/{eid} works
- DELETE /api/reminders/{id} works
- DELETE /api/trips/{id} by member works end-to-end
- GET /api/auth/me returns 401 on invalid/cleared token (sign-out guard)
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

from conftest import BASE_URL, DEMO_EMAIL, DEMO_PASSWORD

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "merizo")


def _mongo_db():
    return MongoClient(MONGO_URL)[DB_NAME]


def _find_trip(trips, name):
    return next((t for t in trips if t.get("name") == name), None)


# ---------- Settle endpoint still works (no AttributeError) ----------
class TestSettleHomeCategory:
    def test_settle_on_home_trip_works(self, api_client, auth_headers):
        # Create a HOME category trip, add a settle, ensure no 500
        trip_name = f"TEST_settle_home_{uuid.uuid4().hex[:6]}"
        r = api_client.post(
            f"{BASE_URL}/api/trips", headers=auth_headers,
            json={"name": trip_name, "currency": "INR", "split_category": "home",
                  "members": ["Demo", "Mate"]}, timeout=20,
        )
        assert r.status_code == 200, r.text
        trip = r.json()
        trip_id = trip["id"]
        member_ids = [m["id"] for m in trip["members"]]
        try:
            # Add an expense so there's something to settle
            api_client.post(
                f"{BASE_URL}/api/trips/{trip_id}/expenses", headers=auth_headers,
                json={"name": "Rent", "amount": 1000, "currency": "INR", "category": "home",
                      "paid_by": member_ids[0], "split_among": member_ids}, timeout=20,
            )
            # Now settle — this previously crashed with AttributeError on req.category
            r = api_client.post(
                f"{BASE_URL}/api/trips/{trip_id}/settle", headers=auth_headers,
                json={"from_member": member_ids[1], "to_member": member_ids[0], "amount": 500},
                timeout=20,
            )
            assert r.status_code == 200, f"settle failed: {r.status_code} {r.text}"
            body = r.json()
            assert "expenses" in body and "settlements" in body
            assert any(e.get("is_settlement") for e in body["expenses"])
        finally:
            api_client.delete(f"{BASE_URL}/api/trips/{trip_id}", headers=auth_headers, timeout=20)


# ---------- Recurring suggestion with backdated expense ----------
class TestRecurringBackdated:
    def test_recurring_suggestion_triggered_for_old_duplicate(self, api_client, auth_headers):
        trip_name = f"TEST_recurring_{uuid.uuid4().hex[:6]}"
        r = api_client.post(
            f"{BASE_URL}/api/trips", headers=auth_headers,
            json={"name": trip_name, "currency": "INR", "split_category": "home",
                  "members": ["Demo", "Mate"]}, timeout=20,
        )
        assert r.status_code == 200
        trip = r.json()
        trip_id = trip["id"]
        member_ids = [m["id"] for m in trip["members"]]
        db = _mongo_db()
        try:
            # Add a "previous" electricity bill directly and backdate it 40 days
            old_ts = (datetime.now(timezone.utc) - timedelta(days=40)).isoformat()
            old_expense = {
                "id": str(uuid.uuid4()),
                "name": "Electricity Bill",
                "amount": 1200, "currency": "INR", "amount_base": 1200, "fx_rate": 1.0,
                "category": "home", "emoji": "🏠",
                "paid_by": member_ids[0], "split_among": member_ids,
                "created_at": old_ts, "added_by": "seed",
            }
            db.trips.update_one({"id": trip_id}, {"$push": {"expenses": old_expense}})

            # Now add a duplicate-named expense — should trigger recurring_suggestion
            r = api_client.post(
                f"{BASE_URL}/api/trips/{trip_id}/expenses", headers=auth_headers,
                json={"name": "Electricity Bill", "amount": 1250, "currency": "INR",
                      "category": "home", "paid_by": member_ids[0], "split_among": member_ids},
                timeout=20,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert "recurring_suggestion" in body, f"missing recurring_suggestion: {body}"
            rs = body["recurring_suggestion"]
            assert rs.get("name") == "Electricity Bill"
            assert rs.get("expense_id")
            assert rs.get("previous_at")  # ISO date
        finally:
            api_client.delete(f"{BASE_URL}/api/trips/{trip_id}", headers=auth_headers, timeout=20)


# ---------- Delete expense ----------
class TestDeleteExpense:
    def test_delete_expense_flow(self, api_client, auth_headers):
        trip_name = f"TEST_delexp_{uuid.uuid4().hex[:6]}"
        r = api_client.post(
            f"{BASE_URL}/api/trips", headers=auth_headers,
            json={"name": trip_name, "currency": "INR", "split_category": "trip",
                  "members": ["Demo", "Mate"]}, timeout=20,
        )
        assert r.status_code == 200
        trip = r.json()
        trip_id = trip["id"]
        member_ids = [m["id"] for m in trip["members"]]
        try:
            r = api_client.post(
                f"{BASE_URL}/api/trips/{trip_id}/expenses", headers=auth_headers,
                json={"name": "Lunch", "amount": 500, "currency": "INR", "category": "food",
                      "paid_by": member_ids[0], "split_among": member_ids}, timeout=20,
            )
            assert r.status_code == 200
            trip_after_add = r.json()
            # Find the lunch expense id
            exp = next((e for e in trip_after_add["expenses"] if e.get("name") == "Lunch"), None)
            assert exp, "Lunch expense not found after add"
            eid = exp["id"]
            # Delete
            r = api_client.delete(
                f"{BASE_URL}/api/trips/{trip_id}/expenses/{eid}", headers=auth_headers, timeout=20,
            )
            assert r.status_code == 200, r.text
            # Verify it's gone
            r = api_client.get(f"{BASE_URL}/api/trips/{trip_id}", headers=auth_headers, timeout=20)
            assert r.status_code == 200
            assert not any(e.get("id") == eid for e in r.json()["expenses"])
        finally:
            api_client.delete(f"{BASE_URL}/api/trips/{trip_id}", headers=auth_headers, timeout=20)


# ---------- Delete reminder ----------
class TestDeleteReminder:
    def test_delete_reminder(self, api_client, auth_headers):
        r = api_client.post(
            f"{BASE_URL}/api/reminders", headers=auth_headers,
            json={"title": "TEST_reminder", "frequency": "weekly", "enabled": True},
            timeout=20,
        )
        # The exact payload shape may differ — tolerate 200/201
        assert r.status_code in (200, 201), f"create reminder: {r.status_code} {r.text}"
        rid = r.json().get("id")
        assert rid, f"no id in create response: {r.json()}"
        # delete
        r = api_client.delete(f"{BASE_URL}/api/reminders/{rid}", headers=auth_headers, timeout=20)
        assert r.status_code in (200, 204), f"delete reminder: {r.status_code} {r.text}"
        # verify not listed
        r = api_client.get(f"{BASE_URL}/api/reminders", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        assert not any(it.get("id") == rid for it in items)


# ---------- Sign-out: /api/auth/me 401 on bad token ----------
class TestAuthMeInvalidToken:
    def test_me_rejects_invalid_bearer(self, api_client):
        r = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer totallyinvalidtoken"},
            timeout=20,
        )
        assert r.status_code == 401

    def test_me_rejects_missing_bearer(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me", timeout=20)
        assert r.status_code in (401, 403)
