/**
 * FinancialRealmsSettings.tsx
 *
 * Drop-in "Financial Realms" section for the existing Settings / Appearance page.
 *
 * Usage:
 *   import { FinancialRealmsSettings } from "../../src/components/FinancialRealmsSettings";
 *   // Inside your settings screen:
 *   <FinancialRealmsSettings />
 */

import React, { useState } from "react";
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import { CurrencyThemeList } from "./CurrencyThemeSelector";
import { ImmersiveThemePreviewCard } from "./ImmersiveThemePreviewCard";
import type { CurrencyThemeId } from "../lib/currencyThemes";

// ── Currency picker row ────────────────────────────────────────────────────────

function CurrencyRow({
  currency,
  onChangeCurrency,
}: {
  currency: string;
  onChangeCurrency: (c: string) => void;
}) {
  const { c } = useTheme();
  const SUPPORTED = ["INR", "USD", "EUR", "JPY", "GBP", "AUD", "SGD"];

  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>
        DEFAULT CURRENCY
      </Text>
      <View style={styles.currencyRow}>
        {SUPPORTED.map((code) => (
          <TouchableOpacity
            key={code}
            onPress={() => onChangeCurrency(code)}
            style={[
              styles.currencyPill,
              {
                backgroundColor:
                  currency === code ? c.indigo : c.surface,
                borderColor:
                  currency === code ? c.indigo : c.border,
              },
            ]}
          >
            <Text
              style={[
                styles.currencyPillText,
                {
                  color:
                    currency === code
                      ? "#fff"
                      : c.textSecondary,
                  fontWeight: currency === code ? "700" : "500",
                },
              ]}
            >
              {code}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function FinancialRealmsSettings() {
  const {
    c,
    currencyTheme,
    immersiveEnabled,       setImmersiveEnabled,
    selectedCurrencyThemeId, setSelectedCurrencyThemeId,
    defaultCurrency,        setDefaultCurrency,
    manualThemeOverride,    clearManualOverride,
  } = useTheme();

  const [showThemeList, setShowThemeList] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: c.surface, borderColor: c.border }]}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <View style={[styles.iconWrap, { backgroundColor: c.indigoSoft }]}>
          <Text style={{ fontSize: 18 }}>🌐</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>
            Financial Realms
          </Text>
          <Text style={[styles.sectionDesc, { color: c.textSecondary }]}>
            Immersive cultural themes based on your currency
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: c.border }]} />

      {/* Currency selector */}
      <CurrencyRow
        currency={defaultCurrency}
        onChangeCurrency={(code) => {
          setDefaultCurrency(code);
        }}
      />

      <View style={[styles.divider, { backgroundColor: c.border, marginVertical: 16 }]} />

      {/* Immersive toggle */}
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.toggleLabel, { color: c.textPrimary }]}>
            Immersive Currency Themes
          </Text>
          <Text style={[styles.toggleDesc, { color: c.textSecondary }]}>
            {immersiveEnabled
              ? `Active: ${currencyTheme?.meta.name ?? "—"} ${currencyTheme?.meta.emoji ?? ""}`
              : "Transform the app based on your financial world"}
          </Text>
        </View>
        <Switch
          value={immersiveEnabled}
          onValueChange={setImmersiveEnabled}
          trackColor={{ false: c.border, true: c.indigo }}
          thumbColor={immersiveEnabled ? "#fff" : c.textMuted}
        />
      </View>

      {/* Expanded when ON */}
      {immersiveEnabled && (
        <View style={{ gap: 16, marginTop: 8 }}>
          {/* Preview card */}
          {currencyTheme && (
            <ImmersiveThemePreviewCard theme={currencyTheme} />
          )}

          {/* Manual override notice */}
          {manualThemeOverride && (
            <TouchableOpacity
              onPress={clearManualOverride}
              style={[styles.overrideNotice, { borderColor: c.indigo, backgroundColor: c.indigoSoft }]}
            >
              <Ionicons name="refresh-outline" size={14} color={c.indigo} />
              <Text style={[styles.overrideText, { color: c.indigo }]}>
                Manual override active — tap to sync with {defaultCurrency}
              </Text>
            </TouchableOpacity>
          )}

          {/* Change theme button */}
          <TouchableOpacity
            onPress={() => setShowThemeList(!showThemeList)}
            style={[styles.changeBtn, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}
          >
            <Ionicons
              name={showThemeList ? "chevron-up" : "color-palette-outline"}
              size={16}
              color={c.textPrimary}
            />
            <Text style={[styles.changeBtnText, { color: c.textPrimary }]}>
              {showThemeList ? "Collapse" : "Change Theme Manually"}
            </Text>
          </TouchableOpacity>

          {/* Theme list (expanded) */}
          {showThemeList && (
            <CurrencyThemeList
              selectedId={selectedCurrencyThemeId}
              onSelect={(id) => {
                setSelectedCurrencyThemeId(id as CurrencyThemeId);
                setShowThemeList(false);
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionDesc: {
    fontSize: 12,
    marginTop: 1,
  },
  divider: {
    height: 1,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  currencyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  currencyPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  currencyPillText: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  toggleDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  overrideNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  overrideText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  changeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  changeBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
