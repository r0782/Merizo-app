export const palette = {
  light: {
    bg: "#F5F5F5",
    surface: "#FFFFFF",
    surfaceAlt: "#FAFAFA",
    border: "rgba(0,0,0,0.06)",
    textPrimary: "#0A0A0A",
    textSecondary: "#888888",
    textMuted: "#B8B8B8",
    accent: "#0A0A0A",
    accentSoft: "#0A0A0A",
    positive: "#16A34A",
    negative: "#DC2626",
    indigo: "#7C5CFF",
  },
  dark: {
    bg: "#0D0D0D",
    surface: "#1A1A1A",
    surfaceAlt: "#141414",
    border: "rgba(255,255,255,0.07)",
    textPrimary: "#FFFFFF",
    textSecondary: "#777777",
    textMuted: "#3F3F3F",
    accent: "#7C5CFF",
    accentSoft: "rgba(124,92,255,0.18)",
    positive: "#4ADE80",
    negative: "#F87171",
    indigo: "#7C5CFF",
  },
};

export const radius = {
  card: 16,
  small: 12,
  pill: 999,
};

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// Cover image map — keyword to remote url. Grayscale in light mode applied at render.
export const coverImages: Record<string, string> = {
  // destinations
  goa: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200&q=80",
  manali: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80",
  paris: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80",
  tokyo: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80",
  "new york": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1200&q=80",
  london: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&q=80",
  bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80",
  singapore: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200&q=80",
  kerala: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200&q=80",
  maldives: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1200&q=80",
  dubai: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80",
  // category fallbacks
  trip: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80",
  food: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80",
  home: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
  friends: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&q=80",
  shopping: "https://images.unsplash.com/photo-1481437156560-3205f6a55735?w=1200&q=80",
  bills: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80",
  default: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80",
};

export function resolveCover(destinations: string[] | undefined, category: string, override?: string): string {
  if (override && coverImages[override]) return coverImages[override];
  if (destinations && destinations.length > 0) {
    for (const d of destinations) {
      const k = (d || "").toLowerCase().trim();
      if (coverImages[k]) return coverImages[k];
    }
  }
  return coverImages[category] || coverImages.default;
}

export const categoryMeta: Record<string, { emoji: string; label: string; tint: string; description: string }> = {
  trip: { emoji: "✈️", label: "Trip / Travel", tint: "#3B82F6", description: "Beach, mountains, road trips" },
  food: { emoji: "🍽️", label: "Food & Dining", tint: "#EF4444", description: "Restaurants, drinks, takeout" },
  home: { emoji: "🏠", label: "Home & Rent", tint: "#10B981", description: "Rent, bills, utilities" },
  friends: { emoji: "🎉", label: "Friends & Events", tint: "#F59E0B", description: "Parties, meetups, gigs" },
  shopping: { emoji: "🛍️", label: "Shopping", tint: "#8B5CF6", description: "Gifts, gear, groceries" },
  bills: { emoji: "⚡", label: "Bills & Subscriptions", tint: "#14B8A6", description: "Recurring expenses" },
  other: { emoji: "💸", label: "Other", tint: "#6B7280", description: "Anything else" },
  settlement: { emoji: "✅", label: "Settlement", tint: "#10B981", description: "Paid up" },
};

export const coverOptions = [
  { key: "goa", label: "Goa", url: coverImages.goa },
  { key: "paris", label: "Paris", url: coverImages.paris },
  { key: "tokyo", label: "Tokyo", url: coverImages.tokyo },
  { key: "new york", label: "NYC", url: coverImages["new york"] },
  { key: "manali", label: "Manali", url: coverImages.manali },
  { key: "bali", label: "Bali", url: coverImages.bali },
  { key: "dubai", label: "Dubai", url: coverImages.dubai },
  { key: "maldives", label: "Maldives", url: coverImages.maldives },
];

export function detectCategory(text: string): string {
  const t = (text || "").toLowerCase();
  if (/(flight|hotel|cab|uber|train|bus|trip|travel|airport)/.test(t)) return "trip";
  if (/(pizza|food|dinner|lunch|breakfast|restaurant|cafe|coffee|drink|bar|beer)/.test(t)) return "food";
  if (/(rent|home|apartment|electric|wifi|water|utility)/.test(t)) return "home";
  if (/(party|movie|gig|concert|event|club)/.test(t)) return "friends";
  if (/(shop|gift|amazon|grocery|market|mall)/.test(t)) return "shopping";
  if (/(bill|subscription|netflix|spotify|prime)/.test(t)) return "bills";
  return "other";
}

export const currencyOptions = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "AED", "SGD", "THB"];

export function currencySymbol(code: string): string {
  const map: Record<string, string> = {
    INR: "₹", USD: "$", EUR: "€", GBP: "£", JPY: "¥", AUD: "A$", CAD: "C$", AED: "د.إ", SGD: "S$", THB: "฿",
  };
  return map[code] || code;
}

export function formatAmount(amount: number, currency = "INR", showSign = false): string {
  const sym = currencySymbol(currency);
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-IN", { maximumFractionDigits: abs >= 1000 ? 0 : 2 });
  const sign = showSign ? (amount > 0 ? "+" : amount < 0 ? "-" : "") : (amount < 0 ? "-" : "");
  return `${sign}${sym}${formatted}`;
}
