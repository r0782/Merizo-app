/**
 * ThemedCard.tsx
 *
 * 4 completely different card presentations — not color swaps.
 *
 * Western:  parchment paper, engraved double border, sepia vignette grain
 * Festival: jewel-tone, ornamental gold corners, layered decorative framing
 * Zen:      floating rice paper, barely-there border, generous breathing room
 * Roman:    dark marble, ivory content area, gold engraved border
 *
 * Drop-in replacement:
 *   // Before:
 *   <View style={[styles.card, { backgroundColor: c.surface }]}>
 *   // After:
 *   <ThemedCard>
 */

import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useTheme } from "../lib/theme";

type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Tighter padding variant for list items */
  compact?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// SVG CORNER DECORATIONS
// ─────────────────────────────────────────────────────────────────────────────

function WesternCorner({ flip = false }: { flip?: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18"
      style={{ transform: [{ scaleX: flip ? -1 : 1 }] }}>
      {/* Engraved bracket */}
      <Path d="M2,16 L2,2 L16,2" fill="none" stroke="#6B4226" strokeWidth="1.5"/>
      <Path d="M5,16 L5,5 L16,5" fill="none" stroke="#8C6A3B" strokeWidth="0.7" opacity="0.5"/>
      {/* Corner star */}
      <Path d="M2,2 L4,0 L6,2 L4,4 Z" fill="#8B0000" opacity="0.7"/>
    </Svg>
  );
}

function FestivalCorner({ flip = false, rotate = 0 }: { flip?: boolean; rotate?: number }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22"
      style={{ transform: [{ scaleX: flip ? -1 : 1 }, { rotate: `${rotate}deg` }] }}>
      {/* Paisley-inspired teardrop */}
      <Path d="M4,0 Q10,4 4,14 Q-2,4 4,0Z" fill="#F4B400" opacity="0.55"/>
      <Path d="M4,3 Q7,6 4,11 Q1,6 4,3Z" fill="#FFD166" opacity="0.4"/>
      {/* Dot accent */}
      <Circle cx="4" cy="0" r="1.5" fill="#F4B400" opacity="0.8"/>
    </Svg>
  );
}

function ZenCorner({ flip = false }: { flip?: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14"
      style={{ transform: [{ scaleX: flip ? -1 : 1 }] }}>
      {/* Red seal mark — single geometric accent */}
      <Rect x="1" y="1" width="7" height="7" fill="none" stroke="#C53030" strokeWidth="1" opacity="0.5"/>
      <Rect x="3" y="3" width="3" height="3" fill="#C53030" opacity="0.35"/>
    </Svg>
  );
}

function RomanCorner({ flip = false }: { flip?: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20"
      style={{ transform: [{ scaleX: flip ? -1 : 1 }] }}>
      {/* Laurel-like leaf accent */}
      <Path d="M0,20 Q8,12 10,0" fill="none" stroke="#C9A227" strokeWidth="1.2" opacity="0.5"/>
      <Path d="M2,18 Q6,10 4,2" fill="#C9A227" opacity="0.15"/>
      <Path d="M6,16 Q10,8 8,0" fill="#C9A227" opacity="0.1"/>
      {/* Corner dot */}
      <Circle cx="1" cy="19" r="2" fill="#C9A227" opacity="0.4"/>
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAIN TEXTURE OVERLAY (dot-based — works in React Native)
// ─────────────────────────────────────────────────────────────────────────────

function GrainOverlay({ seed, color, opacity }: { seed: number; color: string; opacity: number }) {
  const dots = Array.from({ length: 120 }, (_, i) => {
    const h = ((seed * 7919 * (i + 1)) >>> 8) % 10000;
    return {
      x: (h % 100),
      y: ((h >> 4) % 100),
      r: 0.4 + ((h % 5) * 0.15),
      o: 0.3 + ((h % 10) / 25),
    };
  });

  return (
    <Svg
      width="100%" height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      style={StyleSheet.absoluteFill as any}
      pointerEvents="none"
    >
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={color} opacity={d.o * opacity} />
      ))}
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WESTERN CARD — parchment + engraved border + grain
// ─────────────────────────────────────────────────────────────────────────────
function WesternCard({ children, style, compact }: CardProps) {
  const pad = compact ? 12 : 18;
  return (
    <View style={[wCard.outer, style]}>
      {/* Engraved outer border */}
      <View style={wCard.borderOuter}>
        {/* Parchment content area */}
        <View style={[wCard.inner, { padding: pad }]}>
          {/* Grain texture */}
          <GrainOverlay seed={12345} color="#6B4226" opacity={0.06} />

          {/* Corner decorations */}
          <View style={[wCard.corner, wCard.cornerTL]}><WesternCorner /></View>
          <View style={[wCard.corner, wCard.cornerTR]}><WesternCorner flip /></View>

          {children}
        </View>
      </View>
    </View>
  );
}

const wCard = StyleSheet.create({
  outer:       { borderRadius: 4, overflow: "hidden" },
  borderOuter: {
    borderWidth: 1.5,
    borderColor: "#6B4226",
    borderRadius: 4,
    padding: 2,
    backgroundColor: "#2F2118",
  },
  inner: {
    backgroundColor: "#C8A47A",
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "#8C6A3B",
    overflow: "hidden",
    position: "relative",
  },
  corner:    { position: "absolute", zIndex: 1 },
  cornerTL:  { top: 4, left: 4 },
  cornerTR:  { top: 4, right: 4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// FESTIVAL CARD — jewel-tone + ornamental gold corners + layered border
// ─────────────────────────────────────────────────────────────────────────────
function FestivalCard({ children, style, compact }: CardProps) {
  const pad = compact ? 12 : 18;
  return (
    <View style={[fCard.outer, style]}>
      {/* Outer gold frame */}
      <View style={fCard.goldFrame}>
        {/* Inner cream/ivory content */}
        <View style={[fCard.inner, { padding: pad }]}>
          {/* Top gold accent bar */}
          <View style={fCard.topBar} />

          {/* Corner decorations */}
          <View style={[fCard.corner, fCard.cornerTL]}><FestivalCorner /></View>
          <View style={[fCard.corner, fCard.cornerTR]}><FestivalCorner flip /></View>
          <View style={[fCard.corner, fCard.cornerBL]}><FestivalCorner rotate={90} /></View>
          <View style={[fCard.corner, fCard.cornerBR]}><FestivalCorner flip rotate={90} /></View>

          {children}
        </View>
      </View>
    </View>
  );
}

const fCard = StyleSheet.create({
  outer:     { borderRadius: 12, overflow: "hidden" },
  goldFrame: {
    borderWidth: 1.5,
    borderColor: "#F4B400",
    borderRadius: 12,
    padding: 3,
    backgroundColor: "#1A0A12",
  },
  inner: {
    backgroundColor: "#F5E8C0",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E4C87A",
    overflow: "hidden",
    position: "relative",
  },
  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 3,
    backgroundColor: "#F4B400",
    opacity: 0.6,
  },
  corner:    { position: "absolute", zIndex: 1 },
  cornerTL:  { top: 5, left: 5 },
  cornerTR:  { top: 5, right: 5 },
  cornerBL:  { bottom: 5, left: 5 },
  cornerBR:  { bottom: 5, right: 5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ZEN CARD — floating rice paper, generous space, brush edge
// ─────────────────────────────────────────────────────────────────────────────
function ZenCard({ children, style, compact }: CardProps) {
  const pad = compact ? 14 : 22;  // Zen gets more padding — breathing room
  return (
    <View style={[zCard.outer, style, { padding: pad }]}>
      {/* Corner seal marks */}
      <View style={[zCard.corner, zCard.cornerTL]}><ZenCorner /></View>
      <View style={[zCard.corner, zCard.cornerTR]}><ZenCorner flip /></View>

      {children}

      {/* Bottom brush mark */}
      <View style={zCard.bottomBrush} />
    </View>
  );
}

const zCard = StyleSheet.create({
  outer: {
    backgroundColor: "#FFFEF9",
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(26,26,26,0.08)",
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  corner:    { position: "absolute", zIndex: 1 },
  cornerTL:  { top: 4, left: 4 },
  cornerTR:  { top: 4, right: 4 },
  bottomBrush: {
    position: "absolute",
    bottom: 0, left: "10%", right: "10%",
    height: 1.5,
    backgroundColor: "#1A1A1A",
    opacity: 0.08,
    borderRadius: 1,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROMAN CARD — dark marble frame, ivory manuscript content, gold engrave border
// ─────────────────────────────────────────────────────────────────────────────
function RomanCard({ children, style, compact }: CardProps) {
  const pad = compact ? 12 : 18;
  return (
    <View style={[rCard.outer, style]}>
      {/* Marble outer frame */}
      <View style={rCard.marbleFrame}>
        {/* Gold border ring */}
        <View style={rCard.goldBorder}>
          {/* Ivory manuscript area */}
          <View style={[rCard.inner, { padding: pad }]}>
            {/* Corner laurel marks */}
            <View style={[rCard.corner, rCard.cornerTL]}><RomanCorner /></View>
            <View style={[rCard.corner, rCard.cornerTR]}><RomanCorner flip /></View>

            {children}
          </View>
        </View>
      </View>
    </View>
  );
}

const rCard = StyleSheet.create({
  outer:       { borderRadius: 6, overflow: "hidden" },
  marbleFrame: {
    backgroundColor: "#1F1A17",
    borderRadius: 6,
    padding: 3,
    borderWidth: 1,
    borderColor: "#3A2F24",
  },
  goldBorder: {
    borderWidth: 1,
    borderColor: "#C9A22755",
    borderRadius: 4,
    padding: 1,
  },
  inner: {
    backgroundColor: "#F0E4C4",
    borderRadius: 3,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "#D4C090",
  },
  corner:    { position: "absolute", zIndex: 1 },
  cornerTL:  { top: 3, left: 3 },
  cornerTR:  { top: 3, right: 3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export function ThemedCard({ children, style, compact }: CardProps) {
  const { currencyTheme, isImmersive, c } = useTheme();

  if (!isImmersive || !currencyTheme) {
    // Standard mode
    return (
      <View
        style={[
          { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border },
          style,
          { padding: compact ? 12 : 16 },
        ]}
      >
        {children}
      </View>
    );
  }

  switch (currencyTheme.meta.id) {
    case "westernLedger":  return <WesternCard  style={style} compact={compact}>{children}</WesternCard>;
    case "festivalLedger": return <FestivalCard style={style} compact={compact}>{children}</FestivalCard>;
    case "zenInk":         return <ZenCard      style={style} compact={compact}>{children}</ZenCard>;
    case "romanTreasury":  return <RomanCard    style={style} compact={compact}>{children}</RomanCard>;
    default:               return <View style={[style, { padding: 16 }]}>{children}</View>;
  }
}
