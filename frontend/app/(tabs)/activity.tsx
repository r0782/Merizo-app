/**
 * MERIZO Activity — Chronological Financial Journal
 * Looks like a dated ledger / notebook diary.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Platform, Animated, Easing,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useTheme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import { currencySymbol, categoryMeta, type } from "../../src/lib/tokens";
import { getDeviceLocale } from "../../src/lib/currency";
import { useCurrency } from "../../src/lib/CurrencyContext";

// ── Row entrance animation ────────────────────────────────────────────────────
function AnimRow({ children, index }: { children: React.ReactNode; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,     { toValue: 1, duration: 280, delay: 30 + index * 40, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateX,  { toValue: 0, duration: 260, delay: 30 + index * 40, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateX]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      {children}
    </Animated.View>
  );
}

// ── Journal date heading ──────────────────────────────────────────────────────
function DateHeading({ label, c }: { label: string; c: any }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
      <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase" }}>
        {label}
      </Text>
      <View style={{ height: 1, backgroundColor: c.border, opacity: 0.15, marginTop: 6 }} />
    </View>
  );
}

// ── Journal expense row ───────────────────────────────────────────────────────
function JournalRow({ item, sym, onPress, c }: any) {
  const isSettlement = item._type === "settlement";
  const meta = categoryMeta[item.category || "other"] || categoryMeta.other;
  const time = new Date(item.created_at).toLocaleTimeString(getDeviceLocale(), { hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.65}
      style={{ paddingHorizontal: 20, paddingVertical: 12 }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
        {/* Time column */}
        <View style={{ width: 44, alignItems: "flex-end", paddingTop: 1 }}>
          <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted, letterSpacing: 0.3 }}>
            {time}
          </Text>
        </View>
        {/* Vertical timeline line */}
        <View style={{ width: 1, backgroundColor: c.border, opacity: 0.15, alignSelf: "stretch", marginHorizontal: 0 }} />
        {/* Content */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontFamily: type.family.medium, fontSize: type.size.sm, color: c.textPrimary }}>
                {isSettlement ? "Settlement" : (item.name || "Expense")}
              </Text>
              <Text style={{ fontFamily: type.family.regular, fontSize: 11, color: c.textMuted, marginTop: 2 }}>
                {isSettlement ? item.tripName : `${meta.label} · ${item.tripName}`}
              </Text>
            </View>
            <Text style={{ fontFamily: type.family.semibold, fontSize: type.size.sm, color: c.textPrimary, letterSpacing: -0.3 }}>
              {isSettlement ? "+" : ""}{sym}{Math.round(item.amount || 0).toLocaleString(getDeviceLocale())}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Group items by date ───────────────────────────────────────────────────────
function groupByDate(items: any[]) {
  const groups: { label: string; items: any[] }[] = [];
  const map: Record<string, any[]> = {};

  items.forEach(item => {
    const date = new Date(item.created_at);
    const diff = Date.now() - date.getTime();
    let label: string;
    if (diff < 86400000)  label = "Today";
    else if (diff < 172800000) label = "Yesterday";
    else label = date.toLocaleDateString(getDeviceLocale(), { weekday: "long", day: "numeric", month: "long" });

    if (!map[label]) { map[label] = []; groups.push({ label, items: map[label] }); }
    map[label].push(item);
  });

  return groups;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ActivityScreen() {
  const { c } = useTheme();
  const { currency } = useCurrency();
  const sym = currencySymbol(currency);
  const [expenses,    setExpenses]    = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const load = useCallback(async () => {
    try {
      const trips = await api.get("/trips");
      const topTrips: any[] = (trips.data || []).slice(0, 5);
      const results = await Promise.all(topTrips.map(async (trip: any) => {
        try {
          const [exps, setts] = await Promise.all([api.get(`/expenses/${trip.id}`), api.get(`/settlements/${trip.id}`)]);
          return {
            expenses:    (exps.data  || []).map((e: any) => ({ ...e, tripName: trip.name, tripId: trip.id })),
            settlements: (setts.data || []).map((s: any) => ({ ...s, tripName: trip.name })),
          };
        } catch { return { expenses: [], settlements: [] }; }
      }));
      const allExp  = results.flatMap(r => r.expenses);
      const allSett = results.flatMap(r => r.settlements);
      allExp.sort( (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      allSett.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setExpenses(allExp);
      setSettlements(allSett);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const allActivity = [
    ...expenses.map(e    => ({ ...e, _type: "expense" })),
    ...settlements.map(s => ({ ...s, _type: "settlement" })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const groups = groupByDate(allActivity);
  const totalSpent = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 40, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textMuted} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>
              Journal
            </Text>
            <Text style={{ fontFamily: type.family.bold, fontSize: 28, color: c.textPrimary, letterSpacing: -1 }}>
              Activity
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted, letterSpacing: 1 }}>
              {allActivity.length} entries
            </Text>
            <Text style={{ fontFamily: type.family.semibold, fontSize: type.size.base, color: c.textPrimary, marginTop: 2 }}>
              {sym}{totalSpent.toLocaleString(getDeviceLocale())}
            </Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: c.border, opacity: 0.3, marginHorizontal: 20 }} />

        {/* ── Loading state — skeleton lines ── */}
        {loading && (
          <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 18 }}>
            {[90, 70, 85, 60, 75].map((w, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ width: `${w}%` as any, height: 13, backgroundColor: c.surfaceAlt, opacity: 0.6 + (i % 2) * 0.2 }} />
                <View style={{ width: 48, height: 13, backgroundColor: c.surfaceAlt, opacity: 0.5 }} />
              </View>
            ))}
          </View>
        )}

        {/* ── Journal entries by date ── */}
        {!loading && groups.length === 0 && (
          <View style={{ paddingHorizontal: 20, paddingTop: 40, alignItems: "center" }}>
            <Text style={{ fontFamily: type.family.light, fontSize: type.size.sm, color: c.textMuted, textAlign: "center", lineHeight: 22 }}>
              No entries yet.{"\n"}Add an expense to start your financial journal.
            </Text>
          </View>
        )}

        {!loading && groups.map((group, gi) => (
          <View key={group.label}>
            <DateHeading label={group.label} c={c} />
            {group.items.map((item, i) => (
              <AnimRow key={item.id || i} index={gi * 10 + i}>
                <JournalRow item={item} sym={sym} c={c} onPress={() => {}} />
                {i < group.items.length - 1 && (
                  <View style={{ height: 1, backgroundColor: c.border, opacity: 0.08, marginHorizontal: 78 }} />
                )}
              </AnimRow>
            ))}
          </View>
        ))}

        <View style={{ paddingHorizontal: 20, paddingTop: 32 }}>
          <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted, letterSpacing: 1.5, textAlign: "center", opacity: 0.4, textTransform: "uppercase" }}>
            End of journal
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
