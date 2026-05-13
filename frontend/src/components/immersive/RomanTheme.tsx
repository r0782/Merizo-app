/**
 * RomanTheme.tsx
 * EUR — "Roman Treasury"
 *
 * Visual language: Ancient Roman treasury records, renaissance banking manuscripts,
 * marble architecture, Medici financial books, Vatican archive aesthetics.
 *
 * NOT black and gold fintech. A prestige presentation system.
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { Path, Circle, Line, G } from "react-native-svg";
import { currencySymbol } from "../../lib/tokens";

// ── Color constants ───────────────────────────────────────────────────────────
const R = {
  marble:   "#121212",
  marbleAlt:"#1F1A17",
  surface:  "#2A1F18",
  ivory:    "#F0E4C4",
  ivoryAlt: "#E8D9B0",
  ink:      "#241A13",
  inkLight: "#5A4030",
  gold:     "#C9A227",
  goldBright:"#E6C068",
  goldDim:  "#8B7355",
  wine:     "#7B1E1E",
};

// ── Laurel corner SVG ─────────────────────────────────────────────────────────
function RCorner({ flip }: { flip?: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18"
      style={{ transform: [{ scaleX: flip ? -1 : 1 }] }}>
      <Path d="M0,18 Q6,10 8,0" fill="none" stroke={R.gold} strokeWidth="1.2" opacity="0.55"/>
      <Path d="M3,16 Q7,9 6,1" fill={R.gold} opacity="0.12"/>
      <Path d="M7,14 Q11,7 9,0" fill={R.gold} opacity="0.08"/>
      <Circle cx="1" cy="17" r="2" fill={R.gold} opacity="0.45"/>
      {/* Leaf */}
      <Path d="M4,10 Q7,7 6,4 Q4,7 4,10Z" fill={R.gold} opacity="0.3"/>
    </Svg>
  );
}

// ── ROMAN ENGRAVED TICKER ─────────────────────────────────────────────────────
// Metallic gold digits with engraving depth effect
export function RomanTicker({ value, currency = "EUR", size = "card" }:
  { value: number; currency?: string; size?: "balance" | "card" | "small" }) {
  const sym = currencySymbol(currency);
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("de-DE", { maximumFractionDigits: 0 });
  const neg = value < 0;

  const amtSz = size === "balance" ? 32 : size === "card" ? 23 : 15;
  const symSz = size === "balance" ? 24 : size === "card" ? 17 : 12;

  return (
    <View style={rt.outer}>
      <View style={rt.row}>
        {neg && <Text style={[rt.neg, { fontSize: amtSz }]}>−</Text>}
        <Text style={[rt.sym, { fontSize: symSz }]}>{sym}</Text>
        <Text style={[rt.amount, { fontSize: amtSz }]}>{formatted}</Text>
      </View>
      {/* Engraved ornamental rule */}
      <View style={rt.ruleRow}>
        <View style={rt.ruleLine} />
        <View style={rt.diamond} />
        <View style={rt.ruleLine} />
      </View>
    </View>
  );
}
const rt = StyleSheet.create({
  outer:    { gap: 8 },
  row:      { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  neg:      { color: R.wine, textShadowColor: "rgba(0,0,0,0.9)", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  sym:      { color: R.gold, fontWeight: "600", letterSpacing: 2, textShadowColor: "rgba(0,0,0,0.9)", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  amount:   {
    color: R.goldBright, fontWeight: "700", letterSpacing: 5,
    fontVariant: ["tabular-nums"] as any,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 3,
  },
  ruleRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  ruleLine: { flex: 1, height: 1, backgroundColor: R.gold + "40" },
  diamond:  { width: 5, height: 5, backgroundColor: R.gold, opacity: 0.55, transform: [{ rotate: "45deg" }] },
});

// ── ROMAN BALANCE CARD ────────────────────────────────────────────────────────
// Archival treasury manuscript style: dark marble frame, ivory content
export function RomanBalanceCard({ name, paid, share, net, currency }:
  { name: string; paid: number; share: number; net: number; currency: string }) {
  const sym = currencySymbol(currency);
  return (
    <View style={rbc.outer}>
      {/* Dark marble outer frame */}
      <View style={rbc.marbleFrame}>
        {/* Gold border ring */}
        <View style={rbc.goldRing}>
          {/* Ivory manuscript content */}
          <View style={rbc.ivory}>
            {/* Corner laurel marks */}
            <View style={[rbc.corner, { top: 3, left: 3 }]}><RCorner /></View>
            <View style={[rbc.corner, { top: 3, right: 3 }]}><RCorner flip /></View>
            {/* Engraved name */}
            <Text style={rbc.name}>{name.toUpperCase()}</Text>
            {/* Rule */}
            <View style={rbc.rule} />
            {/* Row */}
            <View style={rbc.row}>
              <View style={{ flex: 1 }}>
                <Text style={rbc.detail}>
                  SOLVIT: {sym}{Math.round(paid).toLocaleString()} · PARS: {sym}{Math.round(share).toLocaleString()}
                </Text>
              </View>
              <RomanTicker value={net} currency={currency} size="small" />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
const rbc = StyleSheet.create({
  outer:       { marginBottom: 10 },
  marbleFrame: { borderRadius: 6, borderWidth: 1.5, borderColor: R.marbleAlt, padding: 3, backgroundColor: R.marble },
  goldRing:    { borderWidth: 1, borderColor: R.gold + "50", borderRadius: 4, padding: 1 },
  ivory:       { backgroundColor: R.ivory, borderRadius: 3, padding: 14, overflow: "hidden", position: "relative", borderWidth: 1, borderColor: R.ivoryAlt },
  corner:      { position: "absolute", zIndex: 1 },
  name:        { color: R.ink, fontSize: 11, fontWeight: "700", letterSpacing: 3, textAlign: "center", marginBottom: 8 },
  rule:        { height: 1, backgroundColor: R.gold + "35", marginHorizontal: 16, marginBottom: 8 },
  row:         { flexDirection: "row", alignItems: "center", gap: 10 },
  detail:      { color: R.inkLight, fontSize: 9, letterSpacing: 0.5 },
});

// ── ROMAN EXPENSE ROW ─────────────────────────────────────────────────────────
// Ledger entry style with coin-like icon
export function RomanExpenseRow({ name, paidBy, date, amount, currency, emoji }:
  { name: string; paidBy: string; date: string; amount: number; currency: string; emoji?: string }) {
  const sym = currencySymbol(currency);
  return (
    <View style={rer.outer}>
      {/* Coin-like icon */}
      <View style={rer.coin}>
        <Text style={{ fontSize: 14 }}>{emoji || "🪙"}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={rer.name}>{name}</Text>
        <Text style={rer.sub}>{paidBy} · {date}</Text>
      </View>
      <View style={rer.amtBox}>
        <Text style={rer.amount}>{sym}{Math.round(amount).toLocaleString()}</Text>
      </View>
    </View>
  );
}
const rer = StyleSheet.create({
  outer:  { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: R.gold + "20" },
  coin:   { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: R.gold + "50", backgroundColor: R.surface, alignItems: "center", justifyContent: "center" },
  name:   { color: R.ivory, fontSize: 13, fontWeight: "600", letterSpacing: 0.5 },
  sub:    { color: R.goldDim, fontSize: 10, marginTop: 2 },
  amtBox: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: R.gold + "35" },
  amount: {
    color: R.goldBright, fontSize: 13, fontWeight: "700", letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
});

// ── ROMAN SECTION HEADER ──────────────────────────────────────────────────────
export function RomanSectionHeader({ title }: { title: string }) {
  return (
    <View style={rsh.outer}>
      <Text style={rsh.text}>{title}</Text>
      <View style={rsh.ruleRow}>
        <View style={rsh.ruleLine} />
        <View style={rsh.diamond} />
        <View style={rsh.ruleLine} />
      </View>
    </View>
  );
}
const rsh = StyleSheet.create({
  outer:    { marginVertical: 14 },
  text:     { color: R.goldDim, fontSize: 9, fontWeight: "700", letterSpacing: 4, textTransform: "uppercase", marginBottom: 6 },
  ruleRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  ruleLine: { flex: 1, height: 1, backgroundColor: R.gold + "35" },
  diamond:  { width: 5, height: 5, backgroundColor: R.gold, opacity: 0.4, transform: [{ rotate: "45deg" }] },
});

// ── ROMAN DIVIDER ─────────────────────────────────────────────────────────────
export function RomanDivider({ style }: { style?: any }) {
  return (
    <View style={[rd.row, style]}>
      <View style={rd.doubleLine}>
        <View style={rd.lineTop} />
        <View style={rd.lineBot} />
      </View>
      <View style={rd.center}>
        <View style={rd.diamond} />
      </View>
      <View style={rd.doubleLine}>
        <View style={rd.lineTop} />
        <View style={rd.lineBot} />
      </View>
    </View>
  );
}
const rd = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 16 },
  doubleLine: { flex: 1, gap: 4 },
  lineTop:    { height: 1, backgroundColor: R.gold + "40" },
  lineBot:    { height: 0.5, backgroundColor: R.gold + "20" },
  center:     { paddingHorizontal: 6 },
  diamond:    { width: 7, height: 7, backgroundColor: R.gold, opacity: 0.5, transform: [{ rotate: "45deg" }] },
});

// ── ROMAN BUTTON ──────────────────────────────────────────────────────────────
export function RomanButton({ label, onPress, disabled, testID }:
  { label: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} disabled={disabled} onPress={onPress} activeOpacity={0.75}
      style={[rbtn.outer, disabled && { opacity: 0.45 }]}>
      <View style={rbtn.goldRing}>
        <View style={rbtn.inner}>
          <Text style={rbtn.label}>{label.toUpperCase()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
const rbtn = StyleSheet.create({
  outer:   { borderRadius: 6 },
  goldRing: { borderWidth: 1.5, borderColor: R.gold, borderRadius: 6, padding: 2 },
  inner:   { backgroundColor: R.marble, borderRadius: 4, paddingVertical: 14, paddingHorizontal: 24, alignItems: "center", borderWidth: 1, borderColor: R.marbleAlt },
  label:   {
    color: R.goldBright, fontSize: 12, fontWeight: "700", letterSpacing: 4,
    textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
});

// ── ROMAN CURRENCY DISPLAY ────────────────────────────────────────────────────
export function RomanCurrencyDisplay({ value, currency, label }:
  { value: number; currency: string; label?: string }) {
  return (
    <View style={rcd.outer}>
      <View style={rcd.marbleBox}>
        <View style={rcd.goldBorder}>
          <View style={rcd.content}>
            <View style={[rcd.corner, { top: 4, left: 4 }]}><RCorner /></View>
            <View style={[rcd.corner, { top: 4, right: 4 }]}><RCorner flip /></View>
            {label && <Text style={rcd.label}>{label.toUpperCase()}</Text>}
            <RomanTicker value={value} currency={currency} size="balance" />
          </View>
        </View>
      </View>
    </View>
  );
}
const rcd = StyleSheet.create({
  outer:      { marginVertical: 12 },
  marbleBox:  { borderRadius: 8, borderWidth: 2, borderColor: R.marbleAlt, padding: 3, backgroundColor: R.marble },
  goldBorder: { borderWidth: 1, borderColor: R.gold + "45", borderRadius: 5, padding: 1 },
  content:    { backgroundColor: R.surface, borderRadius: 4, padding: 20, alignItems: "center", overflow: "hidden", position: "relative" },
  corner:     { position: "absolute", zIndex: 1 },
  label:      { color: R.goldDim, fontSize: 8, letterSpacing: 4, fontWeight: "700", marginBottom: 10 },
});
