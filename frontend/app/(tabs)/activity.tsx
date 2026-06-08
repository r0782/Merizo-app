import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Platform } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import { currencySymbol, categoryMeta } from "../../src/lib/tokens";

export default function ActivityScreen() {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const sym = currencySymbol("INR");

  const load = useCallback(async () => {
    try {
      const trips = await api.get("/trips");
      const allExpenses: any[] = [];
      const allSettlements: any[] = [];
      for (const trip of (trips.data || []).slice(0, 5)) {
        try {
          const exps = await api.get(`/expenses/${trip.id}`);
          (exps.data || []).forEach((e: any) => allExpenses.push({ ...e, tripName: trip.name, tripId: trip.id }));
          const setts = await api.get(`/settlements/${trip.id}`);
          (setts.data || []).forEach((s: any) => allSettlements.push({ ...s, tripName: trip.name }));
        } catch {}
      }
      allExpenses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      allSettlements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setExpenses(allExpenses);
      setSettlements(allSettlements);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) return "Today";
    if (diff < 172800000) return "Yesterday";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  // Merge and sort all activity
  const allActivity = [
    ...expenses.map(e => ({ ...e, type: "expense" })),
    ...settlements.map(s => ({ ...s, type: "settlement" })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 40, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 28, fontWeight: "500", color: c.textPrimary, letterSpacing: -0.5 }}>Activity</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? "#1C1C1E" : "#F0EDE8", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="options" size={17} color={c.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? "#1C1C1E" : "#F0EDE8", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="search" size={17} color={c.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary cards */}
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={{ flex: 1, backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: c.border }}>
            <Text style={{ fontSize: 10, color: c.textSecondary, marginBottom: 4 }}>Total</Text>
            <Text style={{ fontSize: 16, fontWeight: "500", color: c.textPrimary }}>{allActivity.length} activities</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: c.border }}>
            <Text style={{ fontSize: 10, color: c.textSecondary, marginBottom: 4 }}>Expenses</Text>
            <Text style={{ fontSize: 16, fontWeight: "500", color: c.textPrimary }}>{expenses.length}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: c.border }}>
            <Text style={{ fontSize: 10, color: c.textSecondary, marginBottom: 4 }}>Settled</Text>
            <Text style={{ fontSize: 16, fontWeight: "500", color: "#00C48C" }}>{settlements.length}</Text>
          </View>
        </View>

        {/* Activity list */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
            Recent activity
          </Text>

          {loading ? (
            <View style={{ gap: 10 }}>
              {[1,2,3,4].map(i => <View key={i} style={{ height: 68, backgroundColor: isDark ? "#1C1C1E" : "#F0EDE8", borderRadius: 16 }} />)}
            </View>
          ) : allActivity.length === 0 ? (
            <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 18, padding: 32, alignItems: "center", borderWidth: 0.5, borderColor: c.border }}>
              <Text style={{ fontSize: 28, marginBottom: 10 }}>📋</Text>
              <Text style={{ fontSize: 15, fontWeight: "500", color: c.textPrimary, marginBottom: 6 }}>No activity yet</Text>
              <Text style={{ fontSize: 13, color: c.textSecondary, textAlign: "center" }}>Add expenses or settle payments to see your activity here.</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {allActivity.map((item, i) => {
                if (item.type === "expense") {
                  const meta = categoryMeta[item.category || "other"] || categoryMeta.other;
                  return (
                    <TouchableOpacity key={item.id || i}
                      onPress={() => item.tripId && router.push({ pathname: "/split/[id]", params: { id: item.tripId } })}
                      style={{ backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 0.5, borderColor: c.border }}
                    >
                      <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: meta.tint + "22", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary, marginBottom: 2 }}>{item.name || "Expense"}</Text>
                        <Text style={{ fontSize: 12, color: c.textSecondary }}>{item.tripName} · {formatDate(item.created_at)}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 15, fontWeight: "500", color: "#00C48C" }}>+{sym}{Math.round(item.amount || 0).toLocaleString("en-IN")}</Text>
                        <Text style={{ fontSize: 10, color: c.textMuted, marginTop: 1 }}>expense</Text>
                      </View>
                    </TouchableOpacity>
                  );
                } else {
                  return (
                    <View key={item.id || i} style={{ backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 0.5, borderColor: c.border }}>
                      <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(0,196,140,0.1)", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Ionicons name="checkmark-circle" size={22} color="#00C48C" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary, marginBottom: 2 }}>Settlement</Text>
                        <Text style={{ fontSize: 12, color: c.textSecondary }}>{item.tripName} · {formatDate(item.created_at)}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 15, fontWeight: "500", color: "#FF453A" }}>{sym}{Math.round(item.amount || 0).toLocaleString("en-IN")}</Text>
                        <Text style={{ fontSize: 10, color: c.textMuted, marginTop: 1 }}>settled</Text>
                      </View>
                    </View>
                  );
                }
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
