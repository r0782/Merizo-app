/**
 * currencyThemes.ts
 *
 * Defines 4 immersive cultural themes tied to currencies.
 * Each theme maps to the exact palette shape used throughout the app,
 * so existing components get themed automatically when immersive mode is ON.
 *
 * Architecture:
 *  - palette  → maps to typeof palette.light  (c.bg, c.surface, etc.)
 *  - ticker   → digit/bg colors + variant name for ThemedTicker
 *  - decorative → border radius, shadow, texture opacity overrides
 *  - meta     → display info (name, emoji, tagline)
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** Matches the existing palette shape in tokens.ts exactly */
export type PaletteShape = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  positive: string;
  negative: string;
  indigo: string;
};

export type CurrencyThemeId =
  | "westernLedger"   // USD — vintage frontier ledger
  | "festivalLedger"  // INR — Indian festive elegance
  | "zenInk"          // JPY — Japanese minimal calm
  | "romanTreasury";  // EUR — Roman prestige finance

export type TickerVariant = "western" | "temple" | "zen" | "roman";

export interface CurrencyThemeTicker {
  variant: TickerVariant;
  digitColor: string;    // matches DotNum color prop
  digitColorDark: "indigo" | "black" | "red" | "green" | "white" | "gold" | "muted";
  bgColor: string;
  glowColor: string;     // for pulse effect
  currencySymbol: string;
}

export interface CurrencyThemeDecorative {
  cardBorderRadius: number;
  cardBorderWidth: number;
  cardBorderStyle: "solid" | "double";
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  textureOpacity: number;
  dividerStyle: "ornamental" | "brush" | "dotted" | "line";
  cornerAccentColor: string;
}

export interface CurrencyThemeMeta {
  id: CurrencyThemeId;
  name: string;
  subtitle: string;
  currency: string;
  currencySymbol: string;
  emoji: string;
  tagline: string;
  previewSwatches: string[];  // 4 colors for the selector preview
}

export interface CurrencyTheme {
  meta: CurrencyThemeMeta;
  palette: PaletteShape;        // replaces c when isImmersive
  ticker: CurrencyThemeTicker;
  decorative: CurrencyThemeDecorative;
  transitionMs: number;
}

// ── Theme 1: Western Ledger (USD) ─────────────────────────────────────────────
const westernLedger: CurrencyTheme = {
  meta: {
    id: "westernLedger",
    name: "Western Ledger",
    subtitle: "Frontier Finance",
    currency: "USD",
    currencySymbol: "$",
    emoji: "🤠",
    tagline: "Frontier accounting meets modern finance",
    previewSwatches: ["#1B120D", "#C2A076", "#8B0000", "#E0B96A"],
  },
  palette: {
    // Dark leather background
    bg:         "#1B120D",
    surface:    "#2F2118",
    surfaceAlt: "#241710",
    border:     "rgba(140,106,59,0.3)",
    // Ink-on-parchment text
    textPrimary:   "#E8D8BE",
    textSecondary: "#A8845C",
    textMuted:     "#6B4E34",
    // Brass / crimson accent
    accent:     "#8C6A3B",
    accentSoft: "rgba(140,106,59,0.18)",
    positive:   "#5A7A2A",
    negative:   "#8B0000",
    indigo:     "#8C6A3B",  // replace indigo with brass
  },
  ticker: {
    variant:        "western",
    digitColor:     "#E0B96A",
    digitColorDark: "gold",
    bgColor:        "#140D08",
    glowColor:      "rgba(224,185,106,0.15)",
    currencySymbol: "$",
  },
  decorative: {
    cardBorderRadius: 4,       // vintage: less rounded
    cardBorderWidth:  1.5,
    cardBorderStyle:  "double",
    shadowColor:      "#000000",
    shadowOpacity:    0.55,
    shadowRadius:     18,
    textureOpacity:   0.07,
    dividerStyle:     "ornamental",
    cornerAccentColor: "#8B0000",
  },
  transitionMs: 600,
};

// ── Theme 2: Festival Ledger (INR) ────────────────────────────────────────────
const festivalLedger: CurrencyTheme = {
  meta: {
    id: "festivalLedger",
    name: "Festival Ledger",
    subtitle: "Festive Elegance",
    currency: "INR",
    currencySymbol: "₹",
    emoji: "🪔",
    tagline: "Where finance meets celebration",
    previewSwatches: ["#1A0A12", "#F8E7C1", "#F4B400", "#B83280"],
  },
  palette: {
    // Deep jewel-toned backgrounds
    bg:         "#12060D",
    surface:    "#1E0B16",
    surfaceAlt: "#26101E",
    border:     "rgba(184,50,128,0.25)",
    // Warm parchment text
    textPrimary:   "#F8E7C1",
    textSecondary: "#C4A87A",
    textMuted:     "#7A5040",
    // Gold / magenta accent
    accent:     "#F4B400",
    accentSoft: "rgba(244,180,0,0.15)",
    positive:   "#0F9E8E",
    negative:   "#D9467A",
    indigo:     "#F4B400",  // replace indigo with gold
  },
  ticker: {
    variant:        "temple",
    digitColor:     "#FFD166",
    digitColorDark: "gold",
    bgColor:        "#5B153F",
    glowColor:      "rgba(244,180,0,0.2)",
    currencySymbol: "₹",
  },
  decorative: {
    cardBorderRadius: 12,
    cardBorderWidth:  1.5,
    cardBorderStyle:  "double",
    shadowColor:      "#F4B400",
    shadowOpacity:    0.12,
    shadowRadius:     20,
    textureOpacity:   0.055,
    dividerStyle:     "ornamental",
    cornerAccentColor: "#F4B400",
  },
  transitionMs: 500,
};

// ── Theme 3: Zen Ink (JPY) ────────────────────────────────────────────────────
const zenInk: CurrencyTheme = {
  meta: {
    id: "zenInk",
    name: "Zen Ink",
    subtitle: "Minimal Clarity",
    currency: "JPY",
    currencySymbol: "¥",
    emoji: "🏯",
    tagline: "Clarity through minimalist finance",
    previewSwatches: ["#F5F1E8", "#FFFEF9", "#C53030", "#1A1A1A"],
  },
  palette: {
    // Rice paper backgrounds (light by nature)
    bg:         "#F5F1E8",
    surface:    "#FFFEF9",
    surfaceAlt: "#EDE7DA",
    border:     "rgba(26,26,26,0.1)",
    // Ink text
    textPrimary:   "#1A1A1A",
    textSecondary: "#555555",
    textMuted:     "#999999",
    // Red seal / stone grey accent
    accent:     "#C53030",
    accentSoft: "rgba(197,48,48,0.1)",
    positive:   "#2D6A4F",
    negative:   "#C53030",
    indigo:     "#C53030",  // replace indigo with red seal
  },
  ticker: {
    variant:        "zen",
    digitColor:     "#1A1A1A",
    digitColorDark: "black",
    bgColor:        "#F7F3EA",
    glowColor:      "rgba(0,0,0,0.04)",
    currencySymbol: "¥",
  },
  decorative: {
    cardBorderRadius: 2,        // minimal: almost square
    cardBorderWidth:  1,
    cardBorderStyle:  "solid",
    shadowColor:      "#000000",
    shadowOpacity:    0.06,
    shadowRadius:     8,
    textureOpacity:   0.035,
    dividerStyle:     "brush",
    cornerAccentColor: "#C53030",
  },
  transitionMs: 800,
};

// ── Theme 4: Roman Treasury (EUR) ─────────────────────────────────────────────
const romanTreasury: CurrencyTheme = {
  meta: {
    id: "romanTreasury",
    name: "Roman Treasury",
    subtitle: "Timeless Prestige",
    currency: "EUR",
    currencySymbol: "€",
    emoji: "🏛️",
    tagline: "Timeless European financial prestige",
    previewSwatches: ["#121212", "#F5E6C8", "#C9A227", "#7B1E1E"],
  },
  palette: {
    // Dark marble backgrounds
    bg:         "#121212",
    surface:    "#1F1A17",
    surfaceAlt: "#2A1F18",
    border:     "rgba(201,162,39,0.2)",
    // Ivory / warm parchment text on dark
    textPrimary:   "#F0E0C0",
    textSecondary: "#A08060",
    textMuted:     "#5A4030",
    // Antique gold accent
    accent:     "#C9A227",
    accentSoft: "rgba(201,162,39,0.15)",
    positive:   "#4A7A3A",
    negative:   "#7B1E1E",
    indigo:     "#C9A227",  // replace indigo with gold
  },
  ticker: {
    variant:        "roman",
    digitColor:     "#E6C068",
    digitColorDark: "gold",
    bgColor:        "#1C140F",
    glowColor:      "rgba(230,192,104,0.12)",
    currencySymbol: "€",
  },
  decorative: {
    cardBorderRadius: 6,
    cardBorderWidth:  1.5,
    cardBorderStyle:  "double",
    shadowColor:      "#C9A227",
    shadowOpacity:    0.1,
    shadowRadius:     16,
    textureOpacity:   0.065,
    dividerStyle:     "ornamental",
    cornerAccentColor: "#C9A227",
  },
  transitionMs: 700,
};

// ── Registry ───────────────────────────────────────────────────────────────────

export const currencyThemes: Record<CurrencyThemeId, CurrencyTheme> = {
  westernLedger,
  festivalLedger,
  zenInk,
  romanTreasury,
};

export const CURRENCY_THEME_LIST: CurrencyTheme[] = [
  westernLedger,
  festivalLedger,
  zenInk,
  romanTreasury,
];

/** Map from ISO currency code → default theme id */
export const CURRENCY_TO_THEME: Record<string, CurrencyThemeId> = {
  USD: "westernLedger",
  INR: "festivalLedger",
  JPY: "zenInk",
  EUR: "romanTreasury",
};

/** Returns the theme for a currency code, or null if unsupported */
export function getThemeForCurrency(currencyCode: string): CurrencyTheme | null {
  const id = CURRENCY_TO_THEME[currencyCode.toUpperCase()];
  return id ? currencyThemes[id] : null;
}

/** Get theme by id */
export function getThemeById(id: CurrencyThemeId | string): CurrencyTheme | null {
  return currencyThemes[id as CurrencyThemeId] ?? null;
}
