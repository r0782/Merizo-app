// ─────────────────────────────────────────────────────────────────────────────
// Merizo Design System Tokens
// Inspired by the Phosphor Icons aesthetic:
//   massive whitespace · monochrome · editorial typography · thin borders
// ─────────────────────────────────────────────────────────────────────────────

// ── Colour palette ────────────────────────────────────────────────────────────
export const palette = {
  light: {
    bg:           "#E8E4DB",
    surface:      "#F4F1EA",
    surfaceAlt:   "#DDD9D1",
    surfaceHover: "#D4D0C8",
    border:       "#E0DDD5",
    borderActive: "#1C1A14",
    textPrimary:  "#1C1A14",
    textSecondary:"#6B6455",
    textMuted:    "#B0A898",
    positive:     "#1F8A50",
    negative:     "#D64545",
    indigo:       "#1C1A14",
    gold:         "#C4A35A",
    cardBg:       "#F4F1EA",
    overlay:      "rgba(0,0,0,0.45)",
  },
  dark: {
    bg:           "#0C0C0C",
    surface:      "#161616",
    surfaceAlt:   "#1F1F1F",
    surfaceHover: "#252525",
    border:       "#2A2A2A",
    borderActive: "#F0F0F0",
    textPrimary:  "#F0F0F0",
    textSecondary:"#8A8A8A",
    textMuted:    "#4A4A4A",
    positive:     "#27AE60",
    negative:     "#E84040",
    indigo:       "#F0F0F0",
    gold:         "#C4A35A",
    cardBg:       "#161616",
    overlay:      "rgba(0,0,0,0.65)",
  },
};

// ── Spacing — 8pt grid ────────────────────────────────────────────────────────
export const spacing = {
  "1":  4,
  "2":  8,
  "3":  12,
  "4":  16,
  "5":  20,
  "6":  24,
  "8":  32,
  "10": 40,
  "12": 48,
  "16": 64,
  "20": 80,
} as const;

// ── Border radius ─────────────────────────────────────────────────────────────
export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  "2xl":24,
  "3xl":32,
  full: 9999,
} as const;

// ── Type scale ────────────────────────────────────────────────────────────────
export const type = {
  size: {
    xs:   11,
    sm:   13,
    base: 15,
    md:   17,
    lg:   20,
    xl:   24,
    "2xl":30,
    "3xl":38,
    "4xl":52,
  },
  weight: {
    light:     "300" as const,
    regular:   "400" as const,
    medium:    "500" as const,
    semibold:  "600" as const,
    bold:      "700" as const,
    extrabold: "800" as const,
  },
  family: {
    light:     "Manrope_300Light",
    regular:   "Manrope_400Regular",
    medium:    "Manrope_500Medium",
    semibold:  "Manrope_600SemiBold",
    bold:      "Manrope_700Bold",
    extrabold: "Manrope_800ExtraBold",
  },
  leading: {
    tight:   1.1,
    snug:    1.3,
    normal:  1.5,
    relaxed: 1.7,
  },
  tracking: {
    tight:  -0.5,
    normal:  0,
    wide:    0.5,
    wider:   1,
    widest:  2,
  },
} as const;

// ── Shadows ───────────────────────────────────────────────────────────────────
export const shadow = {
  none: {
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  xs: {
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sm: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

// ── Font family tokens ────────────────────────────────────────────────────────
export const fonts = type.family;

// ── Currency ──────────────────────────────────────────────────────────────────
export function currencySymbol(currency?: string): string {
  const map: Record<string, string> = {
    INR: "₹", USD: "$", EUR: "€", GBP: "£",
    JPY: "¥", AED: "د.إ", SGD: "S$", AUD: "A$", CAD: "C$",
  };
  return map[(currency || "INR").toUpperCase()] ?? "₹";
}

export const currencyOptions = [
  { code: "INR", label: "Indian Rupee",      symbol: "₹" },
  { code: "USD", label: "US Dollar",         symbol: "$" },
  { code: "EUR", label: "Euro",              symbol: "€" },
  { code: "GBP", label: "British Pound",     symbol: "£" },
  { code: "JPY", label: "Japanese Yen",      symbol: "¥" },
  { code: "AED", label: "UAE Dirham",        symbol: "د.إ" },
  { code: "SGD", label: "Singapore Dollar",  symbol: "S$" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
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
  if (/food|eat|lunch|dinner|breakfast|cafe|rest|pizza|coffee|swiggy|zomato|biryani|snack|drink|juice|chai|tea|biscuit|chocolate|icecream|ice cream|dessert|bakery|burger|sandwich|noodle|rice|curry|dosa|idli|thali|paneer|chicken|fish|mutton|veg|beverage|bottle|water|meal|feast|restaurant|dhaba|bar|pub|canteen|mess/.test(n)) return "food";
  if (/uber|ola|cab|taxi|train|flight|bus|travel|petrol|fuel|metro|auto|rickshaw|rapido|toll|parking|ticket|transport|commute|road|highway/.test(n)) return "travel";
  if (/movie|netflix|game|sport|fun|entertain|ticket|show|concert|event|party|club|bowling|amusement|theme.?park|escape.?room|karting|paintball/.test(n)) return "entertainment";
  if (/rent|electr|wifi|water|house|flat|maintenance|bill|gas|cylinder|internet|broadband|recharge|dth|cable/.test(n)) return "utilities";
  if (/shop|cloth|amazon|flipkart|mall|buy|purchase|order|apparel|fashion|shoe|bag|watch|gift|market/.test(n)) return "shopping";
  if (/doctor|medicine|hospital|pharmacy|health|medical|clinic|dentist|optical|glasses|prescription|chemist/.test(n)) return "health";
  if (/hotel|hostel|airbnb|stay|room|resort|lodge|motel|oyo|booking|accommodation|rent/.test(n)) return "accommodation";
  if (/trip|tour|trek|goa|manali|shimla|ooty|kashmir|beach|hill|heritage|sightseeing|excursion/.test(n)) return "trip";
  return "other";
}

// ── Cover images ──────────────────────────────────────────────────────────────
const COVER_MAP: Record<string, string[]> = {
  food:          ["https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80","https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80"],
  travel:        ["https://images.unsplash.com/photo-1488085061387-422e29b40080?w=800&q=80","https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80"],
  entertainment: ["https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80"],
  accommodation: ["https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80"],
  utilities:     ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80"],
  shopping:      ["https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80"],
  trip:          ["https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80","https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80"],
  other:         ["https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80"],
};

export const coverOptions = Object.entries(COVER_MAP).flatMap(([cat, urls]) =>
  urls.map((url, i) => ({ key: `${cat}-${i}`, url, category: cat }))
);

export function resolveCover(
  destinations?: string[] | null,
  category?: string | null,
  coverKey?: string | null,
): string {
  if (coverKey && coverKey.startsWith("http")) return coverKey;
  const cat  = (category || "other").toLowerCase();
  const pool = COVER_MAP[cat] || COVER_MAP.other;
  const seed = (destinations?.[0] || "").charCodeAt(0) || 0;
  return pool[seed % pool.length];
}
