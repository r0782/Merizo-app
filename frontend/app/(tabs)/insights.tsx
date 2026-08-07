import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Platform, TextInput, Alert, Modal, useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import { categoryMeta, currencySymbol } from "../../src/lib/tokens";
import { ProGate, ProBadge } from "../../src/components/ProGate";
import { LiveTicker } from "../../src/components/LiveTicker";
import {
  SketchAreaChart,
  SketchBudgetBar,
  AIInsightCard,
  SketchDonutLegend,
} from "../../src/components/Charts";

// ─────────────────────────────────────────────────────────────────────────────
// Types / constants
// ─────────────────────────────────────────────────────────────────────────────
type Period = "1M" | "3M" | "6M" | "1Y";

const BUDGET_KEY = "merizo_budgets";
const DEFAULT_BUDGETS = { food: 5000, travel: 10000, entertainment: 2000, shopping: 3000, bills: 2000 };

// Accent colour for each category
const CAT_ACCENT: Record<string, string> = {
  food: "#FF8B7B", travel: "#60A5FA", entertainment: "#A78BFA",
  utilities: "#FBBF24", shopping: "#F472B6", health: "#34D399",
  accommodation: "#E8B04E", trip: "#9D7BFF", other: "#9CA3AF",
};

// ─────────────────────────────────────────────────────────────────────────────
// CategoryRow — single animated sketch category row
// ─────────────────────────────────────────────────────────────────────────────
function CategoryRow({
  cc,
  sym,
  barWidth,
  index,
}: {
  cc: any;
  sym: string;
  barWidth: number;
  index: number;
}) {
  const { c } = useTheme();
  const meta = categoryMeta[cc.category] || categoryMeta.other;
  const accent = CAT_ACCENT[cc.category] || "#9CA3AF";

  return (
    <View style={{
      backgroundColor: c.surface, borderRadius: 16, padding: 14,
      flexDirection: "row", alignItems: "center", gap: 12,
      borderWidth: 1, borderColor: c.border,
    }}>
      {/* Icon */}
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: `${accent}18`,
        alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
      </View>

      {/* Bar + label */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: c.textPrimary }}>{meta.label}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 11, color: c.textMuted }}>{cc.percent.toFixed(0)}%</Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: c.textPrimary }}>
              {sym}{Math.round(cc.amount).toLocaleString("en-IN")}
            </Text>
          </View>
        </View>
        {/* Sketch budget bar used as category fill */}
        <SketchBudgetBar
          spent={cc.amount}
          budget={cc.amount / (cc.percent / 100)}
          accent={accent}
          width={barWidth}
          height={9}
        />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: derive AI insights from data (no extra API call)
// ─────────────────────────────────────────────────────────────────────────────
function deriveInsights(data: any, sym: string) {
  if (!data) return [];
  const cats: any[] = data.by_category || [];
  const total: number = data.total || 0;
  const owed: number = data.owed_to_you || 0;
  const owing: number = data.you_owe || 0;
  const trend: any[] = data.monthly_trend || [];
  const insights: Array<{ emoji: string; title: string; sub?: string; trendDir?: "up" | "down" | "neutral" }> = [];

  // 1. Top spending category
  if (cats.length > 0) {
    const top = cats[0];
    const meta = categoryMeta[top.category] || categoryMeta.other;
    insights.push({
      emoji: meta.emoji,
      title: `${meta.label} is your top spend — ${sym}${Math.round(top.amount).toLocaleString("en-IN")}`,
      sub: `${top.percent.toFixed(0)}% of your total spending this period`,
      trendDir: "neutral",
    });
  }

  // 2. Month-over-month change
  if (trend.length >= 2) {
    const last = trend[trend.length - 1]?.total || 0;
    const prev = trend[trend.length - 2]?.total || 1;
    const changePct = Math.round(((last - prev) / Math.max(prev, 1)) * 100);
    if (Math.abs(changePct) >= 5) {
      insights.push({
        emoji: changePct > 0 ? "📈" : "📉",
        title: changePct > 0
          ? `Spending up ${Math.abs(changePct)}% vs last month`
          : `Spending down ${Math.abs(changePct)}% vs last month`,
        sub: `${trend[trend.length - 1]?.month} vs ${trend[trend.length - 2]?.month}`,
        trendDir: changePct > 0 ? "up" : "down",
      });
    }
  }

  // 3. Settlement health
  if (owed > 0 && owing === 0) {
    insights.push({
      emoji: "💚",
      title: `${sym}${Math.round(owed).toLocaleString("en-IN")} owed to you`,
      sub: "You're in a great position — others owe you",
      trendDir: "down",
    });
  } else if (owing > 0) {
    insights.push({
      emoji: "🔴",
      title: `You owe ${sym}${Math.round(owing).toLocaleString("en-IN")} across groups`,
      sub: "Settle up to keep balances clean",
      trendDir: "up",
    });
  }

  // 4. Category concentration
  const topTwo = cats.slice(0, 2).reduce((s: number, cc: any) => s + cc.percent, 0);
  if (cats.length >= 3 && topTwo > 70) {
    const names = cats.slice(0, 2).map((cc: any) => (categoryMeta[cc.category] || categoryMeta.other).label);
    insights.push({
      emoji: "🎯",
      title: `${names.join(" & ")} make up ${Math.round(topTwo)}% of spending`,
      sub: "Consider diversifying your budget tracking",
      trendDir: "neutral",
    });
  } else if (total > 0) {
    insights.push({
      emoji: "✨",
      title: `Total: ${sym}${Math.round(total).toLocaleString("en-IN")} across ${cats.length} categories`,
      sub: "Your spending is well distributed",
      trendDir: "neutral",
    });
  }

  return insights;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function InsightsScreen() {
  const { c } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const [period, setPeriod] = useState<Period>("1M");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPro, setShowPro] = useState(false);
  const [proFeature] = useState("Pro Feature");
  const [showBudget, setShowBudget] = useState(false);
  const [budgets, setBudgets] = useState<Record<string, number>>(DEFAULT_BUDGETS);

  // Budget bar layout width
  const budgetBarW = screenW - 40 - 32 - 32; // container padding × 2 + row padding × 2

  useEffect(() => {
    AsyncStorage.getItem(BUDGET_KEY).then(v => {
      if (v) setBudgets({ ...DEFAULT_BUDGETS, ...JSON.parse(v) });
    }).catch(() => {});
  }, []);

  const saveBudgets = async (b: Record<string, number>) => {
    setBudgets(b);
    await AsyncStorage.setItem(BUDGET_KEY, JSON.stringify(b));
  };

  const load = useCallback(async (p: Period = period) => {
    setLoading(true);
    try {
      const r = await api.get("/insights", { params: { period: p } });
      setData(r.data);
    } catch {}
    setLoading(false);
  }, [period]);

  useFocusEffect(useCallback(() => { load(period); }, [period]));

  const sym = currencySymbol("INR");
  const total = data?.total || 0;
  const cats: any[] = data?.by_category || [];
  const owed = data?.owed_to_you || 0;
  const owing = data?.you_owe || 0;
  const periods: Period[] = ["1M", "3M", "6M", "1Y"];
  const monthlyTrend: { month: string; total: number }[] = data?.monthly_trend || [];

  // Width of category bar
  const catBarW = screenW - 40 - 14 - 52 - 12; // H padding + row padding + icon + gap

  // AI insights (derived, no extra call)
  const aiInsights = deriveInsights(data, sym);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 40, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header (UNCHANGED) ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 28, fontWeight: "700", color: c.textPrimary, letterSpacing: -0.5 }}>Insights</Text>
          <TouchableOpacity
            onPress={() => setShowBudget(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surfaceAlt, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: c.border }}
          >
            <Ionicons name="flag" size={13} color={c.textPrimary} />
            <Text style={{ fontSize: 12, color: c.textPrimary, fontWeight: "500" }}>Set Budget</Text>
          </TouchableOpacity>
        </View>

        {/* ── Balance cards (UNCHANGED) ── */}
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ fontSize: 10, color: c.textMuted, marginBottom: 6 }}>Owed to you</Text>
            <Text style={{ fontSize: 20, fontWeight: "700", color: c.positive, letterSpacing: -0.5 }}>
              {sym}{Math.round(owed).toLocaleString("en-IN")}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ fontSize: 10, color: c.textMuted, marginBottom: 6 }}>You owe</Text>
            <Text style={{ fontSize: 20, fontWeight: "700", color: owing > 0 ? c.negative : c.textPrimary, letterSpacing: -0.5 }}>
              {sym}{Math.round(owing).toLocaleString("en-IN")}
            </Text>
          </View>
        </View>

        {/* ── Total spending hero (UNCHANGED layout, decoration only) ── */}
        <View style={{ marginHorizontal: 20, backgroundColor: c.textPrimary, borderRadius: 20, padding: 22, marginBottom: 20 }}>
          <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
            Total spending
          </Text>
          <Text style={{ fontSize: 36, fontWeight: "700", color: c.bg, letterSpacing: -1, marginBottom: 4 }}>
            {sym}{Math.round(total).toLocaleString("en-IN")}
          </Text>
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: monthlyTrend.length > 0 ? 14 : 0 }}>
            This period across all groups
          </Text>
          {/* ── Inline sparkline inside hero — new visual ── */}
          {monthlyTrend.length >= 2 && (
            <SketchAreaChart
              data={monthlyTrend.map(t => t.total)}
              chartWidth={screenW - 40 - 44}
              height={56}
              color="rgba(255,255,255,0.55)"
            />
          )}
        </View>

        {/* ── Period selector (UNCHANGED) ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", backgroundColor: c.surfaceAlt, borderRadius: 14, padding: 3, gap: 2, borderWidth: 1, borderColor: c.border }}>
            {periods.map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                style={{ flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 11, backgroundColor: p === period ? c.surface : "transparent" }}
              >
                <Text style={{ fontSize: 12, fontWeight: p === period ? "600" : "400", color: p === period ? c.textPrimary : c.textSecondary }}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── ① SKETCH SPENDING DONUT — new visualisation ── */}
        {!loading && cats.length > 0 && (
          <View style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: c.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: c.textSecondary, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 14 }}>
              Spending breakdown
            </Text>
            <SketchDonutLegend categories={cats} total={total} sym={sym} />
          </View>
        )}

        {/* ── ② CATEGORY ROWS — sketch bars replace plain 3px bars ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
            By category
          </Text>
          {loading ? (
            <ActivityIndicator color={c.textSecondary} />
          ) : cats.length === 0 ? (
            <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 1, borderColor: c.border }}>
              <Text style={{ fontSize: 24, marginBottom: 8 }}>📊</Text>
              <Text style={{ fontSize: 14, color: c.textSecondary, textAlign: "center" }}>
                No expenses yet. Add expenses to see spending breakdown.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {cats.map((cc: any, i: number) => (
                <CategoryRow key={cc.category} cc={cc} sym={sym} barWidth={catBarW} index={i} />
              ))}
            </View>
          )}
        </View>

        {/* ── ③ BUDGET TRACKER — sketch bars ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>
              Monthly budget
            </Text>
            <TouchableOpacity onPress={() => setShowBudget(true)}>
              <Text style={{ fontSize: 12, color: c.textSecondary, fontWeight: "500" }}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={{ backgroundColor: c.surface, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: c.border }}>
            {([
              { key: "food",          label: "Food & Dining",  emoji: "🍕" },
              { key: "travel",        label: "Travel",         emoji: "✈️" },
              { key: "entertainment", label: "Entertainment",  emoji: "🎬" },
            ] as { key: string; label: string; emoji: string }[]).map((b, i) => {
              const spent = cats.find((x: any) => x.category === b.key)?.amount || 0;
              const budget = budgets[b.key] || 5000;
              const over = spent > budget;
              const accent = over ? "#FF453A" : (CAT_ACCENT[b.key] || "#6D5DFC");
              return (
                <View key={b.key} style={{ padding: 14, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: c.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 16 }}>{b.emoji}</Text>
                      <Text style={{ fontSize: 13, fontWeight: "500", color: c.textPrimary }}>{b.label}</Text>
                      {over && (
                        <View style={{ backgroundColor: "rgba(255,67,58,0.12)", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 9, fontWeight: "700", color: "#FF453A", letterSpacing: 0.5 }}>OVER</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: over ? "#FF453A" : c.textSecondary }}>
                      {sym}{Math.round(spent).toLocaleString("en-IN")} / {sym}{budget.toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <SketchBudgetBar
                    spent={spent}
                    budget={budget}
                    accent={accent}
                    width={budgetBarW}
                    height={9}
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* ── ④ AI INSIGHTS — derived insight cards replace spending score ── */}
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>AI Insights</Text>
            <ProBadge />
          </View>
          {!loading && aiInsights.length > 0 ? (
            <View style={{ gap: 8 }}>
              {aiInsights.map((ins, i) => (
                <AIInsightCard
                  key={i}
                  index={i}
                  emoji={ins.emoji}
                  title={ins.title}
                  sub={ins.sub}
                  trendDir={ins.trendDir}
                />
              ))}
            </View>
          ) : loading ? (
            <ActivityIndicator color={c.textSecondary} />
          ) : (
            <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1, borderColor: c.border }}>
              <Text style={{ fontSize: 24, marginBottom: 8 }}>🤔</Text>
              <Text style={{ fontSize: 13, color: c.textSecondary, textAlign: "center" }}>
                Add expenses to unlock personalised AI insights.
              </Text>
            </View>
          )}
        </View>

        {/* ── ⑤ MONTHLY TRENDS — SketchAreaChart replaces plain view bars ── */}
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>
                Monthly trends
              </Text>
              <TouchableOpacity onPress={() => Alert.alert("Monthly Trends", "This chart shows your spending month by month. As you add more expenses the bars will reflect your real pattern.")}>
                <Ionicons name="information-circle-outline" size={16} color={c.textMuted} />
              </TouchableOpacity>
            </View>
            <ProBadge />
          </View>
          <View style={{ backgroundColor: c.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: c.border }}>
            {monthlyTrend.length > 0 ? (
              <>
                <SketchAreaChart
                  data={monthlyTrend.map(t => t.total)}
                  chartWidth={screenW - 40 - 32}
                  height={120}
                  labels={monthlyTrend.map(t => t.month)}
                />
                {/* High / low annotation */}
                {monthlyTrend.length >= 2 && (() => {
                  const max = Math.max(...monthlyTrend.map(t => t.total));
                  const min = Math.min(...monthlyTrend.map(t => t.total));
                  const maxMonth = monthlyTrend.find(t => t.total === max)?.month;
                  const minMonth = monthlyTrend.find(t => t.total === min)?.month;
                  return (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border }}>
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ fontSize: 9, color: c.textMuted, letterSpacing: 0.8 }}>PEAK</Text>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#FF453A", marginTop: 2 }}>
                          {sym}{Math.round(max).toLocaleString("en-IN")}
                        </Text>
                        <Text style={{ fontSize: 10, color: c.textMuted }}>{maxMonth}</Text>
                      </View>
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ fontSize: 9, color: c.textMuted, letterSpacing: 0.8 }}>LOWEST</Text>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#00C48C", marginTop: 2 }}>
                          {sym}{Math.round(min).toLocaleString("en-IN")}
                        </Text>
                        <Text style={{ fontSize: 10, color: c.textMuted }}>{minMonth}</Text>
                      </View>
                    </View>
                  );
                })()}
              </>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>📈</Text>
                <Text style={{ fontSize: 13, color: c.textSecondary, textAlign: "center" }}>
                  Monthly trends appear after you have expenses across multiple months.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Live rates (UNCHANGED) ── */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10, paddingHorizontal: 20 }}>
            Live rates
          </Text>
          <LiveTicker base="INR" />
        </View>
      </ScrollView>

      {/* ── Budget Modal (UNCHANGED) ── */}
      <Modal visible={showBudget} transparent animationType="slide" onRequestClose={() => setShowBudget(false)}>
        <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: c.textPrimary }}>Monthly Budgets</Text>
              <TouchableOpacity
                onPress={() => setShowBudget(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={16} color={c.textPrimary} />
              </TouchableOpacity>
            </View>
            {([
              { key: "food",          label: "Food & Dining",  emoji: "🍕" },
              { key: "travel",        label: "Travel",         emoji: "✈️" },
              { key: "entertainment", label: "Entertainment",  emoji: "🎬" },
              { key: "shopping",      label: "Shopping",       emoji: "🛍️" },
              { key: "bills",         label: "Bills",          emoji: "💡" },
            ] as { key: string; label: string; emoji: string }[]).map(cat => (
              <View key={cat.key} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <Text style={{ fontSize: 22, width: 32 }}>{cat.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "500", color: c.textPrimary, marginBottom: 4 }}>{cat.label}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: c.border }}>
                    <Text style={{ fontSize: 14, color: c.textSecondary }}>₹</Text>
                    <TextInput
                      value={String(budgets[cat.key] || "")}
                      onChangeText={v => setBudgets(prev => ({ ...prev, [cat.key]: parseInt(v) || 0 }))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={c.textMuted}
                      style={{ flex: 1, fontSize: 15, color: c.textPrimary }}
                    />
                  </View>
                </View>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => { saveBudgets(budgets); setShowBudget(false); Alert.alert("Saved", "Budgets saved!"); }}
              style={{ backgroundColor: c.textPrimary, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8 }}
            >
              <Text style={{ color: c.bg, fontSize: 15, fontWeight: "600" }}>Save Budgets</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ProGate visible={showPro} onClose={() => setShowPro(false)} feature={proFeature} />
    </View>
  );
}
