/**
 * ZenTheme.tsx
 * JPY — "Zen Ink"
 *
 * Visual language: Japanese minimal editorial, zen accounting journal,
 * rice paper finance notebook, peaceful ink wash aesthetics.
 *
 * NOT white minimal fintech. A calm, intentional presentation system.
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import Svg, { Path, Circle, Line, Rect } from "react-native-svg";
import { currencySymbol } from "../../lib/tokens";

// ── Color constants ───────────────────────────────────────────────────────────
const Z = {
  paper:    "#F5F1E8",
  paperAlt: "#EDE7DA",
  paperDeep:"#E0DBCE",
  ink:      "#1A1A1A",
  inkLight: "#555555",
  inkMuted: "#999999",
  seal:     "#C53030",
  sealDark: "#9B2C2C",
  brush:    "rgba(26,26,26,0.12)",
};

// ── Red seal mark ─────────────────────────────────────────────────────────────
function ZSeal({ size = 24 }: { size?: number }) {
  return (
    <View style={[zs.seal, { width: size, height: size, borderRadius: size * 0.15 }]}>
      <Text style={[zs.text, { fontSize: size * 0.45 }]}>禅</Text>
    </View>
  );
}
const zs = StyleSheet.create({
  seal:  { backgroundColor: Z.seal, alignItems: "center", justifyContent: "center" },
  text:  { color: "#FFFEF9", fontWeight: "800" },
});

// ── Brush stroke SVG ──────────────────────────────────────────────────────────
function ZBrushLine({ width = "100%", opacity = 1 }: { width?: any; opacity?: number }) {
  return (
    <Svg width={width} height={6} viewBox="0 0 200 6" preserveAspectRatio="none">
      <Path d="M0,3 C30,1 60,2 90,3 C120,4 150,3 180,3 C190,3 196,4 200,3"
        fill="none" stroke={Z.ink} strokeWidth="1.5" opacity={0.1 * opacity} strokeLinecap="round"/>
    </Svg>
  );
}

// ── ZEN FLOATING TICKER ───────────────────────────────────────────────────────
// Digits fade in on value change — floating on paper, no background
export function ZenTicker({ value, currency = "JPY", size = "card" }:
  { value: number; currency?: string; size?: "balance" | "card" | "small" }) {
  const sym = currencySymbol(currency);
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("ja-JP", { maximumFractionDigits: 0 });
  const neg = value < 0;

  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, [value]);

  const amtSz = size === "balance" ? 34 : size === "card" ? 26 : 16;
  const symSz = size === "balance" ? 18 : size === "card" ? 14 : 11;

  return (
    <Animated.View style={{ opacity, gap: 6 }}>
      <View style={zt.row}>
        {/* Red seal yen symbol */}
        <View style={[zt.sealBox, { width: symSz * 1.8, height: symSz * 1.8, borderRadius: symSz * 0.25 }]}>
          <Text style={[zt.sealText, { fontSize: symSz * 0.85 }]}>{sym}</Text>
        </View>
        {neg && <Text style={[zt.neg, { fontSize: amtSz }]}>−</Text>}
        <Text style={[zt.amount, { fontSize: amtSz }]}>{formatted}</Text>
      </View>
      <ZBrushLine />
    </Animated.View>
  );
}
const zt = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  sealBox:  { backgroundColor: Z.seal, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  sealText: { color: "#FFFEF9", fontWeight: "800" },
  neg:      { color: Z.seal },
  amount:   { color: Z.ink, fontWeight: "300", letterSpacing: 4, fontVariant: ["tabular-nums"] as any },
});

// ── ZEN BALANCE CARD ──────────────────────────────────────────────────────────
// Floats on paper — barely any border, lots of breathing room
export function ZenBalanceCard({ name, paid, share, net, currency }:
  { name: string; paid: number; share: number; net: number; currency: string }) {
  const sym = currencySymbol(currency);
  return (
    <View style={zbc.outer}>
      {/* Top brush mark */}
      <ZBrushLine />
      <View style={zbc.content}>
        {/* Small seal in corner */}
        <View style={zbc.sealWrap}><ZSeal size={20} /></View>
        <Text style={zbc.name}>{name}</Text>
        <View style={zbc.row}>
          <View style={{ flex: 1 }}>
            <Text style={zbc.detail}>
              支払: {sym}{Math.round(paid).toLocaleString()} · 分担: {sym}{Math.round(share).toLocaleString()}
            </Text>
          </View>
          <ZenTicker value={net} currency={currency} size="small" />
        </View>
      </View>
    </View>
  );
}
const zbc = StyleSheet.create({
  outer:   { marginBottom: 16, backgroundColor: Z.paper },
  content: { paddingVertical: 16, paddingHorizontal: 20, position: "relative" },
  sealWrap: { position: "absolute", top: 12, right: 14, zIndex: 1 },
  name:    { color: Z.ink, fontSize: 14, fontWeight: "400", letterSpacing: 1, marginBottom: 10 },
  row:     { flexDirection: "row", alignItems: "center" },
  detail:  { color: Z.inkLight, fontSize: 10, letterSpacing: 0.5 },
});

// ── ZEN EXPENSE ROW ───────────────────────────────────────────────────────────
// Minimal ink line entries — like a journal
export function ZenExpenseRow({ name, paidBy, date, amount, currency, emoji }:
  { name: string; paidBy: string; date: string; amount: number; currency: string; emoji?: string }) {
  const sym = currencySymbol(currency);
  return (
    <View style={zer.outer}>
      <Text style={zer.emoji}>{emoji || "◎"}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={zer.name}>{name}</Text>
        <Text style={zer.sub}>{paidBy} · {date}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={zer.amount}>{sym}{Math.round(amount).toLocaleString()}</Text>
      </View>
    </View>
  );
}
const zer = StyleSheet.create({
  outer:  { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  emoji:  { fontSize: 16, opacity: 0.6, color: Z.ink },
  name:   { color: Z.ink, fontSize: 13, fontWeight: "400", letterSpacing: 0.5 },
  sub:    { color: Z.inkMuted, fontSize: 10 },
  amount: { color: Z.ink, fontSize: 14, fontWeight: "300", letterSpacing: 2, fontVariant: ["tabular-nums"] as any },
});

// ── ZEN SECTION HEADER ────────────────────────────────────────────────────────
export function ZenSectionHeader({ title }: { title: string }) {
  return (
    <View style={zsh.outer}>
      <Text style={zsh.text}>{title}</Text>
    </View>
  );
}
const zsh = StyleSheet.create({
  outer: { marginTop: 24, marginBottom: 16 },
  text:  { color: Z.inkLight, fontSize: 9, letterSpacing: 5, textTransform: "uppercase", opacity: 0.65 },
});

// ── ZEN DIVIDER ───────────────────────────────────────────────────────────────
export function ZenDivider({ style }: { style?: any }) {
  return (
    <View style={[{ marginVertical: 20 }, style]}>
      <ZBrushLine />
    </View>
  );
}

// ── ZEN BUTTON ────────────────────────────────────────────────────────────────
export function ZenButton({ label, onPress, disabled, testID }:
  { label: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} disabled={disabled} onPress={onPress} activeOpacity={0.55}
      style={[zbtn.outer, disabled && { opacity: 0.35 }]}>
      <Text style={zbtn.label}>{label}</Text>
      {/* Brush underline */}
      <Svg width="70%" height={4} viewBox="0 0 100 4" style={{ marginTop: 2 }}>
        <Path d="M0,2 C20,1 50,2 80,2 C90,2 96,3 100,2"
          fill="none" stroke={Z.seal} strokeWidth="1.2" opacity="0.4" strokeLinecap="round"/>
      </Svg>
    </TouchableOpacity>
  );
}
const zbtn = StyleSheet.create({
  outer: { borderWidth: 1, borderColor: Z.brush, borderRadius: 2, paddingVertical: 14, paddingHorizontal: 28, alignItems: "center", backgroundColor: Z.paper },
  label: { color: Z.ink, fontSize: 13, fontWeight: "400", letterSpacing: 3, textTransform: "uppercase" },
});

// ── ZEN CURRENCY DISPLAY ──────────────────────────────────────────────────────
export function ZenCurrencyDisplay({ value, currency, label }:
  { value: number; currency: string; label?: string }) {
  return (
    <View style={zcd.outer}>
      {label && <Text style={zcd.label}>{label}</Text>}
      <ZenTicker value={value} currency={currency} size="balance" />
    </View>
  );
}
const zcd = StyleSheet.create({
  outer: { paddingVertical: 24, paddingHorizontal: 4, alignItems: "flex-start" },
  label: { color: Z.inkMuted, fontSize: 9, letterSpacing: 4, textTransform: "uppercase", marginBottom: 12 },
});
