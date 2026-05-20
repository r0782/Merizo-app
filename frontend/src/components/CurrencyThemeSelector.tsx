/**
 * CurrencyThemeSelector.tsx
 *
 * Horizontal scrollable row of currency theme cards.
 * Used in:
 *   - Currency onboarding screen
 *   - Financial Realms settings section
 *
 * Each card shows: emoji, name, color swatches, selected ring.
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import {
  CurrencyTheme,
  CurrencyThemeId,
  CURRENCY_THEME_LIST,
} from "../lib/currencyThemes";

// ── Mini swatch row ────────────────────────────────────────────────────────────

function SwatchRow({ colors }: { colors: string[] }) {
  return (
    <View style={styles.swatchRow}>
      {colors.map((col, i) => (
        <View key={i} style={[styles.swatch, { backgroundColor: col }]} />
      ))}
    </View>
  );
}

// ── Single theme card ──────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: CurrencyTheme;
  selected: boolean;
  onSelect: () => void;
}) {
  const tp = theme.palette;

  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.82}
      style={[
        styles.card,
        {
          backgroundColor: tp.surface,
          borderColor: selected ? tp.accent : "transparent",
          borderWidth: selected ? 2 : 2,
        },
      ]}
    >
      {/* Selected badge */}
      {selected && (
        <View style={[styles.selectedBadge, { backgroundColor: tp.accent }]}>
          <Ionicons name="checkmark" size={10} color="#fff" />
        </View>
      )}

      {/* Emoji */}
      <Text style={styles.emoji}>{theme.meta.emoji}</Text>

      {/* Names */}
      <Text
        style={[styles.themeName, { color: tp.textPrimary }]}
        numberOfLines={1}
      >
        {theme.meta.name}
      </Text>
      <Text
        style={[styles.themeSubtitle, { color: tp.textSecondary }]}
        numberOfLines={1}
      >
        {theme.meta.currency} · {theme.meta.subtitle}
      </Text>

      {/* Color swatches */}
      <SwatchRow colors={theme.meta.previewSwatches} />
    </TouchableOpacity>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type Props = {
  selectedId: CurrencyThemeId | "none";
  onSelect: (id: CurrencyThemeId) => void;
  showNoneOption?: boolean;
};

export function CurrencyThemeSelector({
  selectedId,
  onSelect,
  showNoneOption = false,
}: Props) {
  const { c } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {showNoneOption && (
        <TouchableOpacity
          onPress={() => onSelect("none" as any)}
          activeOpacity={0.82}
          style={[
            styles.card,
            styles.noneCard,
            {
              backgroundColor: c.surface,
              borderColor: selectedId === "none" ? c.accent : c.border,
              borderWidth: 2,
            },
          ]}
        >
          {selectedId === "none" && (
            <View style={[styles.selectedBadge, { backgroundColor: c.accent }]}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          )}
          <Ionicons name="contrast-outline" size={28} color={c.textMuted} style={{ marginBottom: 6 }} />
          <Text style={[styles.themeName, { color: c.textPrimary }]}>
            Standard
          </Text>
          <Text style={[styles.themeSubtitle, { color: c.textSecondary }]}>
            Light / Dark
          </Text>
          <View style={styles.swatchRow}>
            <View style={[styles.swatch, { backgroundColor: "#0D0D0D" }]} />
            <View style={[styles.swatch, { backgroundColor: "#F5F5F5" }]} />
            <View style={[styles.swatch, { backgroundColor: "#7C5CFF" }]} />
            <View style={[styles.swatch, { backgroundColor: "#FFFFFF" }]} />
          </View>
        </TouchableOpacity>
      )}

      {CURRENCY_THEME_LIST.map((theme) => (
        <ThemeCard
          key={theme.meta.id}
          theme={theme}
          selected={selectedId === theme.meta.id}
          onSelect={() => onSelect(theme.meta.id)}
        />
      ))}
    </ScrollView>
  );
}

// ── Compact list version (for settings) ───────────────────────────────────────

export function CurrencyThemeList({
  selectedId,
  onSelect,
}: {
  selectedId: CurrencyThemeId | "none";
  onSelect: (id: CurrencyThemeId | "none") => void;
}) {
  const { c } = useTheme();

  const options: { id: CurrencyThemeId | "none"; label: string; sub: string; emoji: string; accent: string }[] = [
    { id: "none",          label: "Standard",        sub: "Light / Dark mode",       emoji: "🌓", accent: c.accent },
    { id: "westernLedger", label: "Western Ledger",  sub: "USD — Frontier Finance",  emoji: "🤠", accent: "#8C6A3B" },
    { id: "festivalLedger",label: "Festival Ledger", sub: "INR — Festive Elegance",  emoji: "🪔", accent: "#F4B400" },
    { id: "zenInk",        label: "Zen Ink",         sub: "JPY — Minimal Clarity",   emoji: "🏯", accent: "#C53030" },
    { id: "romanTreasury", label: "Roman Treasury",  sub: "EUR — Timeless Prestige", emoji: "🏛️", accent: "#C9A227" },
  ];

  return (
    <View style={styles.listContainer}>
      {options.map((opt) => {
        const isSel = selectedId === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => onSelect(opt.id)}
            style={[
              styles.listRow,
              { backgroundColor: c.surface, borderColor: isSel ? opt.accent : c.border },
            ]}
          >
            <Text style={styles.listEmoji}>{opt.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.listLabel, { color: c.textPrimary }]}>
                {opt.label}
              </Text>
              <Text style={[styles.listSub, { color: c.textSecondary }]}>
                {opt.sub}
              </Text>
            </View>
            {isSel && (
              <View style={[styles.checkDot, { backgroundColor: opt.accent }]}>
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  card: {
    width: 130,
    borderRadius: 14,
    padding: 14,
    position: "relative",
    gap: 4,
  },
  noneCard: {
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 26,
    marginBottom: 4,
  },
  themeName: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  themeSubtitle: {
    fontSize: 10,
    fontWeight: "500",
  },
  swatchRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 8,
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  // List styles
  listContainer: {
    gap: 8,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  listEmoji: {
    fontSize: 22,
  },
  listLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  listSub: {
    fontSize: 12,
    marginTop: 2,
  },
  checkDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
});
