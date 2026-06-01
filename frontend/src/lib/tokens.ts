// ─────────────────────────────────────────────────────────────────────────────
// Merizo Design Tokens — complete export matching all app imports
// ─────────────────────────────────────────────────────────────────────────────

// ── Colour palette (used by theme.tsx via palette.dark / palette.light) ───────
export const palette = {
  dark: {
    bg:           "#14110F",
    surface:      "#1B1612",
    surfaceAlt:   "#231C17",
    border:       "rgba(201,170,120,0.15)",
    borderActive: "rgba(201,170,120,0.35)",
    textPrimary:   "#F4E6D0",
    textSecondary: "#B89D77",
    textMuted:     "#7A6550",
    positive: "#7ED38B",
    negative: "#FF8B7B",
    indigo:   "#9D7BFF",
    gold:     "#E8B04E",
    cardBg:   "#1B1612",
    overlay:  "rgba(0,0,0,0.6)",
  },
  light: {
    bg:           "#FAF7F2",
    surface:      "#F3EEE6",
    surfaceAlt:   "#EDE5D8",
    border:       "rgba(90,60,30,0.12)",
    borderActive: "rgba(90,60,30,0.28)",
    textPrimary:   "#1C1208",
    textSecondary: "#5C4030",
    textMuted:     "#9A7B5E",
    positive: "#1A7A40",
    negative: "#C0392B",
    indigo:   "#5B3FD4",
    gold:     "#B8860B",
    cardBg:   "#F3EEE6",
    overlay:  "rgba(0,0,0,0.4)",
  },
};

// ── Currency ──────────────────────────────────────────────────────────────────
export function currencySymbol(currency?: string): string {
  const map: Record<string, string> = {
    INR: "₹", USD: "$", EUR: "€", GBP: "£",
    JPY: "¥", AED: "د.إ", SGD: "S$", AUD: "A$", CAD: "C$",
  };
  return map[(currency || "INR").toUpperCase()] ?? "₹";
}

export const currencyOptions = [
  { code: "INR", label: "Indian Rupee",     symbol: "₹" },
  { code: "USD", label: "US Dollar",        symbol: "$" },
  { code: "EUR", label: "Euro",             symbol: "€" },
  { code: "GBP", label: "British Pound",    symbol: "£" },
  { code: "JPY", label: "Japanese Yen",     symbol: "¥" },
  { code: "AED", label: "UAE Dirham",       symbol: "د.إ" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$" },
  { code: "AUD", label: "Australian Dollar",symbol: "A$" },
];

// ── Category metadata ─────────────────────────────────────────────────────────
export const categoryMeta: Record<string, { label: string; emoji: string; tint: string }> = {
  food:          { label: "Food",          emoji: "🍽️", tint: "#FF8B7B" },
  travel:        { label: "Travel",        emoji: "✈️", tint: "#60A5FA" },
  entertainment: { label: "Entertainment", emoji: "🎬", tint: "#A78BFA" },
  utilities:     { label: "Utilities",     emoji: "⚡", tint: "#FBBF24" },
  shopping:      { label: "Shopping",      emoji: "🛍️", tint: "#F472B6" },
  health:        { label: "Health",        emoji: "💊", tint: "#34D399" },
  accommodation: { label: "Stay",          emoji: "🏨", tint: "#E8B04E" },
  trip:          { label: "Trip",          emoji: "🗺️", tint: "#9D7BFF" },
  other:         { label: "Other",         emoji: "📦", tint: "#9CA3AF" },
  settlement:    { label: "Settlement",    emoji: "✅", tint: "#7ED38B" },
};

export function detectCategory(name: string): string {
  const n = name.toLowerCase();
  if (/food|eat|lunch|dinner|breakfast|cafe|rest|pizza|coffee|swiggy|zomato|biryani/.test(n)) return "food";
  if (/uber|ola|cab|taxi|train|flight|bus|travel|petrol|fuel|metro|auto/.test(n)) return "travel";
  if (/movie|netflix|game|sport|fun|entertain|ticket|show|concert/.test(n)) return "entertainment";
  if (/rent|electr|wifi|water|house|flat|maintenance|bill/.test(n)) return "utilities";
  if (/shop|cloth|amazon|flipkart|mall|buy|purchase/.test(n)) return "shopping";
  if (/doctor|medicine|hospital|pharmacy|health|medical/.test(n)) return "health";
  if (/hotel|hostel|airbnb|stay|room|resort/.test(n)) return "accommodation";
  return "other";
}

// ── Cover image resolver ──────────────────────────────────────────────────────
// Curated Unsplash images per category — these are stable permanent URLs
const COVER_MAP: Record<string, string[]> = {
  food:          [
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80",
    "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&q=80",
  ],
  travel:        [
    "https://images.unsplash.com/photo-1488085061387-422e29b40080?w=800&q=80",
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  ],
  entertainment: [
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80",
  ],
  accommodation: [
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80",
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  ],
  utilities:     [
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  ],
  shopping:      [
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80",
  ],
  trip:          [
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80",
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    "https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=800&q=80",
  ],
  other:         [
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
    "https://images.unsplash.com/photo-1579621970795-87facc2f976d?w=800&q=80",
  ],
};

/**
 * Resolve a cover image URL for a trip/group.
 * @param destinations  optional array of destination strings (unused, kept for compat)
 * @param category      split_category of the group (food | travel | trip | …)
 * @param coverKey      optional explicit override URL
 */
export const coverOptions = Object.entries(COVER_MAP).flatMap(([cat, urls]) =>
  urls.map((url, i) => ({ key: `${cat}-${i}`, url, category: cat }))
);

export function resolveCover(
  destinations?: string[] | null,
  category?: string | null,
  coverKey?: string | null,
): string {
  // Explicit override wins
  if (coverKey && coverKey.startsWith("http")) return coverKey;

  // Pick from category map
  const cat = (category || "other").toLowerCase();
  const pool = COVER_MAP[cat] || COVER_MAP.other;

  // Deterministic pick based on first destination letter so it's stable
  const seed  = (destinations?.[0] || "").charCodeAt(0) || 0;
  return pool[seed % pool.length];
}