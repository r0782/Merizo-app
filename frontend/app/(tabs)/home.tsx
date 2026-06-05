import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Platform, StatusBar } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";
import { currencySymbol } from "../../src/lib/tokens";

export default function HomeScreen() {
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
        contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 40, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 13, color: c.textSecondary, marginBottom: 2 }}>{greeting()}</Text>
            <Text style={{ fontSize: 22, fontWeight: "500", color: c.textPrimary, letterSpacing: -0.5 }}>{user?.name?.split(" ")[0] || "Welcome"}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? "#2C2C2E" : "#F0EDE8", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 15, fontWeight: "500", color: isDark ? "#7B6FFF" : "#6D5DFC" }}>{initial}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <View style={{ backgroundColor: "#111111", borderRadius: 24, padding: 22 }}>
            <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Net balance</Text>
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
        </View>

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

        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity onPress={() => router.push("/create-split")} style={{ flex: 1, backgroundColor: isDark ? "#7B6FFF" : "#6D5DFC", borderRadius: 14, padding: 14, alignItems: "center", gap: 6 }}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={{ fontSize: 12, fontWeight: "500", color: "#fff" }}>Add expense</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/(tabs)/chat")} style={{ flex: 1, backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 14, padding: 14, alignItems: "center", gap: 6, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
              <Ionicons name="sparkles" size={20} color={isDark ? "#7B6FFF" : "#6D5DFC"} />
              <Text style={{ fontSize: 12, fontWeight: "500", color: isDark ? "#7B6FFF" : "#6D5DFC" }}>Ask AI</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/(tabs)/chat")} style={{ flex: 1, backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 14, padding: 14, alignItems: "center", gap: 6, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
              <Ionicons name="scan" size={20} color={c.textPrimary} />
              <Text style={{ fontSize: 12, fontWeight: "500", color: c.textPrimary }}>Scan bill</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>Active groups</Text>
            <TouchableOpacity onPress={() => router.push("/create-split")}>
              <Text style={{ fontSize: 12, color: isDark ? "#7B6FFF" : "#6D5DFC" }}>New group</Text>
            </TouchableOpacity>
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
              <TouchableOpacity onPress={() => router.push("/create-split")} style={{ backgroundColor: isDark ? "#7B6FFF" : "#6D5DFC", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: "500", color: "#fff" }}>Create first group</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {trips.map((trip) => {
                const net = trip.my_net || 0;
                const isOwed = net > 0;
                const emoji = trip.category === "food" ? "🍕" : trip.category === "travel" ? "✈️" : trip.category === "home" ? "🏠" : trip.category === "entertainment" ? "🎬" : "📁";
                return (
                  <TouchableOpacity key={trip.id} onPress={() => router.push({ pathname: "/split/[id]", params: { id: trip.id } })} style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isDark ? "#2C2C2E" : "#F0EDE8", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Text style={{ fontSize: 20 }}>{emoji}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary, marginBottom: 3 }} numberOfLines={1}>{trip.name}</Text>
                      <Text style={{ fontSize: 12, color: c.textSecondary }}>{trip.member_count || 0} members · {trip.expense_count || 0} expenses</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      {net === 0 ? (
                        <View style={{ backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F0EDE8", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                          <Text style={{ fontSize: 11, color: c.textSecondary }}>Settled</Text>
                        </View>
                      ) : (
                        <>
                          <Text style={{ fontSize: 15, fontWeight: "500", color: isOwed ? "#00C48C" : "#FF453A" }}>
                            {isOwed ? "+" : "-"}{sym}{Math.abs(Math.round(net)).toLocaleString("en-IN")}
                          </Text>
                          <Text style={{ fontSize: 10, color: c.textSecondary, marginTop: 2 }}>{isOwed ? "owed to you" : "you owe"}</Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
