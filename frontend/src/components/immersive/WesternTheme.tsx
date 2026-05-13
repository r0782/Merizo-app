/**
 * WesternTheme.tsx
 * USD — "Western Ledger"
 *
 * Visual language: Old west saloon ledger, leather accounting book,
 * train station mechanical boards, antique frontier receipts.
 *
 * NOT a dark fintech app. A different presentation system entirely.
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import Svg, { Path, Line, Circle, Rect, G } from "react-native-svg";
import { currencySymbol } from "../../lib/tokens";

// ── Color constants ───────────────────────────────────────────────────────────
const W = {
  leather:   "#1B120D",
  parchment: "#C8A47A",
  parchDark: "#B08A5A",
  parchLight:"#DDBF8E",
  ink:       "#120A07",
  inkLight:  "#3A2010",
  amber:     "#E0B96A",
  brass:     "#8C6A3B",
  red:       "#8B0000",
  border:    "#6B4226",
};

// ── Grain texture overlay ─────────────────────────────────────────────────────
function WGrain() {
  const dots = Array.from({ length: 80 }, (_, i) => ({
    x: ((i * 7919) % 100), y: ((i * 6271) % 100),
    r: 0.3 + (i % 4) * 0.1, o: 0.04 + (i % 8) * 0.008,
  }));
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      style={StyleSheet.absoluteFill as any} pointerEvents="none">
      {dots.map((d, i) => <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#4A2E10" opacity={d.o} />)}
    </Svg>
  );
}

// ── Engraved corner bracket ───────────────────────────────────────────────────
function WCorner({ flip }: { flip?: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16"
      style={{ transform: [{ scaleX: flip ? -1 : 1 }] }}>
      <Path d="M1,15 L1,1 L15,1" fill="none" stroke={W.border} strokeWidth="1.5"/>
      <Path d="M4,15 L4,4 L15,4" fill="none" stroke={W.brass} strokeWidth="0.7" opacity="0.6"/>
      <Path d="M1,1 L3,0 L5,1 L3,3 Z" fill={W.red} opacity="0.8"/>
    </Svg>
  );
}

// ── WESTERN MECHANICAL TICKER ─────────────────────────────────────────────────
// Each digit in its own dark tile — like a split-flap station board
export function WesternTicker({ value, currency = "USD", size = "card" }:
  { value: number; currency?: string; size?: "balance" | "card" | "small" }) {
  const sym = currencySymbol(currency);
  const abs = Math.abs(Math.round(value));
  const formatted = abs.toLocaleString("en-US");
  const neg = value < 0;
  const digitSz = size === "balance" ? 24 : size === "card" ? 18 : 13;
  const tileW   = size === "balance" ? 28 : size === "card" ? 22 : 16;

  return (
    <View style={wt.row}>
      {`${neg ? "-" : ""}${sym}${formatted}`.split("").map((ch, i) => {
        const isSep = ",. -".includes(ch);
        return (
          <View key={i} style={[wt.tile, { minWidth: isSep ? tileW * 0.5 : tileW }, isSep && wt.sep]}>
            <Text style={[wt.digit, { fontSize: digitSz }]}>{ch}</Text>
          </View>
        );
      })}
    </View>
  );
}
const wt = StyleSheet.create({
  row:   { flexDirection: "row", gap: 2, alignItems: "flex-end", flexWrap: "wrap" },
  tile:  {
    backgroundColor: "#0F0904", borderRadius: 2, paddingHorizontal: 4, paddingVertical: 3,
    borderWidth: 1, borderColor: "#3A2210", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.7, shadowRadius: 2, elevation: 3,
  },
  sep:   { backgroundColor: "transparent", borderColor: "transparent", shadowOpacity: 0, elevation: 0 },
  digit: { color: W.amber, fontWeight: "700", fontVariant: ["tabular-nums"] as any },
});

// ── WESTERN BALANCE CARD ──────────────────────────────────────────────────────
// Looks like a parchment ledger entry with engraved borders
export function WesternBalanceCard({ name, paid, share, net, currency }:
  { name: string; paid: number; share: number; net: number; currency: string }) {
  const sym = currencySymbol(currency);
  return (
    <View style={wbc.outer}>
      <View style={wbc.leatherFrame}>
        <View style={wbc.parchment}>
          <WGrain />
          {/* Corner brackets */}
          <View style={[wbc.corner, { top: 4, left: 4 }]}><WCorner /></View>
          <View style={[wbc.corner, { top: 4, right: 4 }]}><WCorner flip /></View>
          {/* Engraved top line */}
          <View style={wbc.topRule} />
          {/* Content */}
          <View style={wbc.row}>
            <View style={{ flex: 1 }}>
              <Text style={wbc.name}>{name.toUpperCase()}</Text>
              <Text style={wbc.detail}>
                PAID: {sym}{Math.round(paid).toLocaleString()} · SHARE: {sym}{Math.round(share).toLocaleString()}
              </Text>
            </View>
            <WesternTicker value={net} currency={currency} size="small" />
          </View>
          {/* Perforated bottom */}
          <View style={wbc.perfRow}>
            {Array.from({ length: 18 }, (_, i) => (
              <View key={i} style={wbc.perf} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
const wbc = StyleSheet.create({
  outer:        { marginBottom: 8 },
  leatherFrame: { borderRadius: 4, borderWidth: 2, borderColor: W.border, padding: 3, backgroundColor: W.leather },
  parchment:    { backgroundColor: W.parchment, borderRadius: 2, borderWidth: 1, borderColor: W.brass, overflow: "hidden", padding: 12 },
  corner:       { position: "absolute", zIndex: 1 },
  topRule:      { height: 1, backgroundColor: W.border, marginBottom: 10, opacity: 0.7 },
  row:          { flexDirection: "row", alignItems: "center", gap: 10 },
  name:         { color: W.ink, fontSize: 13, fontWeight: "700", letterSpacing: 1.5 },
  detail:       { color: W.inkLight, fontSize: 10, marginTop: 3, letterSpacing: 0.5 },
  perfRow:      { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  perf:         { width: 4, height: 4, borderRadius: 2, backgroundColor: W.border, opacity: 0.4 },
});

// ── WESTERN EXPENSE ROW ───────────────────────────────────────────────────────
// Looks like a ledger line entry
export function WesternExpenseRow({ name, paidBy, date, amount, currency, emoji }:
  { name: string; paidBy: string; date: string; amount: number; currency: string; emoji?: string }) {
  const sym = currencySymbol(currency);
  return (
    <View style={wer.outer}>
      <View style={wer.iconBox}>
        <Text style={{ fontSize: 14 }}>{emoji || "📜"}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={wer.expName}>{name.toUpperCase()}</Text>
        <Text style={wer.sub}>{paidBy} · {date}</Text>
      </View>
      <View style={wer.amtBox}>
        {`${sym}${Math.round(amount).toLocaleString()}`.split("").map((ch, i) => (
          <View key={i} style={[wer.amtTile, ",. ".includes(ch) && { backgroundColor: "transparent", borderColor: "transparent" }]}>
            <Text style={wer.amtDigit}>{ch}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const wer = StyleSheet.create({
  outer:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: W.border + "40", borderStyle: "dashed" },
  iconBox:  { width: 34, height: 34, borderRadius: 4, backgroundColor: W.leather, borderWidth: 1, borderColor: W.border, alignItems: "center", justifyContent: "center" },
  expName:  { color: W.ink, fontSize: 13, fontWeight: "700", letterSpacing: 0.8 },
  sub:      { color: W.inkLight, fontSize: 10, marginTop: 2 },
  amtBox:   { flexDirection: "row", gap: 1 },
  amtTile:  { backgroundColor: "#0F0904", borderRadius: 2, borderWidth: 1, borderColor: W.border, paddingHorizontal: 3, paddingVertical: 2 },
  amtDigit: { color: W.amber, fontSize: 12, fontWeight: "700" },
});

// ── WESTERN SECTION HEADER ────────────────────────────────────────────────────
export function WesternSectionHeader({ title }: { title: string }) {
  return (
    <View style={wsh.row}>
      <View style={wsh.redMark} />
      <Text style={wsh.text}>{title}</Text>
      <View style={wsh.line} />
      <Text style={wsh.star}>✦</Text>
    </View>
  );
}
const wsh = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 14 },
  redMark: { width: 3, height: 16, backgroundColor: W.red, borderRadius: 1 },
  text:    { color: W.border, fontSize: 10, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase" },
  line:    { flex: 1, height: 1, borderTopWidth: 1, borderTopColor: W.border + "50", borderStyle: "dashed" },
  star:    { color: W.red, fontSize: 10, opacity: 0.8 },
});

// ── WESTERN DIVIDER ───────────────────────────────────────────────────────────
export function WesternDivider({ style }: { style?: any }) {
  return (
    <View style={[wd.row, style]}>
      <View style={wd.line} />
      <View style={wd.center}><Text style={wd.ornament}>— ✦ —</Text></View>
      <View style={wd.line} />
    </View>
  );
}
const wd = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "center", marginVertical: 12 },
  line:    { flex: 1, height: 1, borderTopWidth: 1, borderTopColor: W.border + "50", borderStyle: "dashed" },
  center:  { paddingHorizontal: 10 },
  ornament:{ color: W.red, fontSize: 10, opacity: 0.7 },
});

// ── WESTERN BUTTON ────────────────────────────────────────────────────────────
export function WesternButton({ label, onPress, disabled, testID }:
  { label: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} disabled={disabled} onPress={onPress} activeOpacity={0.78}
      style={[wbtn.outer, disabled && { opacity: 0.45 }]}>
      <View style={wbtn.inner}>
        <Text style={wbtn.label}>{label.toUpperCase()}</Text>
      </View>
    </TouchableOpacity>
  );
}
const wbtn = StyleSheet.create({
  outer: { borderRadius: 4, borderWidth: 2, borderColor: W.border, padding: 2, backgroundColor: "#2F2118" },
  inner: { backgroundColor: "#0F0904", borderRadius: 2, borderWidth: 1, borderColor: W.brass, paddingVertical: 13, paddingHorizontal: 24, alignItems: "center" },
  label: { color: W.amber, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
});

// ── WESTERN CURRENCY DISPLAY (hero balance) ───────────────────────────────────
export function WesternCurrencyDisplay({ value, currency, label }:
  { value: number; currency: string; label?: string }) {
  return (
    <View style={wcd.outer}>
      <View style={wcd.leatherBox}>
        <View style={wcd.parchBox}>
          <WGrain />
          {label && <Text style={wcd.label}>{label.toUpperCase()}</Text>}
          <View style={wcd.rule} />
          <WesternTicker value={value} currency={currency} size="balance" />
          <View style={wcd.rule} />
        </View>
      </View>
    </View>
  );
}
const wcd = StyleSheet.create({
  outer:     { marginVertical: 12 },
  leatherBox: { borderRadius: 4, borderWidth: 2, borderColor: W.border, padding: 3, backgroundColor: W.leather },
  parchBox:  { backgroundColor: W.parchLight, borderRadius: 2, overflow: "hidden", padding: 16, alignItems: "center", gap: 10 },
  label:     { color: W.inkLight, fontSize: 9, letterSpacing: 3, fontWeight: "700" },
  rule:      { width: "80%", height: 1, backgroundColor: W.border, opacity: 0.5 },
});
