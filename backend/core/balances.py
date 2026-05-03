"""Pure helpers for computing balances + the greedy settlement algorithm and
serialising a trip document for client responses (excludes Mongo _id, etc.)."""
from typing import Any, Dict, Optional


def compute_balances(trip: dict) -> Dict[str, Any]:
    members = trip.get("members", [])
    expenses = trip.get("expenses", [])
    base_currency = trip.get("currency", "INR")

    paid = {m["id"]: 0.0 for m in members}
    share = {m["id"]: 0.0 for m in members}
    total = 0.0
    by_category: Dict[str, float] = {}

    for exp in expenses:
        amt = float(exp.get("amount_base", exp.get("amount", 0)))
        is_settlement = bool(exp.get("is_settlement"))
        if not is_settlement:
            total += amt
            cat = exp.get("category", "other")
            by_category[cat] = by_category.get(cat, 0) + amt
        if exp.get("paid_by") in paid:
            paid[exp["paid_by"]] += amt
        split = exp.get("split_among") or [m["id"] for m in members]
        if not split:
            continue
        per = amt / len(split)
        for mid in split:
            if mid in share:
                share[mid] += per

    balances = []
    for m in members:
        net = round(paid.get(m["id"], 0) - share.get(m["id"], 0), 2)
        balances.append({
            "member_id": m["id"], "name": m["name"], "net": net,
            "paid": round(paid.get(m["id"], 0), 2),
            "share": round(share.get(m["id"], 0), 2),
        })

    creditors = sorted([b for b in balances if b["net"] > 0.01], key=lambda x: -x["net"])
    debtors = sorted([b for b in balances if b["net"] < -0.01], key=lambda x: x["net"])
    creds = [{"id": b["member_id"], "name": b["name"], "amt": b["net"]} for b in creditors]
    debs = [{"id": b["member_id"], "name": b["name"], "amt": -b["net"]} for b in debtors]

    transactions = []
    i = j = 0
    while i < len(debs) and j < len(creds):
        amt = round(min(debs[i]["amt"], creds[j]["amt"]), 2)
        if amt > 0.01:
            transactions.append({
                "from_id": debs[i]["id"], "from_name": debs[i]["name"],
                "to_id": creds[j]["id"], "to_name": creds[j]["name"],
                "amount": amt, "currency": base_currency, "paid": False,
            })
        debs[i]["amt"] -= amt
        creds[j]["amt"] -= amt
        if debs[i]["amt"] < 0.01:
            i += 1
        if creds[j]["amt"] < 0.01:
            j += 1

    return {
        "balances": balances,
        "total": round(total, 2),
        "by_category": {k: round(v, 2) for k, v in by_category.items()},
        "transactions": transactions,
        "currency": base_currency,
    }


def serialize_trip(trip: dict, current_user_id: Optional[str] = None) -> dict:
    if not trip:
        return trip
    trip = {k: v for k, v in trip.items() if k != "_id"}
    summary = compute_balances(trip)
    trip["balances"] = summary["balances"]
    trip["per_member_paid"] = [
        {"member_id": b["member_id"], "name": b["name"], "paid": b["paid"]}
        for b in summary["balances"]
    ]
    trip["settlement_transactions"] = summary["transactions"]
    trip["total_spent"] = summary["total"]
    trip["by_category"] = summary["by_category"]
    if current_user_id:
        my_member = next((m for m in trip.get("members", []) if m.get("user_id") == current_user_id), None)
        my_net = 0.0
        if my_member:
            bal = next((b for b in summary["balances"] if b["member_id"] == my_member["id"]), None)
            if bal:
                my_net = bal["net"]
        trip["my_net"] = round(my_net, 2)
    return trip
