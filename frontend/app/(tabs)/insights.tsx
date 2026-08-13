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
import Svg, { Path, Line, Circle } from "react-native-svg";
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

// ── Animated circular progress ring ─────────────────────────────────────────
function CircularProgress({ spent, budget, label, sym, size = 96 }: { spent: number; budget: number; label: string; sym: string; size?: number }) {
  const { c } = useTheme();
  const targetPct = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const over = spent > budget;
  const r = (size - 14) / 2;
  const circumference = 2 * Math.PI * r;

  // Animate pct via state updated from Animated listener
  const [displayPct, setDisplayPct] = useState(0);
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = animVal.addListener(({ value }) => setDisplayPct(value));
    Animated.timing(animVal, { toValue: targetPct, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    return () => animVal.removeListener(id);
  }, [targetPct]);

  const offset = circumference * (1 - displayPct);

  return (
    <View style={{ alignItems: "center", width: size + 16 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track ring */}
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={`${c.border}30`} strokeWidth={6} fill="none" />
          {/* Progress arc */}
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={c.textPrimary}
            strokeWidth={over ? 6 : 5}
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={`${offset}`}
            strokeLinecap="round"
            rotation={-90}
            origin={`${size / 2},${size / 2}`}
            opacity={over ? 1 : 0.88}
          />
        </Svg>
        {/* Center label */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: type.family.bold, fontSize: 14, color: c.textPrimary, letterSpacing: -0.5 }}>
            {Math.round(displayPct * 100)}%
          </Text>
          {over && (
            <Text style={{ fontFamily: type.family.regular, fontSize: 7, color: c.textMuted, letterSpacing: 0.8, marginTop: 1 }}>OVER</Text>
          )}
        </View>
      </View>
      <Text style={{ fontFamily: type.family.medium, fontSize: 10, color: c.textSecondary, marginTop: 6, textAlign: "center" }}>{label}</Text>
      <Text style={{ fontFamily: type.family.regular, fontSize: 9, color: c.textMuted, marginTop: 1 }}>
        {sym}{Math.round(spent).toLocaleString("en-IN")} / {sym}{(budget || 0).toLocaleString("en-IN")}
      </Text>
    </View>
  );
}

// ── Derive AI insights ────────────────────────────────────────────────────────
type Insight = {
  emoji: string;
  title: string;
  sub?: string;
  trendDir?: "up" | "down" | "neutral";
  why: string;
  where: string;
  when: string;
  howMuch: string;
};

function deriveInsights(data: any, sym: string): Insight[] {
  if (!data) return [];
  const cats: any[] = data.by_category || [];
  const total: number = data.total || 0;
  const owed: number = data.owed_to_you || 0;
  const owing: number = data.you_owe || 0;
  const trend: any[] = data.monthly_trend || [];
  const insights: Insight[] = [];

  if (cats.length > 0) {
    const top = cats[0];
    const meta = categoryMeta[top.category] || categoryMeta.other;
    insights.push({
      emoji: meta.emoji,
      title: `${meta.label} is your top spend — ${sym}${Math.round(top.amount).toLocaleString("en-IN")}`,
      sub: `${top.percent.toFixed(0)}% of your total spending this period`,
      trendDir: "neutral",
      why: `${meta.label} accounts for ${top.percent.toFixed(0)}% of all your tracked expenses, making it the single largest spending category in this period.`,
      where: `This spending occurred across your shared groups in the ${meta.label.toLowerCase()} category.`,
      when: trend.length > 0 ? `Observed during ${trend[trend.length - 1]?.month || "this period"}.` : "Observed over your tracked period.",
      howMuch: `${sym}${Math.round(top.amount).toLocaleString("en-IN")} total, which is ${top.percent.toFixed(0)}% of ${sym}${Math.round(total).toLocaleString("en-IN")} overall spending.`,
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
        why: `Your total spending ${changePct > 0 ? "increased" : "decreased"} by ${Math.abs(changePct)}% compared to the previous month. This trend is calculated from your recorded group expenses.`,
        where: "Aggregated across all your shared expense groups.",
        when: `${trend[trend.length - 2]?.month} → ${trend[trend.length - 1]?.month}`,
        howMuch: `${sym}${Math.round(prev).toLocaleString("en-IN")} → ${sym}${Math.round(last).toLocaleString("en-IN")} (${changePct > 0 ? "+" : ""}${changePct}%)`,
      });
    }
  }

  if (owed > 0 && owing === 0) {
    insights.push({
      emoji: "✅",
      title: `+${sym}${Math.round(owed).toLocaleString("en-IN")} owed to you`,
      sub: "You're in a great position — others owe you",
      trendDir: "down",
      why: "You have paid more than your share in shared expenses, resulting in others owing you money.",
      where: "Across your active expense groups based on your settlement balances.",
      when: "Current as of your last sync.",
      howMuch: `${sym}${Math.round(owed).toLocaleString("en-IN")} net owed to you. No outstanding debts.`,
    });
  } else if (owing > 0) {
    insights.push({
      emoji: "⚡",
      title: `-${sym}${Math.round(owing).toLocaleString("en-IN")} you owe across groups`,
      sub: "Settle up to keep balances clean",
      trendDir: "up",
      why: "Others have covered expenses on your behalf. Your net balance across groups is negative.",
      where: "Distributed across your active shared expense groups.",
      when: "Current as of your last sync.",
      howMuch: `You owe ${sym}${Math.round(owing).toLocaleString("en-IN")} in total across your groups.`,
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
      why: `Your top two spending categories — ${names.join(" and ")} — dominate your expenses, accounting for ${Math.round(topTwo)}% of total spending. This level of concentration may indicate an opportunity to review your budget allocation.`,
      where: "Observed in your category breakdown for the selected period.",
      when: trend.length > 0 ? `During ${trend[trend.length - 1]?.month || "this period"}.` : "This period.",
      howMuch: `${Math.round(topTwo)}% of ${sym}${Math.round(total).toLocaleString("en-IN")} is in just two categories.`,
    });
  } else if (total > 0) {
    insights.push({
      emoji: "✨",
      title: `Total: ${sym}${Math.round(total).toLocaleString("en-IN")} across ${cats.length} categories`,
      sub: "Your spending is well distributed",
      trendDir: "neutral",
      why: "Your expenses are spread across multiple categories without any single one dominating, which indicates balanced spending habits.",
      where: `Across ${cats.length} expense categories in your groups.`,
      when: trend.length > 0 ? `During ${trend[trend.length - 1]?.month || "this period"}.` : "This period.",
      howMuch: `${sym}${Math.round(total).toLocaleString("en-IN")} total across ${cats.length} categories — well balanced.`,
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
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);

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

        {/* ── Budget tracker — animated circular rings ── */}
        <View style={{ paddingHorizontal: px, marginBottom: 24 }}>
          <SectionLabel right={
            <TouchableOpacity onPress={() => setShowBudget(true)}>
              <Text style={{ fontFamily: type.family.regular, fontSize: 11, color: c.textMuted }}>Edit</Text>
            </TouchableOpacity>
          }>
            Monthly budget
          </SectionLabel>
          <View style={{ borderTopWidth: 1, borderTopColor: `${c.border}30`, paddingTop: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-around", flexWrap: "wrap", gap: 12 }}>
              {([
                { key: "food",          label: "Food"          },
                { key: "travel",        label: "Travel"        },
                { key: "entertainment", label: "Fun"           },
              ] as { key: string; label: string }[]).map((b) => {
                const spent  = cats.find((x: any) => x.category === b.key)?.amount || 0;
                const budget = budgets[b.key] || 5000;
                return (
                  <CircularProgress key={b.key} spent={spent} budget={budget} label={b.label} sym={sym} size={96} />
                );
              })}
            </View>
          </View>
        </View>

        {/* ── AI insights ── */}
        <View style={{ paddingHorizontal: px, marginBottom: 24 }}>
          <SectionLabel right={<ProBadge />}>AI observations</SectionLabel>
          {!loading && aiInsights.length > 0 ? (
            <View style={{ borderTopWidth: 1, borderTopColor: `${c.border}30` }}>
              {aiInsights.map((ins, i) => (
                <AIInsightCard key={i} index={i} emoji={ins.emoji} title={ins.title} sub={ins.sub} trendDir={ins.trendDir} onPress={() => setSelectedInsight(ins)} />
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

      {/* ── Insight explanation modal ── */}
      <Modal visible={!!selectedInsight} transparent animationType="fade" onRequestClose={() => setSelectedInsight(null)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setSelectedInsight(null)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: c.bg, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40, borderTopWidth: 1, borderTopColor: `${c.border}40` }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ fontFamily: type.family.bold, fontSize: 17, color: c.textPrimary, lineHeight: 23 }}>
                    {selectedInsight?.title}
                  </Text>
                  {selectedInsight?.sub && (
                    <Text style={{ fontFamily: type.family.regular, fontSize: 12, color: c.textMuted, marginTop: 4 }}>
                      {selectedInsight.sub}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => setSelectedInsight(null)} style={{ padding: 4 }}>
                  <CloseIcon color={c.textMuted} size={18} />
                </TouchableOpacity>
              </View>
              <View style={{ height: 1, backgroundColor: c.border, opacity: 0.2, marginBottom: 16 }} />
              {[
                { label: "WHY", value: selectedInsight?.why },
                { label: "WHERE", value: selectedInsight?.where },
                { label: "WHEN", value: selectedInsight?.when },
                { label: "HOW MUCH", value: selectedInsight?.howMuch },
              ].map(({ label, value }) => value ? (
                <View key={label} style={{ marginBottom: 14 }}>
                  <Text style={{ fontFamily: type.family.regular, fontSize: 9, color: c.textMuted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
                    {label}
                  </Text>
                  <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textPrimary, lineHeight: 20 }}>
                    {value}
                  </Text>
                </View>
              ) : null)}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
