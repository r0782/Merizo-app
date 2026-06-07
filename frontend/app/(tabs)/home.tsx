import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated, {
  useSharedValue, withSpring, withTiming, useAnimatedStyle,
  interpolate, Extrapolation, runOnJS, withDelay,
} from "react-native-reanimated";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  Platform, StatusBar, Modal, Pressable, Dimensions, FlatList,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";
import { currencySymbol } from "../../src/lib/tokens";
import { StackedCarousel } from "../../src/components/StackedCarousel";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Balance Dashboard Modal ──────────────────────────────────────────────────
function BalanceDashboard({ visible, onClose, trips, totalOwed, totalOwing, netBalance, sym, c, isDark }: any) {
  const slideY = useSharedValue(SH);

  useEffect(() => {
    if (visible) slideY.value = withSpring(0, { damping: 20, stiffness: 200 });
    else slideY.value = withTiming(SH, { duration: 300 });
  }, [visible]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  const chartData = useMemo(() => {
    const days = 30;
    const base = netBalance;
    return Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      value: base + (Math.random() - 0.6) * 200 * (i / days),
    }));
  }, [netBalance]);

  const minV = Math.min(...chartData.map(d => d.value));
  const maxV = Math.max(...chartData.map(d => d.value));
  const range = maxV - minV || 1;
  const chartW = SW - 80;
  const chartH = 80;
  const points = chartData.map((d, i) => `${(i / (chartData.length - 1)) * chartW},${chartH - ((d.value - minV) / range) * chartH}`).join(" ");

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View style={[{ backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: SH * 0.85, overflow: "hidden" }, slideStyle]}>
          {/* Handle */}
          <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)", borderRadius: 2 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {/* Hero balance */}
            <View style={{ backgroundColor: "#111", borderRadius: 20, padding: 20, marginBottom: 16 }}>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Net balance</Text>
              <Text style={{ fontSize: 42, fontWeight: "500", color: "#fff", letterSpacing: -2, marginBottom: 4 }}>
                {netBalance >= 0 ? "+" : "-"}{sym}{Math.abs(Math.round(netBalance)).toLocaleString("en-IN")}
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12, padding: 12 }}>
                  <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Owed to you</Text>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: "#00C48C" }}>+{sym}{Math.round(totalOwed).toLocaleString("en-IN")}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12, padding: 12 }}>
                  <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>You owe</Text>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: "#FF453A" }}>-{sym}{Math.round(totalOwing).toLocaleString("en-IN")}</Text>
                </View>
              </View>
            </View>

            {/* AI Insight */}
            <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#6D5DFC" }} />
                <Text style={{ fontSize: 10, color: "#6D5DFC", fontWeight: "500", letterSpacing: 0.5 }}>MERIZO AI INSIGHT</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary, lineHeight: 21, marginBottom: 8 }}>
                {trips.length > 0
                  ? `${trips[0]?.name} accounts for ${trips.length > 0 ? Math.round(Math.abs(trips[0]?.my_net || 0) / Math.max(totalOwing, 1) * 100) : 0}% of your total debt. Settling with ${trips[0]?.member_count || 0} members will significantly clear this up.`
                  : "You're all settled up! Great financial discipline this month."}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ backgroundColor: isDark ? "#2C2C2E" : "#F0EDE8", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 11, color: c.textSecondary }}>{trips.length} groups active</Text>
                </View>
                <View style={{ backgroundColor: "#EDE9FE", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 11, color: "#6D5DFC" }}>Settle now →</Text>
                </View>
              </View>
            </View>

            {/* Balance chart */}
            <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: c.textPrimary, marginBottom: 4 }}>30-day trajectory</Text>
              <Text style={{ fontSize: 11, color: c.textSecondary, marginBottom: 12 }}>Balance movement over the last month</Text>
              <View style={{ height: chartH + 20, paddingHorizontal: 4 }}>
                <svg width={chartW} height={chartH} style={{ overflow: "visible" } as any}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6D5DFC" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#6D5DFC" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polyline points={points} fill="none" stroke="#6D5DFC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points={`0,${chartH} ${points} ${chartW},${chartH}`} fill="url(#grad)" stroke="none" />
                </svg>
              </View>
            </View>

            {/* Group breakdown */}
            <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Group breakdown</Text>
            <View style={{ gap: 10, marginBottom: 16 }}>
              {trips.map((trip: any) => {
                const net = trip.my_net || 0;
                const isOwed = net > 0;
                const settled = Math.floor((trip.member_count || 1) * 0.4);
                const total = trip.member_count || 1;
                const pct = settled / total;
                const emoji = trip.category === "food" ? "🍕" : trip.category === "travel" ? "✈️" : trip.category === "home" ? "🏠" : "📁";
                return (
                  <View key={trip.id} style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <Text style={{ fontSize: 18 }}>{emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "500", color: c.textPrimary }}>{trip.name}</Text>
                        <Text style={{ fontSize: 11, color: c.textSecondary }}>{settled}/{total} members settled</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "500", color: isOwed ? "#00C48C" : "#FF453A" }}>
                        {isOwed ? "+" : "-"}{sym}{Math.abs(Math.round(net)).toLocaleString("en-IN")}
                      </Text>
                    </View>
                    {/* Progress bar */}
                    <View style={{ height: 4, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#F0EDE8", borderRadius: 2, marginBottom: 10 }}>
                      <View style={{ width: `${Math.round(pct * 100)}%`, height: 4, backgroundColor: "#6D5DFC", borderRadius: 2 }} />
                    </View>
                    <TouchableOpacity style={{ backgroundColor: "#6D5DFC", borderRadius: 10, paddingVertical: 8, alignItems: "center" }} onPress={onClose}>
                      <Text style={{ fontSize: 12, fontWeight: "500", color: "#fff" }}>Settle instantly ✓</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── FAB ──────────────────────────────────────────────────────────────────────
function FAB({ router, isDark, c }: any) {
  const [open, setOpen] = useState(false);
  const rot = useSharedValue(0);
  const y1  = useSharedValue(0);
  const y2  = useSharedValue(0);
  const op  = useSharedValue(0);

  const openMenu = () => {
    setOpen(true);
    rot.value = withTiming(1, { duration: 250 });
    op.value  = withTiming(1, { duration: 200 });
    y1.value  = withSpring(-56,  { damping: 18, stiffness: 260 });
    y2.value  = withSpring(-112, { damping: 18, stiffness: 240 });
  };

  const closeMenu = (cb?: () => void) => {
    rot.value = withTiming(0, { duration: 200 });
    op.value  = withTiming(0, { duration: 150 });
    y1.value  = withTiming(0, { duration: 180 });
    y2.value  = withTiming(0, { duration: 180 });
    setTimeout(() => { setOpen(false); cb && cb(); }, 200);
  };

  const rotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rot.value, [0,1], [0,45])}deg` }]
  }));
  const item1Style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: y1.value }],
    pointerEvents: open ? "auto" : "none",
  }));
  const item2Style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: y2.value }],
    pointerEvents: open ? "auto" : "none",
  }));

  return (
    <View style={{ position: "absolute", bottom: 28, right: 20, alignItems: "flex-end" }}>
      {/* Backdrop */}
      {open && <Pressable onPress={() => closeMenu()} style={{ position: "absolute", top: -2000, left: -2000, right: -20, bottom: -28, zIndex: 0 }} />}

      {/* Item 1 — Quick split */}
      <Animated.View style={[{ position: "absolute", bottom: 0, right: 0, zIndex: 2 }, item1Style]}>
        <TouchableOpacity
          onPress={() => closeMenu(() => router.push("/simple-split"))}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
        >
          <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="flash" size={15} color="#6D5DFC" />
          </View>
          <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary }}>Quick split</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Item 2 — Create group */}
      <Animated.View style={[{ position: "absolute", bottom: 0, right: 0, zIndex: 2 }, item2Style]}>
        <TouchableOpacity
          onPress={() => closeMenu(() => router.push("/category"))}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
        >
          <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="people" size={15} color="#6D5DFC" />
          </View>
          <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary }}>Create group</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Main FAB button */}
      <TouchableOpacity
        onPress={() => open ? closeMenu() : openMenu()}
        style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: isDark ? "#7B6FFF" : "#6D5DFC", alignItems: "center", justifyContent: "center", shadowColor: "#6D5DFC", shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8, zIndex: 3 }}
      >
        <Animated.View style={rotStyle}>
          <Ionicons name="add" size={24} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get("/trips"); setTrips(r.data || []); } catch {}
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const totalOwed  = useMemo(() => trips.reduce((s, t) => s + Math.max(0, t.my_net || 0), 0), [trips]);
  const totalOwing = useMemo(() => Math.abs(trips.reduce((s, t) => s + Math.min(0, t.my_net || 0), 0)), [trips]);
  const netBalance = totalOwed - totalOwing;
  const sym = currencySymbol(trips[0]?.currency || "INR");
  const initial = (user?.name || "U").trim().charAt(0).toUpperCase();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView
        contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 40, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 13, color: c.textSecondary, marginBottom: 2 }}>{greeting()}</Text>
            <Text style={{ fontSize: 22, fontWeight: "500", color: c.textPrimary, letterSpacing: -0.5 }}>{user?.name?.split(" ")[0] || "Welcome"}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? "#2C2C2E" : "#F0EDE8", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 15, fontWeight: "500", color: isDark ? "#7B6FFF" : "#6D5DFC" }}>{initial}</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Balance Card — tap to expand */}
        <TouchableOpacity onPress={() => setShowDashboard(true)} activeOpacity={0.92} style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <View style={{ backgroundColor: "#111111", borderRadius: 24, padding: 22 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase" }}>Net balance</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Tap for details</Text>
                <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.3)" />
              </View>
            </View>
            <Text style={{ fontSize: 38, fontWeight: "500", color: "#FFFFFF", letterSpacing: -1.5, marginBottom: 4 }}>
              {netBalance >= 0 ? "+" : "-"}{sym}{Math.abs(Math.round(netBalance)).toLocaleString("en-IN")}
            </Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 18 }}>
              {netBalance >= 0 ? "Others owe you this amount" : "You owe this amount total"}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, padding: 14 }}>
                <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Owed to you</Text>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#00C48C" }}>+{sym}{Math.round(totalOwed).toLocaleString("en-IN")}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, padding: 14 }}>
                <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>You owe</Text>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#FF453A" }}>-{sym}{Math.round(totalOwing).toLocaleString("en-IN")}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* AI Insight Card */}
        <TouchableOpacity onPress={() => router.push("/(tabs)/chat")} style={{ marginHorizontal: 20, marginBottom: 24, backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#6D5DFC" }} />
            <Text style={{ fontSize: 10, color: "#6D5DFC", fontWeight: "500", letterSpacing: 0.5 }}>AI INSIGHT</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary, lineHeight: 20, marginBottom: 4 }}>
            {trips.length > 0 ? `You have ${trips.length} active group${trips.length > 1 ? "s" : ""}. Ask AI anything about your expenses.` : "Ask AI to create your first group or split an expense."}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: "#6D5DFC" }}>Chat with Merizo AI</Text>
            <Ionicons name="arrow-forward" size={12} color="#6D5DFC" />
          </View>
        </TouchableOpacity>

        {/* Groups */}
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>Active groups</Text>
          </View>
          {loading ? (
            <View style={{ gap: 10 }}>
              {[1,2,3].map(i => <View key={i} style={{ height: 70, backgroundColor: isDark ? "#1C1C1E" : "#F0EDE8", borderRadius: 16 }} />)}
            </View>
          ) : trips.length === 0 ? (
            <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 18, padding: 28, alignItems: "center", borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
              <Text style={{ fontSize: 28, marginBottom: 10 }}>👋</Text>
              <Text style={{ fontSize: 15, fontWeight: "500", color: c.textPrimary, marginBottom: 6 }}>No groups yet</Text>
              <Text style={{ fontSize: 13, color: c.textSecondary, textAlign: "center", marginBottom: 16, lineHeight: 20 }}>Create your first group or ask AI to help split an expense</Text>
              <TouchableOpacity onPress={() => router.push("/category")} style={{ backgroundColor: isDark ? "#7B6FFF" : "#6D5DFC", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: "500", color: "#fff" }}>Create first group</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <StackedCarousel
              trips={trips}
              onPressCard={(trip) => router.push({ pathname: "/split/[id]", params: { id: trip.id } })}
            />
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <FAB router={router} isDark={isDark} c={c} />

      {/* Balance Dashboard Modal */}
      <BalanceDashboard
        visible={showDashboard}
        onClose={() => setShowDashboard(false)}
        trips={trips}
        totalOwed={totalOwed}
        totalOwing={totalOwing}
        netBalance={netBalance}
        sym={sym}
        c={c}
        isDark={isDark}
      />
    </View>
  );
}
