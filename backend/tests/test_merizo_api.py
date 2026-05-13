"""
Merizo backend API regression tests.
Covers: Auth, Trips, Expenses, Members, Settlement, Insights, Invites, FX.
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://group-expense-hub-3.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")

DEMO_EMAIL = "demo@merizo.app"
DEMO_PASSWORD = "Demo@123"


# ===== Auth =====
class TestAuth:
    def test_login_demo(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and "user" in data
        assert data["user"]["email"] == DEMO_EMAIL
        assert data["user"]["name"] == "Demo User"

    def test_login_invalid(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": "wrong"}, timeout=20)
        assert r.status_code == 401

    def test_register_and_me(self, api_client):
        email = f"TEST_user_{int(time.time()*1000)}@example.com"
        r = api_client.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Test@123", "name": "TEST User"}, timeout=20)
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        # duplicate
        r2 = api_client.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Test@123", "name": "TEST User"}, timeout=20)
        assert r2.status_code == 400
        # me
        me = api_client.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert me.status_code == 200
        assert me.json()["email"] == email.lower()

    def test_me_no_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me", timeout=20)
        assert r.status_code == 401


# ===== Trips =====
class TestTrips:
    def test_list_trips_has_demo(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/trips", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        trips = r.json()
        names = {t["name"] for t in trips}
        assert {"Goa Trip", "Manali Trip", "College Buddies"}.issubset(names), f"Missing demo trips: {names}"
        for t in trips:
            assert "balances" in t
            assert "total_spent" in t
            assert "my_net" in t
            assert "settlement_transactions" in t

    def test_get_trip_detail(self, api_client, auth_headers):
        trips = api_client.get(f"{BASE_URL}/api/trips", headers=auth_headers).json()
        goa = next(t for t in trips if t["name"] == "Goa Trip")
        r = api_client.get(f"{BASE_URL}/api/trips/{goa['id']}", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert len(d["members"]) >= 3
        non_settle = [e for e in d["expenses"] if not e.get("is_settlement")]
        assert len(non_settle) >= 5
        assert d["total_spent"] > 0

    def test_create_delete_trip(self, api_client, auth_headers):
        payload = {"name": "TEST_Trip", "split_category": "trip", "destinations": ["Paris"], "members": ["Alice", "Bob"], "currency": "INR"}
        r = api_client.post(f"{BASE_URL}/api/trips", headers=auth_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        assert len(r.json()["members"]) == 3  # owner + 2
        # GET verify
        g = api_client.get(f"{BASE_URL}/api/trips/{tid}", headers=auth_headers)
        assert g.status_code == 200
        # delete
        d = api_client.delete(f"{BASE_URL}/api/trips/{tid}", headers=auth_headers)
        assert d.status_code == 200
        # 404 after delete
        g2 = api_client.get(f"{BASE_URL}/api/trips/{tid}", headers=auth_headers)
        assert g2.status_code == 404

    def test_delete_non_owner(self, api_client, auth_headers):
        # create trip as demo user
        payload = {"name": "TEST_DelGuard", "split_category": "trip", "members": [], "currency": "INR"}
        r = api_client.post(f"{BASE_URL}/api/trips", headers=auth_headers, json=payload)
        tid = r.json()["id"]
        # register another user
        email = f"TEST_other_{int(time.time()*1000)}@example.com"
        other = api_client.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Test@123", "name": "TEST Other"}).json()
        other_headers = {"Authorization": f"Bearer {other['token']}", "Content-Type": "application/json"}
        d = api_client.delete(f"{BASE_URL}/api/trips/{tid}", headers=other_headers)
        assert d.status_code == 403
        # cleanup
        api_client.delete(f"{BASE_URL}/api/trips/{tid}", headers=auth_headers)


# ===== Expenses =====
class TestExpenses:
    def test_add_expense_with_fx_conversion(self, api_client, auth_headers):
        trips = api_client.get(f"{BASE_URL}/api/trips", headers=auth_headers).json()
        goa = next(t for t in trips if t["name"] == "Goa Trip")
        payer = goa["members"][0]["id"]
        split = [m["id"] for m in goa["members"]]
        payload = {
            "name": "TEST_USD_expense", "amount": 100, "currency": "USD",
            "category": "food", "paid_by": payer, "split_among": split, "emoji": "🍔"
        }
        r = api_client.post(f"{BASE_URL}/api/trips/{goa['id']}/expenses", headers=auth_headers, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        trip = r.json()
        added = next(e for e in trip["expenses"] if e["name"] == "TEST_USD_expense")
        assert added["currency"] == "USD"
        assert added["amount_base"] > 100 * 50  # USD->INR rate should be well above 50
        eid = added["id"]
        # delete
        d = api_client.delete(f"{BASE_URL}/api/trips/{goa['id']}/expenses/{eid}", headers=auth_headers)
        assert d.status_code == 200
        trip2 = d.json()
        assert not any(e["id"] == eid for e in trip2["expenses"])


# ===== Members =====
class TestMembers:
    def test_add_member_as_owner(self, api_client, auth_headers):
        payload = {"name": "TEST_MemTrip", "split_category": "trip", "members": [], "currency": "INR"}
        tid = api_client.post(f"{BASE_URL}/api/trips", headers=auth_headers, json=payload).json()["id"]
        r = api_client.post(f"{BASE_URL}/api/trips/{tid}/members", headers=auth_headers, json={"name": "TEST_Newbie"})
        assert r.status_code == 200
        assert any(m["name"] == "TEST_Newbie" for m in r.json()["members"])
        api_client.delete(f"{BASE_URL}/api/trips/{tid}", headers=auth_headers)


# ===== Settle =====
class TestSettle:
    def test_settle_and_get_settlement(self, api_client, auth_headers):
        trips = api_client.get(f"{BASE_URL}/api/trips", headers=auth_headers).json()
        goa = next(t for t in trips if t["name"] == "Goa Trip")
        txs = goa["settlement_transactions"]
        if not txs:
            pytest.skip("No pending settlements")
        t0 = txs[0]
        r = api_client.post(f"{BASE_URL}/api/trips/{goa['id']}/settle", headers=auth_headers,
                            json={"from_member": t0["from_id"], "to_member": t0["to_id"], "amount": t0["amount"]})
        assert r.status_code == 200
        # GET settlement endpoint
        g = api_client.get(f"{BASE_URL}/api/trips/{goa['id']}/settlement", headers=auth_headers)
        assert g.status_code == 200
        assert "settlement_transactions" in g.json()


# ===== Insights =====
class TestInsights:
    @pytest.mark.parametrize("period", ["all", "week", "month"])
    def test_insights(self, api_client, auth_headers, period):
        r = api_client.get(f"{BASE_URL}/api/insights?period={period}", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "total" in d
        assert "by_category" in d
        assert "by_trip" in d
        assert d["period"] == period
        if period == "all":
            assert d["total"] > 0
            assert len(d["by_category"]) > 0


# ===== Invite =====
class TestInvite:
    def test_invite_flow(self, api_client, auth_headers):
        trips = api_client.get(f"{BASE_URL}/api/trips", headers=auth_headers).json()
        goa = next(t for t in trips if t["name"] == "Goa Trip")
        r = api_client.get(f"{BASE_URL}/api/trips/{goa['id']}/invite", headers=auth_headers)
        assert r.status_code == 200
        token = r.json()["token"]
        assert token
        # preview (no auth needed)
        p = requests.get(f"{BASE_URL}/api/invite/{token}/preview", timeout=20)
        assert p.status_code == 200
        assert p.json()["name"] == "Goa Trip"
        # rotate
        rot = api_client.post(f"{BASE_URL}/api/trips/{goa['id']}/invite/rotate", headers=auth_headers)
        assert rot.status_code == 200
        new_token = rot.json()["token"]
        assert new_token != token
        # old token dead
        p_old = requests.get(f"{BASE_URL}/api/invite/{token}/preview", timeout=20)
        assert p_old.status_code == 404
        # new register + join
        email = f"TEST_joiner_{int(time.time()*1000)}@example.com"
        reg = api_client.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Test@123", "name": "TEST Joiner"}).json()
        join_headers = {"Authorization": f"Bearer {reg['token']}", "Content-Type": "application/json"}
        j = api_client.post(f"{BASE_URL}/api/invite/{new_token}/join", headers=join_headers)
        assert j.status_code == 200
        assert any(m.get("user_id") == reg["user"]["id"] for m in j.json()["members"])


# ===== FX =====
class TestFX:
    def test_fx_rate_usd_inr(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/fx/rate?base=USD&target=INR", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["base"] == "USD" and d["target"] == "INR"
        assert isinstance(d["rate"], (int, float))
        assert d["rate"] > 50  # sanity

    def test_fx_same_currency(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/fx/rate?base=INR&target=INR", timeout=20)
        assert r.status_code == 200
        assert r.json()["rate"] == 1.0
