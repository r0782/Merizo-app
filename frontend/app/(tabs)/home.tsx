import React, { useCallback, useEffect, useMemo, useState } from "react";
import Animated, { useSharedValue, withSpring, withTiming, useAnimatedStyle, interpolate, Extrapolation } from "react-native-reanimated";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { useAuth } from "../../src/lib/auth";
import { api }      from "../../src/lib/api";
import { useQuery }  from "../../src/lib/useQuery";
import { CK, TTL }   from "../../src/lib/cache";
import { SkeletonHome } from "../../src/components/Skeleton";
import { EmptyGroups }  from "../../src/components/EmptyStates";
import { usePressScale } from "../../src/lib/perf";
import { StackedCarousel } from "../../src/components/StackedCarousel";
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
  const [showNewMenu, setShowNewMenu] = useState(false);
  const fabRot  = useSharedValue(0);
  const slide1  = useSharedValue(0);
  const slide2  = useSharedValue(0);

  const openMenu = () => {
    setShowNewMenu(true);
    fabRot.value = withSpring(1, { damping: 14, stiffness: 180 });
    slide1.value = withSpring(1, { damping: 16, stiffness: 200 });
    slide2.value = withSpring(1, { damping: 16, stiffness: 160 });
  };
  const closeMenu = () => {
    fabRot.value  = withTiming(0, { duration: 160 });
    slide1.value  = withTiming(0, { duration: 140 });
    slide2.value  = withTiming(0, { duration: 120 });
    setTimeout(() => setShowNewMenu(false), 180);
  };
  const fabRotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(fabRot.value, [0,1], [0,45], Extrapolation.CLAMP)}deg` }],
  }));
  const s1 = useAnimatedStyle(() => ({
    opacity: slide1.value,
    transform: [{ translateY: interpolate(slide1.value, [0,1], [40,0], Extrapolation.CLAMP) }],
  }));
  const s2 = useAnimatedStyle(() => ({
    opacity: slide2.value,
    transform: [{ translateY: interpolate(slide2.value, [0,1], [60,0], Extrapolation.CLAMP) }],
  }));

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

  const totalOwed = useMemo(() => trips.reduce((s, t) => s + Math.max(0, t.my_net || 0), 0), [trips]);
  const totalOwing = useMemo(() => Math.abs(trips.reduce((s, t) => s + Math.min(0, t.my_net || 0), 0)), [trips]);
  const activeGroups = trips.filter(t => (t.total_spent || 0) > 0).length;

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
              onPress={openMenu}
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
            <SkeletonHome />
          ) : trips.length === 0 ? (
            <EmptyGroups onPrimary={() => router.push("/category")} onSecondary={() => router.push("/simple-split")} />
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
            <MerizoAICard trips={trips} totalOwed={totalOwed} onPress={() => router.push("/(tabs)/insights")} isDark={isDark} c={c} />
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



      {/* ── Menu modal ── */}
      {showNewMenu && (
        <Modal transparent animationType="none" onRequestClose={() => {
          fabRot.value = withTiming(0, { duration: 160 });
          slide1.value = withTiming(0, { duration: 140 });
          slide2.value = withTiming(0, { duration: 120 });
          setTimeout(() => setShowNewMenu(false), 180);
        }}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => {
            fabRot.value = withTiming(0, { duration: 160 });
            slide1.value = withTiming(0, { duration: 140 });
            slide2.value = withTiming(0, { duration: 120 });
            setTimeout(() => setShowNewMenu(false), 180);
          }}>
            <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: 100, paddingHorizontal: 20, gap: 12 }}>

              <Animated.View style={s1}>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, letterSpacing: 3, fontFamily: "RobotoMono_400Regular", textAlign: "center" }}>
                  WHAT DO YOU WANT TO DO?
                </Text>
              </Animated.View>

              {/* Create Group */}
              <Animated.View style={s2}>
                <TouchableOpacity
                  onPress={() => {
                    fabRot.value = withTiming(0,{duration:160});
                    slide1.value = withTiming(0,{duration:140});
                    slide2.value = withTiming(0,{duration:120});
                    setTimeout(() => { setShowNewMenu(false); router.push("/category"); }, 180);
                  }}
                  style={{ flexDirection:"row", alignItems:"center", gap:16, backgroundColor:isDark?"#1B1612":"#F5F1E8", borderRadius:18, padding:18, borderWidth:1.5, borderColor:isDark?"rgba(157,123,255,0.5)":"#1F1A17" }}
                  activeOpacity={0.82}
                >
                  <View style={{ width:52, height:52, borderRadius:26, backgroundColor:isDark?"#9D7BFF":"#1F1A17", alignItems:"center", justifyContent:"center" }}>
                    <Ionicons name="people-outline" size={24} color="#fff" />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={{ color:isDark?"#F4E6D0":"#1F1A17", fontSize:17, fontFamily:"Syne_800ExtraBold", letterSpacing:-0.3 }}>Create a Group</Text>
                    <Text style={{ color:isDark?"#7A6550":"#6B5D4A", fontSize:12, marginTop:3, lineHeight:18 }}>Trips, roommates, friends — shared ledger</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={isDark?"#7A6550":"#9A8970"} />
                </TouchableOpacity>
              </Animated.View>

              {/* OR divider */}
              <Animated.View style={[s1, { flexDirection:"row", alignItems:"center", gap:10 }]}>
                <View style={{ flex:1, height:0.5, backgroundColor:"rgba(255,255,255,0.15)" }} />
                <Text style={{ color:"rgba(255,255,255,0.3)", fontSize:10, fontFamily:"RobotoMono_400Regular" }}>OR</Text>
                <View style={{ flex:1, height:0.5, backgroundColor:"rgba(255,255,255,0.15)" }} />
              </Animated.View>

              {/* Quick Split */}
              <Animated.View style={s1}>
                <TouchableOpacity
                  onPress={() => {
                    fabRot.value = withTiming(0,{duration:160});
                    slide1.value = withTiming(0,{duration:140});
                    slide2.value = withTiming(0,{duration:120});
                    setTimeout(() => { setShowNewMenu(false); router.push("/simple-split"); }, 180);
                  }}
                  style={{ flexDirection:"row", alignItems:"center", gap:16, backgroundColor:isDark?"#1B1612":"#F5F1E8", borderRadius:18, padding:18, borderWidth:1, borderColor:isDark?"rgba(201,170,120,0.25)":"#C4B89A" }}
                  activeOpacity={0.82}
                >
                  <View style={{ width:52, height:52, borderRadius:26, backgroundColor:isDark?"rgba(232,176,78,0.15)":"#EDE7D8", alignItems:"center", justifyContent:"center" }}>
                    <Ionicons name="calculator-outline" size={24} color={isDark?"#E8B04E":"#6B5D4A"} />
                  </View>
                  <View style={{ flex:1 }}>
                    <View style={{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:3 }}>
                      <Text style={{ color:isDark?"#F4E6D0":"#1F1A17", fontSize:17, fontFamily:"Syne_800ExtraBold", letterSpacing:-0.3 }}>Quick Split</Text>
                      <View style={{ paddingHorizontal:7, paddingVertical:2, borderRadius:6, backgroundColor:isDark?"rgba(232,176,78,0.2)":"#FEF3C7" }}>
                        <Text style={{ color:isDark?"#E8B04E":"#92400E", fontSize:9, fontWeight:"700", letterSpacing:1 }}>NO GROUP</Text>
                      </View>
                    </View>
                    <Text style={{ color:isDark?"#7A6550":"#6B5D4A", fontSize:12, lineHeight:18 }}>Split one bill instantly — one-time use</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={isDark?"#7A6550":"#9A8970"} />
                </TouchableOpacity>
              </Animated.View>

            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}


// ── Empty state when no groups ────────────────────────────────────────────────
// ── AI Card (replaces QuickSplitWidget) ───────────────────────────────────────
function MerizoAICard({ trips, totalOwed, onPress, isDark, c }: {
  trips: any[]; totalOwed: number; onPress: () => void; isDark: boolean; c: any;
}) {
  // Count pending payments across all groups
  const pendingCount = trips.reduce((sum: number, t: any) =>
    sum + (t.settlement_transactions || []).length, 0);
  const friendCount  = new Set(
    trips.flatMap((t: any) => (t.settlement_transactions || []).map((tx: any) => tx.to_id))
  ).size;
  const hasData = totalOwed > 0 && friendCount > 0;

  // Avatars of people who owe you
  const PALETTE = ["#45B7D1","#FF6B6B","#96CEB4","#DDA0DD","#F7DC6F"];
  const debtors: string[] = [];
  trips.forEach((t: any) => {
    (t.balances || []).forEach((b: any) => {
      if ((b.net || 0) < -0.5 && !debtors.includes(b.name)) debtors.push(b.name);
    });
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}
      style={{ flex: 1, borderRadius: 16, overflow: "hidden", minHeight: 130,
        backgroundColor: isDark ? "#1A1040" : "#EEF2FF",
        borderWidth: 1, borderColor: isDark ? "rgba(157,123,255,0.3)" : "rgba(91,63,212,0.15)" }}>

      {/* Background orb */}
      <View style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100,
        borderRadius: 50, backgroundColor: isDark ? "rgba(157,123,255,0.15)" : "rgba(91,63,212,0.1)" }} />
      <View style={{ position: "absolute", right: 10, top: 10, width: 60, height: 60,
        borderRadius: 30, backgroundColor: isDark ? "rgba(157,123,255,0.1)" : "rgba(91,63,212,0.07)",
        borderWidth: 1, borderColor: isDark ? "rgba(157,123,255,0.2)" : "rgba(91,63,212,0.12)" }} />

      <View style={{ padding: 14, flex: 1, justifyContent: "space-between" }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="sparkles" size={11} color={isDark ? "#9D7BFF" : "#5B3FD4"} />
          <Text style={{ color: isDark ? "#9D7BFF" : "#5B3FD4", fontSize: 9, fontWeight: "700", letterSpacing: 2 }}>
            MERIZO AI
          </Text>
        </View>

        {/* Content */}
        {hasData ? (
          <View style={{ marginTop: 6 }}>
            <Text style={{ color: isDark ? "#F4E6D0" : "#1C1208", fontSize: 13, fontWeight: "800", lineHeight: 18 }}>
              {"Collect ₹"+Math.round(totalOwed).toLocaleString("en-IN")+" from "+friendCount+" friend"+(friendCount!==1?"s":"")}
            </Text>
            {pendingCount > 0 && (
              <Text style={{ color: isDark ? "rgba(196,168,255,0.7)" : "#5B3FD4", fontSize: 10, marginTop: 4, lineHeight: 14 }}>
                {pendingCount+" pending payment"+(pendingCount!==1?"s":"")}
              </Text>
            )}
          </View>
        ) : (
          <View style={{ marginTop: 6 }}>
            <Text style={{ color: isDark ? "#F4E6D0" : "#1C1208", fontSize: 13, fontWeight: "800", lineHeight: 18 }}>
              {"AI spending insights"}
            </Text>
            <Text style={{ color: isDark ? "rgba(196,168,255,0.7)" : "#5B3FD4", fontSize: 10, marginTop: 4 }}>
              Add expenses to start
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          {/* Mini avatars */}
          <View style={{ flexDirection: "row" }}>
            {debtors.slice(0, 3).map((name, i) => (
              <View key={i} style={{ width: 22, height: 22, borderRadius: 11,
                backgroundColor: PALETTE[i % PALETTE.length],
                alignItems: "center", justifyContent: "center",
                marginLeft: i > 0 ? -6 : 0,
                borderWidth: 1.5, borderColor: isDark ? "#1A1040" : "#EEF2FF" }}>
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{name.charAt(0)}</Text>
              </View>
            ))}
            {debtors.length > 3 && (
              <View style={{ width: 22, height: 22, borderRadius: 11,
                backgroundColor: isDark ? "rgba(157,123,255,0.3)" : "rgba(91,63,212,0.2)",
                alignItems: "center", justifyContent: "center", marginLeft: -6,
                borderWidth: 1.5, borderColor: isDark ? "#1A1040" : "#EEF2FF" }}>
                <Text style={{ color: isDark ? "#9D7BFF" : "#5B3FD4", fontSize: 8, fontWeight: "800" }}>
                  +{debtors.length - 3}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Text style={{ color: isDark ? "#9D7BFF" : "#5B3FD4", fontSize: 10, fontWeight: "700" }}>
              View
            </Text>
            <Ionicons name="arrow-forward" size={10} color={isDark ? "#9D7BFF" : "#5B3FD4"} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
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