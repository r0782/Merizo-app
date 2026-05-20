/**
 * currency-onboarding.tsx
 *
 * Shown once after registration — lets the user choose their default currency
 * and optionally enable immersive cultural themes.
 *
 * Navigate here from register.tsx after successful registration:
 *   router.replace("/currency-onboarding");
 *
 * This screen navigates to /(tabs)/home when done.
 */

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { CurrencyThemeSelector } from "../src/components/CurrencyThemeSelector";
import { ImmersiveThemePreviewCard } from "../src/components/ImmersiveThemePreviewCard";
import { markCurrencyOnboardingDone } from "../src/lib/settings";
import {
  CurrencyThemeId,
  CURRENCY_TO_THEME,
  getThemeById,
} from "../src/lib/currencyThemes";
import { currencySymbol } from "../src/lib/tokens";

// ── Currency options with flag emoji ──────────────────────────────────────────

const CURRENCIES = [
  { code: "INR", flag: "🇮🇳", label: "Indian Rupee",    symbol: "₹" },
  { code: "USD", flag: "🇺🇸", label: "US Dollar",       symbol: "$" },
  { code: "EUR", flag: "🇪🇺", label: "Euro",            symbol: "€" },
  { code: "JPY", flag: "🇯🇵", label: "Japanese Yen",    symbol: "¥" },
  { code: "GBP", flag: "🇬🇧", label: "British Pound",   symbol: "£" },
  { code: "AUD", flag: "🇦🇺", label: "Australian Dollar",symbol: "A$" },
  { code: "SGD", flag: "🇸🇬", label: "Singapore Dollar", symbol: "S$" },
  { code: "AED", flag: "🇦🇪", label: "UAE Dirham",      symbol: "د.إ" },
];

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ step, total }: { step: number; total: number }) {
  const { c } = useTheme();
  return (
    <View style={styles.stepDots}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.stepDot,
            {
              backgroundColor: i <= step ? c.accent : c.border,
              width: i === step ? 20 : 6,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ── Currency picker pill ───────────────────────────────────────────────────────

function CurrencyPill({
  code, flag, label, symbol, selected, onPress,
}: {
  code: string; flag: string; label: string; symbol: string;
  selected: boolean; onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? c.accent : c.surface,
          borderColor: selected ? c.accent : c.border,
        },
      ]}
    >
      <Text style={styles.pillFlag}>{flag}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.pillCode, { color: selected ? "#fff" : c.textPrimary }]}>
          {code}
        </Text>
        <Text style={[styles.pillLabel, { color: selected ? "rgba(255,255,255,0.75)" : c.textSecondary }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.pillSymbol, { color: selected ? "#fff" : c.textMuted }]}>
        {symbol}
      </Text>
      {selected && <Ionicons name="checkmark-circle" size={16} color="#fff" />}
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CurrencyOnboardingScreen() {
  const { c, setDefaultCurrency, setImmersiveEnabled, setSelectedCurrencyThemeId } = useTheme();
  const router = useRouter();

  const [selectedCurrency, setSelectedCurrency] = useState("INR");
  const [immersiveOn, setImmersiveOn] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<CurrencyThemeId | "none">("none");
  const [step, setStep] = useState(0);  // 0 = currency, 1 = theme

  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Auto-pick the matching theme when currency changes
  const onCurrencyChange = (code: string) => {
    setSelectedCurrency(code);
    const matchId = CURRENCY_TO_THEME[code];
    if (matchId) setSelectedThemeId(matchId);
  };

  const activeTheme = getThemeById(selectedThemeId ?? "none");

  const animateTo = (nextStep: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(nextStep), 180);
  };

  const onFinish = async () => {
    // Commit to theme context
    setDefaultCurrency(selectedCurrency);
    setImmersiveEnabled(immersiveOn);
    if (immersiveOn && selectedThemeId !== "none") {
      setSelectedCurrencyThemeId(selectedThemeId);
    }
    await markCurrencyOnboardingDone();
    router.replace("/(tabs)/home");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <StepDots step={step} total={2} />
          <Text style={[styles.headline, { color: c.textPrimary, fontFamily: "Syne_700Bold" }]}>
            {step === 0 ? "Choose Your Default Currency" : "Enable Immersive Themes"}
          </Text>
          <Text style={[styles.subheadline, { color: c.textSecondary }]}>
            {step === 0
              ? "Set the currency for all your splits and expense tracking."
              : "Transform the app appearance based on your financial world and currency style."}
          </Text>
        </View>

        {/* Step content */}
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Step 0: Currency picker ── */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <View style={styles.currencyList}>
                {CURRENCIES.map((cur) => (
                  <CurrencyPill
                    key={cur.code}
                    {...cur}
                    selected={selectedCurrency === cur.code}
                    onPress={() => onCurrencyChange(cur.code)}
                  />
                ))}
              </View>

              {/* Live preview chip */}
              <View style={[styles.previewChip, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Ionicons name="eye-outline" size={14} color={c.textMuted} />
                <Text style={[styles.previewText, { color: c.textSecondary }]}>
                  Splits will show as: {currencySymbol(selectedCurrency)}1,200
                </Text>
              </View>
            </View>
          )}

          {/* ── Step 1: Theme toggle + selector ── */}
          {step === 1 && (
            <View style={styles.stepContent}>

              {/* Immersive toggle */}
              <View style={[styles.toggleCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleTitle, { color: c.textPrimary }]}>
                    Immersive Currency Themes
                  </Text>
                  <Text style={[styles.toggleDesc, { color: c.textSecondary }]}>
                    {immersiveOn
                      ? "Theme active — your app will look unique"
                      : "Keep the standard light / dark appearance"}
                  </Text>
                </View>
                <Switch
                  value={immersiveOn}
                  onValueChange={setImmersiveOn}
                  trackColor={{ false: c.border, true: c.accent }}
                  thumbColor="#fff"
                />
              </View>

              {immersiveOn && (
                <>
                  {/* Theme preview */}
                  {activeTheme && (
                    <View style={{ marginTop: 8 }}>
                      <ImmersiveThemePreviewCard theme={activeTheme} />
                    </View>
                  )}

                  {/* Theme selector */}
                  <Text style={[styles.selectorLabel, { color: c.textSecondary }]}>
                    Or choose a different theme
                  </Text>
                  <CurrencyThemeSelector
                    selectedId={selectedThemeId}
                    onSelect={(id) => setSelectedThemeId(id)}
                  />
                </>
              )}

              {!immersiveOn && (
                <View style={[styles.standardNote, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <Ionicons name="moon-outline" size={16} color={c.textMuted} />
                  <Text style={[styles.standardNoteText, { color: c.textSecondary }]}>
                    You can enable Immersive Themes anytime from Settings → Appearance
                  </Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* Navigation buttons */}
        <View style={styles.navButtons}>
          {step === 0 ? (
            <>
              <TouchableOpacity
                onPress={() => animateTo(1)}
                style={[styles.primaryBtn, { backgroundColor: c.accent }]}
              >
                <Text style={styles.primaryBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onFinish}
                style={styles.skipBtn}
              >
                <Text style={[styles.skipText, { color: c.textMuted }]}>Skip for now</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={onFinish}
                style={[styles.primaryBtn, { backgroundColor: c.accent }]}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>
                  {immersiveOn ? "Apply Theme & Get Started" : "Get Started"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => animateTo(0)}
                style={styles.skipBtn}
              >
                <Ionicons name="arrow-back" size={14} color={c.textMuted} />
                <Text style={[styles.skipText, { color: c.textMuted }]}>Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { paddingTop: 72, paddingBottom: 40, paddingHorizontal: 0 },
  header: { paddingHorizontal: 24, marginBottom: 28, gap: 10 },
  headline: {
    fontSize: 28,
    letterSpacing: -0.8,
    marginTop: 4,
  },
  subheadline: {
    fontSize: 14,
    lineHeight: 22,
  },
  stepDots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  stepDot: {
    height: 6,
    borderRadius: 3,
  },
  stepContent: {
    gap: 12,
    paddingHorizontal: 24,
  },
  currencyList: {
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  pillFlag:   { fontSize: 22 },
  pillCode:   { fontSize: 14, fontWeight: "700" },
  pillLabel:  { fontSize: 12, marginTop: 1 },
  pillSymbol: { fontSize: 16, fontWeight: "700", marginRight: 4 },
  previewChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  previewText: { fontSize: 13 },
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  toggleTitle: { fontSize: 15, fontWeight: "700" },
  toggleDesc:  { fontSize: 12, marginTop: 3 },
  selectorLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  standardNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  standardNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  navButtons: {
    paddingHorizontal: 24,
    marginTop: 32,
    gap: 12,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 14,
  },
});
