/**
 * ThemedDivider.tsx + ThemedSectionHeader.tsx + ThemedButton.tsx
 *
 * Three components in one file for convenience.
 * Each has 4 genuinely different visual presentations.
 */

import React from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import Svg, { Path, Line, Circle, G, Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";

// ══════════════════════════════════════════════════════════════════════════════
// THEMED DIVIDER
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Usage:
 *   <ThemedDivider />           ← auto-picks based on theme
 *   <ThemedDivider label="BALANCES" />   ← with optional center label
 */
export function ThemedDivider({ label, style }: { label?: string; style?: ViewStyle }) {
  const { currencyTheme, isImmersive, c } = useTheme();

  if (!isImmersive || !currencyTheme) {
    return <View style={[{ height: 1, backgroundColor: c.border }, style]} />;
  }

  switch (currencyTheme.meta.id) {
    case "westernLedger":  return <WesternDivider  label={label} style={style} />;
    case "festivalLedger": return <FestivalDivider label={label} style={style} />;
    case "zenInk":         return <ZenDivider      label={label} style={style} />;
    case "romanTreasury":  return <RomanDivider    label={label} style={style} />;
    default:               return <View style={[{ height: 1, backgroundColor: "#33333330" }, style]} />;
  }
}

// ── Western: perforated ticket edge with center star ─────────────────────────
function WesternDivider({ label, style }: { label?: string; style?: ViewStyle }) {
  return (
    <View style={[wDiv.row, style]}>
      <View style={wDiv.line} />
      <View style={wDiv.center}>
        {label
          ? <Text style={wDiv.label}>{label}</Text>
          : <Text style={wDiv.star}>✦</Text>
        }
      </View>
      <View style={wDiv.line} />
    </View>
  );
}
const wDiv = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 },
  line:   { flex: 1, height: 1, borderTopWidth: 1, borderTopColor: "#6B4226", borderStyle: "dashed" },
  center: { paddingHorizontal: 8 },
  star:   { color: "#8B0000", fontSize: 12 },
  label:  { color: "#6B4226", fontSize: 9, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
});

// ── Festival: ornamental lotus divider ────────────────────────────────────────
function FestivalDivider({ label, style }: { label?: string; style?: ViewStyle }) {
  return (
    <View style={[fDiv.row, style]}>
      <View style={fDiv.line} />
      <View style={fDiv.ornament}>
        {label
          ? <Text style={fDiv.label}>{label}</Text>
          : <Text style={fDiv.lotus}>❧</Text>
        }
      </View>
      <View style={fDiv.line} />
    </View>
  );
}
const fDiv = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 14 },
  line:    { flex: 1, height: 1, backgroundColor: "#F4B40040" },
  ornament: { paddingHorizontal: 10 },
  lotus:   { color: "#F4B400", fontSize: 16, opacity: 0.8 },
  label:   { color: "#C4A87A", fontSize: 9, fontWeight: "700", letterSpacing: 2 },
});

// ── Zen: asymmetric brush stroke ──────────────────────────────────────────────
function ZenDivider({ label, style }: { label?: string; style?: ViewStyle }) {
  return (
    <View style={[zDiv.outer, style]}>
      {/* Asymmetric: thick on left, tapers to nothing */}
      <Svg width="100%" height="6" viewBox="0 0 200 6">
        <Path
          d="M0,3 C40,1 80,2 120,3 C150,4 180,3 200,3"
          fill="none"
          stroke="#1A1A1A"
          strokeWidth="1.5"
          opacity="0.12"
          strokeLinecap="round"
        />
      </Svg>
      {label && <Text style={zDiv.label}>{label}</Text>}
    </View>
  );
}
const zDiv = StyleSheet.create({
  outer: { marginVertical: 16 },
  label: { color: "#555", fontSize: 9, letterSpacing: 3, textTransform: "uppercase", marginTop: 8, opacity: 0.6 },
});

// ── Roman: engraved classical rule with diamond ───────────────────────────────
function RomanDivider({ label, style }: { label?: string; style?: ViewStyle }) {
  return (
    <View style={[rDiv.row, style]}>
      <View style={rDiv.doubleLine}>
        <View style={rDiv.lineTop} />
        <View style={rDiv.lineBot} />
      </View>
      <View style={rDiv.center}>
        {label
          ? <Text style={rDiv.label}>{label}</Text>
          : <View style={rDiv.diamond} />
        }
      </View>
      <View style={rDiv.doubleLine}>
        <View style={rDiv.lineTop} />
        <View style={rDiv.lineBot} />
      </View>
    </View>
  );
}
const rDiv = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 14 },
  doubleLine: { flex: 1, gap: 3 },
  lineTop:    { height: 1, backgroundColor: "#C9A22750" },
  lineBot:    { height: 0.5, backgroundColor: "#C9A22730" },
  center:     { paddingHorizontal: 8 },
  diamond: {
    width: 7, height: 7,
    backgroundColor: "#C9A227",
    opacity: 0.5,
    transform: [{ rotate: "45deg" }],
  },
  label: { color: "#A08060", fontSize: 9, fontWeight: "700", letterSpacing: 2 },
});


// ══════════════════════════════════════════════════════════════════════════════
// THEMED SECTION HEADER
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Replaces:
 *   <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
 *     BALANCES
 *   </Text>
 *
 * Usage:
 *   <ThemedSectionHeader title="BALANCES" />
 */
export function ThemedSectionHeader({ title, style }: { title: string; style?: ViewStyle }) {
  const { currencyTheme, isImmersive, c } = useTheme();

  if (!isImmersive || !currencyTheme) {
    return (
      <Text style={[{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" }, style as TextStyle]}>
        {title}
      </Text>
    );
  }

  switch (currencyTheme.meta.id) {
    case "westernLedger":  return <WesternHeader  title={title} style={style} />;
    case "festivalLedger": return <FestivalHeader title={title} style={style} />;
    case "zenInk":         return <ZenHeader      title={title} style={style} />;
    case "romanTreasury":  return <RomanHeader    title={title} style={style} />;
    default:               return <Text style={{ color: "#888", fontSize: 11 }}>{title}</Text>;
  }
}

function WesternHeader({ title, style }: { title: string; style?: ViewStyle }) {
  return (
    <View style={[wHdr.row, style]}>
      {/* Left red accent mark */}
      <View style={wHdr.mark} />
      <Text style={wHdr.text}>{title}</Text>
      <View style={wHdr.line} />
    </View>
  );
}
const wHdr = StyleSheet.create({
  row:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  mark: { width: 3, height: 14, backgroundColor: "#8B0000", borderRadius: 1 },
  text: { color: "#6B4226", fontSize: 10, fontWeight: "700", letterSpacing: 2.5, textTransform: "uppercase" },
  line: { flex: 1, height: 1, borderTopWidth: 1, borderTopColor: "#6B422640", borderStyle: "dashed" },
});

function FestivalHeader({ title, style }: { title: string; style?: ViewStyle }) {
  return (
    <View style={[fHdr.outer, style]}>
      {/* Gold left border accent */}
      <View style={fHdr.goldBar} />
      <View style={fHdr.content}>
        <Text style={fHdr.text}>{title}</Text>
        <Text style={fHdr.ornament}>✦</Text>
      </View>
    </View>
  );
}
const fHdr = StyleSheet.create({
  outer:   { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 10 },
  goldBar: { width: 2.5, height: 20, backgroundColor: "#F4B400", borderRadius: 1, opacity: 0.85 },
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
  text:    { color: "#C4A87A", fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  ornament: { color: "#F4B400", fontSize: 8, opacity: 0.7 },
});

function ZenHeader({ title, style }: { title: string; style?: ViewStyle }) {
  return (
    <View style={[zHdr.outer, style]}>
      <Text style={zHdr.text}>{title}</Text>
    </View>
  );
}
const zHdr = StyleSheet.create({
  outer: { marginBottom: 16, marginTop: 4 },  // extra breathing space for zen
  text:  { color: "#555", fontSize: 10, letterSpacing: 4, textTransform: "uppercase", opacity: 0.7 },
});

function RomanHeader({ title, style }: { title: string; style?: ViewStyle }) {
  return (
    <View style={[rHdr.outer, style]}>
      <Text style={rHdr.text}>{title}</Text>
      <View style={rHdr.underline} />
    </View>
  );
}
const rHdr = StyleSheet.create({
  outer:     { marginBottom: 10 },
  text:      { color: "#A08060", fontSize: 10, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase" },
  underline: { marginTop: 4, height: 1, backgroundColor: "#C9A22740" },
});


// ══════════════════════════════════════════════════════════════════════════════
// THEMED BUTTON
// ══════════════════════════════════════════════════════════════════════════════

type BtnProps = {
  label: string;
  onPress: () => void;
  icon?: any;   // Ionicons name
  disabled?: boolean;
  variant?: "primary" | "ghost";
  style?: ViewStyle;
  testID?: string;
};

export function ThemedButton({ label, onPress, icon, disabled, variant = "primary", style, testID }: BtnProps) {
  const { currencyTheme, isImmersive, c, isDark } = useTheme();

  if (!isImmersive || !currencyTheme) {
    const bg = variant === "primary" ? (isDark ? c.indigo : "#0A0A0A") : "transparent";
    const tc = variant === "primary" ? "#fff" : c.textPrimary;
    const bc = variant === "primary" ? "transparent" : c.border;
    return (
      <TouchableOpacity
        testID={testID}
        disabled={disabled}
        onPress={onPress}
        style={[{
          flexDirection: "row", alignItems: "center", justifyContent: "center",
          paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14,
          backgroundColor: bg, borderWidth: 1, borderColor: bc,
          opacity: disabled ? 0.5 : 1, gap: 8,
        }, style]}
      >
        {icon && <Ionicons name={icon} size={18} color={tc} />}
        <Text style={{ color: tc, fontSize: 15, fontWeight: "700" }}>{label}</Text>
      </TouchableOpacity>
    );
  }

  switch (currencyTheme.meta.id) {
    case "westernLedger":  return <WesternButton  {...{label, onPress, icon, disabled, variant, style, testID}} />;
    case "festivalLedger": return <FestivalButton {...{label, onPress, icon, disabled, variant, style, testID}} />;
    case "zenInk":         return <ZenButton      {...{label, onPress, icon, disabled, variant, style, testID}} />;
    case "romanTreasury":  return <RomanButton    {...{label, onPress, icon, disabled, variant, style, testID}} />;
    default:               return null;
  }
}

function WesternButton({ label, onPress, icon, disabled, style, testID }: BtnProps) {
  return (
    <TouchableOpacity testID={testID} disabled={disabled} onPress={onPress} activeOpacity={0.78}
      style={[wBtn.outer, style, disabled && { opacity: 0.45 }]}>
      <View style={wBtn.inner}>
        {icon && <Ionicons name={icon} size={16} color="#E0B96A" />}
        <Text style={wBtn.label}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}
const wBtn = StyleSheet.create({
  outer: {
    borderRadius: 4, borderWidth: 2, borderColor: "#6B4226",
    padding: 2, backgroundColor: "#2F2118",
  },
  inner: {
    backgroundColor: "#0F0904", borderRadius: 2, borderWidth: 1, borderColor: "#3A2210",
    paddingVertical: 12, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  label: { color: "#E0B96A", fontSize: 14, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" },
});

function FestivalButton({ label, onPress, icon, disabled, style, testID }: BtnProps) {
  return (
    <TouchableOpacity testID={testID} disabled={disabled} onPress={onPress} activeOpacity={0.8}
      style={[fBtn.outer, style, disabled && { opacity: 0.5 }]}>
      {/* Gold shimmer top border */}
      <View style={fBtn.topShimmer} />
      <View style={fBtn.inner}>
        {icon && <Ionicons name={icon} size={16} color="#2D0A1F" />}
        <Text style={fBtn.label}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}
const fBtn = StyleSheet.create({
  outer:      { borderRadius: 10, overflow: "hidden" },
  topShimmer: { height: 2, backgroundColor: "#FFD166", opacity: 0.9 },
  inner: {
    backgroundColor: "#F4B400",
    paddingVertical: 14, paddingHorizontal: 24,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  label: { color: "#2D0A1F", fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
});

function ZenButton({ label, onPress, icon, disabled, style, testID }: BtnProps) {
  return (
    <TouchableOpacity testID={testID} disabled={disabled} onPress={onPress} activeOpacity={0.6}
      style={[zBtn.outer, style, disabled && { opacity: 0.4 }]}>
      {icon && <Ionicons name={icon} size={16} color="#1A1A1A" />}
      <Text style={zBtn.label}>{label}</Text>
      {/* Brush underline */}
      <View style={zBtn.brush} />
    </TouchableOpacity>
  );
}
const zBtn = StyleSheet.create({
  outer: {
    borderWidth: 1, borderColor: "rgba(26,26,26,0.2)", borderRadius: 2,
    paddingVertical: 14, paddingHorizontal: 24,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#FFFEF9", position: "relative",
  },
  label: { color: "#1A1A1A", fontSize: 14, fontWeight: "500", letterSpacing: 2, textTransform: "uppercase" },
  brush: {
    position: "absolute", bottom: 4, left: "15%", right: "15%",
    height: 1, backgroundColor: "#C53030", opacity: 0.3, borderRadius: 1,
  },
});

function RomanButton({ label, onPress, icon, disabled, style, testID }: BtnProps) {
  return (
    <TouchableOpacity testID={testID} disabled={disabled} onPress={onPress} activeOpacity={0.75}
      style={[rBtn.outer, style, disabled && { opacity: 0.45 }]}>
      <View style={rBtn.goldRing}>
        <View style={rBtn.inner}>
          {icon && <Ionicons name={icon} size={16} color="#E6C068" />}
          <Text style={rBtn.label}>{label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
const rBtn = StyleSheet.create({
  outer:   { borderRadius: 6 },
  goldRing: {
    borderWidth: 1.5, borderColor: "#C9A227",
    borderRadius: 6, padding: 2,
  },
  inner: {
    backgroundColor: "#1C140F",
    borderRadius: 4, borderWidth: 1, borderColor: "#3A2F2060",
    paddingVertical: 13, paddingHorizontal: 22,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  label: {
    color: "#E6C068", fontSize: 13, fontWeight: "700",
    letterSpacing: 3, textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
