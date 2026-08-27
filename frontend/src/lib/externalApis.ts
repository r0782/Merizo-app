/**
 * Merizo AI — External Free APIs Integration
 * 1. Frankfurter — Currency exchange rates (free, no key)
 * 2. REST Countries — Country data & flags (free, no key)
 * 3. IPStack — Geolocation (free tier)
 * 4. Open Exchange Rates — Multi-currency (free tier)
 * 5. Mailboxlayer — Email validation (free tier)
 * 6. Numverify — Phone validation (free tier)
 */

const IPSTACK_KEY = process.env.EXPO_PUBLIC_IPSTACK_KEY || "";
const OER_KEY = process.env.EXPO_PUBLIC_OER_KEY || "";
const MAILBOXLAYER_KEY = process.env.EXPO_PUBLIC_MAILBOXLAYER_KEY || "";
const LANGUAGELAYER_KEY = process.env.EXPO_PUBLIC_LANGUAGELAYER_KEY || "";

// ── 1. Frankfurter — Real-time currency exchange ───────────────────────────
// api.frankfurter.app permanently redirects to api.frankfurter.dev/v1 now —
// calling the new host directly avoids relying on that cross-origin redirect
// resolving correctly in every environment.
export async function getExchangeRates(base: string = "INR"): Promise<Record<string, number>> {
  try {
    const r = await fetch(`https://api.frankfurter.dev/v1/latest?from=${base}`);
    const data = await r.json();
    return data.rates || {};
  } catch { return {}; }
}

export async function convertCurrency(amount: number, from: string, to: string): Promise<number> {
  try {
    if (from === to) return amount;
    const r = await fetch(`https://api.frankfurter.dev/v1/latest?from=${from}&to=${to}&amount=${amount}`);
    const data = await r.json();
    return data.rates?.[to] || amount;
  } catch { return amount; }
}

export async function getSupportedCurrencies(): Promise<Record<string, string>> {
  try {
    const r = await fetch("https://api.frankfurter.dev/v1/currencies");
    return await r.json();
  } catch { return {}; }
}

// ── 2. REST Countries — Country data & flags ──────────────────────────────
export async function getAllCountries(): Promise<any[]> {
  try {
    const r = await fetch("https://restcountries.com/v3.1/all?fields=name,flags,cca2,currencies,idd");
    return await r.json();
  } catch { return []; }
}

export async function getCountryByCurrency(currency: string): Promise<any> {
  try {
    const r = await fetch(`https://restcountries.com/v3.1/currency/${currency}?fields=name,flags,cca2`);
    const data = await r.json();
    return Array.isArray(data) ? data[0] : null;
  } catch { return null; }
}

export function getFlagEmoji(countryCode: string): string {
  // Convert country code to flag emoji
  return countryCode
    .toUpperCase()
    .split("")
    .map(c => String.fromCodePoint(0x1f1e0 + c.charCodeAt(0) - 65))
    .join("");
}

// ── 3. IPStack — Auto-detect user location ───────────────────────────────
export async function detectUserLocation(): Promise<{
  country_code: string;
  country_name: string;
  currency: string;
  flag: string;
} | null> {
  try {
    if (!IPSTACK_KEY) {
      // Fallback: assume India for now
      return { country_code: "IN", country_name: "India", currency: "INR", flag: "🇮🇳" };
    }
    const r = await fetch(`https://api.ipstack.com/check?access_key=${IPSTACK_KEY}&fields=country_code,country_name,currency`);
    const data = await r.json();
    return {
      country_code: data.country_code || "IN",
      country_name: data.country_name || "India",
      currency: data.currency?.code || "INR",
      flag: getFlagEmoji(data.country_code || "IN"),
    };
  } catch { return null; }
}

// ── 4. Open Exchange Rates — Historical & multi-currency ─────────────────
export async function getHistoricalRate(date: string, base: string = "USD"): Promise<Record<string, number>> {
  try {
    if (!OER_KEY) {
      // Fallback to Frankfurter for historical
      const r = await fetch(`https://api.frankfurter.dev/v1/${date}?from=${base}`);
      const data = await r.json();
      return data.rates || {};
    }
    const r = await fetch(`https://openexchangerates.org/api/historical/${date}.json?app_id=${OER_KEY}&base=${base}`);
    const data = await r.json();
    return data.rates || {};
  } catch { return {}; }
}

// ── 5. Mailboxlayer — Email validation ───────────────────────────────────
export async function validateEmail(email: string): Promise<{
  valid: boolean;
  format: boolean;
  reason?: string;
}> {
  try {
    if (!MAILBOXLAYER_KEY) {
      // Basic local validation as fallback
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return { valid: re.test(email), format: re.test(email) };
    }
    const r = await fetch(`https://apilayer.net/api/check?access_key=${MAILBOXLAYER_KEY}&email=${encodeURIComponent(email)}&format=1&smtp=1`);
    const data = await r.json();
    return {
      valid: data.format_valid && !data.disposable,
      format: data.format_valid,
      reason: data.disposable ? "Disposable email not allowed" : undefined,
    };
  } catch {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return { valid: re.test(email), format: re.test(email) };
  }
}

// ── 6. Numverify — Phone validation ──────────────────────────────────────
export async function validatePhone(phone: string, country: string = "IN"): Promise<{
  valid: boolean;
  formatted?: string;
  carrier?: string;
}> {
  try {
    const NUMVERIFY_KEY = process.env.EXPO_PUBLIC_NUMVERIFY_KEY || "";
    if (!NUMVERIFY_KEY) {
      // Basic validation
      const clean = phone.replace(/\D/g, "");
      return { valid: clean.length >= 10, formatted: clean };
    }
    const r = await fetch(`https://apilayer.net/api/validate?access_key=${NUMVERIFY_KEY}&number=${encodeURIComponent(phone)}&country_code=${country}`);
    const data = await r.json();
    return {
      valid: data.valid,
      formatted: data.international_format,
      carrier: data.carrier,
    };
  } catch {
    const clean = phone.replace(/\D/g, "");
    return { valid: clean.length >= 10 };
  }
}

// ── 7. Languagelayer — Text language detection ───────────────────────────
export async function detectLanguage(text: string): Promise<string> {
  try {
    if (!LANGUAGELAYER_KEY || text.trim().length < 3) return "en";
    const r = await fetch(
      `https://api.languagelayer.com/detect?access_key=${LANGUAGELAYER_KEY}&query=${encodeURIComponent(text.slice(0, 200))}`
    );
    const data = await r.json();
    const top = data.results?.[0];
    if (top?.reliable_result) return top.language_code as string;
    return "en";
  } catch { return "en"; }
}

// ── Currency Conversion Helper ────────────────────────────────────────────
export const POPULAR_CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", flag: "🇮🇳" },
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸" },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺" },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", flag: "🇦🇪" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", flag: "🇸🇬" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", flag: "🇯🇵" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", flag: "🇦🇺" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", flag: "🇨🇦" },
  { code: "THB", symbol: "฿", name: "Thai Baht", flag: "🇹🇭" },
];
