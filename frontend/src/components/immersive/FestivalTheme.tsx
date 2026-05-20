/**
 * FestivalTheme.tsx
 * INR — "Festival Ledger"
 *
 * Visual language: Luxury Indian invitation card, handcrafted festive accounting,
 * royal textile motifs, embossed gold detailing, premium festive elegance.
 *
 * NOT purple fintech. A different cultural presentation system.
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { currencySymbol } from "../../lib/tokens";

// ── Color constants ───────────────────────────────────────────────────────────
const F = {
  bg:       "#12060D",
  surface:  "#1E0B16",
  card:     "#F5E8C0",
  cardAlt:  "#EDD8A0",
  gold:     "#F4B400",
  goldBright:"#FFD166",
  goldDim:  "#C4A030",
  magenta:  "#B83280",
  ink:      "#2D0A1F",
  inkLight: "#5A2040",
  cream:    "#FFF8E7",
};

// ── Paisley corner decoration ─────────────────────────────────────────────────
function FCorner({ rotate = 0 }: { rotate?: number }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20"
      style={{ transform: [{ rotate: `${rotate}deg` }] }}>
      <Path d="M4,0 Q10,5 4,14 Q-2,5 4,0Z" fill={F.gold} opacity="0.55"/>
      <Path d="M4,3 Q7,7 4,11 Q1,7 4,3Z" fill={F.goldBright} opacity="0.35"/>
      <Circle cx="4" cy="0" r="1.5" fill={F.gold} opacity="0.9"/>
      <Path d="M0,16 Q4,12 8,16" fill="none" stroke={F.goldDim} strokeWidth="0.8" opacity="0.6"/>
    </Svg>
  );
}

// ── FESTIVAL LUXURY TICKER ────────────────────────────────────────────────────
// Glowing gold digits with breathing ambient halo
export function FestivalTicker({ value, currency = "INR", size = "card" }:
  { value: number; currency?: string; size?: "balance" | "card" | "small" }) {
  const sym = currencySymbol(currency);
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const neg = value < 0;

  const glow  = useRef(new Animated.Value(0.4)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(glow,  { toValue: 1,    duration: 2200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.015, duration: 2200, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(glow,  { toValue: 0.4, duration: 2200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,   duration: 2200, useNativeDriver: true }),
      ]),
    ])).start();
  }, [glow, scale]);

  const amtSz = size === "balance" ? 34 : size === "card" ? 24 : 16;
  const symSz = size === "balance" ? 26 : size === "card" ? 18 : 13;

  return (
    <View style={ft.outer}>
      <Animated.View style={[ft.halo, { opacity: glow, transform: [{ scale }] }]} />
      <View style={ft.row}>
        {neg && <Text style={[ft.sym, { fontSize: symSz }]}>−</Text>}
        <Text style={[ft.sym, { fontSize: symSz }]}>{sym}</Text>
        <Text style={[ft.amount, { fontSize: amtSz }]}>{formatted}</Text>
      </View>
      <View style={ft.underBar} />
    </View>
  );
}
const ft = StyleSheet.create({
  outer:    { position: "relative", alignSelf: "flex-start" },
  halo:     { position: "absolute", top: -12, left: -18, right: -18, bottom: -12, borderRadius: 12, backgroundColor: "rgba(244,180,0,0.1)" },
  row:      { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  sym:      { color: F.gold, fontWeight: "600", letterSpacing: 1 },
  amount:   { color: F.goldBright, fontWeight: "900", letterSpacing: 3, fontVariant: ["tabular-nums"] as any },
  underBar: { marginTop: 8, height: 1.5, backgroundColor: F.gold + "40" },
});

// ── FESTIVAL BALANCE CARD ─────────────────────────────────────────────────────
// Luxury invitation card style with ornamental gold corners
export function FestivalBalanceCard({ name, paid, share, net, currency }:
  { name: string; paid: number; share: number; net: number; currency: string }) {
  const sym = currencySymbol(currency);
  return (
    <View style={fbc.outer}>
      {/* Gold outer frame */}
      <View style={fbc.goldFrame}>
        {/* Top shimmer bar */}
        <View style={fbc.topBar} />
        {/* Ivory content area */}
        <View style={fbc.ivory}>
          {/* Four corner decorations */}
          <View style={[fbc.corner, { top: 4, left: 4 }]}><FCorner /></View>
          <View style={[fbc.corner, { top: 4, right: 4 }]}><FCorner rotate={90} /></View>
          <View style={[fbc.corner, { bottom: 4, left: 4 }]}><FCorner rotate={270} /></View>
          <View style={[fbc.corner, { bottom: 4, right: 4 }]}><FCorner rotate={180} /></View>
          {/* Name */}
          <Text style={fbc.name}>{name}</Text>
          {/* Gold separator */}
          <View style={fbc.goldLine} />
          {/* Row: detail + ticker */}
          <View style={fbc.row}>
            <View style={{ flex: 1 }}>
              <Text style={fbc.detail}>
                भुगतान: {sym}{Math.round(paid).toLocaleString()} · हिस्सा: {sym}{Math.round(share).toLocaleString()}
              </Text>
            </View>
            <FestivalTicker value={net} currency={currency} size="small" />
          </View>
        </View>
      </View>
    </View>
  );
}
const fbc = StyleSheet.create({
  outer:     { marginBottom: 10 },
  goldFrame: { borderRadius: 12, borderWidth: 1.5, borderColor: F.gold, padding: 2, backgroundColor: F.bg },
  topBar:    { height: 3, backgroundColor: F.gold, opacity: 0.7, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  ivory:     { backgroundColor: F.card, borderRadius: 9, padding: 14, overflow: "hidden", position: "relative" },
  corner:    { position: "absolute", zIndex: 1 },
  name:      { color: F.ink, fontSize: 15, fontWeight: "700", letterSpacing: 0.5, textAlign: "center", marginBottom: 6 },
  goldLine:  { height: 1, backgroundColor: F.gold, opacity: 0.4, marginHorizontal: 20, marginBottom: 8 },
  row:       { flexDirection: "row", alignItems: "center", gap: 10 },
  detail:    { color: F.inkLight, fontSize: 10, lineHeight: 16 },
});

// ── FESTIVAL EXPENSE ROW ──────────────────────────────────────────────────────
// Each expense as a festive card row with embossed circle icon
export function FestivalExpenseRow({ name, paidBy, date, amount, currency, emoji }:
  { name: string; paidBy: string; date: string; amount: number; currency: string; emoji?: string }) {
  const sym = currencySymbol(currency);
  return (
    <View style={fer.outer}>
      {/* Gold-ringed icon */}
      <View style={fer.iconRing}>
        <View style={fer.iconInner}>
          <Text style={{ fontSize: 14 }}>{emoji || "🪔"}</Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={fer.name}>{name}</Text>
        <Text style={fer.sub}>{paidBy} · {date}</Text>
      </View>
      {/* Gold amount */}
      <View style={fer.amtWrap}>
        <Text style={fer.amt}>{sym}{Math.round(amount).toLocaleString()}</Text>
      </View>
    </View>
  );
}
const fer = StyleSheet.create({
  outer:   { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: F.gold + "25" },
  iconRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: F.gold, padding: 2 },
  iconInner:{ flex: 1, borderRadius: 16, backgroundColor: F.surface, alignItems: "center", justifyContent: "center" },
  name:    { color: F.ink, fontSize: 13, fontWeight: "600" },
  sub:     { color: F.inkLight, fontSize: 10, marginTop: 2 },
  amtWrap: { backgroundColor: F.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: F.gold + "40" },
  amt:     { color: F.goldBright, fontSize: 13, fontWeight: "700", letterSpacing: 1 },
});

// ── FESTIVAL SECTION HEADER ───────────────────────────────────────────────────
export function FestivalSectionHeader({ title }: { title: string }) {
  return (
    <View style={fsh.outer}>
      <View style={fsh.goldBar} />
      <View style={fsh.content}>
        <Text style={fsh.text}>{title}</Text>
        <Text style={fsh.ornament}>❧</Text>
      </View>
      <View style={fsh.line} />
    </View>
  );
}
const fsh = StyleSheet.create({
  outer:   { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 16 },
  goldBar: { width: 3, height: 22, backgroundColor: F.gold, borderRadius: 1.5 },
  content: { flexDirection: "row", alignItems: "center", gap: 6 },
  text:    { color: F.goldDim, fontSize: 10, fontWeight: "700", letterSpacing: 2.5 },
  ornament: { color: F.gold, fontSize: 12, opacity: 0.7 },
  line:    { flex: 1, height: 1, backgroundColor: F.gold + "30" },
});

// ── FESTIVAL DIVIDER ──────────────────────────────────────────────────────────
export function FestivalDivider({ style }: { style?: any }) {
  return (
    <View style={[fd.row, style]}>
      <View style={fd.line} />
      <View style={fd.center}>
        <Text style={fd.lotus}>✾</Text>
      </View>
      <View style={fd.line} />
    </View>
  );
}
const fd = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "center", marginVertical: 14 },
  line:   { flex: 1, height: 1, backgroundColor: F.gold + "35" },
  center: { paddingHorizontal: 12 },
  lotus:  { color: F.gold, fontSize: 14, opacity: 0.75 },
});

// ── FESTIVAL BUTTON ───────────────────────────────────────────────────────────
export function FestivalButton({ label, onPress, disabled, testID }:
  { label: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} disabled={disabled} onPress={onPress} activeOpacity={0.8}
      style={[fbtn.outer, disabled && { opacity: 0.5 }]}>
      <View style={fbtn.topShimmer} />
      <View style={fbtn.inner}>
        <Text style={fbtn.label}>{label}</Text>
      </View>
      <View style={fbtn.bottomShimmer} />
    </TouchableOpacity>
  );
}
const fbtn = StyleSheet.create({
  outer:        { borderRadius: 10, overflow: "hidden", borderWidth: 1.5, borderColor: F.gold },
  topShimmer:   { height: 2, backgroundColor: F.goldBright, opacity: 0.9 },
  inner:        { backgroundColor: F.gold, paddingVertical: 14, paddingHorizontal: 28, alignItems: "center" },
  bottomShimmer: { height: 1, backgroundColor: F.goldDim },
  label:        { color: F.ink, fontSize: 15, fontWeight: "800", letterSpacing: 1 },
});

// ── FESTIVAL CURRENCY DISPLAY ─────────────────────────────────────────────────
export function FestivalCurrencyDisplay({ value, currency, label }:
  { value: number; currency: string; label?: string }) {
  return (
    <View style={fcd.outer}>
      <View style={fcd.goldFrame}>
        <View style={fcd.topBar} />
        <View style={fcd.content}>
          <View style={[fcd.corner, { top: 4, left: 4 }]}><FCorner /></View>
          <View style={[fcd.corner, { top: 4, right: 4 }]}><FCorner rotate={90} /></View>
          {label && <Text style={fcd.label}>{label}</Text>}
          <FestivalTicker value={value} currency={currency} size="balance" />
        </View>
      </View>
    </View>
  );
}
const fcd = StyleSheet.create({
  outer:     { marginVertical: 12 },
  goldFrame: { borderRadius: 14, borderWidth: 1.5, borderColor: F.gold, padding: 2, backgroundColor: F.bg },
  topBar:    { height: 3, backgroundColor: F.gold, opacity: 0.6, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  content:   { backgroundColor: "#1E0B16", borderRadius: 10, padding: 20, alignItems: "center", gap: 8, overflow: "hidden", position: "relative" },
  corner:    { position: "absolute", zIndex: 1 },
  label:     { color: F.goldDim, fontSize: 9, letterSpacing: 3, fontWeight: "700" },
});
