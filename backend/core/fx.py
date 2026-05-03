"""FX rate fetcher (fawazahmed0/exchange-api) with MongoDB caching."""
import logging
from datetime import datetime, timezone, timedelta

import httpx

from .db import db

logger = logging.getLogger("merizo.fx")

FX_FALLBACK = {
    "USD": 1.0, "INR": 83.0, "EUR": 0.92, "GBP": 0.79, "JPY": 149.0,
    "AUD": 1.52, "CAD": 1.36, "CHF": 0.88, "CNY": 7.25, "SGD": 1.35,
    "AED": 3.67, "THB": 35.5, "MYR": 4.75, "IDR": 15700.0, "KRW": 1370.0,
}


async def get_fx_rate(base: str, target: str) -> float:
    base = base.upper()
    target = target.upper()
    if base == target:
        return 1.0

    cache_key = f"{base}:{target}"
    now = datetime.now(timezone.utc)
    cached = await db.fx_cache.find_one({"pair": cache_key}, {"_id": 0})
    if cached:
        cached_at = cached.get("updated_at")
        if cached_at and isinstance(cached_at, datetime):
            ts = cached_at if cached_at.tzinfo else cached_at.replace(tzinfo=timezone.utc)
            if (now - ts) < timedelta(hours=1):
                return float(cached["rate"])

    rate = None
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as http:
            url = f"https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/{base.lower()}.json"
            r = await http.get(url)
            if r.status_code == 200:
                data = r.json()
                rates = data.get(base.lower(), {})
                if target.lower() in rates:
                    rate = float(rates[target.lower()])
    except Exception as e:
        logger.warning(f"FX fetch failed: {e}")

    if rate is None:
        if base in FX_FALLBACK and target in FX_FALLBACK:
            rate = FX_FALLBACK[target] / FX_FALLBACK[base]
        else:
            rate = 1.0

    await db.fx_cache.update_one(
        {"pair": cache_key},
        {"$set": {"pair": cache_key, "rate": rate, "updated_at": now}},
        upsert=True,
    )
    return rate
