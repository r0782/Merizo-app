/**
 * ImmersiveThemePreviewCard.tsx
 *
 * Mini preview card showing how the app looks under a given currency theme.
 * Shows: background, a sample card, a sample number, and the theme name.
 * Used in onboarding and settings.
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from "react-native";
import { CurrencyTheme } from "../lib/currencyThemes";

type Props = {
  theme: CurrencyTheme;
  /** Show the full version (default) or compact mini version */
  compact?: boolean;
};

export function ImmersiveThemePreviewCard({ theme, compact = false }: Props) {
  const tp = theme.palette;
  const tk = theme.ticker;
  const dc = theme.decorative;

  // Subtle shimmer pulse on the accent line
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const accentOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  if (compact) {
    return (
      <View style={[styles.compact, { backgroundColor: tp.bg, borderColor: tp.accent }]}>
        <Text style={{ fontSize: 18 }}>{theme.meta.emoji}</Text>
        <View>
          <Text style={[styles.compactName, { color: tp.textPrimary }]}>{theme.meta.name}</Text>
          <Text style={[styles.compactSub, { color: tp.textSecondary }]}>{theme.meta.currency}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: "row", gap: 4 }}>
          {theme.meta.previewSwatches.map((col, i) => (
            <View key={i} style={[styles.compactSwatch, { backgroundColor: col }]} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.preview,
        {
          backgroundColor: tp.bg,
          borderRadius: 14,
          borderColor: tp.accent,
          borderWidth: 1,
          overflow: "hidden",
        },
      ]}
    >
      {/* Top bar (simulates nav) */}
      <View style={[styles.navBar, { backgroundColor: tp.surfaceAlt, borderBottomColor: tp.border }]}>
        <View style={[styles.navDot, { backgroundColor: tp.accent }]} />
        <Text style={[styles.navTitle, { color: tp.textPrimary }]}>{theme.meta.name}</Text>
        <Text style={{ fontSize: 12 }}>{theme.meta.emoji}</Text>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {/* Sample balance label */}
        <Text style={[styles.balanceLabel, { color: tp.textSecondary }]}>BALANCE</Text>

        {/* Ticker preview — styled number */}
        <View style={[styles.tickerWrap, { backgroundColor: tk.bgColor }]}>
          <Text style={[styles.tickerText, { color: tk.digitColor }]}>
            {tk.currencySymbol}{"12,500"}
          </Text>
        </View>

        {/* Mini sample cards row */}
        <View style={styles.cardsRow}>
          {["Trip · Goa", "Coffee run", "Rent split"].map((label, i) => (
            <View
              key={i}
              style={[
                styles.miniCard,
                {
                  backgroundColor: tp.surface,
                  borderColor: tp.border,
                  borderWidth: dc.cardBorderWidth,
                  borderRadius: dc.cardBorderRadius,
                },
              ]}
            >
              <Text style={[styles.miniCardText, { color: tp.textSecondary }]} numberOfLines={1}>
                {label}
              </Text>
              <Text style={[styles.miniCardAmt, { color: tp.accent }]}>
                {tk.currencySymbol}{i === 0 ? "3,200" : i === 1 ? "480" : "8,000"}
              </Text>
            </View>
          ))}
        </View>

        {/* Accent divider with shimmer */}
        <Animated.View
          style={[styles.accentDivider, { backgroundColor: tp.accent, opacity: accentOpacity }]}
        />

        {/* Tagline */}
        <Text style={[styles.tagline, { color: tp.textMuted }]}>{theme.meta.tagline}</Text>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  preview: {
    width: "100%",
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  navDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  navTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  body: {
    padding: 14,
    gap: 10,
  },
  balanceLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  tickerWrap: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  tickerText: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
  },
  cardsRow: {
    gap: 6,
  },
  miniCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  miniCardText: {
    fontSize: 10,
    fontWeight: "500",
  },
  miniCardAmt: {
    fontSize: 11,
    fontWeight: "700",
  },
  accentDivider: {
    height: 1.5,
    borderRadius: 1,
    marginTop: 2,
  },
  tagline: {
    fontSize: 9,
    fontStyle: "italic",
    letterSpacing: 0.3,
  },
  // Compact
  compact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  compactName: {
    fontSize: 13,
    fontWeight: "700",
  },
  compactSub: {
    fontSize: 11,
  },
  compactSwatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
});
