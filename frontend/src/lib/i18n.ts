/**
 * i18n bootstrap — react-i18next with AsyncStorage persistence.
 *
 * Call initI18n() once at app startup (in _layout.tsx).
 * Use the useTranslation() hook from react-i18next everywhere else.
 *
 * Adding a new language:
 *   1. Add the JSON file to src/locales/<code>.json
 *   2. Import it here and add to RESOURCES
 *   3. Add to SUPPORTED_LANGUAGES below
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

// ── Locale resources (imported statically for offline + instant load) ─────────
import en from "../locales/en.json";
import hi from "../locales/hi.json";
import te from "../locales/te.json";
import ta from "../locales/ta.json";
import kn from "../locales/kn.json";
import ml from "../locales/ml.json";
import mr from "../locales/mr.json";
import bn from "../locales/bn.json";
import gu from "../locales/gu.json";
import pa from "../locales/pa.json";
import ur from "../locales/ur.json";
import or from "../locales/or.json";
import as from "../locales/as.json";

export const RESOURCES = {
  en: { translation: en },
  hi: { translation: hi },
  te: { translation: te },
  ta: { translation: ta },
  kn: { translation: kn },
  ml: { translation: ml },
  mr: { translation: mr },
  bn: { translation: bn },
  gu: { translation: gu },
  pa: { translation: pa },
  ur: { translation: ur },
  or: { translation: or },
  as: { translation: as },
};

// ── Supported language metadata ───────────────────────────────────────────────
export interface LanguageMeta {
  code: string;
  name: string;        // English name
  nativeName: string;  // Native script name
  rtl: boolean;        // Right-to-left layout
  region: string;      // BCP-47 region (for Sarvam)
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: "en", name: "English",    nativeName: "English",    rtl: false, region: "en-IN" },
  { code: "hi", name: "Hindi",      nativeName: "हिंदी",       rtl: false, region: "hi-IN" },
  { code: "te", name: "Telugu",     nativeName: "తెలుగు",      rtl: false, region: "te-IN" },
  { code: "ta", name: "Tamil",      nativeName: "தமிழ்",      rtl: false, region: "ta-IN" },
  { code: "kn", name: "Kannada",    nativeName: "ಕನ್ನಡ",       rtl: false, region: "kn-IN" },
  { code: "ml", name: "Malayalam",  nativeName: "മലയാളം",     rtl: false, region: "ml-IN" },
  { code: "mr", name: "Marathi",    nativeName: "मराठी",       rtl: false, region: "mr-IN" },
  { code: "bn", name: "Bengali",    nativeName: "বাংলা",       rtl: false, region: "bn-IN" },
  { code: "gu", name: "Gujarati",   nativeName: "ગુજરાતી",     rtl: false, region: "gu-IN" },
  { code: "pa", name: "Punjabi",    nativeName: "ਪੰਜਾਬੀ",      rtl: false, region: "pa-IN" },
  { code: "ur", name: "Urdu",       nativeName: "اردو",        rtl: true,  region: "ur-IN" },
  { code: "or", name: "Odia",       nativeName: "ଓଡ଼ିଆ",       rtl: false, region: "or-IN" },
  { code: "as", name: "Assamese",   nativeName: "অসমীয়া",     rtl: false, region: "as-IN" },
];

export const LANG_STORAGE_KEY = "merizo_language";

// ── Device language detection ─────────────────────────────────────────────────
// Android language = Telugu → expo-localization → "te" → te.json → whole UI.
// Falls back to "en" if the device locale isn't one of our supported codes.
function getDeviceLanguage(): string {
  try {
    const code = Localization.getLocales()[0]?.languageCode?.toLowerCase() || "en";
    return SUPPORTED_LANGUAGES.some(l => l.code === code) ? code : "en";
  } catch {
    return "en";
  }
}

// ── Initialise i18n ───────────────────────────────────────────────────────────
let _initialised = false;

export async function initI18n(): Promise<void> {
  if (_initialised) return;
  _initialised = true;

  // Restore persisted language, fall back to device locale
  let savedLang = "en";
  try {
    const stored = await AsyncStorage.getItem(LANG_STORAGE_KEY);
    savedLang = stored || getDeviceLanguage();
  } catch {
    savedLang = getDeviceLanguage();
  }

  await i18n
    .use(initReactI18next)
    .init({
      resources: RESOURCES,
      lng: savedLang,
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      compatibilityJSON: "v4",
    });
}

// ── Runtime language change (persists to AsyncStorage) ───────────────────────
export async function changeLanguage(code: string): Promise<void> {
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, code);
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function getCurrentLanguage(): string {
  return i18n.language || "en";
}

export function getLanguageMeta(code: string): LanguageMeta {
  return SUPPORTED_LANGUAGES.find(l => l.code === code) ?? SUPPORTED_LANGUAGES[0];
}

export function isRTL(code?: string): boolean {
  return getLanguageMeta(code ?? getCurrentLanguage()).rtl;
}

export default i18n;
