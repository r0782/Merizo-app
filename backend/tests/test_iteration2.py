"""
Iteration 2 backend tests:
- /api/smart-limit
- /api/reminders (GET/POST/PATCH/DELETE)
- /api/scan-bill (validation + real receipt OCR)
"""
import os
import time
import base64
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://group-expense-hub-3.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")


# ===== Smart Limit =====
class TestSmartLimit:
    def test_smart_limit_shape(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/smart-limit", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["current_week_spent", "weekly_budget", "percent", "history_weeks", "currency", "has_history"]:
            assert k in d, f"Missing key {k}"
        assert isinstance(d["history_weeks"], list)
        assert len(d["history_weeks"]) == 4
        assert isinstance(d["has_history"], bool)
        # Demo seed expenses created at startup all use paid_by some member (mostly Demo); seeded created_at is "now - i days" ISO string => current week
        # weekly_budget defaults to 5000 if no history. Demo has no >7 day old expenses by default => has_history False, budget 5000
        if not d["has_history"]:
            assert d["weekly_budget"] == 5000.0
        assert d["percent"] >= 0
        assert d["currency"] == "INR"

    def test_smart_limit_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/smart-limit", timeout=20)
        assert r.status_code == 401


# ===== Reminders =====
class TestReminders:
    def test_list_demo_reminders(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/reminders", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        items = r.json()
        # Demo seeds 3 reminders
        titles = {x["title"] for x in items}
        assert "Pay Aman for Goa flights" in titles
        assert "Settle Karan for Manali stay" in titles
        assert "Collect from Neha for pizza" in titles
        for x in items:
            assert "id" in x and "title" in x
            assert x.get("completed") is False

    def test_create_complete_delete_flow(self, api_client, auth_headers):
        # create
        payload = {"title": "TEST_reminder", "amount": 250, "due_date": "2026-12-31"}
        r = api_client.post(f"{BASE_URL}/api/reminders", headers=auth_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        rem = r.json()
        rid = rem["id"]
        assert rem["title"] == "TEST_reminder"
        assert rem["amount"] == 250
        # GET to verify it appears
        lst = api_client.get(f"{BASE_URL}/api/reminders", headers=auth_headers).json()
        assert any(x["id"] == rid for x in lst)
        # complete
        c = api_client.patch(f"{BASE_URL}/api/reminders/{rid}/complete", headers=auth_headers)
        assert c.status_code == 200
        # should disappear from list (filters completed)
        lst2 = api_client.get(f"{BASE_URL}/api/reminders", headers=auth_headers).json()
        assert not any(x["id"] == rid for x in lst2)
        # delete (should still work on completed)
        d = api_client.delete(f"{BASE_URL}/api/reminders/{rid}", headers=auth_headers)
        assert d.status_code == 200
        # delete again -> 404
        d2 = api_client.delete(f"{BASE_URL}/api/reminders/{rid}", headers=auth_headers)
        assert d2.status_code == 404

    def test_complete_unknown_404(self, api_client, auth_headers):
        r = api_client.patch(f"{BASE_URL}/api/reminders/nonexistent-xyz/complete", headers=auth_headers)
        assert r.status_code == 404

    def test_reminders_require_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/reminders", timeout=20)
        assert r.status_code == 401


# ===== Scan Bill =====
class TestScanBill:
    def test_empty_image_rejected(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/scan-bill", headers=auth_headers, json={"image_base64": ""}, timeout=20)
        assert r.status_code == 400

    def test_short_image_rejected(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/scan-bill", headers=auth_headers, json={"image_base64": "abc"}, timeout=20)
        assert r.status_code == 400

    def test_scan_bill_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/scan-bill", json={"image_base64": "x" * 200}, timeout=20)
        assert r.status_code == 401

    def test_real_receipt_ocr(self, api_client, auth_headers):
        # Generate a synthetic but realistic receipt JPEG with PIL (real text/edges/contrast)
        try:
            from PIL import Image, ImageDraw
        except Exception:
            pytest.skip("PIL not available")
        img = Image.new("RGB", (400, 600), "white")
        d = ImageDraw.Draw(img)
        text = (
            "\nTASTY BURGER CAFE\n123 Main Street, Mumbai\nDate: 2026-01-15\n"
            "------------------------\nCheeseburger     250.00\nFries            120.00\n"
            "Coke              80.00\n------------------------\nSubtotal         450.00\n"
            "Tax (5%)          22.50\nTOTAL          INR 472.50\n------------------------\n"
            "Thank you!\nVisit again\n"
        )
        d.multiline_text((20, 30), text, fill="black")
        import io
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=85)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        r = api_client.post(
            f"{BASE_URL}/api/scan-bill",
            headers=auth_headers,
            json={"image_base64": b64},
            timeout=90,
        )
        if r.status_code == 502:
            pytest.skip(f"LLM unavailable / vision failed: {r.text}")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["vendor", "amount", "currency", "category", "date", "suggested_name"]:
            assert k in d, f"Missing key {k}"
        assert isinstance(d["amount"], (int, float))
        assert d["amount"] > 0
        assert len(d["currency"]) == 3
        assert d["category"] in {"food", "trip", "home", "friends", "shopping", "bills", "other"}
        # date format YYYY-MM-DD
        assert len(d["date"]) == 10 and d["date"][4] == "-" and d["date"][7] == "-"
