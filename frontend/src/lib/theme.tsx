/**
 * theme.tsx  (extended)
 *
 * Backward-compatible extension of the original theme system.
 *
 * Existing code:    const { c, isDark, toggle } = useTheme();  ← unchanged
 * Immersive code:   const { c, isImmersive, currencyTheme } = useTheme();
 *
 * When isImmersive is true, `c` is populated from the selected currency theme's
 * palette, so all existing components get themed automatically.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";
import { palette } from "./tokens";
import {
  CurrencyTheme,
  CurrencyThemeId,
  currencyThemes,
  CURRENCY_TO_THEME,
} from "./currencyThemes";

// ── Types ──────────────────────────────────────────────────────────────────────

type Mode = "light" | "dark";

type ThemeCtx = {
  // ── Existing API (unchanged) ──
  mode: Mode;
  setMode: (m: Mode) => void;
  toggle: () => void;
  c: typeof palette.light;   // always matches palette shape
  isDark: boolean;

  // ── Immersive Currency Theme API (new) ──
  isImmersive: boolean;
  currencyTheme: CurrencyTheme | null;           // current immersive theme, or null
  selectedCurrencyThemeId: CurrencyThemeId | "none";
  setSelectedCurrencyThemeId: (id: CurrencyThemeId | "none") => void;
  immersiveEnabled: boolean;
  setImmersiveEnabled: (v: boolean) => void;
  defaultCurrency: string;
  setDefaultCurrency: (code: string) => void;
  manualThemeOverride: boolean;                   // true if user manually picked theme ≠ currency
  clearManualOverride: () => void;
};

// ── Storage keys ───────────────────────────────────────────────────────────────

const KEY_MODE     = "merizo_theme";
const KEY_IMMERSIVE = "merizo_immersive";
const KEY_CURRENCY_THEME = "merizo_currency_theme_id";
const KEY_DEFAULT_CURRENCY = "merizo_default_currency";

// ── Context ────────────────────────────────────────────────────────────────────

const Ctx = createContext<ThemeCtx | null>(null);

// ── Provider ────────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const sysScheme = useColorScheme();

  // Light/dark mode (existing)
  const [mode, setModeState] = useState<Mode>("dark");

  // Immersive currency theme (new)
  const [immersiveEnabled, setImmersiveEnabledState] = useState(false);
  const [selectedCurrencyThemeId, setSelectedCurrencyThemeIdState] = useState<
    CurrencyThemeId | "none"
  >("none");
  const [defaultCurrency, setDefaultCurrencyState] = useState("INR");
  const [manualThemeOverride, setManualThemeOverride] = useState(false);

  const [loaded, setLoaded] = useState(false);

  // ── Load all settings from storage on mount ──
  useEffect(() => {
    (async () => {
      try {
        const [savedMode, savedImmersive, savedThemeId, savedCurrency] =
          await Promise.all([
            AsyncStorage.getItem(KEY_MODE),
            AsyncStorage.getItem(KEY_IMMERSIVE),
            AsyncStorage.getItem(KEY_CURRENCY_THEME),
            AsyncStorage.getItem(KEY_DEFAULT_CURRENCY),
          ]);

        // Mode
        if (savedMode === "light" || savedMode === "dark") {
          setModeState(savedMode);
        } else {
          setModeState(sysScheme === "light" ? "light" : "dark");
        }

        // Immersive flag
        if (savedImmersive === "1") setImmersiveEnabledState(true);

        // Currency theme
        if (savedThemeId && savedThemeId !== "none" && currencyThemes[savedThemeId as CurrencyThemeId]) {
          setSelectedCurrencyThemeIdState(savedThemeId as CurrencyThemeId);
        }

        // Default currency
        if (savedCurrency) setDefaultCurrencyState(savedCurrency);
      } catch {
        // Silent fallback
      } finally {
        setLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Setters (persist + update state) ──

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY_MODE, m).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "light" ? "dark" : "light");
  }, [mode, setMode]);

  const setImmersiveEnabled = useCallback((v: boolean) => {
    setImmersiveEnabledState(v);
    AsyncStorage.setItem(KEY_IMMERSIVE, v ? "1" : "0").catch(() => {});
  }, []);

  const setSelectedCurrencyThemeId = useCallback(
    (id: CurrencyThemeId | "none") => {
      setSelectedCurrencyThemeIdState(id);
      AsyncStorage.setItem(KEY_CURRENCY_THEME, id).catch(() => {});

      // If user picks a theme that doesn't match their currency, mark as manual override
      const expectedId = CURRENCY_TO_THEME[defaultCurrency.toUpperCase()];
      setManualThemeOverride(id !== "none" && id !== expectedId);
    },
    [defaultCurrency]
  );

  const setDefaultCurrency = useCallback(
    (code: string) => {
      setDefaultCurrencyState(code);
      AsyncStorage.setItem(KEY_DEFAULT_CURRENCY, code).catch(() => {});

      // Auto-select matching theme unless user has manual override
      if (!manualThemeOverride) {
        const matchingTheme = CURRENCY_TO_THEME[code.toUpperCase()];
        if (matchingTheme) {
          setSelectedCurrencyThemeIdState(matchingTheme);
          AsyncStorage.setItem(KEY_CURRENCY_THEME, matchingTheme).catch(() => {});
        }
      }
    },
    [manualThemeOverride]
  );

  const clearManualOverride = useCallback(() => {
    setManualThemeOverride(false);
    // Re-sync theme to currency
    const matchingTheme = CURRENCY_TO_THEME[defaultCurrency.toUpperCase()];
    if (matchingTheme) {
      setSelectedCurrencyThemeId(matchingTheme);
    }
  }, [defaultCurrency, setSelectedCurrencyThemeId]);

  // ── Derive the active palette ──
  //
  // When immersive is ON and a valid theme is selected:
  //   c = currency theme palette  ← all existing components auto-themed
  // Otherwise:
  //   c = palette[mode]           ← existing behavior, 100% unchanged
  //
  const isImmersive =
    immersiveEnabled &&
    selectedCurrencyThemeId !== "none" &&
    !!currencyThemes[selectedCurrencyThemeId as CurrencyThemeId];

  const currencyTheme: CurrencyTheme | null = isImmersive
    ? currencyThemes[selectedCurrencyThemeId as CurrencyThemeId]
    : null;

  const activePalette = isImmersive && currencyTheme
    ? currencyTheme.palette
    : palette[mode];

  // isDark: immersive themes are considered "dark" except zenInk which is light
  const isDark = isImmersive
    ? currencyTheme?.meta.id !== "zenInk"
    : mode === "dark";

  const value = useMemo<ThemeCtx>(
    () => ({
      // Existing API
      mode,
      setMode,
      toggle,
      c: activePalette as typeof palette.light,
      isDark,
      // New immersive API
      isImmersive,
      currencyTheme,
      selectedCurrencyThemeId,
      setSelectedCurrencyThemeId,
      immersiveEnabled,
      setImmersiveEnabled,
      defaultCurrency,
      setDefaultCurrency,
      manualThemeOverride,
      clearManualOverride,
    }),
    [
      mode, setMode, toggle, activePalette, isDark,
      isImmersive, currencyTheme, selectedCurrencyThemeId,
      setSelectedCurrencyThemeId, immersiveEnabled, setImmersiveEnabled,
      defaultCurrency, setDefaultCurrency, manualThemeOverride, clearManualOverride,
    ]
  );

  if (!loaded) return null;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme outside provider");
  return v;
}

// ── Convenience hook for immersive-aware components ───────────────────────────
/**
 * Returns the decorative config for the current currency theme,
 * or sensible defaults if not in immersive mode.
 */
export function useDecorative() {
  const { currencyTheme, isImmersive, isDark } = useTheme();
  if (isImmersive && currencyTheme) return currencyTheme.decorative;
  return {
    cardBorderRadius: 16,
    cardBorderWidth:  1,
    cardBorderStyle:  "solid" as const,
    shadowColor:      "#000",
    shadowOpacity:    isDark ? 0.3 : 0.08,
    shadowRadius:     12,
    textureOpacity:   0,
    dividerStyle:     "line" as const,
    cornerAccentColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
  };
}

/**
 * Returns ticker config for the current theme.
 */
export function useTickerTheme() {
  const { currencyTheme, isImmersive, isDark } = useTheme();
  if (isImmersive && currencyTheme) return currencyTheme.ticker;
  return {
    variant:        "default" as const,
    digitColor:     isDark ? "#FFFFFF" : "#111111",
    digitColorDark: (isDark ? "indigo" : "black") as "indigo" | "black",
    bgColor:        isDark ? "#1A1A1A" : "#F5F5F5",
    glowColor:      "transparent",
    currencySymbol: "₹",
  };
}
