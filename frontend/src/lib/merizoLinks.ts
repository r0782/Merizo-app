// ─────────────────────────────────────────────────────────────────────────────
// Merizo Links — central builder/parser for shareable + scannable app links
// (QR codes, deep links, share-sheet URLs).
//
// "join" (trip invites) and "user" (a profile QR, keyed by email — scan to
// add someone as a friend or straight into a split) are wired up. Add new
// entries to MERIZO_LINK_TYPES and a case in navigateToMerizoLink() for
// future link types — everything else (QR generation, the scanner,
// deep-link handling) is generic over this map already.
// ─────────────────────────────────────────────────────────────────────────────
import type { Router } from "expo-router";

export const MERIZO_LINK_TYPES = {
  join: "join",
  user: "user",
} as const;

export type MerizoLinkType = keyof typeof MERIZO_LINK_TYPES;

// Web origin used to build shareable links. Overridable per environment;
// falls back to the same default host the backend uses for FRONTEND_URL.
const APP_URL = (process.env.EXPO_PUBLIC_APP_URL || "https://merizo-app.onrender.com").replace(/\/+$/, "");

export function buildMerizoLink(type: MerizoLinkType, token: string): string {
  return `${APP_URL}/${MERIZO_LINK_TYPES[type]}/${token}`;
}

export interface ParsedMerizoLink {
  type: MerizoLinkType;
  token: string;
}

/**
 * Parse a scanned QR payload or opened deep link. Accepts both web links
 * (https://merizo-app.onrender.com/join/XYZ) and app-scheme links
 * (merizo://join/XYZ) — for scheme URLs the WHATWG URL parser puts the first
 * path segment in `hostname` rather than `pathname`.
 */
export function parseMerizoLink(raw: string): ParsedMerizoLink | null {
  if (!raw) return null;
  const input = raw.trim();
  let segments: string[] = [];
  try {
    const u = new URL(input);
    const hostLooksLikeDomain = u.hostname.includes(".") || u.hostname === "localhost";
    const fromHost = !hostLooksLikeDomain && u.hostname ? [u.hostname] : [];
    const fromPath = u.pathname.split("/").filter(Boolean);
    segments = [...fromHost, ...fromPath];
  } catch {
    segments = input.split("/").filter(Boolean);
  }
  if (segments.length < 2) return null;
  const [segment, token] = segments;
  const type = (Object.keys(MERIZO_LINK_TYPES) as MerizoLinkType[]).find(
    (t) => MERIZO_LINK_TYPES[t] === segment
  );
  if (!type || !token) return null;
  return { type, token };
}

export function isMerizoLink(raw: string): boolean {
  return parseMerizoLink(raw) !== null;
}

/** Navigate to the right screen for a parsed link. Central place to extend as new link types ship. */
export function navigateToMerizoLink(router: Router, link: ParsedMerizoLink) {
  switch (link.type) {
    case "join":
      router.push(`/join/${link.token}` as any);
      return;
    case "user":
      // token is the scanned user's email — hand off to the friends screen,
      // which prompts to add them as a friend.
      router.push({ pathname: "/friends", params: { addEmail: link.token } } as any);
      return;
    default:
      link.type satisfies never;
  }
}
