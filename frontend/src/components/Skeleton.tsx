/**
 * Skeleton.tsx — Enterprise Skeleton Loading System
 * Merizo · Staff Frontend Engineer Grade
 *
 * Rules:
 * - Zero layout shift (matches final layout exactly)
 * - GPU-accelerated shimmer (opacity + transform only)
 * - Smooth fade-out transition when content arrives
 * - Never show ActivityIndicator or "Loading..."
 */
import React, { useEffect, useRef } from "react";
import { View, Animated, Easing, StyleSheet, Dimensions } from "react-native";
import { useTheme } from "../lib/theme";

const { width: SW } = Dimensions.get("window");

// ─── Base shimmer atom ────────────────────────────────────────────────────────
export function SkeletonBox({
  w, h, r = 8, style, children,
}: {
  w?: number | string; h: number; r?: number;
  style?: any; children?: React.ReactNode;
}) {
  const { isDark } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1, duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0, duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
    return () => anim.stopAnimation();
  }, []);

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: isDark ? [0.08, 0.18] : [0.06, 0.14],
  });

  return (
    <Animated.View style={[
      { width: w as any, height: h, borderRadius: r,
        backgroundColor: isDark ? "#fff" : "#000", opacity },
      style,
    ]}>
      {children}
    </Animated.View>
  );
}

// ─── Fade-in wrapper (content replaces skeleton) ──────────────────────────────
export function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 280, delay,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);
  return <Animated.View style={{ opacity: anim }}>{children}</Animated.View>;
}

// ─── SKELETON COMPONENTS ─────────────────────────────────────────────────────

/** Home screen — balance + action buttons + AI card + groups */
export function SkeletonHome() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: 20 }}>
      {/* Header */}
      <View style={s.row}>
        <SkeletonBox w={42} h={42} r={21} />
        <View style={{ flex: 1 }} />
        <SkeletonBox w={36} h={36} r={18} />
        <View style={{ width: 8 }} />
        <SkeletonBox w={36} h={36} r={18} />
      </View>

      {/* Balance */}
      <View style={{ marginTop: 24, marginBottom: 28 }}>
        <SkeletonBox w={80} h={10} r={5} style={{ marginBottom: 10 }} />
        <SkeletonBox w={160} h={38} r={8} style={{ marginBottom: 6 }} />
        <SkeletonBox w={100} h={10} r={5} />
      </View>

      {/* Action buttons row */}
      <View style={[s.row, { gap: 10, marginBottom: 20 }]}>
        {[1,2,3,4].map(i => (
          <View key={i} style={{ flex: 1, alignItems: "center", gap: 8 }}>
            <SkeletonBox w={56} h={56} r={16} />
            <SkeletonBox w={44} h={9} r={5} />
          </View>
        ))}
      </View>

      {/* AI card + insights row */}
      <View style={[s.row, { gap: 10, marginBottom: 20 }]}>
        <SkeletonBox w="60%" h={110} r={16} />
        <View style={{ flex: 1, gap: 10 }}>
          <SkeletonBox w="100%" h={50} r={12} />
          <SkeletonBox w="100%" h={50} r={12} />
        </View>
      </View>

      {/* Groups list */}
      <SkeletonBox w={100} h={10} r={5} style={{ marginBottom: 14 }} />
      {[1,2,3].map(i => <SkeletonGroupRow key={i} />)}
    </View>
  );
}

/** Single group row */
export function SkeletonGroupRow() {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <SkeletonBox w={44} h={44} r={12} />
      <View style={{ flex: 1, gap: 7 }}>
        <SkeletonBox w="55%" h={13} r={6} />
        <SkeletonBox w="35%" h={10} r={5} />
      </View>
      <View style={{ alignItems: "flex-end", gap: 7 }}>
        <SkeletonBox w={60} h={13} r={6} />
        <SkeletonBox w={40} h={10} r={5} />
      </View>
    </View>
  );
}

/** Group detail hero + tabs */
export function SkeletonGroupDetail() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Hero image */}
      <SkeletonBox w="100%" h={220} r={0}>
        {/* Overlay content */}
        <View style={{ position: "absolute", bottom: 20, left: 20, gap: 10 }}>
          <SkeletonBox w={200} h={28} r={6} />
          <SkeletonBox w={140} h={12} r={5} />
        </View>
      </SkeletonBox>

      {/* Tab bar */}
      <View style={[s.row, { gap: 0, borderBottomWidth: 1, borderBottomColor: c.border }]}>
        {[1,2,3,4].map(i => (
          <View key={i} style={{ flex: 1, alignItems: "center", padding: 14 }}>
            <SkeletonBox w={24} h={24} r={6} style={{ marginBottom: 6 }} />
            <SkeletonBox w={44} h={8} r={4} />
          </View>
        ))}
      </View>

      {/* Expense cards */}
      <View style={{ padding: 16, gap: 12 }}>
        <SkeletonBox w={100} h={10} r={5} style={{ marginBottom: 4 }} />
        {[1,2,3].map(i => <SkeletonExpenseCard key={i} />)}
      </View>
    </View>
  );
}

/** Single expense card */
export function SkeletonExpenseCard() {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, padding: 14 }}>
      <View style={[s.row, { marginBottom: 12 }]}>
        <SkeletonBox w={36} h={36} r={10} />
        <View style={{ flex: 1, marginLeft: 10, gap: 7 }}>
          <SkeletonBox w="50%" h={13} r={6} />
          <SkeletonBox w="30%" h={10} r={5} />
        </View>
        <SkeletonBox w={64} h={18} r={6} />
      </View>
      <SkeletonBox w="35%" h={8} r={4} style={{ marginBottom: 8 }} />
      <View style={[s.row, { gap: 6 }]}>
        {[1,2,3].map(i => <SkeletonBox key={i} w={72} h={24} r={20} />)}
      </View>
    </View>
  );
}

/** Settle tab skeleton */
export function SkeletonSettleTab() {
  const { c } = useTheme();
  return (
    <View style={{ padding: 16, gap: 12 }}>
      {/* Header card */}
      <SkeletonBox w="100%" h={90} r={14} style={{ marginBottom: 4 }} />
      {/* View as pills */}
      <View style={[s.row, { gap: 8 }]}>
        {[1,2,3,4].map(i => <SkeletonBox key={i} w={72} h={34} r={20} />)}
      </View>
      {/* Sub-tabs */}
      <SkeletonBox w="100%" h={44} r={12} />
      {/* Transaction cards */}
      {[1,2].map(i => (
        <View key={i} style={{ backgroundColor: c.surface, borderRadius: 14,
          borderWidth: 1, borderColor: c.border, padding: 14 }}>
          <View style={[s.row, { gap: 12 }]}>
            <SkeletonBox w={40} h={40} r={20} />
            <View style={{ flex: 1, gap: 8 }}>
              <SkeletonBox w="45%" h={14} r={6} />
              <SkeletonBox w="25%" h={10} r={5} />
            </View>
            <SkeletonBox w={80} h={24} r={8} />
            <SkeletonBox w={34} h={34} r={17} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Profile screen */
export function SkeletonProfile() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: 20 }}>
      {/* Avatar */}
      <View style={{ alignItems: "center", marginBottom: 24, gap: 10 }}>
        <SkeletonBox w={80} h={80} r={40} />
        <SkeletonBox w={120} h={16} r={8} />
        <SkeletonBox w={160} h={12} r={6} />
      </View>
      {/* Stats row */}
      <View style={[s.row, { gap: 10, marginBottom: 20 }]}>
        {[1,2,3].map(i => (
          <View key={i} style={{ flex: 1, backgroundColor: c.surface, borderRadius: 12,
            borderWidth: 1, borderColor: c.border, padding: 14, gap: 8 }}>
            <SkeletonBox w="60%" h={10} r={5} />
            <SkeletonBox w="80%" h={22} r={6} />
          </View>
        ))}
      </View>
      {/* Settings rows */}
      {[1,2,3,4].map(i => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center",
          paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border, gap: 12 }}>
          <SkeletonBox w={36} h={36} r={10} />
          <View style={{ flex: 1, gap: 7 }}>
            <SkeletonBox w="50%" h={13} r={6} />
            <SkeletonBox w="70%" h={10} r={5} />
          </View>
          <SkeletonBox w={44} h={26} r={13} />
        </View>
      ))}
    </View>
  );
}

/** Insights screen */
export function SkeletonInsights() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: 20 }}>
      <SkeletonBox w={120} h={14} r={7} style={{ marginBottom: 20 }} />
      {/* Chart area */}
      <SkeletonBox w="100%" h={200} r={16} style={{ marginBottom: 20 }} />
      {/* Category list */}
      {[1,2,3,4].map(i => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center",
          paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <SkeletonBox w={36} h={36} r={18} />
          <View style={{ flex: 1, gap: 7 }}>
            <SkeletonBox w="40%" h={12} r={6} />
            <SkeletonBox w={`${30 + i * 15}%` as any} h={6} r={3} />
          </View>
          <SkeletonBox w={60} h={12} r={6} />
        </View>
      ))}
    </View>
  );
}

/** Smart Split / AI chat */
export function SkeletonAIChat() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: 20 }}>
      {/* Header */}
      <View style={[s.row, { marginBottom: 32, gap: 12 }]}>
        <SkeletonBox w={34} h={34} r={17} />
        <View style={{ flex: 1, alignItems: "center", gap: 7 }}>
          <SkeletonBox w={100} h={14} r={7} />
          <SkeletonBox w={130} h={10} r={5} />
        </View>
        <View style={{ width: 34 }} />
      </View>
      {/* AI message */}
      <View style={{ marginBottom: 20 }}>
        <View style={[s.row, { gap: 8, marginBottom: 8 }]}>
          <SkeletonBox w={22} h={22} r={8} />
          <SkeletonBox w={80} h={9} r={5} />
        </View>
        <SkeletonBox w="80%" h={72} r={16} />
      </View>
      {/* Suggestion chips */}
      <View style={{ gap: 8 }}>
        {[1,2,3].map(i => <SkeletonBox key={i} w="100%" h={44} r={12} />)}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});