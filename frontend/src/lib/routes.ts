// src/lib/routes.ts
// Central spot for route strings that get typed out more than once —
// keeps navigation targets consistent when a screen path changes.
export const ROUTES = {
  HOME: "/(tabs)/home",
  CHAT: "/(tabs)/chat",
  SCAN: "/scan",
  SCAN_QR: "/scan-qr",
  SPLIT_DETAIL: "/split/[id]",
  CREATE_SPLIT: "/create-split",
  LOGIN: "/login",
  REGISTER: "/register",
  LOGIN_OTP: "/login-otp",
  LOGIN_VERIFY: "/login-verify",
  CURRENCY_ONBOARDING: "/currency-onboarding",
} as const;
