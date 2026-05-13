/**
 * settings.ts  (extended)
 *
 * Adds currency theme settings to the existing settings module.
 * All existing exports (getOverbudgetAlerts, etc.) are preserved unchanged.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CurrencyThemeId } from "./currencyThemes";

// ── EXISTING — Overbudget alerts (unchanged) ───────────────────────────────────

const ALERTS_KEY = "merizo_overbudget_alerts";
const NOTIF_MAP_KEY = "merizo_notif_map";

export async function getOverbudgetAlerts(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(ALERTS_KEY);
    if (v === null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

export async function setOverbudgetAlerts(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ALERTS_KEY, enabled ? "1" : "0");
  } catch {}
}

type NotifMap = Record<string, string>;

export async function getNotifMap(): Promise<NotifMap> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function setNotifId(reminderId: string, notifId: string): Promise<void> {
  try {
    const map = await getNotifMap();
    map[reminderId] = notifId;
    await AsyncStorage.setItem(NOTIF_MAP_KEY, JSON.stringify(map));
  } catch {}
}

export async function popNotifId(reminderId: string): Promise<string | null> {
  try {
    const map = await getNotifMap();
    const v = map[reminderId] || null;
    if (v) {
      delete map[reminderId];
      await AsyncStorage.setItem(NOTIF_MAP_KEY, JSON.stringify(map));
    }
    return v;
  } catch {
    return null;
  }
}

// ── NEW — Currency Theme Settings ──────────────────────────────────────────────

const CURRENCY_SETTINGS_KEY = "merizo_currency_settings_v1";

export interface CurrencyThemeSettings {
  defaultCurrency: string;           // e.g. "INR"
  immersiveThemesEnabled: boolean;
  selectedThemeId: CurrencyThemeId | "none";
  manualThemeOverride: boolean;      // user picked theme ≠ currency match
  onboardingCompleted: boolean;      // hide currency onboarding after first use
}

const DEFAULT_CURRENCY_SETTINGS: CurrencyThemeSettings = {
  defaultCurrency:         "INR",
  immersiveThemesEnabled:  false,
  selectedThemeId:         "none",
  manualThemeOverride:     false,
  onboardingCompleted:     false,
};

export async function getCurrencyThemeSettings(): Promise<CurrencyThemeSettings> {
  try {
    const raw = await AsyncStorage.getItem(CURRENCY_SETTINGS_KEY);
    if (!raw) return DEFAULT_CURRENCY_SETTINGS;
    return { ...DEFAULT_CURRENCY_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CURRENCY_SETTINGS;
  }
}

export async function saveCurrencyThemeSettings(
  patch: Partial<CurrencyThemeSettings>
): Promise<void> {
  try {
    const current = await getCurrencyThemeSettings();
    const merged = { ...current, ...patch };
    await AsyncStorage.setItem(CURRENCY_SETTINGS_KEY, JSON.stringify(merged));
  } catch {}
}

export async function resetCurrencyThemeSettings(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CURRENCY_SETTINGS_KEY);
  } catch {}
}

/** Convenience: mark onboarding as done */
export async function markCurrencyOnboardingDone(): Promise<void> {
  await saveCurrencyThemeSettings({ onboardingCompleted: true });
}

/** Convenience: check if onboarding has been shown */
export async function hasCurrencyOnboardingCompleted(): Promise<boolean> {
  const s = await getCurrencyThemeSettings();
  return s.onboardingCompleted;
}
