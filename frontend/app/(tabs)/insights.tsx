/**
 * MERIZO Insights — B&W financial notebook statistics page.
 * Hand-drawn charts, ledger rows, ink aesthetics throughout.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Platform,
  TextInput, Alert, Modal, useWindowDimensions, Animated, Easing,
} from "react-native";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path, Line } from "react-native-svg";
import { useTheme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import { categoryMeta, currencySymbol, type } from "../../src/lib/tokens";
import { ProGate, ProBadge } from "../../src/components/ProGate";
import { LiveTicker } from "../../src/components/LiveTicker";
import {
  SketchAreaChart,
  SketchBudgetBar,
  AIInsightCard,
  SketchDonutLegend,
} from "../../src/components/Charts";

// ── Types ─────────────────────────────────────────────────────────────────────
type Period = "1M" | "3M" | "6M" | "1Y";
const BUDGET_KEY = "merizo_budgets";
const DEFAULT_BUDGETS = { food: 5000, travel: 10000, entertainment: 2000, shopping: 3000, bills: 2000 };

// ── Inline SVG icons ──────────────────────────────────────────────────────────
function FlagIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Path d="M 3 2 L 3 12" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      <Path d="M 3 2 L 11 4 L 3 6" stroke={color} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function InfoIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Path d="M 7 7 m -5.5 0 a 5.5 5.5 0 1 0 11 0 a 5.5 5.5 0 1 0 -11 0" stroke={color} strokeWidth={1.2} fill="none" />
      <Path d="M 7 6 L 7 10" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M 7 4.5 L 7 4.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function CloseIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M 4 4 L 12 12 M 12 4 L 4 12" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}
function CheckIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Path d="M 2 7 L 5.5 10.5 L 12 4" stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children, right }: { children: string; right?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase" }}>
        {children}
      </Text>
      {right}
    </View>
  );
}

// ── Animate-in row ────────────────────────────────────────────────────────────
function AnimRow({ children, index }: { children: React.ReactNode; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 340, delay: 60 + index * 60, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, delay: 60 + index * 60, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [index]);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// ── Category ledger row ───────────────────────────────────────────────────────
function CategoryRow({ cc, sym, barWidth, index }: { cc: any; sym: string; barWidth: number; index: number }) {
  const { c } = useTheme();
  const meta = categoryMeta[cc.category] || categoryMeta.other;
  return (
    <AnimRow index={index}>
      <View style={{ paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: `${c.border}18` }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 4 }}>
          <Text style={{ fontFamily: type.family.medium, fontSize: type.size.sm, color: c.textPrimary, flex: 1 }}>
            {meta.label}
          </Text>
          <Text style={{ fontFamily: type.family.light, fontSize: 11, color: c.textMuted }}>
            {cc.percent.toFixed(0)}%
          </Text>
          <Text style={{ fontFamily: type.family.semibold, fontSize: type.size.sm, color: c.textPrimary, marginLeft: 8, letterSpacing: -0.3 }}>
            {sym}{Math.round(cc.amount).toLocaleString("en-IN")}
          </Text>
        </View>
        <SketchBudgetBar
          spent={cc.amount}
          budget={cc.amount / (cc.percent / 100)}
          accent="#0A0A0A"
          width={barWidth}
          height={7}
        />
      </View>
    </AnimRow>
  );
}

// ── Derive AI insights ────────────────────────────────────────────────────────
function deriveInsights(data: any, sym: string) {
  if (!data) return [];
  const cats: any[] = data.by_category || [];
  const total: number = data.total || 0;
  const owed: number = data.owed_to_you || 0;
  const owing: number = data.you_owe || 0;
  const trend: any[] = data.monthly_trend || [];
  const insights: Array<{ emoji: string; title: string; sub?: string; trendDir?: "up" | "down" | "neutral" }> = [];

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

  if (owed > 0 && owing === 0) {
    insights.push({
      emoji: "✅",
      title: `+${sym}${Math.round(owed).toLocaleString("en-IN")} owed to you`,
      sub: "You're in a great position — others owe you",
      trendDir: "down",
    });
  } else if (owing > 0) {
    insights.push({
      emoji: "⚡",
      title: `-${sym}${Math.round(owing).toLocaleString("en-IN")} you owe across groups`,
      sub: "Settle up to keep balances clean",
      trendDir: "up",
    });
  }

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

// ── Budget edit modal ─────────────────────────────────────────────────────────
const BUDGET_CATS = [
  { key: "food",          label: "Food & Dining" },
  { key: "travel",        label: "Travel"        },
  { key: "entertainment", label: "Entertainment" },
  { key: "shopping",      label: "Shopping"      },
  { key: "bills",         label: "Bills"         },
] as const;

function BudgetModal({ visible, budgets, onClose, onSave }: {
  visible: boolean;
  budgets: Record<string, number>;
  onClose: () => void;
  onSave: (b: Record<string, number>) => void;
}) {
  const { c } = useTheme();
  const [local, setLocal] = useState(budgets);

  useEffect(() => { setLocal(budgets); }, [budgets, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: c.bg, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 40 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <View>
              <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 2 }}>
                Configure
              </Text>
              <Text style={{ fontFamily: type.family.bold, fontSize: 20, color: c.textPrimary }}>
                Monthly Budgets
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{ width: 32, height: 32, borderWidth: 1, borderColor: `${c.border}40`, alignItems: "center", justifyContent: "center" }}
            >
              <CloseIcon color={c.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={{ height: 1, backgroundColor: c.border, opacity: 0.2, marginVertical: 16 }} />

          {BUDGET_CATS.map((cat, i) => (
            <View key={cat.key} style={{
              flexDirection: "row", alignItems: "center", gap: 14,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: `${c.border}18`,
            }}>
              <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textPrimary, flex: 1 }}>
                {cat.label}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: `${c.border}40`, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textSecondary }}>₹</Text>
                <TextInput
                  value={String(local[cat.key] || "")}
                  onChangeText={v => setLocal(prev => ({ ...prev, [cat.key]: parseInt(v) || 0 }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={c.textMuted}
                  style={{ minWidth: 70, fontSize: type.size.sm, fontFamily: type.family.regular, color: c.textPrimary } as any}
                />
              </View>
            </View>
          ))}

          <TouchableOpacity
            onPress={() => { onSave(local); onClose(); }}
            style={{ marginTop: 20, backgroundColor: c.ink, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
          >
            <CheckIcon color={c.bg} size={16} />
            <Text style={{ fontFamily: type.family.semibold, fontSize: type.size.sm, color: c.bg, letterSpacing: 0.5 }}>
              Save Budgets
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
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

  const px = 20;
  const budgetBarW = screenW - px * 2 - 32;
  const catBarW    = screenW - px * 2;

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
  const total   = data?.total || 0;
  const cats: any[]    = data?.by_category || [];
  const owed    = data?.owed_to_you || 0;
  const owing   = data?.you_owe || 0;
  const periods: Period[] = ["1M", "3M", "6M", "1Y"];
  const monthlyTrend: { month: string; total: number }[] = data?.monthly_trend || [];
  const aiInsights = deriveInsights(data, sym);

  const chartW = screenW - px * 2;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 40, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ paddingHorizontal: px, marginBottom: 20, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>
              Overview
            </Text>
            <Text style={{ fontFamily: type.family.bold, fontSize: 28, color: c.textPrimary, letterSpacing: -1 }}>
              Statistics
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowBudget(true)}
            style={{
              flexDirection: "row", alignItems: "center", gap: 7,
              borderWidth: 1, borderColor: `${c.border}40`,
              paddingHorizontal: 12, paddingVertical: 8,
            }}
          >
            <FlagIcon color={c.textSecondary} size={12} />
            <Text style={{ fontFamily: type.family.regular, fontSize: 11, color: c.textSecondary }}>
              Set Budget
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 1, backgroundColor: c.border, opacity: 0.2, marginHorizontal: px, marginBottom: 20 }} />

        {/* ── Balance: 2-column ledger ── */}
        <View style={{ paddingHorizontal: px, flexDirection: "row", marginBottom: 24 }}>
          {/* Owed to you */}
          <View style={{ flex: 1, paddingRight: 16, borderRightWidth: 1, borderRightColor: `${c.border}20` }}>
            <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
              Owed to you
            </Text>
            <Text style={{ fontFamily: type.family.bold, fontSize: 22, color: c.textPrimary, letterSpacing: -0.5 }}>
              +{sym}{Math.round(owed).toLocaleString("en-IN")}
            </Text>
          </View>
          {/* You owe */}
          <View style={{ flex: 1, paddingLeft: 16 }}>
            <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
              You owe
            </Text>
            <Text style={{ fontFamily: type.family.bold, fontSize: 22, color: c.textPrimary, letterSpacing: -0.5 }}>
              {owing > 0 ? "-" : ""}{sym}{Math.round(owing).toLocaleString("en-IN")}
            </Text>
          </View>
        </View>

        {/* ── Total spending ── */}
        <View style={{ marginHorizontal: px, backgroundColor: c.textPrimary, padding: 22, marginBottom: 20 }}>
          <Text style={{ fontFamily: type.family.light, fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
            Total spending
          </Text>
          <Text style={{ fontFamily: type.family.bold, fontSize: 38, color: c.bg, letterSpacing: -1.5, marginBottom: 4 }}>
            {sym}{Math.round(total).toLocaleString("en-IN")}
          </Text>
          <Text style={{ fontFamily: type.family.light, fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: monthlyTrend.length > 0 ? 16 : 0 }}>
            This period across all groups
          </Text>
          {monthlyTrend.length >= 2 && (
            <SketchAreaChart
              data={monthlyTrend.map(t => t.total)}
              chartWidth={chartW - 44}
              height={56}
              color={c.bg}
            />
          )}
        </View>

        {/* ── Period selector ── */}
        <View style={{ paddingHorizontal: px, marginBottom: 24 }}>
          <View style={{ flexDirection: "row", borderWidth: 1, borderColor: `${c.border}30` }}>
            {periods.map((p, i) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: "center",
                  borderRightWidth: i < periods.length - 1 ? 1 : 0,
                  borderRightColor: `${c.border}30`,
                  borderBottomWidth: p === period ? 2 : 0,
                  borderBottomColor: c.ink,
                }}
              >
                <Text style={{
                  fontFamily: p === period ? type.family.semibold : type.family.regular,
                  fontSize: 12,
                  color: p === period ? c.textPrimary : c.textMuted,
                  letterSpacing: 0.5,
                }}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Spending breakdown (donut) ── */}
        {!loading && cats.length > 0 && (
          <View style={{ marginHorizontal: px, marginBottom: 24 }}>
            <SectionLabel>Spending breakdown</SectionLabel>
            <SketchDonutLegend categories={cats} total={total} sym={sym} />
          </View>
        )}

        {/* ── Category rows ── */}
        <View style={{ paddingHorizontal: px, marginBottom: 24 }}>
          <SectionLabel>By category</SectionLabel>
          {loading ? (
            <View style={{ gap: 16 }}>
              {[90, 70, 80].map((w, i) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ width: `${w}%` as any, height: 12, backgroundColor: c.surfaceAlt }} />
                  <View style={{ width: 48, height: 12, backgroundColor: c.surfaceAlt }} />
                </View>
              ))}
            </View>
          ) : cats.length === 0 ? (
            <Text style={{ fontFamily: type.family.light, fontSize: type.size.sm, color: c.textMuted, textAlign: "center", paddingVertical: 20 }}>
              No expenses yet. Add expenses to see a breakdown.
            </Text>
          ) : (
            <View>
              {cats.map((cc: any, i: number) => (
                <CategoryRow key={cc.category} cc={cc} sym={sym} barWidth={catBarW} index={i} />
              ))}
            </View>
          )}
        </View>

        {/* ── Budget tracker ── */}
        <View style={{ paddingHorizontal: px, marginBottom: 24 }}>
          <SectionLabel right={
            <TouchableOpacity onPress={() => setShowBudget(true)}>
              <Text style={{ fontFamily: type.family.regular, fontSize: 11, color: c.textMuted }}>Edit</Text>
            </TouchableOpacity>
          }>
            Monthly budget
          </SectionLabel>
          <View style={{ borderTopWidth: 1, borderTopColor: `${c.border}30` }}>
            {([
              { key: "food",          label: "Food & Dining"  },
              { key: "travel",        label: "Travel"         },
              { key: "entertainment", label: "Entertainment"  },
            ] as { key: string; label: string }[]).map((b, i) => {
              const spent  = cats.find((x: any) => x.category === b.key)?.amount || 0;
              const budget = budgets[b.key] || 5000;
              const over   = spent > budget;
              return (
                <View key={b.key} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: `${c.border}18` }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontFamily: type.family.medium, fontSize: type.size.sm, color: c.textPrimary }}>
                        {b.label}
                      </Text>
                      {over && (
                        <View style={{ borderWidth: 1, borderColor: `${c.border}40`, paddingHorizontal: 5, paddingVertical: 1 }}>
                          <Text style={{ fontFamily: type.family.semibold, fontSize: 9, color: c.textPrimary, letterSpacing: 0.8 }}>OVER</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontFamily: type.family.regular, fontSize: 11, color: c.textSecondary }}>
                      {sym}{Math.round(spent).toLocaleString("en-IN")} / {sym}{budget.toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <SketchBudgetBar spent={spent} budget={budget} accent="#0A0A0A" width={budgetBarW} height={8} />
                </View>
              );
            })}
          </View>
        </View>

        {/* ── AI insights ── */}
        <View style={{ paddingHorizontal: px, marginBottom: 24 }}>
          <SectionLabel right={<ProBadge />}>AI observations</SectionLabel>
          {!loading && aiInsights.length > 0 ? (
            <View style={{ borderTopWidth: 1, borderTopColor: `${c.border}30` }}>
              {aiInsights.map((ins, i) => (
                <AIInsightCard key={i} index={i} emoji={ins.emoji} title={ins.title} sub={ins.sub} trendDir={ins.trendDir} />
              ))}
            </View>
          ) : loading ? (
            <View style={{ gap: 14 }}>
              {[80, 65, 75].map((w, i) => (
                <View key={i} style={{ width: `${w}%` as any, height: 12, backgroundColor: c.surfaceAlt }} />
              ))}
            </View>
          ) : (
            <Text style={{ fontFamily: type.family.light, fontSize: type.size.sm, color: c.textMuted, textAlign: "center", paddingVertical: 20 }}>
              Add expenses to unlock personalised insights.
            </Text>
          )}
        </View>

        {/* ── Monthly trends ── */}
        <View style={{ paddingHorizontal: px, marginBottom: 24 }}>
          <SectionLabel right={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity
                onPress={() => Alert.alert("Monthly Trends", "This chart shows your spending month by month. As you add more expenses the bars will reflect your real pattern.")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <InfoIcon color={c.textMuted} />
              </TouchableOpacity>
              <ProBadge />
            </View>
          }>
            Monthly trends
          </SectionLabel>

          {monthlyTrend.length > 0 ? (
            <View>
              <SketchAreaChart
                data={monthlyTrend.map(t => t.total)}
                chartWidth={chartW}
                height={130}
                labels={monthlyTrend.map(t => t.month)}
              />
              {monthlyTrend.length >= 2 && (() => {
                const max = Math.max(...monthlyTrend.map(t => t.total));
                const min = Math.min(...monthlyTrend.map(t => t.total));
                const maxMonth = monthlyTrend.find(t => t.total === max)?.month;
                const minMonth = monthlyTrend.find(t => t.total === min)?.month;
                return (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: `${c.border}20` }}>
                    <View>
                      <Text style={{ fontFamily: type.family.regular, fontSize: 9, color: c.textMuted, letterSpacing: 1.5, textTransform: "uppercase" }}>Peak</Text>
                      <Text style={{ fontFamily: type.family.bold, fontSize: 14, color: c.textPrimary, marginTop: 2 }}>
                        {sym}{Math.round(max).toLocaleString("en-IN")}
                      </Text>
                      <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted }}>{maxMonth}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontFamily: type.family.regular, fontSize: 9, color: c.textMuted, letterSpacing: 1.5, textTransform: "uppercase" }}>Lowest</Text>
                      <Text style={{ fontFamily: type.family.bold, fontSize: 14, color: c.textPrimary, marginTop: 2 }}>
                        {sym}{Math.round(min).toLocaleString("en-IN")}
                      </Text>
                      <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted }}>{minMonth}</Text>
                    </View>
                  </View>
                );
              })()}
            </View>
          ) : (
            <Text style={{ fontFamily: type.family.light, fontSize: type.size.sm, color: c.textMuted, textAlign: "center", paddingVertical: 20 }}>
              Monthly trends appear after expenses across multiple months.
            </Text>
          )}
        </View>

        {/* ── Live rates ── */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ paddingHorizontal: px }}>
            <SectionLabel>Live rates</SectionLabel>
          </View>
          <LiveTicker base="INR" />
        </View>

        {/* Footer */}
        <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted, letterSpacing: 1.5, textAlign: "center", opacity: 0.4, textTransform: "uppercase", paddingBottom: 8 }}>
          Merizo · Statistics
        </Text>
      </ScrollView>

      <BudgetModal
        visible={showBudget}
        budgets={budgets}
        onClose={() => setShowBudget(false)}
        onSave={saveBudgets}
      />
      <ProGate visible={showPro} onClose={() => setShowPro(false)} feature={proFeature} />
    </View>
  );
}
