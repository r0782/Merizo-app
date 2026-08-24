// src/lib/storage-keys.ts

// DEFAULT_CURRENCY intentionally matches the "merizo_currency" key already
// read/written by profile.tsx (Settings → Currency), home.tsx, and
// activity.tsx — reusing the existing key is what keeps onboarding and
// Settings in sync instead of drifting apart under two different keys.
export const STORAGE_KEYS = {
  DEFAULT_CURRENCY: "merizo_currency",
  ONBOARDING_DONE: "onboarding_done",
  RECURRING: "@merizo:recurring",
  CONTACTS_CACHE: "merizo_contacts_cache",
  THEME: "merizo_theme",
  CHAT_HISTORY: "merizo_chat_history",
  AI_ENABLED: "merizo_ai_enabled",
  VOICE_ENABLED: "merizo_voice_enabled",
  TTS_ENABLED: "merizo_tts_enabled",
  VOICE_SPEED: "merizo_voice_speed",
  AI_PROVIDER: "merizo_ai_provider",
} as const;
