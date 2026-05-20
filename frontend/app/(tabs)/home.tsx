import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";
import { StackedCarousel } from "../../src/components/StackedCarousel";
import { SmartLimitWidget } from "../../src/components/SmartLimit";
import { SmartNum } from "../../src/components/DotNum";
import { currencySymbol } from "../../src/lib/tokens";

export default function HomeScreen() {
  const { c, isDark, toggle } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<any[]>([]);
  const [smartLimit, setSmartLimit] = useState<any>({ percent: 74, has_history: false });
  const [reminderCount, setReminderCount] = useState(0);
  const [insightCount, setInsightCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const load = useCallback(async () => {
    try {
      const [tripsRes, smartRes, remRes, insRes] = await Promise.all([
        api.get("/trips"),
        api.get("/smart-limit").catch(() => ({ data: { percent: 0, has_history: false } })),
        api.get("/reminders").catch(() => ({ data: [] })),
        api.get("/insights", { params: { period: "week" } }).catch(() => ({ data: { by_category: [] } })),
      ]);
      setTrips(tripsRes.data || []);
      setSmartLimit(smartRes.data || { percent: 0 });
      setReminderCount((remRes.data || []).length);
      setInsightCount((insRes.data?.by_category || []).length);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const totalOwed = useMemo(() => {
    return trips.reduce((sum, t) => sum + Math.max(0, t.my_net || 0), 0);
  }, [trips]);

  const initial = (user?.name || "M").trim().charAt(0).toUpperCase();
  const accentBtn = isDark ? c.indigo : "#0A0A0A";

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 60, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            testID="home-avatar"
            onPress={() => router.push("/(tabs)/profile")}
            style={[styles.avatar, { backgroundColor: isDark ? c.indigo : "#0A0A0A" }]}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>{initial}</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity
              testID="home-theme-toggle"
              onPress={toggle}
              style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color={c.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="home-add-btn"
              onPress={() => router.push("/category")}
              style={[styles.iconBtn, { backgroundColor: accentBtn }]}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Header text */}
        <View style={{ paddingHorizontal: 24, marginTop: 18 }}>
          <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: "500" }}>
            Hi, {user?.name?.split(" ")[0] || "there"}
          </Text>
          <Text
            testID="home-heading"
            style={{
              color: c.textPrimary,
              fontSize: 32,
              fontFamily: "Syne_700Bold",
              letterSpacing: -1,
              marginTop: 2,
            }}
          >
            Your groups
          </Text>
        </View>

        {/* Balance summary */}
        <View style={{ paddingHorizontal: 24, marginTop: 22 }}>
          <Text style={[styles.smallCaps, { color: c.textSecondary }]}>YOU ARE OWED</Text>
          <View style={{ marginTop: 6 }}>
            <SmartNum
              testID="home-balance"
              value={`${currencySymbol("INR")}${Math.round(totalOwed).toLocaleString("en-IN")}`}
              size="xxl"
              color={isDark ? "indigo" : "black"}
            />
          </View>
        </View>

        {/* Carousel */}
        <View testID="home-carousel" style={{ marginTop: 26, alignItems: "center" }}>
          {loading ? (
            <ActivityIndicator color={c.indigo} />
          ) : (
            <>
              <StackedCarousel
                trips={trips}
                onIndexChange={setActiveIndex}
                onPressCard={(t) => router.push({ pathname: "/split/[id]", params: { id: t.id } })}
              />
              {trips.length > 1 && (
                <View style={styles.dots}>
                  {trips.map((_, i) => (
                    <View
                      key={i}
                      testID={`home-dot-${i}`}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: i === activeIndex ? (isDark ? c.indigo : "#0A0A0A") : c.textMuted,
                          width: i === activeIndex ? 18 : 6,
                        },
                      ]}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* Quick actions */}
        <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
          <View style={styles.quickRow}>
            <QuickAction
              icon="cash-outline"
              label="Add Expense"
              testID="quick-add-expense"
              onPress={() => {
                if (trips[activeIndex]) {
                  router.push({
                    pathname: "/split/[id]",
                    params: { id: trips[activeIndex].id, action: "add" },
                  });
                } else {
                  router.push("/category");
                }
              }}
            />
            <QuickAction
              icon="checkmark-done-outline"
              label="Settle Up"
              testID="quick-settle"
              onPress={() => {
                if (trips[activeIndex]) {
                  router.push({
                    pathname: "/split/[id]",
                    params: { id: trips[activeIndex].id, tab: "settle" },
                  });
                }
              }}
            />
            <QuickAction
              icon="scan-outline"
              label="Scan Bill"
              testID="quick-scan"
              onPress={() => {
                const tripId = trips[activeIndex]?.id;
                router.push({ pathname: "/scan", params: tripId ? { trip_id: tripId } : {} });
              }}
            />
            <QuickAction
              icon="share-social-outline"
              label="Invite"
              testID="quick-invite"
              onPress={() => {
                if (trips[activeIndex]) {
                  router.push({
                    pathname: "/split/[id]",
                    params: { id: trips[activeIndex].id, tab: "members" },
                  });
                }
              }}
            />
          </View>
        </View>

        {/* Widget row */}
        <View style={{ paddingHorizontal: 24, marginTop: 22 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <SmartLimitWidget
              testID="smart-limit"
              percent={smartLimit.percent ?? 0}
              spent={smartLimit.current_week_spent}
              budget={smartLimit.weekly_budget}
              currency={smartLimit.currency || "INR"}
              hasHistory={!!smartLimit.has_history}
            />
            <View style={{ flex: 1, gap: 12 }}>
              <MiniWidget
                testID="widget-insights"
                label="Insights"
                value={insightCount > 0 ? `${insightCount} new` : "Tap to view"}
                icon="bar-chart-outline"
                onPress={() => router.push("/(tabs)/insights")}
                accent={isDark ? c.indigo : "#0A0A0A"}
              />
              <MiniWidget
                testID="widget-reminders"
                label="Reminders"
                value={reminderCount > 0 ? `${reminderCount} active` : "Tap to add"}
                icon="notifications-outline"
                onPress={() => router.push("/reminders")}
                accent={isDark ? "#F5C842" : "#0A0A0A"}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function QuickAction({ icon, label, onPress, testID }: { icon: any; label: string; onPress: () => void; testID?: string }) {
  const { c, isDark } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.quickItem, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={[styles.quickIcon, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#F5F5F5" }]}>
        <Ionicons name={icon} size={20} color={c.textPrimary} />
      </View>
      <Text style={{ color: c.textPrimary, fontSize: 11, fontWeight: "600", marginTop: 8, textAlign: "center" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MiniWidget({
  label,
  value,
  icon,
  onPress,
  accent,
  testID,
}: {
  label: string;
  value: string;
  icon: any;
  onPress: () => void;
  accent: string;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.miniWidget, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 }}>
          {label}
        </Text>
        <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700", marginTop: 2 }}>
          {value}
        </Text>
      </View>
      <Ionicons name={icon} size={20} color={accent} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  smallCaps: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 8,
  },
  dot: {
    height: 6,
    borderRadius: 999,
  },
  quickRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickItem: {
    flex: 1,
    aspectRatio: 0.92,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  miniWidget: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 68,
  },
});
