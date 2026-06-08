import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import { categoryMeta, currencySymbol } from "../../src/lib/tokens";
import { ProGate, ProBadge } from "../../src/components/ProGate";

type Period = "1M" | "3M" | "6M" | "1Y";

export default function InsightsScreen() {
  const { c, isDark } = useTheme();
  const [period, setPeriod] = useState<Period>("1M");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPro, setShowPro] = useState(false);
  const [proFeature, setProFeature] = useState("AI Insights");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/insights", { params: { period: "month" } });
      setData(r.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sym = currencySymbol("INR");
  const total = data?.total || 0;
  const cats: any[] = data?.by_category || [];
  const owed = data?.owed_to_you || 0;
  const owing = data?.you_owe || 0;

  const periods: Period[] = ["1M", "3M", "6M", "1Y"];

  const openPro = (feature: string) => { setProFeature(feature); setShowPro(true); };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 40, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 28, fontWeight: "500", color: c.textPrimary, letterSpacing: -0.5 }}>Insights</Text>
          <TouchableOpacity onPress={() => openPro("Full analytics")} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(109,93,252,0.1)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: "rgba(109,93,252,0.2)" }}>
            <Ionicons name="sparkles" size={13} color="#6D5DFC" />
            <Text style={{ fontSize: 12, color: "#6D5DFC", fontWeight: "500" }}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>

        {/* Balance cards */}
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flex: 1, backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
            <Text style={{ fontSize: 11, color: c.textSecondary, marginBottom: 6, letterSpacing: 0.3 }}>You are owed</Text>
            <Text style={{ fontSize: 20, fontWeight: "500", color: "#00C48C", letterSpacing: -0.5 }}>{sym}{Math.round(owed).toLocaleString("en-IN")}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
            <Text style={{ fontSize: 11, color: c.textSecondary, marginBottom: 6, letterSpacing: 0.3 }}>You owe</Text>
            <Text style={{ fontSize: 20, fontWeight: "500", color: owing > 0 ? "#FF453A" : c.textPrimary, letterSpacing: -0.5 }}>{sym}{Math.round(owing).toLocaleString("en-IN")}</Text>
          </View>
        </View>

        {/* Total spending hero */}
        <View style={{ marginHorizontal: 20, backgroundColor: "#111", borderRadius: 20, padding: 20, marginBottom: 20 }}>
          <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Total spending</Text>
          <Text style={{ fontSize: 36, fontWeight: "500", color: "#fff", letterSpacing: -1, marginBottom: 4 }}>{sym}{Math.round(total).toLocaleString("en-IN")}</Text>
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>This month across all groups</Text>
        </View>

        {/* Period selector */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", backgroundColor: isDark ? "#1C1C1E" : "#F0EDE8", borderRadius: 14, padding: 3, gap: 2 }}>
            {periods.map(p => (
              <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={{ flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 11, backgroundColor: p === period ? (isDark ? "#2C2C2E" : "#fff") : "transparent" }}>
                <Text style={{ fontSize: 12, fontWeight: p === period ? "500" : "400", color: p === period ? (isDark ? "#7B6FFF" : "#6D5DFC") : c.textSecondary }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Spending by category */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Spending by category</Text>
          {loading ? (
            <ActivityIndicator color="#6D5DFC" />
          ) : cats.length === 0 ? (
            <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
              <Text style={{ fontSize: 24, marginBottom: 8 }}>📊</Text>
              <Text style={{ fontSize: 14, color: c.textSecondary, textAlign: "center" }}>No expenses yet. Add expenses to see spending breakdown.</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {cats.map((cc: any) => {
                const meta = categoryMeta[cc.category] || categoryMeta.other;
                return (
                  <View key={cc.category} style={{ backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: meta.tint + "22", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary, marginBottom: 4 }}>{meta.label}</Text>
                      <View style={{ height: 4, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#F0EDE8", borderRadius: 2, overflow: "hidden" }}>
                        <View style={{ width: `${cc.percent}%` as any, height: 4, backgroundColor: "#6D5DFC", borderRadius: 2 }} />
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary }}>{sym}{Math.round(cc.amount).toLocaleString("en-IN")}</Text>
                      <Text style={{ fontSize: 11, color: c.textSecondary, marginTop: 1 }}>{cc.percent.toFixed(0)}%</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* AI Insights — PRO locked */}
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>AI Insights</Text>
            <ProBadge />
          </View>
          <TouchableOpacity onPress={() => openPro("AI Insights")} activeOpacity={0.9}>
            <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 18, overflow: "hidden", borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
              {/* Blurred preview */}
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#6D5DFC" }} />
                  <Text style={{ fontSize: 12, color: "#6D5DFC", fontWeight: "500" }}>Spending Score</Text>
                </View>
                <View style={{ opacity: 0.2 }}>
                  <Text style={{ fontSize: 48, fontWeight: "500", color: "#00C48C", letterSpacing: -2 }}>82</Text>
                  <Text style={{ fontSize: 13, color: c.textSecondary, lineHeight: 20 }}>Your spending patterns look healthy. You've reduced food expenses by 14% compared to last month...</Text>
                </View>
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? "rgba(28,28,30,0.85)" : "rgba(255,255,255,0.85)", borderRadius: 18, padding: 20 }}>
                  <Ionicons name="lock-closed" size={24} color="#6D5DFC" />
                  <Text style={{ fontSize: 16, fontWeight: "500", color: c.textPrimary, marginTop: 8, marginBottom: 4 }}>Unlock AI Insights</Text>
                  <Text style={{ fontSize: 13, color: c.textSecondary, textAlign: "center", marginBottom: 14 }}>Get spending scores, savings tips, and personalized recommendations</Text>
                  <View style={{ backgroundColor: "#6D5DFC", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "500" }}>Upgrade to Pro · ₹299/mo</Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Monthly graph — PRO locked */}
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>Monthly trends</Text>
            <ProBadge />
          </View>
          <TouchableOpacity onPress={() => openPro("Monthly Trends")} activeOpacity={0.9}>
            <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", alignItems: "center" }}>
              <View style={{ opacity: 0.15, width: "100%", height: 100, flexDirection: "row", alignItems: "flex-end", gap: 6, marginBottom: 8 }}>
                {[30,55,40,70,45,90].map((h,i) => (
                  <View key={i} style={{ flex: 1, height: `${h}%` as any, backgroundColor: "#6D5DFC", borderRadius: 4 }} />
                ))}
              </View>
              <Ionicons name="lock-closed" size={20} color="#6D5DFC" />
              <Text style={{ fontSize: 13, color: c.textSecondary, marginTop: 6 }}>Upgrade to see monthly trends</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ProGate visible={showPro} onClose={() => setShowPro(false)} feature={proFeature} />
    </View>
  );
}
