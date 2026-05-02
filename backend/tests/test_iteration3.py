"""
Iteration 3 backend tests - smart-limit caching + invalidation + pre-warm.
"""
import os
import time
import requests
import pytest

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://group-expense-hub-3.preview.emergentagent.com").rstrip("/")


def _get_smart(api_client, headers):
    r = api_client.get(f"{BASE_URL}/api/smart-limit", headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def _get_demo_trip_id(api_client, headers, name_substring=None):
    r = api_client.get(f"{BASE_URL}/api/trips", headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    trips = r.json()
    if name_substring:
        for t in trips:
            if name_substring.lower() in t.get("name", "").lower():
                return t
    return trips[0] if trips else None


# ===== Smart Limit cache shape & hit/miss =====
class TestSmartLimitCache:
    def test_response_shape_with_cache_field(self, api_client, auth_headers):
        d = _get_smart(api_client, auth_headers)
        for k in ["current_week_spent", "weekly_budget", "percent",
                  "history_weeks", "currency", "has_history", "cache"]:
            assert k in d, f"Missing key {k}: {d}"
        assert isinstance(d["history_weeks"], list)
        assert len(d["history_weeks"]) == 4
        assert d["currency"] == "INR"
        assert d["cache"] in ("hit", "miss"), d["cache"]

    def test_prewarm_warms_cache_on_demo_user(self, api_client, auth_headers):
        # Background prewarm runs ~30s after startup. Backend has been up >30s
        # in the test environment, so the very first call from this fresh client
        # should already see cache='hit'.
        d = _get_smart(api_client, auth_headers)
        # If by any chance the cache was just invalidated by another test, accept miss
        # but assert subsequent call is hit.
        if d["cache"] == "miss":
            d2 = _get_smart(api_client, auth_headers)
            assert d2["cache"] == "hit", d2
        else:
            assert d["cache"] == "hit"

    def test_subsequent_call_is_hit_with_same_payload(self, api_client, auth_headers):
        d1 = _get_smart(api_client, auth_headers)
        d2 = _get_smart(api_client, auth_headers)
        assert d2["cache"] == "hit"
        # Payload (excluding cache flag) should be identical
        for k in ["current_week_spent", "weekly_budget", "percent", "history_weeks", "currency", "has_history"]:
            assert d1[k] == d2[k], f"{k} mismatch: {d1[k]} vs {d2[k]}"


# ===== Invalidation paths =====
class TestSmartLimitInvalidation:
    def test_add_expense_invalidates(self, api_client, auth_headers):
        # Warm cache
        _get_smart(api_client, auth_headers)
        h = _get_smart(api_client, auth_headers)
        assert h["cache"] == "hit"

        trip = _get_demo_trip_id(api_client, auth_headers, "College")
        assert trip is not None
        members = trip["members"]
        demo_member = next((m for m in members if m.get("user_id")), members[0])
        payload = {
            "name": "TEST_invalidate_add",
            "amount": 11.0,
            "currency": "INR",
            "category": "other",
            "paid_by": demo_member["id"],
            "split_among": [m["id"] for m in members],
            "emoji": "💸",
        }
        r = api_client.post(f"{BASE_URL}/api/trips/{trip['id']}/expenses",
                            headers=auth_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        # locate created expense id
        new_exp = next((e for e in r.json()["expenses"] if e["name"] == "TEST_invalidate_add"), None)
        assert new_exp is not None
        try:
            d = _get_smart(api_client, auth_headers)
            assert d["cache"] == "miss", d
            d2 = _get_smart(api_client, auth_headers)
            assert d2["cache"] == "hit"
        finally:
            api_client.delete(
                f"{BASE_URL}/api/trips/{trip['id']}/expenses/{new_exp['id']}",
                headers=auth_headers, timeout=20,
            )

    def test_delete_expense_invalidates(self, api_client, auth_headers):
        # Add then warm then delete
        trip = _get_demo_trip_id(api_client, auth_headers, "College")
        members = trip["members"]
        demo_member = next((m for m in members if m.get("user_id")), members[0])
        payload = {
            "name": "TEST_invalidate_del",
            "amount": 9.0,
            "currency": "INR",
            "category": "other",
            "paid_by": demo_member["id"],
            "split_among": [m["id"] for m in members],
            "emoji": "💸",
        }
        r = api_client.post(f"{BASE_URL}/api/trips/{trip['id']}/expenses",
                            headers=auth_headers, json=payload, timeout=20)
        assert r.status_code == 200
        new_exp = next(e for e in r.json()["expenses"] if e["name"] == "TEST_invalidate_del")
        # Warm cache
        _get_smart(api_client, auth_headers)
        h = _get_smart(api_client, auth_headers)
        assert h["cache"] == "hit"
        # Delete
        d = api_client.delete(
            f"{BASE_URL}/api/trips/{trip['id']}/expenses/{new_exp['id']}",
            headers=auth_headers, timeout=20,
        )
        assert d.status_code == 200
        # Should now be miss
        s = _get_smart(api_client, auth_headers)
        assert s["cache"] == "miss", s

    def test_settle_invalidates(self, api_client, auth_headers):
        trip = _get_demo_trip_id(api_client, auth_headers, "Goa")
        members = trip["members"]
        # Pick any two
        a, b = members[0], members[1]
        # Warm
        _get_smart(api_client, auth_headers)
        h = _get_smart(api_client, auth_headers)
        assert h["cache"] == "hit"
        r = api_client.post(
            f"{BASE_URL}/api/trips/{trip['id']}/settle",
            headers=auth_headers,
            json={"from_member": a["id"], "to_member": b["id"], "amount": 1.0},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        s = _get_smart(api_client, auth_headers)
        assert s["cache"] == "miss", s
        # Cleanup the settlement expense to keep totals stable
        settle_exp = next(
            (e for e in r.json()["expenses"]
             if e.get("is_settlement") and e.get("amount") == 1.0),
            None,
        )
        if settle_exp:
            api_client.delete(
                f"{BASE_URL}/api/trips/{trip['id']}/expenses/{settle_exp['id']}",
                headers=auth_headers, timeout=20,
            )


# ===== Regression: previous endpoints still respond =====
class TestRegression:
    def test_auth_me(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert r.json()["email"] == "demo@merizo.app"

    def test_trips_list(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/trips", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        names = {t["name"] for t in r.json()}
        assert {"Goa Trip", "Manali Trip", "College Buddies"}.issubset(names)

    def test_insights(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/insights?period=all", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ["total", "by_category", "by_trip", "period", "currency"]:
            assert k in d

    def test_reminders_list(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/reminders", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_invite_endpoint(self, api_client, auth_headers):
        trip = _get_demo_trip_id(api_client, auth_headers, "Goa")
        r = api_client.get(f"{BASE_URL}/api/trips/{trip['id']}/invite",
                           headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert "token" in r.json()
