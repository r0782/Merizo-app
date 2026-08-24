// src/lib/currency.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { currencyOptions } from "./tokens";
import { STORAGE_KEYS } from "./storage-keys";

/** Best-guess currency from the device locale — no stored preference involved.
 *  Used by the onboarding screen, where nothing has been saved yet. */
export function detectLocaleCurrency(): string {
  const supportedCodes = currencyOptions.map((opt) => opt.code);
  const deviceCurrency = Localization.getLocales()[0]?.currencyCode;

  if (deviceCurrency && supportedCodes.includes(deviceCurrency)) {
    return deviceCurrency;
  }
  return supportedCodes.includes("USD") ? "USD" : supportedCodes[0];
}

/** The currency the rest of the app should default to: whatever the user
 *  already picked (onboarding or Settings, both under the same storage
 *  key), falling back to a locale guess only if nothing's been saved. */
export async function getDefaultCurrency(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_CURRENCY);
    if (stored) return stored;
  } catch {}
  return detectLocaleCurrency();
}

/** Device locale for number formatting (toLocaleString) — falls back to
 *  en-US rather than a region-specific tag so grouping/decimal separators
 *  stay sane when the device doesn't report one. */
export function getDeviceLocale(): string {
  return Localization.getLocales()[0]?.languageTag || "en-US";
}
