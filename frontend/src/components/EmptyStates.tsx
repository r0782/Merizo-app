/**
 * EmptyStates.tsx — AI-Powered Empty States
 * Merizo · Staff Designer Grade
 *
 * Never show: "No data found" or generic placeholders
 * Always show: Context-aware AI guidance with clear CTAs
 */
import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";

interface EmptyProps {
  onPrimary?:   () => void;
  onSecondary?: () => void;
}

// ─── Floating orb animation ───────────────────────────────────────────────────
function FloatingOrb({ color, size = 80 }: { color: string; size?: number }) {
  const float = useRef(new Animated.Value(0)).current;
  const glow  = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(float, { toValue: -12, duration: 2000,
            easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0,   duration: 2000,
            easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glow, { toValue: 0.8, duration: 2000, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ translateY: float }], opacity: glow,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color + "22", alignItems: "center", justifyContent: "center",
      marginBottom: 24 }}>
      <View style={{ width: size * 0.65, height: size * 0.65, borderRadius: size * 0.325,
        backgroundColor: color + "35", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: size * 0.4, height: size * 0.4, borderRadius: size * 0.2,
          backgroundColor: color + "60" }} />
      </View>
    </Animated.View>
  );
}

// ─── No Groups ───────────────────────────────────────────────────────────────
export function EmptyGroups({ onPrimary, onSecondary }: EmptyProps) {
  const { c, isDark } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 24 }}>
      <FloatingOrb color={isDark ? "#9D7BFF" : "#5B3FD4"} size={96} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Ionicons name="sparkles" size={12} color={isDark ? "#9D7BFF" : "#5B3FD4"} />
        <Text style={{ color: isDark ? "#9D7BFF" : "#5B3FD4", fontSize: 10,
          fontWeight: "700", letterSpacing: 2 }}>MERIZO AI</Text>
      </View>
      <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: "800",
        textAlign: "center", marginBottom: 10, letterSpacing: -0.3 }}>
        No groups yet
      </Text>
      <Text style={{ color: c.textSecondary, fontSize: 14, textAlign: "center",
        lineHeight: 22, marginBottom: 28 }}>
        Create a group for trips, roommates, or dinner — and I'll handle all the math for you.
      </Text>
      <TouchableOpacity onPress={onPrimary}
        style={{ backgroundColor: isDark ? "#9D7BFF" : "#1F1A17", borderRadius: 14,
          paddingVertical: 14, paddingHorizontal: 28,
          flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>Create a Group</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSecondary}
        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="calculator-outline" size={14} color={c.textMuted} />
        <Text style={{ color: c.textMuted, fontSize: 13 }}>or try Quick Split — no group needed</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── No Expenses in a group ───────────────────────────────────────────────────
export function EmptyExpenses({ onPrimary, onSecondary }: EmptyProps) {
  const { c, isDark } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 32 }}>
      <FloatingOrb color={isDark ? "#E8B04E" : "#B8860B"} size={88} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Ionicons name="sparkles" size={12} color={isDark ? "#9D7BFF" : "#5B3FD4"} />
        <Text style={{ color: isDark ? "#9D7BFF" : "#5B3FD4", fontSize: 10,
          fontWeight: "700", letterSpacing: 2 }}>MERIZO AI</Text>
      </View>
      <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: "800",
        textAlign: "center", marginBottom: 10 }}>No expenses yet</Text>
      <Text style={{ color: c.textSecondary, fontSize: 14, textAlign: "center",
        lineHeight: 22, marginBottom: 28 }}>
        Add your first expense or upload a receipt — I'll extract the details and split it automatically.
      </Text>
      <TouchableOpacity onPress={onPrimary}
        style={{ backgroundColor: isDark ? "#E8B04E" : "#1F1A17", borderRadius: 14,
          paddingVertical: 14, paddingHorizontal: 28,
          flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Ionicons name="add" size={18} color={isDark ? "#1F1A17" : "#fff"} />
        <Text style={{ color: isDark ? "#1F1A17" : "#fff", fontSize: 15, fontWeight: "800" }}>
          Add Expense
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSecondary}
        style={{ flexDirection: "row", alignItems: "center", gap: 8,
          paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
          borderWidth: 1, borderColor: c.border }}>
        <Ionicons name="receipt-outline" size={16} color={c.textSecondary} />
        <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: "600" }}>
          Scan a receipt instead
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── All Settled ──────────────────────────────────────────────────────────────
export function EmptySettled() {
  const { c, isDark } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 32 }}>
      <FloatingOrb color={isDark ? "#7ED38B" : "#1A7A40"} size={88} />
      <Text style={{ color: c.positive, fontSize: 22, fontWeight: "800",
        textAlign: "center", marginBottom: 10 }}>
        All settled! 🎉
      </Text>
      <Text style={{ color: c.textSecondary, fontSize: 14, textAlign: "center",
        lineHeight: 22 }}>
        Everyone in this group is square. No pending payments.
      </Text>
    </View>
  );
}

// ─── No Insights ──────────────────────────────────────────────────────────────
export function EmptyInsights({ onPrimary }: EmptyProps) {
  const { c, isDark } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 32 }}>
      <FloatingOrb color={isDark ? "#60A5FA" : "#1D4ED8"} size={88} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Ionicons name="sparkles" size={12} color={isDark ? "#9D7BFF" : "#5B3FD4"} />
        <Text style={{ color: isDark ? "#9D7BFF" : "#5B3FD4", fontSize: 10,
          fontWeight: "700", letterSpacing: 2 }}>MERIZO AI</Text>
      </View>
      <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: "800",
        textAlign: "center", marginBottom: 10 }}>No insights yet</Text>
      <Text style={{ color: c.textSecondary, fontSize: 14, textAlign: "center",
        lineHeight: 22, marginBottom: 28 }}>
        Start adding expenses and I'll show you spending patterns, category breakdowns, and smart suggestions.
      </Text>
      <TouchableOpacity onPress={onPrimary}
        style={{ backgroundColor: isDark ? "#60A5FA" : "#1D4ED8", borderRadius: 14,
          paddingVertical: 14, paddingHorizontal: 28,
          flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>Add your first expense</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── No Search Results ────────────────────────────────────────────────────────
export function EmptySearch({ query }: { query: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 32 }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🔍</Text>
      <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: "700",
        textAlign: "center", marginBottom: 8 }}>
        Nothing found for "{query}"
      </Text>
      <Text style={{ color: c.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 22 }}>
        Try a different search term or check the spelling.
      </Text>
    </View>
  );
}

// ─── Network Error ─────────────────────────────────────────────────────────────
export function EmptyNetworkError({ onRetry }: { onRetry?: () => void }) {
  const { c, isDark } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 32 }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>📡</Text>
      <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: "700",
        textAlign: "center", marginBottom: 8 }}>
        Can't connect right now
      </Text>
      <Text style={{ color: c.textSecondary, fontSize: 14, textAlign: "center",
        lineHeight: 22, marginBottom: 24 }}>
        Check your internet connection and try again.
      </Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry}
          style={{ backgroundColor: isDark ? "#9D7BFF" : "#1F1A17", borderRadius: 14,
            paddingVertical: 12, paddingHorizontal: 24,
            flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="refresh-outline" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}