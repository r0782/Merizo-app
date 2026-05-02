import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTheme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import { GaugeDial, DonutRing, HybridBar } from "../../src/components/Charts";
import { SmartNum, DotNum } from "../../src/components/DotNum";
import { categoryMeta, currencySymbol } from "../../src/lib/tokens";

type Period = "week" | "month" | "all";

export default function InsightsScreen() {
  const { c, isDark } = useTheme();
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const r = await api.get("/insights", { params: { period: p } });
      setData(r.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load(period);
  }, [load, period]);

  useFocusEffect(
    useCallback(() => {
      load(period);
    }, [load, period])
  );

  const total = data?.total || 0;
  const cats = data?.by_category || [];
  const topPct = cats.length > 0 ? cats[0].percent : 0;

  const segments = cats.slice(0, 6).map((cc: any, i: number) => ({
    color: categoryMeta[cc.category]?.tint || "#6B7280",
    value: cc.amount,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: 60, paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 24 }}>
          <Text style={{ color: c.textPrimary, fontSize: 32, fontFamily: "Syne_800ExtraBold", letterSpacing: -1 }}>
            Insights
          </Text>
        </View>

        {/* Total Spent */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <Text style={[styles.smallCaps, { color: c.textSecondary }]}>TOTAL SPENT</Text>
          <View style={{ marginTop: 6 }}>
            <SmartNum
              testID="insights-total"
              value={`${currencySymbol("INR")}${Math.round(total).toLocaleString("en-IN")}`}
              size="xxl"
              color={isDark ? "indigo" : "black"}
            />
          </View>
        </View>

        {/* Period toggle */}
        <View style={{ paddingHorizontal: 24, marginTop: 18 }}>
          <View style={[styles.toggle, { backgroundColor: c.surface, borderColor: c.border }]}>
            {(["week", "month", "all"] as Period[]).map((p) => {
              const active = p === period;
              return (
                <TouchableOpacity
                  key={p}
                  testID={`period-${p}`}
                  style={[
                    styles.togglePill,
                    {
                      backgroundColor: active ? (isDark ? c.indigo : "#0A0A0A") : "transparent",
                    },
                  ]}
                  onPress={() => setPeriod(p)}
                >
                  <Text
                    style={{
                      color: active ? "#fff" : c.textSecondary,
                      fontSize: 12,
                      fontWeight: "700",
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                    }}
                  >
                    {p === "week" ? "This Week" : p === "month" ? "This Month" : "All Time"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Chart */}
        <View style={{ alignItems: "center", marginTop: 32 }}>
          {loading ? (
            <ActivityIndicator color={c.indigo} size="large" />
          ) : isDark ? (
            <GaugeDial percent={Math.min(100, topPct)} size={240}>
              <DotNum value={`${Math.round(topPct)}%`} size="xl" color="gold" />
              <View style={{ marginTop: 4 }}>
                <DotNum
                  value={`${currencySymbol("INR")}${Math.round(total).toLocaleString("en-IN")}`}
                  size="sm"
                  color="white"
                />
              </View>
            </GaugeDial>
          ) : (
            <DonutRing percent={Math.min(100, topPct)} segments={segments.length ? segments : undefined} size={220} thickness={20}>
              <Text style={{ color: c.textPrimary, fontSize: 38, fontWeight: "900", letterSpacing: -1 }}>
                {Math.round(topPct)}%
              </Text>
              <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 4 }}>top category</Text>
            </DonutRing>
          )}
        </View>

        {/* Category list */}
        <View style={{ marginTop: 28, paddingHorizontal: 24, gap: 10 }}>
          {cats.length === 0 && !loading && (
            <Text style={{ color: c.textSecondary, textAlign: "center", marginTop: 20 }}>
              No expenses yet for this period
            </Text>
          )}
          {cats.map((cc: any) => {
            const meta = categoryMeta[cc.category] || categoryMeta.other;
            return (
              <View
                key={cc.category}
                style={[styles.catRow, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <View style={[styles.catEmoji, { backgroundColor: meta.tint + "22" }]}>
                  <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>{meta.label}</Text>
                  <View style={{ marginTop: 6 }}>
                    <HybridBar
                      percent={cc.percent}
                      accent={isDark ? c.indigo : "#0A0A0A"}
                      muted={isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.18)"}
                      width={160}
                      height={6}
                    />
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <SmartNum
                    value={`${currencySymbol("INR")}${Math.round(cc.amount).toLocaleString("en-IN")}`}
                    size="sm"
                    color={isDark ? "white" : "black"}
                  />
                  <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 2 }}>{cc.percent.toFixed(1)}%</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  smallCaps: { fontSize: 11, fontWeight: "700", letterSpacing: 1.6 },
  toggle: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  togglePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  catEmoji: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
