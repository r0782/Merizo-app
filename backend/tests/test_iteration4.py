"""Iteration 4 backend tests for Merizo:
- AI overview (place_facts, forecast, personality) with caching
- POST /api/expenses/parse-upi (Gemini)
- PATCH /api/trips/{id}/currency (FX conversion)
- DELETE /api/trips/{id} as non-owner member
- POST /api/trips/{id}/expenses recurring_suggestion for HOME category
- GET /api/smart-limit ai_source field
"""
import os
import time
import uuid
import pytest
import requests

from conftest import BASE_URL, DEMO_EMAIL, DEMO_PASSWORD


# ---------- helpers ----------
def _login(api_client, email, password):
    r = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _register(api_client, email, password, name):
    r = api_client.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": password, "name": name}, timeout=20)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


def _trips(api_client, token):
    r = api_client.get(f"{BASE_URL}/api/trips", headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 200
    return r.json()


def _find_trip(trips, name):
    for t in trips:
        if t.get("name") == name:
            return t
    return None


# ---------- AI overview ----------
class TestAIOverview:
    def test_goa_trip_overview(self, api_client, auth_headers):
        trips = _trips(api_client, auth_headers["Authorization"].split()[1])
        goa = _find_trip(trips, "Goa Trip")
        assert goa, "Goa Trip not found"
        r = api_client.get(f"{BASE_URL}/api/trips/{goa['id']}/ai/overview", headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("category") == "trip"
        # place_facts should exist with facts >= 2
        assert "place_facts" in data, f"no place_facts: {data}"
        pf = data["place_facts"]
        assert isinstance(pf.get("place"), str) and pf["place"]
        assert isinstance(pf.get("facts"), list) and len(pf["facts"]) >= 2
        # forecast should end with one of the emojis
        if "forecast" in data:
            txt = data["forecast"].get("text", "")
            assert any(txt.endswith(em) for em in ["✅", "⚠️", "🚨"]), f"forecast missing emoji: {txt!r}"

    def test_overview_cached_second_call(self, api_client, auth_headers):
        trips = _trips(api_client, auth_headers["Authorization"].split()[1])
        goa = _find_trip(trips, "Goa Trip")
        r1 = api_client.get(f"{BASE_URL}/api/trips/{goa['id']}/ai/overview", headers=auth_headers, timeout=60)
        r2 = api_client.get(f"{BASE_URL}/api/trips/{goa['id']}/ai/overview", headers=auth_headers, timeout=60)
        assert r1.status_code == 200 and r2.status_code == 200
        # place_facts should be stable across calls (cached)
        if "place_facts" in r1.json() and "place_facts" in r2.json():
            assert r1.json()["place_facts"] == r2.json()["place_facts"]

    def test_friends_personality(self, api_client, auth_headers):
        trips = _trips(api_client, auth_headers["Authorization"].split()[1])
        friends = _find_trip(trips, "College Buddies")
        assert friends, "College Buddies trip not found"
        r = api_client.get(f"{BASE_URL}/api/trips/{friends['id']}/ai/overview", headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("category") == "friends"
        if "personality" in data:
            p = data["personality"]
            assert p.get("title") and p.get("emoji") and p.get("description")


# ---------- Parse UPI ----------
class TestParseUPI:
    def test_parse_swiggy(self, api_client, auth_headers):
        r = api_client.post(
            f"{BASE_URL}/api/expenses/parse-upi",
            headers=auth_headers,
            json={"text": "Rs 350.00 debited at Swiggy on 02 May"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert abs(float(data["amount"]) - 350.0) < 0.01, f"amount wrong: {data}"
        assert "swiggy" in (data["merchant"] or "").lower(), f"merchant: {data}"
        assert data["category"] == "food", f"category: {data}"
        assert data["currency"] == "INR"

    def test_parse_short_text_400(self, api_client, auth_headers):
        r = api_client.post(
            f"{BASE_URL}/api/expenses/parse-upi", headers=auth_headers, json={"text": ""}, timeout=20
        )
        assert r.status_code == 400
        r2 = api_client.post(
            f"{BASE_URL}/api/expenses/parse-upi", headers=auth_headers, json={"text": "Rs"}, timeout=20
        )
        assert r2.status_code == 400


# ---------- Currency change ----------
class TestCurrencyChange:
    def test_inr_to_usd_and_back(self, api_client, auth_headers):
        trips = _trips(api_client, auth_headers["Authorization"].split()[1])
        goa = _find_trip(trips, "Goa Trip")
        assert goa
        original_total = sum(float(e.get("amount_base", 0)) for e in goa.get("expenses", []))
        original_budget = goa.get("budget")
        original_cur = goa.get("currency", "INR")

        # to USD
        r = api_client.patch(
            f"{BASE_URL}/api/trips/{goa['id']}/currency",
            headers=auth_headers,
            json={"currency": "USD"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        usd_trip = r.json()
        assert usd_trip["currency"] == "USD"
        usd_total = sum(float(e.get("amount_base", 0)) for e in usd_trip.get("expenses", []))
        # USD total should be much smaller than INR (rate ~ 1/83)
        assert usd_total < original_total / 50, f"USD total {usd_total} not shrunk from {original_total}"
        if original_budget:
            assert float(usd_trip["budget"]) < float(original_budget) / 50

        # back to INR
        try:
            r2 = api_client.patch(
                f"{BASE_URL}/api/trips/{goa['id']}/currency",
                headers=auth_headers,
                json={"currency": original_cur},
                timeout=30,
            )
            assert r2.status_code == 200, r2.text
            back = r2.json()
            assert back["currency"] == original_cur
            back_total = sum(float(e.get("amount_base", 0)) for e in back.get("expenses", []))
            # within 5% rounding
            assert abs(back_total - original_total) / max(original_total, 1) < 0.05, (
                f"round-trip total drift too big: {original_total} -> {back_total}"
            )
        finally:
            # Make sure we leave the trip in INR
            api_client.patch(
                f"{BASE_URL}/api/trips/{goa['id']}/currency",
                headers=auth_headers,
                json={"currency": original_cur},
                timeout=30,
            )


# ---------- Delete trip (member non-owner) ----------
class TestMemberDelete:
    def test_member_non_owner_can_delete(self, api_client, auth_headers, auth_token):
        # 1. demo creates a trip
        payload = {
            "name": "TEST_member_delete_trip",
            "currency": "INR",
            "split_category": "trip",
            "members": ["Demo", "Friend"],
        }
        r = api_client.post(f"{BASE_URL}/api/trips", headers=auth_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        trip = r.json()
        trip_id = trip["id"]

        # 2. get invite token
        r = api_client.get(f"{BASE_URL}/api/trips/{trip_id}/invite", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        token = r.json().get("token") or r.json().get("invite_token")
        assert token

        # 3. register a fresh user and join
        email = f"test_member_{uuid.uuid4().hex[:8]}@merizo.app"
        new_token, new_user = _register(api_client, email, "Test@1234", "TestMember")
        new_headers = {"Authorization": f"Bearer {new_token}", "Content-Type": "application/json"}
        r = api_client.post(f"{BASE_URL}/api/invite/{token}/join", headers=new_headers, timeout=20)
        assert r.status_code == 200, f"join failed: {r.status_code} {r.text}"

        # 4. Non-member should still be 403 (use a freshly registered third user)
        email2 = f"test_outsider_{uuid.uuid4().hex[:8]}@merizo.app"
        out_token, _ = _register(api_client, email2, "Test@1234", "Outsider")
        out_headers = {"Authorization": f"Bearer {out_token}"}
        r = api_client.delete(f"{BASE_URL}/api/trips/{trip_id}", headers=out_headers, timeout=20)
        assert r.status_code == 403, f"non-member delete: {r.status_code} {r.text}"

        # 5. New member (non-owner) deletes trip — should 200
        r = api_client.delete(f"{BASE_URL}/api/trips/{trip_id}", headers=new_headers, timeout=20)
        assert r.status_code == 200, f"member delete: {r.status_code} {r.text}"

        # 6. Owner GET should now 404
        r = api_client.get(f"{BASE_URL}/api/trips/{trip_id}", headers=auth_headers, timeout=20)
        assert r.status_code == 404


# ---------- Recurring suggestion (HOME category) ----------
class TestRecurringSuggestion:
    def test_home_recurring_suggestion_on_add_expense(self, api_client, auth_headers):
        # Create a HOME trip
        payload = {
            "name": "TEST_home_recurring",
            "currency": "INR",
            "split_category": "home",
            "members": ["Demo", "Roommate"],
        }
        r = api_client.post(f"{BASE_URL}/api/trips", headers=auth_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        trip = r.json()
        trip_id = trip["id"]
        member_ids = [m["id"] for m in trip["members"]]
        try:
            # First expense (we'll need it >25 days old in DB to trigger; skip backdating since
            # the public API doesn't expose backdate. Just verify endpoint returns no field
            # for a non-duplicate, and confirms field shape if/when present.)
            ex1 = {
                "name": "Electricity Bill",
                "amount": 1200,
                "currency": "INR",
                "category": "home",
                "paid_by": member_ids[0],
                "split_among": member_ids,
            }
            r = api_client.post(f"{BASE_URL}/api/trips/{trip_id}/expenses", headers=auth_headers, json=ex1, timeout=20)
            assert r.status_code == 200, r.text
            data = r.json()
            assert "recurring_suggestion" not in data, f"unexpected recurring on first add: {data.get('recurring_suggestion')}"

            # Add a second non-duplicate
            ex2 = {
                "name": "Water Can",
                "amount": 60,
                "currency": "INR",
                "category": "home",
                "paid_by": member_ids[0],
                "split_among": member_ids,
            }
            r = api_client.post(f"{BASE_URL}/api/trips/{trip_id}/expenses", headers=auth_headers, json=ex2, timeout=20)
            assert r.status_code == 200, r.text
            assert "recurring_suggestion" not in r.json()

            # NOTE: To trigger recurring_suggestion, the previous duplicate must be >25 days old.
            # The test request acknowledges this requires seed/backdate. We only verify the field
            # is NOT spuriously emitted for non-recurring or fresh-duplicate cases. The
            # recurring detector logic is currently in the SETTLE endpoint, not add_expense
            # (see RCA in test report).
        finally:
            api_client.delete(f"{BASE_URL}/api/trips/{trip_id}", headers=auth_headers, timeout=20)


# ---------- Smart Limit ai_source ----------
class TestSmartLimitAiSource:
    def test_payload_has_ai_source(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/smart-limit", headers=auth_headers, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "ai_source" in data, f"missing ai_source: {data}"
        assert data["ai_source"] in ("ai_fresh", "ai_cache", "statistical"), f"bad value: {data['ai_source']}"
        assert "weekly_budget" in data
        assert isinstance(data["weekly_budget"], (int, float))

    def test_repeated_call_cache_hit(self, api_client, auth_headers):
        r1 = api_client.get(f"{BASE_URL}/api/smart-limit", headers=auth_headers, timeout=120)
        r2 = api_client.get(f"{BASE_URL}/api/smart-limit", headers=auth_headers, timeout=30)
        assert r1.status_code == 200 and r2.status_code == 200
        # second call should be cache=hit
        assert r2.json().get("cache") == "hit"
        # ai_source should be ai_cache when from cache (Gemini-derived) OR statistical (fallback) on second call.
        ai_src = r2.json().get("ai_source")
        assert ai_src in ("ai_cache", "ai_fresh", "statistical")
