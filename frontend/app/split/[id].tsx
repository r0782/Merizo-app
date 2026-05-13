import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";
import { confirmAction } from "../../src/lib/confirm";
import { GaugeDial, HybridBar } from "../../src/components/Charts";
import { AnimatedSmartNum } from "../../src/components/AnimatedSmartNum";
import {
  resolveCover,
  categoryMeta,
  currencySymbol,
  currencyOptions,
  detectCategory,
} from "../../src/lib/tokens";
import { SmartNum } from "../../src/components/DotNum";

type Tab = "ledger" | "balances" | "insights" | "members";

export default function SplitDetailScreen() {
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; tab?: string; action?: string }>();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>((params.tab as Tab) || "ledger");
  const [showAdd, setShowAdd] = useState(params.action === "add");
  const [showMember, setShowMember] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/trips/${tripId}`);
      setTrip(r.data);
    } catch (e) {
      Alert.alert("Error", "Could not load split");
    }
  }, [tripId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  if (loading || !trip) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
        <ActivityIndicator color={c.indigo} size="large" />
      </View>
    );
  }

  const cover = resolveCover(trip.destinations, trip.split_category, trip.cover_key);
  const isOwner = trip.owner_id === user?.id;

  const onShareInvite = async () => {
    try {
      const inv = await api.get(`/trips/${tripId}/invite`);
      const link = `merizo://invite/${inv.data.token}`;
      await Share.share({ message: `Join "${trip.name}" on Merizo: ${link}` });
    } catch {
      Alert.alert("Error", "Could not get invite");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Image source={{ uri: cover }} style={[StyleSheet.absoluteFill as any, { width: "100%", height: 220 }]} />
          <View style={[StyleSheet.absoluteFill as any, { backgroundColor: "rgba(0,0,0,0.35)", height: 220 }]} />
          <View style={styles.heroTop}>
            <TouchableOpacity testID="split-back" onPress={() => router.back()} style={styles.frostBtn}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity testID="split-share" onPress={onShareInvite} style={styles.frostBtn}>
                <Ionicons name="share-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity testID="split-settings" onPress={() => setShowSettings(true)} style={styles.frostBtn}>
                <Ionicons name="settings-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.heroInfo}>
            <Text style={{ color: "#fff", fontSize: 28, fontFamily: "Syne_700Bold", letterSpacing: -0.5 }}>{trip.name}</Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 4 }}>
              {trip.members.length} members{trip.start_date ? ` · ${trip.start_date}` : ""}{trip.end_date ? ` → ${trip.end_date}` : ""}
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { backgroundColor: c.surface, borderColor: c.border }]}>
          {([
            { id: "ledger",   label: "Ledger"   },
            { id: "balances", label: "Balances" },
            { id: "insights", label: "Insights" },
            { id: "members",  label: "Members"  },
          ] as { id: Tab; label: string }[]).map(({ id: t, label }) => {
            const active = tab === t;
            return (
              <TouchableOpacity
                key={t}
                testID={`tab-${t}`}
                onPress={() => setTab(t)}
                style={[
                  styles.tab,
                  { backgroundColor: active ? (isDark ? c.indigo : "#0A0A0A") : "transparent" },
                ]}
              >
                <Text style={{ color: active ? "#fff" : c.textSecondary, fontWeight: "700", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {tab === "ledger"   && <LedgerTab   trip={trip} onChange={load} userId={user?.id || ""} />}
        {tab === "balances" && <BalancesTab trip={trip} onChange={load} userId={user?.id || ""} />}
        {tab === "insights" && <InsightsTab trip={trip} />}
        {tab === "members"  && <MembersTab  trip={trip} onAdd={() => setShowMember(true)} onShare={onShareInvite} onUpdate={load} />}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        testID="split-fab"
        onPress={() => setShowAdd(true)}
        style={[styles.fab, { backgroundColor: isDark ? c.indigo : "#0A0A0A" }]}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Expense modal */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <AddExpenseSheet
          trip={trip}
          onClose={() => setShowAdd(false)}
          onAdded={async () => {
            setShowAdd(false);
            await load();
          }}
        />
      </Modal>

      {/* Add Member modal */}
      <Modal visible={showMember} animationType="slide" transparent onRequestClose={() => setShowMember(false)}>
        <AddMemberSheet
          trip={trip}
          onClose={() => setShowMember(false)}
          onAdded={async () => {
            setShowMember(false);
            await load();
          }}
        />
      </Modal>

      {/* Settings modal */}
      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <SettingsSheet
          trip={trip}
          isOwner={isOwner}
          onClose={() => setShowSettings(false)}
          onShare={onShareInvite}
          onAddMember={() => {
            setShowSettings(false);
            setShowMember(true);
          }}
          onCurrencyChanged={async () => {
            setShowSettings(false);
            await load();
          }}
          onDeleted={() => {
            setShowSettings(false);
            router.replace("/(tabs)/home");
          }}
        />
      </Modal>
    </View>
  );
}

// --- AI Overview Section (forecast / fun facts / food insight / personality) ---
function AIOverviewSection({ trip }: { trip: any }) {
  const { c, isDark } = useTheme();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const sigKey = useMemo(() => {
    return (trip.expenses || []).filter((e: any) => !e.is_settlement).length + ":" + (trip.split_category || "");
  }, [trip]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setFailed(false);
        const r = await api.get(`/trips/${trip.id}/ai/overview`);
        if (!alive) return;
        setData(r.data);
      } catch {
        if (!alive) return;
        setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [trip.id, sigKey]);

  if (failed) return null;

  const indigo = isDark ? c.indigo : "#0A0A0A";
  const indigoBg = isDark ? "rgba(124,92,255,0.16)" : "#0A0A0A";
  const personalityFg = isDark ? "#fff" : "#fff";

  const showAnything =
    loading ||
    (data && (data.forecast || data.place_facts || data.food_insight || data.personality));

  if (!showAnything) return null;

  return (
    <View style={styles.aiSection}>
      <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.6 }}>
        AI INSIGHTS
      </Text>

      {/* Forecast chip */}
      {(loading || data?.forecast) && (
        <View>
          {loading && !data?.forecast ? (
            <Skeleton style={[styles.forecastChip, { backgroundColor: c.surface, borderColor: c.border, width: 240 }]} />
          ) : (
            <View
              testID="ai-forecast-chip"
              style={[
                styles.forecastChip,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: "700", textAlign: "center" }}>
                {data.forecast.text}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Food Insight */}
      {(data?.category === "food" && (loading || data?.food_insight)) && (
        <View style={{ marginTop: 12 }}>
          {loading && !data?.food_insight ? (
            <Skeleton style={[styles.insightCard, { backgroundColor: c.surface, borderColor: c.border, height: 60 }]} />
          ) : (
            <View testID="ai-food-insight" style={[styles.insightCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={[styles.aiBadge, { backgroundColor: isDark ? "rgba(124,92,255,0.18)" : "#EEF2FF", marginRight: 10, marginLeft: 0 }]}>
                <Text style={{ color: indigo, fontSize: 9, fontWeight: "800" }}>AI</Text>
              </View>
              <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: "600", flex: 1, lineHeight: 18 }}>
                {data.food_insight.text}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Group Personality (friends category) */}
      {(data?.category === "friends" && (loading || data?.personality)) && (
        <View style={{ marginTop: 12 }}>
          {loading && !data?.personality ? (
            <Skeleton style={[styles.personalityCard, { backgroundColor: c.surface, height: 90 }]} />
          ) : (
            <View
              testID="ai-personality"
              style={[styles.personalityCard, { backgroundColor: indigoBg }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <Text style={{ fontSize: 24 }}>{data.personality.emoji}</Text>
                <Text
                  style={{
                    color: personalityFg,
                    fontSize: 18,
                    fontFamily: "Syne_700Bold",
                    marginLeft: 10,
                    flex: 1,
                  }}
                >
                  {data.personality.title}
                </Text>
              </View>
              <Text style={{ color: isDark ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.9)", fontSize: 12 }}>
                {data.personality.description}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Place Facts (trip category) */}
      {(data?.category === "trip" && (loading || data?.place_facts)) && (
        <View style={{ marginTop: 14 }}>
          <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700", marginBottom: 8 }}>
            Fun facts about {data?.place_facts?.place || "this place"}
          </Text>
          {loading && !data?.place_facts ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Skeleton style={[styles.factCard, { backgroundColor: c.surface, borderColor: c.border }]} />
              <Skeleton style={[styles.factCard, { backgroundColor: c.surface, borderColor: c.border }]} />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingRight: 24 }}
              testID="ai-place-facts"
            >
              {(data.place_facts.facts || []).map((f: string, i: number) => (
                <View
                  key={i}
                  style={[styles.factCard, { backgroundColor: c.surface, borderColor: c.border }]}
                >
                  <Text style={{ fontSize: 16 }}>📍</Text>
                  <Text
                    style={{
                      color: c.textPrimary,
                      fontSize: 13,
                      fontFamily: "Syne_500Medium",
                      lineHeight: 18,
                      marginTop: 8,
                      flex: 1,
                    }}
                  >
                    {f}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.6, marginTop: 8 }}>
                    {(data.place_facts.place || "").toUpperCase()}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

function Skeleton({ style }: { style: any }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        style,
        { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, opacity: 0.55 },
      ]}
    />
  );
}

// --- Overview Tab ---

// ═══════════════════════════════════════════════════════════════════════════════
// LEDGER TAB — chronological financial timeline
// ═══════════════════════════════════════════════════════════════════════════════
function LedgerTab({ trip, onChange, userId }: { trip: any; onChange: () => void; userId: string }) {
  const { c, isDark } = useTheme();
  const expenses: any[] = trip.expenses || [];
  const currency = trip.currency || "INR";
  const sym = currencySymbol(currency);
  const memberCount = (trip.members || []).length || 1;

  // Group by date
  const grouped: Record<string, any[]> = {};
  for (const e of [...expenses].sort((a, b) => b.date?.localeCompare(a.date ?? "") ?? 0)) {
    const day = (e.date || "").split("T")[0] || "Unknown";
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(e);
  }

  const formatDay = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).toUpperCase();
    } catch { return d; }
  };

  const deleteExpense = async (expId: string) => {
    try {
      await api.delete(`/expenses/${expId}`);
      onChange();
    } catch { Alert.alert("Error", "Could not delete"); }
  };

  if (expenses.length === 0) {
    return (
      <View style={{ padding: 48, alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 32 }}>📜</Text>
        <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: "800", letterSpacing: -0.5 }}>No entries yet</Text>
        <Text style={{ color: c.textSecondary, fontSize: 13, textAlign: "center" }}>
          Tap + to add your first expense to the ledger.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      {Object.entries(grouped).map(([day, dayExps]) => (
        <View key={day} style={{ marginBottom: 24 }}>
          {/* Date header */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12, marginTop: 8 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            <Text style={{ color: c.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 2 }}>{formatDay(day)}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
          </View>

          {dayExps.map((exp) => {
            const perPerson = Math.round(exp.amount / memberCount);
            const isYouPaid = exp.paid_by === userId || exp.paid_by_name?.toLowerCase().includes("you") || exp.paid_by_name?.toLowerCase().includes(trip.members?.[0]?.name?.toLowerCase() ?? "");
            return (
              <View key={exp.id} style={{ marginBottom: 12, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
                {/* Ledger entry header */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", padding: 14, paddingBottom: 10 }}>
                  {/* Category icon */}
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F0F0F0", alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0 }}>
                    <Text style={{ fontSize: 17 }}>{categoryMeta[exp.category]?.emoji || "💸"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: "700", letterSpacing: -0.2 }} numberOfLines={1}>
                      {exp.description || exp.name}
                    </Text>
                    <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }}>
                      {isYouPaid ? "You paid" : `Paid by ${exp.paid_by_name || "—"}`}
                    </Text>
                  </View>
                  {/* Amount */}
                  <View style={{ alignItems: "flex-end", flexShrink: 0, marginLeft: 8 }}>
                    <Text style={{ fontFamily: "RobotoMono_700Bold", fontSize: 18, color: c.textPrimary, fontVariant: ["tabular-nums"] as any }}>
                      {sym}{Math.round(exp.amount).toLocaleString("en-IN")}
                    </Text>
                    <TouchableOpacity onPress={() => Alert.alert("Delete", "Remove this expense?", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteExpense(exp.id) }])}>
                      <Ionicons name="trash-outline" size={14} color={c.textMuted} style={{ marginTop: 4 }} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Split details */}
                <View style={{ paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
                  <Text style={{ color: c.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 6 }}>
                    SPLIT EQUALLY · {sym}{perPerson.toLocaleString("en-IN")} PER PERSON
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {(trip.members || []).slice(0, 4).map((m: any, i: number) => {
                      const isPayer = m.id === exp.paid_by;
                      return (
                        <View key={m.id || i} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: isPayer ? (isDark ? "rgba(74,222,128,0.12)" : "#F0FFF4") : (isDark ? "rgba(255,255,255,0.06)" : "#F5F5F5"), borderWidth: 1, borderColor: isPayer ? (isDark ? "rgba(74,222,128,0.3)" : "#A7F3D0") : c.border }}>
                          <Text style={{ fontSize: 9 }}>{isPayer ? "✓" : "·"}</Text>
                          <Text style={{ color: isPayer ? c.positive : c.textSecondary, fontSize: 11, fontWeight: isPayer ? "700" : "400" }}>{m.name}</Text>
                        </View>
                      );
                    })}
                    {(trip.members || []).length > 4 && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
                        <Text style={{ color: c.textMuted, fontSize: 11 }}>+{(trip.members || []).length - 4} more</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ))}
      <View style={{ height: 20 }} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BALANCES TAB — who owes whom, human language with arrows
// ═══════════════════════════════════════════════════════════════════════════════
function BalancesTab({ trip, onChange, userId }: { trip: any; onChange: () => void; userId: string }) {
  const { c, isDark } = useTheme();
  const currency  = trip.currency || "INR";
  const sym       = currencySymbol(currency);
  const txns: any[] = trip.settlement_transactions || [];
  const balances: any[] = trip.balances || [];
  const total     = trip.total_spent || 0;
  const unsettled = txns.reduce((s: number, t: any) => s + (t.amount || 0), 0);

  // Group health
  const paidAmounts = balances.map((b: any) => b.paid || 0);
  const maxPaid     = Math.max(...paidAmounts, 0);
  const avgPaid     = total / Math.max(balances.length, 1);
  const isUneven    = maxPaid > avgPaid * 2;
  const isSettled   = txns.length === 0;
  const health      = isSettled ? { emoji: "🟢", label: "Fully settled", color: c.positive }
                    : isUneven  ? { emoji: "🔴", label: "Payment burden uneven", color: c.negative }
                    : { emoji: "🟡", label: "Pending settlements", color: "#F59E0B" };

  const markPaid = async (t: any) => {
    try {
      await api.post(`/trips/${trip.id}/settle`, { from_member: t.from_id, to_member: t.to_id, amount: t.amount });
      onChange();
    } catch { Alert.alert("Error", "Could not settle"); }
  };

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>

      {/* Summary row */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
        <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: c.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 1.5 }}>TOTAL SPENT</Text>
          <Text style={{ fontFamily: "RobotoMono_700Bold", fontSize: 20, color: c.textPrimary, marginTop: 4, fontVariant: ["tabular-nums"] as any }}>{sym}{Math.round(total).toLocaleString("en-IN")}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: c.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 1.5 }}>TO SETTLE</Text>
          <Text style={{ fontFamily: "RobotoMono_700Bold", fontSize: 20, color: unsettled > 0 ? c.negative : c.positive, marginTop: 4, fontVariant: ["tabular-nums"] as any }}>{sym}{Math.round(unsettled).toLocaleString("en-IN")}</Text>
        </View>
      </View>

      {/* Group health badge */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, marginBottom: 20 }}>
        <Text style={{ fontSize: 16 }}>{health.emoji}</Text>
        <View>
          <Text style={{ color: health.color, fontSize: 12, fontWeight: "700" }}>{health.label}</Text>
          <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 1 }}>
            {isSettled ? "Everyone is square." : `${txns.length} payment${txns.length !== 1 ? "s" : ""} will fully balance the group.`}
          </Text>
        </View>
      </View>

      {/* Settlement rows */}
      {txns.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 32, gap: 10 }}>
          <Ionicons name="checkmark-circle" size={44} color={c.positive} />
          <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: "800" }}>All settled up!</Text>
          <Text style={{ color: c.textSecondary, fontSize: 13 }}>No outstanding balances.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={{ color: c.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 2, marginBottom: 4 }}>WHO OWES WHOM</Text>
          {txns.map((t: any, i: number) => {
            const youPay     = t.from_id === userId;
            const youReceive = t.to_id === userId;
            return (
              <View key={i} style={{ backgroundColor: c.surface, borderRadius: 14, borderWidth: 1.5, borderColor: youPay ? c.negative + "50" : youReceive ? c.positive + "50" : c.border, padding: 14 }}>
                {/* Arrow row */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  {/* From */}
                  <View style={{ alignItems: "center", minWidth: 60 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#F0F0F0", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>{t.from_name?.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={{ color: youPay ? c.negative : c.textPrimary, fontSize: 11, fontWeight: "700", marginTop: 4 }} numberOfLines={1}>{youPay ? "You" : t.from_name}</Text>
                  </View>
                  {/* Arrow */}
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1, height: 1.5, borderTopWidth: 1.5, borderTopColor: youPay ? c.negative : youReceive ? c.positive : c.textMuted, borderStyle: "dashed" }} />
                    <Ionicons name="arrow-forward" size={16} color={youPay ? c.negative : youReceive ? c.positive : c.textMuted} />
                  </View>
                  {/* To */}
                  <View style={{ alignItems: "center", minWidth: 60 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#F0F0F0", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>{t.to_name?.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={{ color: youReceive ? c.positive : c.textPrimary, fontSize: 11, fontWeight: "700", marginTop: 4 }} numberOfLines={1}>{youReceive ? "You" : t.to_name}</Text>
                  </View>
                </View>
                {/* Amount + action */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: "RobotoMono_700Bold", fontSize: 20, color: youPay ? c.negative : youReceive ? c.positive : c.textPrimary, fontVariant: ["tabular-nums"] as any }}>
                    {sym}{Math.round(t.amount).toLocaleString("en-IN")}
                  </Text>
                  <TouchableOpacity onPress={() => markPaid(t)} style={{ backgroundColor: isDark ? c.indigo : "#0A0A0A", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 }}>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Mark Settled</Text>
                  </TouchableOpacity>
                </View>
                {youPay && <Text style={{ color: c.negative, fontSize: 11, marginTop: 6 }}>You owe this amount</Text>}
                {youReceive && <Text style={{ color: c.positive, fontSize: 11, marginTop: 6 }}>You will receive this amount</Text>}
              </View>
            );
          })}
        </View>
      )}

      {/* Per-member breakdown */}
      {balances.length > 0 && (
        <View style={{ marginTop: 24, gap: 8 }}>
          <Text style={{ color: c.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 2, marginBottom: 4 }}>PER MEMBER SUMMARY</Text>
          {balances.map((b: any) => (
            <View key={b.member_id || b.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.border }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F0F0F0", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                <Text style={{ color: c.textPrimary, fontSize: 12, fontWeight: "700" }}>{b.name?.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: "600" }}>{b.name}</Text>
                <Text style={{ color: c.textMuted, fontSize: 10, marginTop: 1 }}>Paid {sym}{Math.round(b.paid || 0).toLocaleString("en-IN")}</Text>
              </View>
              <Text style={{ fontFamily: "RobotoMono_700Bold", fontSize: 15, color: (b.net || 0) > 0.5 ? c.positive : (b.net || 0) < -0.5 ? c.negative : c.textMuted, fontVariant: ["tabular-nums"] as any }}>
                {(b.net || 0) >= 0 ? "+" : ""}{sym}{Math.round(Math.abs(b.net || 0)).toLocaleString("en-IN")}
              </Text>
            </View>
          ))}
        </View>
      )}
      <View style={{ height: 40 }} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSIGHTS TAB — AI financial storytelling
// ═══════════════════════════════════════════════════════════════════════════════
function InsightsTab({ trip }: { trip: any }) {
  const { c, isDark } = useTheme();
  const currency = trip.currency || "INR";
  const sym      = currencySymbol(currency);
  const total    = trip.total_spent || 0;
  const balances = trip.balances || [];
  const txns     = trip.settlement_transactions || [];

  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.get("/trips/" + trip.id + "/ai-report")
      .then(r => setInsights(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [trip.id]);

  // Compute local stats
  const topPayer    = [...balances].sort((a: any, b: any) => (b.paid || 0) - (a.paid || 0))[0];
  const categories  = trip.by_category || {};
  const topCatKey   = Object.keys(categories).sort((a, b) => categories[b] - categories[a])[0];
  const topCatPct   = topCatKey && total > 0 ? Math.round(categories[topCatKey] / total * 100) : 0;
  const catLabel    = { food: "Food & Dining", trip: "Travel", home: "Home", friends: "Events", shopping: "Shopping", bills: "Bills", other: "Other" };

  // Group health
  const maxPaid  = Math.max(...balances.map((b: any) => b.paid || 0), 0);
  const avgPaid  = total / Math.max(balances.length, 1);
  const isUneven = maxPaid > avgPaid * 2;
  const health   = txns.length === 0
    ? { emoji: "🟢", label: "Fully settled", detail: "Everyone is square. Great job!", color: c.positive }
    : isUneven
    ? { emoji: "🔴", label: "Payment burden uneven", detail: `${topPayer?.name} has covered disproportionately more than others.`, color: c.negative }
    : { emoji: "🟡", label: "Pending settlements", detail: `${txns.length} payment${txns.length !== 1 ? "s" : ""} needed to fully balance the group.`, color: "#F59E0B" };

  const staticInsights = [
    topPayer && `${topPayer.name} covered the most — ${sym}${Math.round(topPayer.paid || 0).toLocaleString("en-IN")} paid.`,
    topCatKey && `${catLabel[topCatKey as keyof typeof catLabel] || topCatKey} is ${topCatPct}% of total spending.`,
    txns.length === 0 ? "The group is fully balanced — no payments needed." : `${txns.length} settlement${txns.length !== 1 ? "s" : ""} will clear all balances.`,
    `Average spend per person: ${sym}${Math.round(total / Math.max(balances.length, 1)).toLocaleString("en-IN")}.`,
  ].filter(Boolean) as string[];

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 16 }}>

      {/* AI Summary */}
      <View style={{ backgroundColor: isDark ? "rgba(124,92,255,0.1)" : "#F5F3FF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: isDark ? "rgba(124,92,255,0.25)" : "#E0D9FF" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Ionicons name="sparkles" size={16} color={isDark ? c.indigo : "#6D28D9"} />
          <Text style={{ color: isDark ? c.indigo : "#6D28D9", fontSize: 11, fontWeight: "700", letterSpacing: 1.5 }}>AI FINANCIAL SUMMARY</Text>
        </View>
        {loading ? (
          <View style={{ height: 40, borderRadius: 8, backgroundColor: c.border, opacity: 0.4 }} />
        ) : (
          <Text style={{ color: c.textPrimary, fontSize: 14, lineHeight: 22 }}>
            {insights?.summary || staticInsights[0] || "Loading financial analysis..."}
          </Text>
        )}
      </View>

      {/* Group Health */}
      <View style={{ backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border }}>
        <Text style={{ color: c.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 2, marginBottom: 12 }}>GROUP HEALTH</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 24 }}>{health.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: health.color, fontSize: 14, fontWeight: "800" }}>{health.label}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 18 }}>{health.detail}</Text>
          </View>
        </View>
      </View>

      {/* Key insights */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: c.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 2 }}>KEY INSIGHTS</Text>
        {(insights?.recommendations || staticInsights).slice(0, 5).map((ins: string, i: number) => (
          <View key={i} style={{ flexDirection: "row", gap: 10, backgroundColor: c.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ color: isDark ? c.indigo : "#6D28D9", fontSize: 14 }}>✦</Text>
            <Text style={{ color: c.textPrimary, fontSize: 13, lineHeight: 20, flex: 1 }}>{ins}</Text>
          </View>
        ))}
      </View>

      {/* Smart settlement */}
      {txns.length > 0 && (
        <View style={{ backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: c.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 2, marginBottom: 12 }}>SMART SETTLEMENT</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, marginBottom: 12 }}>
            To settle the group in the fewest transactions ({txns.length}):
          </Text>
          {txns.map((t: any, i: number) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: i < txns.length - 1 ? 1 : 0, borderBottomColor: c.border }}>
              <Text style={{ color: c.textPrimary, fontSize: 13 }}>
                <Text style={{ fontWeight: "700" }}>{t.from_name}</Text>
                <Text style={{ color: c.textMuted }}> → </Text>
                <Text style={{ fontWeight: "700" }}>{t.to_name}</Text>
              </Text>
              <Text style={{ fontFamily: "RobotoMono_700Bold", fontSize: 13, color: c.textPrimary, fontVariant: ["tabular-nums"] as any }}>
                {sym}{Math.round(t.amount).toLocaleString("en-IN")}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Savings score */}
      {insights?.savings_score != null && (
        <View style={{ backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border, alignItems: "center" }}>
          <Text style={{ color: c.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 2 }}>FINANCIAL SCORE</Text>
          <Text style={{ fontFamily: "RobotoMono_700Bold", fontSize: 48, fontWeight: "900", color: insights.savings_score >= 70 ? c.positive : insights.savings_score >= 40 ? "#F59E0B" : c.negative, marginTop: 4 }}>
            {insights.savings_score}
          </Text>
          <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 2 }}>{insights.savings_label}</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </View>
  );
}


function OverviewTab({ trip }: { trip: any }) {
  const { c, isDark } = useTheme();
  const total = trip.total_spent || 0;
  const budget = trip.budget;
  const pct = budget && budget > 0 ? Math.min(100, (total / budget) * 100) : 50;
  const currency = trip.currency || "INR";

  const cats = Object.entries(trip.by_category || {}).map(([k, v]: any) => ({
    category: k,
    amount: v as number,
    percent: total > 0 ? ((v as number) / total) * 100 : 0,
  })).sort((a: any, b: any) => b.amount - a.amount);

  return (
    <View style={{ padding: 24 }}>
      <View style={{ alignItems: "center" }}>
        {(() => {
          const pctColor: "green" | "gold" | "red" | "black" = isDark
            ? pct >= 80 ? "red" : pct >= 50 ? "gold" : "green"
            : "black";
          return (
            <GaugeDial percent={pct} size={220}>
              <SmartNum value={`${pct.toFixed(0)}%`} size="xl" color={pctColor} />
              <View style={{ marginTop: 6 }}>
                <AnimatedSmartNum
                  value={`${currencySymbol(currency)}${Math.round(total).toLocaleString("en-IN")}`}
                  size="md"
                  color={isDark ? "indigo" : "black"}
                  duration={100}
                />
              </View>
            </GaugeDial>
          );
        })()}  
        {budget && (
          <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 8 }}>
            Budget {currencySymbol(currency)}{budget.toLocaleString("en-IN")}
          </Text>
        )}
      </View>

      {/* Member balances */}
      <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.6, marginTop: 28 }}>
        BALANCES
      </Text>
      <View style={{ marginTop: 12, gap: 10 }}>
        {(trip.balances || []).map((b: any) => {
          return (
            <View key={b.member_id} style={[styles.balRow, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>{b.name}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 2 }}>
                  Paid {currencySymbol(currency)}{Math.round(b.paid).toLocaleString("en-IN")} · Share {currencySymbol(currency)}{Math.round(b.share).toLocaleString("en-IN")}
                </Text>
              </View>
              <AnimatedSmartNum 
                value={`${currencySymbol(currency)}${Math.round(Math.abs(b.net)).toLocaleString("en-IN")}`}
                size="lg"
                color={b.net > 0.5 ? "green" : b.net < -0.5 ? "red" : "black"}
                duration={100}
              />
            </View>
          );
        })}
      </View>

      {/* AI Insights — Forecast / Place Facts / Food Insight / Personality (above categories so it's visible without scrolling) */}
      <AIOverviewSection trip={trip} />

      {/* Category breakdown */}
      {cats.length > 0 && (
        <>
          <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.6, marginTop: 28 }}>
            CATEGORIES
          </Text>
          <View style={{ marginTop: 12, gap: 8 }}>
            {cats.map((cc: any) => {
              const meta = categoryMeta[cc.category] || categoryMeta.other;
              return (
                <View
                  key={cc.category}
                  style={[styles.balRow, { backgroundColor: c.surface, borderColor: c.border }]}
                >
                  <View style={[styles.catEmojiSm, { backgroundColor: meta.tint + "22" }]}>
                    <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: "700" }}>{meta.label}</Text>
                      <AnimatedSmartNum
                        value={`${currencySymbol(currency)}${Math.round(cc.amount).toLocaleString("en-IN")}`}
                        size="md"
                        color={isDark ? "indigo" : "black"}
                        duration={100}
                      />
                    </View>
                    <HybridBar
                      percent={cc.percent}
                      accent={isDark ? c.indigo : "#0A0A0A"}
                      muted={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}
                      width={200}
                      height={5}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

// --- Expenses Tab ---
function ExpensesTab({ trip, onChange }: { trip: any; onChange: () => void }) {
  const { c, isDark } = useTheme();
  const [search, setSearch] = useState("");
  const allExpenses = (trip.expenses || []).filter((e: any) => !e.is_settlement).slice().reverse();
  const currency = trip.currency || "INR";
  const memberMap = new Map((trip.members || []).map((m: any) => [m.id, m.name]));

  const expenses = search.trim()
    ? allExpenses.filter((e: any) =>
        (e.name || e.description || "").toLowerCase().includes(search.toLowerCase()) ||
        String(e.amount).includes(search)
      )
    : allExpenses;

  const onDelete = async (eid: string) => {
    const ok = await confirmAction("Delete expense?", "This cannot be undone.", "Delete", true);
    if (!ok) return;
    try {
      await api.delete(`/expenses/${eid}`);
      onChange();
    } catch {
      Alert.alert("Error", "Could not delete");
    }
  };

  const onExportCSV = async () => {
    try {
      const base = process.env.EXPO_PUBLIC_BACKEND_URL || "";
      const token = await import("../../src/lib/api").then((m) => m.getToken());
      const url = `${base}/api/trips/${trip.id}/export/csv`;
      // On mobile open in browser; on web trigger download
      await import("expo-web-browser").then((wb) =>
        wb.openBrowserAsync(url + `?token=${token}`)
      );
    } catch {
      Alert.alert("Export", "Open your browser to download the CSV.");
    }
  };

  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 16, gap: 10 }}>
      {/* Search + Export row */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 4 }}>
        <View style={[styles.searchBox, { backgroundColor: c.surface, borderColor: c.border, flex: 1 }]}>
          <Ionicons name="search-outline" size={16} color={c.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search expenses…"
            placeholderTextColor={c.textMuted}
            style={{ flex: 1, color: c.textPrimary, fontSize: 13, marginLeft: 8 }}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={c.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={onExportCSV}
          style={[styles.exportBtn, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Ionicons name="download-outline" size={18} color={isDark ? c.indigo : "#0A0A0A"} />
        </TouchableOpacity>
      </View>

      {expenses.length === 0 ? (
        <View style={{ padding: 32, alignItems: "center" }}>
          <Text style={{ color: c.textSecondary, fontSize: 14 }}>
            {search ? "No matching expenses" : "No expenses yet"}
          </Text>
          {!search && (
            <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: "700", marginTop: 8 }}>
              Tap + to add one
            </Text>
          )}
        </View>
      ) : (
        expenses.map((exp: any) => (
          <View key={exp.id} style={[styles.expRow, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={[styles.expEmoji, { backgroundColor: c.bg }]}>
              <Text style={{ fontSize: 20 }}>{exp.emoji || "💸"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>
                {exp.name || exp.description || "Expense"}
              </Text>
              <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 2 }}>
                {String(memberMap.get(exp.paid_by) || "—")}
                {exp.date ? ` · ${String(exp.date).slice(0, 10)}` : ""}
              </Text>
            </View>
            <AnimatedSmartNum
              value={`${currencySymbol(currency)}${Math.round(exp.amount).toLocaleString("en-IN")}`}
              size="lg"
              color={isDark ? "indigo" : "black"}
              duration={100}
            />
            <TouchableOpacity
              testID={`del-exp-${exp.id}`}
              onPress={() => onDelete(exp.id)}
              style={{ marginLeft: 8, padding: 6 }}
            >
              <Ionicons name="trash-outline" size={18} color={c.textMuted} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

// --- Members Tab ---
// --- Members Tab ---
function MembersTab({ trip, onAdd, onShare, onUpdate }: { trip: any; onAdd: () => void; onShare: () => void; onUpdate: () => Promise<void> }) {
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteMember = async (memberId: string, memberName: string) => {
    Alert.alert(
      "Remove Member",
      `Remove ${memberName} from this group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          onPress: async () => {
            setDeletingId(memberId);
            try {
              await api.delete(`/trips/${trip.id}/members/${memberId}`);
              
              // Reload trip data
              await onUpdate();
              
              Alert.alert("Success", `${memberName} has been removed`);
            } catch (e: any) {
              console.error("Delete error:", e);
              const errorMsg = e.response?.data?.detail || "Failed to remove member";
              Alert.alert("Error", errorMsg);
            } finally {
              setDeletingId(null);
            }
          },
          style: "destructive",
        },
      ]
    );
  };

  return (
    <View style={{ padding: 24, gap: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: "700" }}>
          {trip.members.length} members
        </Text>
        <TouchableOpacity
          testID="member-add"
          onPress={onAdd}
          style={[styles.smallBtn, { backgroundColor: isDark ? c.indigo : "#0A0A0A" }]}
        >
          <Ionicons name="person-add-outline" size={14} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", marginLeft: 6 }}>
            Add Member
          </Text>
        </TouchableOpacity>
      </View>

      {/* Members List */}
      <View style={{ gap: 10 }}>
        {trip.members.map((m: any) => (
          <View
            key={m.id}
            style={[
              styles.memberRow,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
                opacity: deletingId === m.id ? 0.6 : 1,
              },
            ]}
          >
            {/* Avatar */}
            <View style={[styles.avatarSm, { backgroundColor: isDark ? c.indigo : "#0A0A0A" }]}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>
                {m.name.charAt(0).toUpperCase()}
              </Text>
            </View>

            {/* Name */}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>
                {m.name}
              </Text>
            </View>

            {/* Delete Button - Only for owner, not self */}
            {trip.owner_id === user?.id && m.id !== user?.id && (
              <TouchableOpacity
                testID={`delete-member-${m.id}`}
                disabled={deletingId === m.id}
                onPress={() => deleteMember(m.id, m.name)}
                style={{ padding: 8, opacity: deletingId === m.id ? 0.5 : 1 }}
              >
                {deletingId === m.id ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                )}
              </TouchableOpacity>
            )}

            {/* Badge */}
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: m.registered
                    ? isDark
                      ? "rgba(124,92,255,0.18)"
                      : "#EEF2FF"
                    : c.bg,
                },
              ]}
            >
              <Text
                style={{
                  color: m.registered ? c.indigo : c.textSecondary,
                  fontSize: 10,
                  fontWeight: "700",
                  letterSpacing: 0.5,
                }}
              >
                {m.registered ? "REGISTERED" : "GUEST"}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Invite Button */}
      <TouchableOpacity
        testID="member-invite"
        onPress={onShare}
        style={[styles.inviteBtn, { borderColor: c.border, backgroundColor: c.surface }]}
      >
        <Ionicons name="link-outline" size={18} color={c.textPrimary} />
        <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700", marginLeft: 8 }}>
          Invite via link
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// --- Settle Tab ---
function SettleTab({ trip, onChange }: { trip: any; onChange: () => void }) {
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const txns = trip.settlement_transactions || [];
  const currency = trip.currency || "INR";

  const markPaid = async (t: any) => {
    try {
      await api.post(`/trips/${trip.id}/settle`, {
        from_member: t.from_id,
        to_member: t.to_id,
        amount: t.amount,
      });
      onChange();
    } catch {
      Alert.alert("Error", "Could not settle");
    }
  };

  if (txns.length === 0) {
    return (
      <View style={{ padding: 40, alignItems: "center" }}>
        <Ionicons name="checkmark-circle" size={48} color={c.positive} />
        <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: "800", marginTop: 12 }}>All settled up!</Text>
        <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 6, textAlign: "center" }}>
          No outstanding balances in this group.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 24, gap: 10 }}>
      <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.6 }}>SUGGESTED SETTLEMENTS</Text>
      {txns.map((t: any, i: number) => (
        <View key={i} style={[styles.settleRow, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>
              {t.from_name} → {t.to_name}
            </Text>
            <View style={{ marginTop: 6 }}>
              {(() => {
                const settleColor: "red" | "green" | "indigo" | "black" = isDark
                  ? t.from_id === user?.id ? "red"
                    : t.to_id === user?.id ? "green"
                    : "indigo"
                  : "black";
                return (
                  <AnimatedSmartNum
                    value={`${currencySymbol(currency)}${Math.round(t.amount).toLocaleString("en-IN")}`}
                    size="lg"
                    color={settleColor}
                    duration={100}
                  />
                );
              })()}
            </View>
          </View>
          <TouchableOpacity
            testID={`mark-paid-${i}`}
            onPress={() => markPaid(t)}
            style={[styles.markPaidBtn, { backgroundColor: isDark ? c.indigo : "#0A0A0A" }]}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Mark Paid</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// --- Add Expense bottom sheet ---
function AddExpenseSheet({ trip, onClose, onAdded }: any) {
  const { c, isDark } = useTheme();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(trip.currency || "INR");
  const [paidBy, setPaidBy] = useState(trip.members[0]?.id || "");
  const [splitAmong, setSplitAmong] = useState<string[]>(trip.members.map((m: any) => m.id));
  const [submitting, setSubmitting] = useState(false);
  const [showUpi, setShowUpi] = useState(false);
  const [upiText, setUpiText] = useState("");
  const [upiLoading, setUpiLoading] = useState(false);
  const [upiFilled, setUpiFilled] = useState<{ name: boolean; amount: boolean; category: boolean }>({
    name: false,
    amount: false,
    category: false,
  });
  const [manualCat, setManualCat] = useState<string | null>(null);

  // Auto-tag — runs as user types unless they manually picked
  const autoCat = manualCat || detectCategory(name);
  const cat = autoCat;
  const meta = categoryMeta[cat] || categoryMeta.other;

  const toggleMember = (id: string) => {
    setSplitAmong((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  };

  const onSubmit = async () => {
    const amt = parseFloat(amount);
    if (!name.trim() || isNaN(amt) || amt <= 0) {
      Alert.alert("Invalid", "Please enter a name and amount.");
      return;
    }
    if (splitAmong.length === 0) {
      Alert.alert("Invalid", "Pick at least one person to split among.");
      return;
    }
    setSubmitting(true);
    try {
      // Subscription conflict warning (frontend keyword check, no AI)
      const subKeys = ["netflix", "spotify", "disney", "prime", "youtube"];
      const memberCount = trip.members.length;
      const lower = name.trim().toLowerCase();
      const matchedSub = subKeys.find((k) => lower.includes(k));
      const subLimits: Record<string, number> = {
        netflix: 2,
        spotify: 1,
        disney: 4,
        prime: 3,
        youtube: 6,
      };
      if (matchedSub && memberCount > (subLimits[matchedSub] || 2)) {
        const limit = subLimits[matchedSub] || 2;
        const cap = matchedSub.charAt(0).toUpperCase() + matchedSub.slice(1);
        Alert.alert(
          "Heads up",
          `${cap} typically supports ${limit} screens — splitting among ${memberCount} people may cause issues 📺`,
          [{ text: "OK" }]
        );
      }

      const r = await api.post(`/trips/${trip.id}/expenses`, {
        name: name.trim(),
        amount: amt,
        currency,
        category: cat,
        emoji: meta.emoji,
        paid_by: paidBy,
        split_among: splitAmong,
      });

      // Recurring expense detector toast (Home category)
      const suggestion = r.data?.recurring_suggestion;
      if (suggestion) {
        Alert.alert(
          "Looks like a recurring expense",
          `Want to set a monthly reminder for "${suggestion.name}"?`,
          [
            { text: "No", style: "cancel" },
            {
              text: "Yes",
              onPress: async () => {
                try {
                  const due = new Date();
                  due.setMonth(due.getMonth() + 1);
                  await api.post("/reminders", {
                    title: `Recurring: ${suggestion.name}`,
                    amount: amt,
                    due_date: due.toISOString().slice(0, 10),
                    trip_id: trip.id,
                  });
                } catch {}
              },
            },
          ]
        );
      }

      onAdded();
    } catch (e: any) {
      Alert.alert("Error", "Could not add expense");
    } finally {
      setSubmitting(false);
    }
  };

  const onParseUpi = async () => {
    if (!upiText.trim()) {
      Alert.alert("Paste a message", "Paste your UPI / SMS text first.");
      return;
    }
    setUpiLoading(true);
    try {
      const r = await api.post("/expenses/parse-upi", { text: upiText });
      const d = r.data;
      const filled = { name: false, amount: false, category: false };
      if (d.merchant) {
        setName(d.merchant);
        filled.name = true;
      }
      if (d.amount && d.amount > 0) {
        setAmount(String(d.amount));
        filled.amount = true;
      }
      if (d.category) {
        setManualCat(d.category);
        filled.category = true;
      }
      if (d.currency) setCurrency(d.currency);
      setUpiFilled(filled);
      setShowUpi(false);
      setUpiText("");
    } catch (e: any) {
      Alert.alert("Could not parse", "Please type the expense manually.");
    } finally {
      setUpiLoading(false);
    }
  };

  const onChangeName = (t: string) => {
    setName(t);
    if (upiFilled.name) setUpiFilled((f) => ({ ...f, name: false }));
    // user is typing — clear manual category override so auto-tag kicks back in
    if (manualCat && !upiFilled.category) setManualCat(null);
  };

  const onChangeAmount = (t: string) => {
    setAmount(t.replace(/[^0-9.]/g, ""));
    if (upiFilled.amount) setUpiFilled((f) => ({ ...f, amount: false }));
  };

  const allSelected = splitAmong.length === trip.members.length;
  const toggleAll = () => {
    if (allSelected) setSplitAmong([]);
    else setSplitAmong(trip.members.map((m: any) => m.id));
  };

  const indigo = isDark ? c.indigo : "#0A0A0A";
  const aiHighlight = isDark ? "rgba(124,92,255,0.45)" : c.indigo;

  return (
    <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.bg, borderColor: c.border }]}>
        <View style={styles.sheetHandle}>
          <View style={[styles.handleBar, { backgroundColor: c.textMuted }]} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 }}>
            <Text style={{ color: c.textPrimary, fontSize: 22, fontFamily: "Syne_700Bold" }}>Add expense</Text>
            <TouchableOpacity onPress={onClose} testID="add-exp-close">
              <Ionicons name="close" size={24} color={c.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Paste UPI button */}
          <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
            <TouchableOpacity
              testID="add-exp-paste-upi"
              onPress={() => setShowUpi(true)}
              style={[styles.upiBtn, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <Text style={{ fontSize: 16 }}>📋</Text>
              <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: "700", marginLeft: 8 }}>
                Paste UPI Message
              </Text>
              <View style={[styles.aiBadge, { backgroundColor: isDark ? "rgba(124,92,255,0.18)" : "#EEF2FF" }]}>
                <Text style={{ color: indigo, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }}>AI</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Name field */}
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>NAME</Text>
            <TextInput
              testID="add-exp-name"
              value={name}
              onChangeText={onChangeName}
              placeholder="What is this for?"
              placeholderTextColor={c.textMuted}
              style={[
                styles.input,
                {
                  backgroundColor: c.surface,
                  borderColor: upiFilled.name ? aiHighlight : c.border,
                  borderWidth: upiFilled.name ? 1.5 : 1,
                  color: c.textPrimary,
                },
              ]}
            />
            {/* Auto-tag chip */}
            {(name.length > 0 || manualCat) && (
              <View style={{ flexDirection: "row", marginTop: 8, alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <View
                  testID="add-exp-cat-chip"
                  style={[
                    styles.catTag,
                    {
                      backgroundColor: meta.tint + "22",
                      borderColor: upiFilled.category ? aiHighlight : meta.tint + "55",
                      borderWidth: upiFilled.category ? 1.5 : 1,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 13 }}>{meta.emoji}</Text>
                  <Text style={{ color: c.textPrimary, fontSize: 11, fontWeight: "700", marginLeft: 5 }}>
                    {meta.label}
                  </Text>
                </View>
                <Text style={{ color: c.textMuted, fontSize: 10 }}>
                  {upiFilled.category ? "(AI)" : "(auto · tap to change)"}
                </Text>
              </View>
            )}
            {/* Category override picker */}
            {(name.length > 0 || manualCat) && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, marginTop: 8 }}
              >
                {Object.entries(categoryMeta)
                  .filter(([k]) => k !== "settlement" && k !== "other")
                  .map(([k, m]) => {
                    const active = cat === k;
                    return (
                      <TouchableOpacity
                        key={k}
                        testID={`add-exp-cat-${k}`}
                        onPress={() => {
                          setManualCat(k);
                          if (upiFilled.category) setUpiFilled((f) => ({ ...f, category: false }));
                        }}
                        style={[
                          styles.catPick,
                          {
                            backgroundColor: active ? m.tint + "22" : c.surface,
                            borderColor: active ? m.tint : c.border,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 12 }}>{m.emoji}</Text>
                        <Text style={{ color: c.textPrimary, fontSize: 10, fontWeight: "700", marginLeft: 4 }}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            )}
          </View>

          {/* Amount field — full width with currency pill on the label row */}
          <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={[styles.fieldLabel, { color: c.textSecondary, marginBottom: 0 }]}>AMOUNT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {currencyOptions.slice(0, 8).map((cur) => {
                  const active = currency === cur;
                  return (
                    <TouchableOpacity
                      key={cur}
                      testID={`add-exp-cur-${cur}`}
                      onPress={() => setCurrency(cur)}
                      style={[
                        styles.curMini,
                        {
                          backgroundColor: active ? indigo : c.surface,
                          borderColor: active ? "transparent" : c.border,
                        },
                      ]}
                    >
                      <Text style={{ color: active ? "#fff" : c.textPrimary, fontSize: 11, fontWeight: "700" }}>
                        {cur}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            <View
              style={[
                styles.amountInputWrap,
                {
                  backgroundColor: c.surface,
                  borderColor: upiFilled.amount ? aiHighlight : c.border,
                  borderWidth: upiFilled.amount ? 1.5 : 1,
                },
              ]}
            >
              <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: "900", marginRight: 6 }}>
                {currencySymbol(currency)}
              </Text>
              <TextInput
                testID="add-exp-amount"
                value={amount}
                onChangeText={onChangeAmount}
                placeholder="0.00"
                placeholderTextColor={c.textMuted}
                keyboardType="decimal-pad"
                style={{
                  flex: 1,
                  fontSize: 22,
                  fontWeight: "800",
                  color: c.textPrimary,
                  padding: 0,
                  minWidth: 60,
                }}
              />
            </View>
          </View>

          {/* Paid by */}
          <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
            <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>PAID BY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {trip.members.map((m: any) => {
                const active = paidBy === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    testID={`add-exp-payer-${m.id}`}
                    onPress={() => setPaidBy(m.id)}
                    style={[styles.payerChip, { backgroundColor: active ? indigo : c.surface, borderColor: c.border }]}
                  >
                    <Text style={{ color: active ? "#fff" : c.textPrimary, fontSize: 12, fontWeight: "700" }}>{m.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Split among */}
          <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.fieldLabel, { color: c.textSecondary, marginBottom: 0 }]}>SPLIT AMONG</Text>
              <TouchableOpacity testID="add-exp-toggle-all" onPress={toggleAll}>
                <Text style={{ color: indigo, fontSize: 12, fontWeight: "700" }}>
                  {allSelected ? "Clear all" : "Select all"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 8, gap: 8 }}>
              {trip.members.map((m: any) => {
                const checked = splitAmong.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    testID={`add-exp-split-${m.id}`}
                    onPress={() => toggleMember(m.id)}
                    style={[styles.splitRow, { backgroundColor: c.surface, borderColor: c.border }]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: checked ? indigo : "transparent",
                          borderColor: checked ? "transparent" : c.border,
                        },
                      ]}
                    >
                      {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "600", marginLeft: 12 }}>{m.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              testID="add-exp-submit"
              disabled={submitting}
              onPress={onSubmit}
              style={[styles.primaryBtn, { backgroundColor: indigo, marginTop: 22, opacity: submitting ? 0.7 : 1 }]}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Add expense</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* UPI Parser Modal */}
      <Modal visible={showUpi} animationType="fade" transparent onRequestClose={() => setShowUpi(false)}>
        <View style={[styles.modalRoot, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
          <View style={[styles.upiModal, { backgroundColor: c.bg, borderColor: c.border }]}>
            <Text style={{ color: c.textPrimary, fontSize: 18, fontFamily: "Syne_700Bold" }}>
              Paste your UPI message
            </Text>
            <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 4 }}>
              AI will fill the fields for you. You can edit before saving.
            </Text>
            <TextInput
              testID="upi-text"
              value={upiText}
              onChangeText={setUpiText}
              multiline
              autoFocus
              placeholder="e.g. Rs 350 debited to Swiggy on 02 May…"
              placeholderTextColor={c.textMuted}
              style={[
                styles.upiInput,
                { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary },
              ]}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                testID="upi-cancel"
                onPress={() => setShowUpi(false)}
                style={[styles.upiBtnSecondary, { borderColor: c.border, backgroundColor: c.surface }]}
              >
                <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="upi-parse"
                onPress={onParseUpi}
                disabled={upiLoading}
                style={[styles.upiBtnPrimary, { backgroundColor: indigo, opacity: upiLoading ? 0.6 : 1 }]}
              >
                {upiLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Parse with AI</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// --- Add Member sheet ---
function AddMemberSheet({ trip, onClose, onAdded }: any) {
  const { c, isDark } = useTheme();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/trips/${trip.id}/members`, { name: name.trim() });
      onAdded();
    } catch {
      Alert.alert("Error", "Could not add member");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.bg, borderColor: c.border, maxHeight: 480 }]}>
        <View style={styles.sheetHandle}>
          <View style={[styles.handleBar, { backgroundColor: c.textMuted }]} />
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: c.textPrimary, fontSize: 22, fontFamily: "Syne_700Bold" }}>Add member</Text>
          <TextInput
            testID="add-member-name"
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor={c.textMuted}
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary, marginTop: 14 }]}
          />
          <TouchableOpacity
            testID="add-member-submit"
            onPress={onSubmit}
            disabled={submitting}
            style={[styles.primaryBtn, { backgroundColor: isDark ? c.indigo : "#0A0A0A", marginTop: 18 }]}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Add</Text>}
          </TouchableOpacity>

          <View style={{ marginTop: 22, gap: 8 }}>
            <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>CURRENT MEMBERS</Text>
            {trip.members.map((m: any) => (
              <View key={m.id} style={[styles.memberRow, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={[styles.avatarSm, { backgroundColor: isDark ? c.indigo : "#0A0A0A" }]}>
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>{m.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "600", marginLeft: 10, flex: 1 }}>{m.name}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// --- Settings sheet ---
function SettingsSheet({ trip, isOwner: _isOwner, onClose, onShare, onAddMember, onDeleted, onCurrencyChanged }: any) {
  const { c } = useTheme();
  const [showCur, setShowCur] = useState(false);

  const onDelete = async () => {
    const ok = await confirmAction(
      "Are you sure?",
      "This cannot be undone.",
      "Delete",
      true
    );
    if (!ok) return;
    try {
      await api.delete(`/trips/${trip.id}`);
      onDeleted();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert("Could not delete", typeof detail === "string" ? detail : "Try again later");
    }
  };

  const changeCurrency = async (cur: string) => {
    setShowCur(false);
    try {
      await api.patch(`/trips/${trip.id}/currency`, { currency: cur });
      onCurrencyChanged?.();
    } catch {
      Alert.alert("Error", "Could not change currency");
    }
  };

  return (
    <View style={styles.modalRoot}>
      <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.bg, borderColor: c.border, maxHeight: 480 }]}>
        <View style={styles.sheetHandle}>
          <View style={[styles.handleBar, { backgroundColor: c.textMuted }]} />
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: c.textPrimary, fontSize: 22, fontFamily: "Syne_700Bold" }}>{trip.name}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 4 }}>
            {trip.members.length} members · {(trip.expenses || []).filter((e: any) => !e.is_settlement).length} expenses · {trip.currency || "INR"}
          </Text>

          <View style={{ marginTop: 18, gap: 8 }}>
            <SettingsRow label="Add member" icon="person-add-outline" onPress={onAddMember} testID="settings-add-member" />
            <SettingsRow label="Invite via link" icon="link-outline" onPress={onShare} testID="settings-invite" />
            <SettingsRow
              label={`Change currency · ${trip.currency || "INR"}`}
              icon="swap-horizontal-outline"
              onPress={() => setShowCur(true)}
              testID="settings-change-currency"
            />
            <SettingsRow label="Delete split" icon="trash-outline" danger onPress={onDelete} testID="settings-delete" />
          </View>
        </View>
      </View>

      <Modal visible={showCur} animationType="fade" transparent onRequestClose={() => setShowCur(false)}>
        <CurrencyPicker
          current={trip.currency || "INR"}
          onPick={changeCurrency}
          onClose={() => setShowCur(false)}
        />
      </Modal>
    </View>
  );
}

function CurrencyPicker({ current, onPick, onClose }: { current: string; onPick: (c: string) => void; onClose: () => void }) {
  const { c, isDark } = useTheme();
  const [query, setQuery] = useState("");
  const list = currencyOptions.filter((cu) => cu.toLowerCase().includes(query.toLowerCase()));
  return (
    <View style={[styles.modalRoot, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
      <View style={[styles.upiModal, { backgroundColor: c.bg, borderColor: c.border, maxWidth: 420, padding: 18 }]}>
        <Text style={{ color: c.textPrimary, fontSize: 18, fontFamily: "Syne_700Bold" }}>Change currency</Text>
        <TextInput
          testID="cur-search"
          value={query}
          onChangeText={setQuery}
          placeholder="Search…"
          placeholderTextColor={c.textMuted}
          style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary, marginTop: 12 }]}
        />
        <ScrollView style={{ maxHeight: 280, marginTop: 12 }} showsVerticalScrollIndicator={false}>
          {list.map((cu) => {
            const active = cu === current;
            return (
              <TouchableOpacity
                key={cu}
                testID={`cur-pick-${cu}`}
                onPress={() => onPick(cu)}
                style={[
                  styles.curRow,
                  {
                    backgroundColor: active ? (isDark ? "rgba(124,92,255,0.18)" : "#F5F5F5") : "transparent",
                    borderColor: c.border,
                  },
                ]}
              >
                <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700", flex: 1 }}>{cu}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 13 }}>{currencySymbol(cu)}</Text>
                {active && <Ionicons name="checkmark" size={18} color={isDark ? c.indigo : "#0A0A0A"} style={{ marginLeft: 8 }} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity onPress={onClose} style={{ marginTop: 14, alignItems: "center" }}>
          <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: "700" }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SettingsRow({ label, icon, onPress, danger, testID }: any) {
  const { c } = useTheme();
  const color = danger ? c.negative : c.textPrimary;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.settingsRow, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={{ color, fontSize: 14, fontWeight: "700", marginLeft: 10, flex: 1 }}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={18} color={c.textMuted} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  exportBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { width: "100%", height: 220, position: "relative", justifyContent: "flex-end" },
  heroTop: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroInfo: { padding: 20 },
  frostBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    marginHorizontal: 24,
    marginTop: -22,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 28,
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 14px rgba(0,0,0,0.25)",
    elevation: 8,
  },
  balRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  expRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  expEmoji: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  catEmojiSm: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatarSm: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  inviteBtn: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  settleRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  markPaidBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    paddingTop: 0,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: "90%",
  },
  sheetHandle: { alignItems: "center", paddingVertical: 12 },
  handleBar: { width: 36, height: 4, borderRadius: 999 },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
  },
  curMini: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  payerChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  upiBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  aiBadge: {
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  catTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  catPick: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    width: "100%",
  },
  upiModal: {
    margin: 24,
    padding: 22,
    borderRadius: 20,
    borderWidth: 1,
    width: "85%",
    maxWidth: 420,
    alignSelf: "center",
    marginTop: "auto",
    marginBottom: "auto",
  },
  upiInput: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: "top",
  },
  upiBtnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  upiBtnPrimary: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  // AI Overview section
  aiSection: { marginTop: 22 },
  aiSkel: {
    height: 60,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  forecastChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "center",
    marginTop: 12,
    maxWidth: "100%",
  },
  insightCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  personalityCard: {
    padding: 18,
    borderRadius: 18,
  },
  factCard: {
    width: 220,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 110,
  },
  curRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
});