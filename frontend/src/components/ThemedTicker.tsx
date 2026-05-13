/**
 * ThemedTicker.tsx
 *
 * 4 completely different number display styles, one per immersive theme.
 * These are NOT color variants of the same ticker.
 * Each is a different visual presentation language.
 *
 * Usage:
 *   const { isImmersive } = useTheme();
 *   {isImmersive
 *     ? <ThemedTicker value={1200} currency="INR" />
 *     : <AnimatedSmartNum value="₹1,200" size="lg" />
 *   }
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useTheme } from "../lib/theme";
import { currencySymbol } from "../lib/tokens";

type TickerProps = {
  value: number;
  currency?: string;
  /** "balance" = large hero; "card" = medium card amount; "small" = inline */
  size?: "balance" | "card" | "small";
};

// ─────────────────────────────────────────────────────────────────────────────
// WESTERN (USD) — Split-flap mechanical station board
//
// Every digit lives in its own dark box, like vintage arrival/departure boards.
// Amber digits on near-black tiles. Brass-tone separators.
// ─────────────────────────────────────────────────────────────────────────────
function WesternTicker({ value, currency = "USD", size = "card" }: TickerProps) {
  const sym = currencySymbol(currency);
  const abs = Math.abs(Math.round(value));
  const formatted = abs.toLocaleString("en-US");
  const isNeg = value < 0;
  const digitSize = size === "balance" ? 22 : size === "card" ? 17 : 13;
  const boxMinW = size === "balance" ? 26 : size === "card" ? 20 : 15;

  const chars = `${isNeg ? "-" : ""}${sym}${formatted}`;

  return (
    <View style={wStyles.row}>
      {chars.split("").map((ch, i) => {
        const isSep = ch === "," || ch === "." || ch === "-";
        return (
          <View
            key={i}
            style={[
              wStyles.tile,
              { minWidth: isSep ? boxMinW * 0.5 : boxMinW },
              isSep && wStyles.tileSep,
            ]}
          >
            <Text style={[wStyles.digit, { fontSize: digitSize }]}>{ch}</Text>
          </View>
        );
      })}
    </View>
  );
}

const wStyles = StyleSheet.create({
  row:     { flexDirection: "row", gap: 2, alignItems: "flex-end", flexWrap: "wrap" },
  tile: {
    backgroundColor: "#0F0904",
    borderRadius: 2,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#3A2210",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 2,
    elevation: 3,
  },
  tileSep: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  digit: {
    color: "#E0B96A",
    fontWeight: "700",
    fontVariant: ["tabular-nums"] as any,
    letterSpacing: 0,
    includeFontPadding: false,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLE (INR) — Glowing gold luxury display
//
// Large warm-gold digits with a breathing ambient glow pulse.
// The background halo breathes slowly like a diya flame.
// Ceremonial wide letter-spacing. Rupee symbol in a different weight.
// ─────────────────────────────────────────────────────────────────────────────
function TempleTicker({ value, currency = "INR", size = "card" }: TickerProps) {
  const sym = currencySymbol(currency);
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const isNeg = value < 0;

  const glow  = useRef(new Animated.Value(0.5)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glow,  { toValue: 1,   duration: 2000, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.02, duration: 2000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(glow,  { toValue: 0.5, duration: 2000, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1,   duration: 2000, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  const amtSize = size === "balance" ? 32 : size === "card" ? 24 : 16;
  const symSize = size === "balance" ? 24 : size === "card" ? 18 : 13;

  return (
    <View style={tStyles.outer}>
      {/* Breathing glow halo */}
      <Animated.View style={[tStyles.halo, { opacity: glow, transform: [{ scale }] }]} />
      {/* Amount */}
      <View style={tStyles.row}>
        {isNeg && <Text style={[tStyles.sym, { fontSize: symSize }]}>−</Text>}
        <Text style={[tStyles.sym, { fontSize: symSize }]}>{sym}</Text>
        <Text style={[tStyles.amount, { fontSize: amtSize }]}>{formatted}</Text>
      </View>
      {/* Thin ornamental underline */}
      <View style={tStyles.underline} />
    </View>
  );
}

const tStyles = StyleSheet.create({
  outer:     { position: "relative" },
  halo: {
    position: "absolute",
    top: -10, left: -16, right: -16, bottom: -10,
    borderRadius: 10,
    backgroundColor: "rgba(244,180,0,0.1)",
  },
  row:       { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  sym:       { color: "#F4B400", fontWeight: "600", letterSpacing: 1 },
  amount: {
    color: "#FFD166",
    fontWeight: "900",
    letterSpacing: 3,
    fontVariant: ["tabular-nums"] as any,
  },
  underline: {
    marginTop: 6,
    height: 1,
    backgroundColor: "#F4B40035",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ZEN (JPY) — Floating minimal ink counter
//
// Clean light-weight digits fade in on value changes.
// No background. Just ink on paper.
// Red yen symbol as a "seal." Thin horizontal rule below.
// ─────────────────────────────────────────────────────────────────────────────
function ZenTicker({ value, currency = "JPY", size = "card" }: TickerProps) {
  const sym = currencySymbol(currency);
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("ja-JP", { maximumFractionDigits: 0 });
  const isNeg = value < 0;

  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [value]);

  const amtSize = size === "balance" ? 32 : size === "card" ? 26 : 16;
  const symSize = size === "balance" ? 18 : size === "card" ? 14 : 11;

  return (
    <Animated.View style={[zStyles.outer, { opacity }]}>
      <View style={zStyles.row}>
        {/* Red seal — the yen symbol */}
        <View style={zStyles.sealWrap}>
          <Text style={[zStyles.seal, { fontSize: symSize }]}>{sym}</Text>
        </View>
        {isNeg && <Text style={[zStyles.neg, { fontSize: amtSize }]}>−</Text>}
        <Text style={[zStyles.amount, { fontSize: amtSize }]}>{formatted}</Text>
      </View>
      {/* Brush rule */}
      <View style={zStyles.brushRule} />
    </Animated.View>
  );
}

const zStyles = StyleSheet.create({
  outer:    { gap: 8 },
  row:      { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  sealWrap: {
    width: 26,
    height: 26,
    borderRadius: 3,
    backgroundColor: "#C53030",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  seal:   { color: "#FFFEF9", fontWeight: "800" },
  neg:    { color: "#C53030" },
  amount: {
    color: "#1A1A1A",
    fontWeight: "300",
    letterSpacing: 4,
    fontVariant: ["tabular-nums"] as any,
  },
  brushRule: {
    height: 1.5,
    backgroundColor: "#1A1A1A",
    opacity: 0.15,
    borderRadius: 1,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROMAN (EUR) — Engraved metallic treasury display
//
// Deep gold digits with text-shadow to simulate engraving depth.
// Wide letter-spacing for classical gravitas.
// Thin gold ornamental rule with a center diamond.
// ─────────────────────────────────────────────────────────────────────────────
function RomanTicker({ value, currency = "EUR", size = "card" }: TickerProps) {
  const sym = currencySymbol(currency);
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("de-DE", { maximumFractionDigits: 0 });
  const isNeg = value < 0;

  const amtSize = size === "balance" ? 30 : size === "card" ? 23 : 15;
  const symSize = size === "balance" ? 22 : size === "card" ? 17 : 12;

  return (
    <View style={rStyles.outer}>
      <View style={rStyles.row}>
        {isNeg && <Text style={[rStyles.neg, { fontSize: amtSize }]}>−</Text>}
        <Text style={[rStyles.sym, { fontSize: symSize }]}>{sym}</Text>
        <Text style={[rStyles.amount, { fontSize: amtSize }]}>{formatted}</Text>
      </View>
      {/* Engraved ornamental rule */}
      <View style={rStyles.ruleRow}>
        <View style={rStyles.ruleLine} />
        <View style={rStyles.ruleDiamond} />
        <View style={rStyles.ruleLine} />
      </View>
    </View>
  );
}

const rStyles = StyleSheet.create({
  outer:  { gap: 8 },
  row:    { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  neg:    { color: "#7B1E1E" },
  sym: {
    color: "#C9A227",
    fontWeight: "600",
    letterSpacing: 2,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  amount: {
    color: "#E6C068",
    fontWeight: "700",
    letterSpacing: 5,
    fontVariant: ["tabular-nums"] as any,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },
  ruleRow:    { flexDirection: "row", alignItems: "center", gap: 6 },
  ruleLine:   { flex: 1, height: 1, backgroundColor: "#C9A22740" },
  ruleDiamond: {
    width: 5, height: 5,
    backgroundColor: "#C9A227",
    opacity: 0.6,
    transform: [{ rotate: "45deg" }],
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main export — auto-selects based on active immersive theme
// ─────────────────────────────────────────────────────────────────────────────
export function ThemedTicker({ value, currency, size = "card" }: TickerProps) {
  const { currencyTheme, isImmersive } = useTheme();
  if (!isImmersive || !currencyTheme) return null;

  const cur = currency || currencyTheme.meta.currencySymbol;

  switch (currencyTheme.meta.id) {
    case "westernLedger":  return <WesternTicker value={value} currency={cur} size={size} />;
    case "festivalLedger": return <TempleTicker  value={value} currency={cur} size={size} />;
    case "zenInk":         return <ZenTicker     value={value} currency={cur} size={size} />;
    case "romanTreasury":  return <RomanTicker   value={value} currency={cur} size={size} />;
    default:               return null;
  }
}
