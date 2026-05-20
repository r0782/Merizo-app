import { useEffect, useState, useCallback } from "react";
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
import { VoiceExpenseSheet } from "../../src/components/Voiceexpensesheet";
import {
  resolveCover,
  categoryMeta,
  currencySymbol,
  currencyOptions,
  detectCategory,
} from "../../src/lib/tokens";

type Tab = "ledger" | "balances" | "insights" | "members";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
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
  const [showVoice, setShowVoice] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/trips/${tripId}`);
      setTrip(r.data);
    } catch {
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
        {tab === "balances" && <BalancesTab  trip={trip} onChange={load} userId={user?.id || ""} />}
        {tab === "insights" && <InsightsTab  trip={trip} />}
        {tab === "members"  && <MembersTab   trip={trip} onAdd={() => setShowMember(true)} onShare={onShareInvite} onUpdate={load} />}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        testID="split-fab"
        onPress={() => setShowAdd(true)}
        style={[styles.fab, { backgroundColor: isDark ? c.indigo : "#0A0A0A" }]}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Voice Expense Modal */}
      {showVoice && (
        <VoiceExpenseSheet
          trip={trip}
          onClose={() => setShowVoice(false)}
          onAdded={async () => { setShowVoice(false); await load(); }}
        />
      )}

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

// ─────────────────────────────────────────────────────────────────────────────
// LEDGER TAB
// ─────────────────────────────────────────────────────────────────────────────
function LedgerTab({ trip, onChange, userId }: { trip: any; onChange: () => void; userId: string }) {
  const { c, isDark } = useTheme();
  const expenses: any[] = [...(trip.expenses || [])].sort(
    (a: any, b: any) => (b.date || "").localeCompare(a.date || "")
  );
  const currency = trip.currency || "INR";
  const sym = currencySymbol(currency);
  const allMembers: any[] = trip.members || [];
  const nameMap = new Map(allMembers.map((m: any) => [m.id, m.name]));

  const grouped: Record<string, any[]> = {};
  for (const e of expenses) {
    const day = (e.date || "").split("T")[0] || "Unknown";
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(e);
  }

  const formatDay = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-GB", {
        weekday: "short", day: "numeric", month: "long", year: "numeric",
      }).toUpperCase();
    } catch { return d; }
  };

  const deleteExpense = async (expId: string) => {
    const ok = await confirmAction("Remove entry", "Delete this ledger entry?", "Delete", true);
    if (!ok) return;
    try { await api.delete("/expenses/" + expId); onChange(); }
    catch { Alert.alert("Error", "Could not delete"); }
  };

  if (expenses.length === 0) {
    return (
      <View style={{ paddingHorizontal: 24, paddingTop: 40, alignItems: "center", gap: 12 }}>
        <Text style={{ color: c.textMuted, fontSize: 13, letterSpacing: 2, fontFamily: "RobotoMono_400Regular" }}>NO ENTRIES YET</Text>
        <Text style={{ color: c.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
          Tap + to add your first expense to the ledger.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 20 }}>
      {Object.entries(grouped).map(([day, dayExps]) => (
        <View key={day}>
          <View style={{ marginTop: 24, marginBottom: 14 }}>
            <View style={{ height: 1, backgroundColor: c.border }} />
            <Text style={{ color: c.textMuted, fontSize: 9, letterSpacing: 2.5, marginTop: 7, fontFamily: "RobotoMono_400Regular" }}>
              {formatDay(day)}
            </Text>
          </View>

          {dayExps.map((exp: any) => {
            const catInfo   = categoryMeta[exp.category] || { emoji: "💸", label: "Other" };
            const payerId   = exp.paid_by || "";
            const payerName = exp.paid_by_name || nameMap.get(payerId) || "Someone";
            const isYouPaid = payerId === userId;

            const splitIds: string[]   = exp.split_among || allMembers.map((m: any) => m.id);
            const splitNames: string[] = exp.split_among_names?.length
              ? exp.split_among_names
              : splitIds.map((id: string) => nameMap.get(id) || id);
            const splitCount = Math.max(splitIds.length, 1);
            const perPerson  = Math.round(exp.amount / splitCount);
            const amIInSplit = splitIds.includes(userId);

            return (
              <View key={exp.id} style={{ marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: c.border, borderStyle: "dashed" as any }}>
                {/* Header */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.textMuted, fontSize: 8, letterSpacing: 2, fontFamily: "RobotoMono_400Regular", marginBottom: 4 }}>
                      {catInfo.emoji}  {catInfo.label?.toUpperCase() || "OTHER"}
                    </Text>
                    <Text style={{ color: c.textPrimary, fontSize: 17, fontFamily: "Syne_700Bold", letterSpacing: -0.3, lineHeight: 22 }}>
                      {exp.description || exp.name || "Expense"}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteExpense(exp.id)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ marginLeft: 8 }}>
                    <Text style={{ color: c.textMuted, fontSize: 14 }}>×</Text>
                  </TouchableOpacity>
                </View>

                {/* Who paid */}
                <View style={{ marginTop: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border }}>
                  <Text style={{ color: c.textMuted, fontSize: 8, letterSpacing: 2, fontFamily: "RobotoMono_400Regular", marginBottom: 5 }}>WHO PAID</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: isYouPaid ? c.positive : c.textPrimary, fontSize: 14, fontFamily: "RobotoMono_700Bold", fontWeight: "700" }}>
                        {isYouPaid ? "You" : payerName}
                      </Text>
                      <Text style={{ color: c.textMuted, fontSize: 10, fontFamily: "RobotoMono_400Regular", marginTop: 2 }}>
                        {isYouPaid ? "You covered the full bill" : `${payerName} covered the full bill`}
                      </Text>
                    </View>
                    <Text style={{ color: c.textPrimary, fontSize: 18, fontFamily: "RobotoMono_700Bold", fontVariant: ["tabular-nums"] as any }}>
                      {sym}{Math.round(exp.amount).toLocaleString("en-IN")}
                    </Text>
                  </View>
                </View>

                {/* Split among */}
                <View style={{ marginTop: 2, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ color: c.textMuted, fontSize: 8, letterSpacing: 2, fontFamily: "RobotoMono_400Regular" }}>
                      SPLIT AMONG {splitCount} {splitCount === 1 ? "PERSON" : "PEOPLE"}
                    </Text>
                    <Text style={{ color: c.textSecondary, fontSize: 9, fontFamily: "RobotoMono_400Regular" }}>
                      {sym}{perPerson.toLocaleString("en-IN")} each
                    </Text>
                  </View>

                  {splitNames.map((name: string, i: number) => {
                    const memberId    = splitIds[i] || "";
                    const isThemPayer = memberId === payerId;
                    const isYou       = memberId === userId;
                    return (
                      <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isThemPayer ? c.positive : c.textMuted, marginRight: 8, flexShrink: 0 }} />
                        <Text style={{ flex: 1, color: isYou ? c.indigo : c.textPrimary, fontSize: 12, fontFamily: "RobotoMono_400Regular" }}>
                          {isYou ? "You" : name}{isThemPayer ? " (paid)" : ""}
                        </Text>
                        <Text style={{ fontFamily: "RobotoMono_700Bold", fontSize: 12, color: isThemPayer ? c.positive : (isYou ? c.indigo : c.textSecondary), fontVariant: ["tabular-nums"] as any, minWidth: 55, textAlign: "right" }}>
                          {sym}{perPerson.toLocaleString("en-IN")}
                        </Text>
                        <Text style={{ fontSize: 9, fontFamily: "RobotoMono_400Regular", marginLeft: 8, color: isThemPayer ? c.positive : c.textMuted, minWidth: 48, textAlign: "right" }}>
                          {isThemPayer ? "✓ paid" : "pending"}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Plain English summary */}
                <View style={{ marginTop: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: isDark ? "rgba(255,255,255,0.03)" : c.surfaceAlt, borderRadius: 4, borderLeftWidth: 2, borderLeftColor: isYouPaid ? c.positive : c.indigo }}>
                  <Text style={{ color: c.textSecondary, fontSize: 11, lineHeight: 18, fontFamily: "RobotoMono_400Regular" }}>
                    {isYouPaid
                      ? `You paid ${sym}${Math.round(exp.amount).toLocaleString("en-IN")} for ${splitCount} ${splitCount === 1 ? "person" : "people"}. Each person owes you ${sym}${perPerson.toLocaleString("en-IN")}.${!amIInSplit ? " You are NOT in this split." : ""}`
                      : `${payerName} paid ${sym}${Math.round(exp.amount).toLocaleString("en-IN")} for ${splitCount} ${splitCount === 1 ? "person" : "people"}. ${amIInSplit ? `You owe ${payerName} ${sym}${perPerson.toLocaleString("en-IN")}.` : "You are not in this split."}`
                    }
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
      <View style={{ height: 60 }} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BALANCES TAB
// ─────────────────────────────────────────────────────────────────────────────
function BalancesTab({ trip, onChange, userId }: { trip: any; onChange: () => void; userId: string }) {
  const { c, isDark } = useTheme();
  const currency  = trip.currency || "INR";
  const sym       = currencySymbol(currency);
  const txns: any[]     = trip.settlement_transactions || [];
  const balances: any[] = trip.balances || [];
  const total     = trip.total_spent || 0;
  const unsettled = txns.reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const myBalance = balances.find((b: any) => b.id === userId || b.member_id === userId);
  const myPaid    = myBalance?.paid || 0;
  const myShare   = myBalance?.share || 0;
  const myNet     = myBalance?.net || 0;
  const nMembers  = balances.length || 1;
  const maxPaid   = Math.max(...balances.map((b: any) => b.paid || 0), 0);
  const avgPaid   = total / nMembers;
  const isUneven  = maxPaid > avgPaid * 1.5 && txns.length > 0;
  const topPayer  = balances.find((b: any) => b.paid === maxPaid);

  const markPaid = async (t: any) => {
    try {
      await api.post("/trips/" + trip.id + "/settle", { from_member: t.from_id, to_member: t.to_id, amount: t.amount });
      onChange();
    } catch { Alert.alert("Error", "Could not settle"); }
  };

  const explainSettlement = (t: any) => {
    const youPay     = t.from_id === userId;
    const youReceive = t.to_id === userId;
    if (youPay)     return `You owe ${t.to_name} for expenses they covered that include you.`;
    if (youReceive) return `${t.from_name} owes you for expenses you covered that include them.`;
    return `${t.from_name} owes ${t.to_name} for shared expenses.`;
  };

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>

        {/* Section 1: Group totals */}
        <View>
          <Text style={{ color: c.textMuted, fontSize: 8, letterSpacing: 2.5, fontFamily: "RobotoMono_400Regular", marginBottom: 8 }}>
            BALANCE SHEET
          </Text>
          <View style={{ height: 1, backgroundColor: c.border, marginBottom: 10 }} />

          {[
            { label: "Total group spending", sub: "All expenses combined", value: Math.round(total), color: c.textPrimary },
            { label: "Your fair share", sub: "Based on expenses you're part of", value: Math.round(myShare), color: c.textPrimary },
            { label: "You actually paid", sub: "Bills you covered for the group", value: Math.round(myPaid), color: myPaid >= myShare ? c.positive : c.negative },
          ].map(({ label, sub, value, color }) => (
            <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.textPrimary, fontSize: 13, fontFamily: "RobotoMono_400Regular" }}>{label}</Text>
                <Text style={{ color: c.textMuted, fontSize: 9, fontFamily: "RobotoMono_400Regular", marginTop: 1 }}>{sub}</Text>
              </View>
              <Text style={{ color, fontSize: 14, fontFamily: "RobotoMono_700Bold", fontVariant: ["tabular-nums"] as any }}>{sym}{value.toLocaleString("en-IN")}</Text>
            </View>
          ))}

          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, marginTop: 2 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: myNet > 0.5 ? c.positive : myNet < -0.5 ? c.negative : c.textPrimary, fontSize: 14, fontFamily: "RobotoMono_700Bold" }}>
                {myNet > 0.5 ? "You are owed" : myNet < -0.5 ? "You owe" : "You are square"}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 9, fontFamily: "RobotoMono_400Regular", marginTop: 2 }}>
                {myNet > 0.5 ? "Others covered less than you. They owe you the difference."
                  : myNet < -0.5 ? "You covered less than your share. You owe the difference."
                  : "Your payments exactly match your share. Nothing to settle!"}
              </Text>
            </View>
            <Text style={{ color: myNet > 0.5 ? c.positive : myNet < -0.5 ? c.negative : c.textMuted, fontSize: 18, fontFamily: "RobotoMono_700Bold", fontVariant: ["tabular-nums"] as any, marginLeft: 8 }}>
              {myNet !== 0 ? (myNet > 0 ? "+" : "") : ""}{sym}{Math.round(Math.abs(myNet)).toLocaleString("en-IN")}
            </Text>
          </View>
        </View>

        {/* Uneven notice */}
        {isUneven && (
          <View style={{ backgroundColor: isDark ? "rgba(156,61,50,0.12)" : "#FEF2F0", borderRadius: 4, padding: 12, borderLeftWidth: 2, borderLeftColor: c.negative, marginBottom: 16 }}>
            <Text style={{ color: c.textMuted, fontSize: 8, letterSpacing: 2, fontFamily: "RobotoMono_400Regular", marginBottom: 4 }}>NOTICE</Text>
            <Text style={{ color: c.textPrimary, fontSize: 12, lineHeight: 18, fontFamily: "RobotoMono_400Regular" }}>
              {topPayer?.name} has paid significantly more than others ({sym}{Math.round(topPayer?.paid || 0).toLocaleString("en-IN")} vs {sym}{Math.round(avgPaid).toLocaleString("en-IN")} avg). Settle outstanding amounts before adding more expenses.
            </Text>
          </View>
        )}

        {/* Section 2: Who pays whom */}
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: c.textMuted, fontSize: 8, letterSpacing: 2.5, fontFamily: "RobotoMono_400Regular", marginBottom: 8 }}>
            {txns.length === 0 ? "NO PAYMENTS NEEDED" : `WHAT NEEDS TO HAPPEN  ·  ${txns.length} PAYMENT${txns.length !== 1 ? "S" : ""}`}
          </Text>
          <View style={{ height: 1, backgroundColor: c.border, marginBottom: 10 }} />

          {txns.length === 0 ? (
            <View style={{ paddingVertical: 16 }}>
              <Text style={{ color: c.positive, fontSize: 13, fontFamily: "RobotoMono_700Bold" }}>✓ All settled up!</Text>
              <Text style={{ color: c.textSecondary, fontSize: 11, fontFamily: "RobotoMono_400Regular", marginTop: 4 }}>
                Everyone has paid their fair share. No payments needed.
              </Text>
            </View>
          ) : txns.map((t: any, i: number) => {
            const youPay     = t.from_id === userId;
            const youReceive = t.to_id === userId;
            const rowColor   = youPay ? c.negative : youReceive ? c.positive : c.textSecondary;
            return (
              <View key={i} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ flex: 2.5, color: youPay ? c.negative : c.textPrimary, fontSize: 13, fontFamily: "RobotoMono_700Bold" }}>
                    {youPay ? "You" : t.from_name}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 16, marginHorizontal: 4 }}>→</Text>
                  <Text style={{ flex: 2.5, color: youReceive ? c.positive : c.textPrimary, fontSize: 13, fontFamily: "RobotoMono_700Bold" }}>
                    {youReceive ? "You" : t.to_name}
                  </Text>
                  <Text style={{ flex: 2, color: rowColor, fontSize: 16, fontFamily: "RobotoMono_700Bold", textAlign: "right", fontVariant: ["tabular-nums"] as any }}>
                    {sym}{Math.round(t.amount).toLocaleString("en-IN")}
                  </Text>
                  <TouchableOpacity onPress={() => markPaid(t)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ marginLeft: 10 }}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={c.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={{ color: c.textMuted, fontSize: 9, fontFamily: "RobotoMono_400Regular", marginTop: 5, lineHeight: 14 }}>
                  {explainSettlement(t)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Section 3: Full member breakdown */}
        {balances.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={{ color: c.textMuted, fontSize: 8, letterSpacing: 2.5, fontFamily: "RobotoMono_400Regular", marginBottom: 8 }}>
              FULL MEMBER BREAKDOWN
            </Text>
            <View style={{ height: 1, backgroundColor: c.border, marginBottom: 10 }} />

            <View style={{ flexDirection: "row", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: c.border }}>
              {["MEMBER", "PAID", "SHARE", "BALANCE"].map((h, i) => (
                <Text key={h} style={{ flex: i === 0 ? 2.5 : 1.5, color: c.textMuted, fontSize: 8, letterSpacing: 1.5, fontFamily: "RobotoMono_400Regular", textAlign: i === 0 ? "left" : "right" }}>{h}</Text>
              ))}
            </View>

            {balances.map((b: any) => {
              const isMe = b.id === userId || b.member_id === userId;
              const net  = b.net || 0;
              return (
                <View key={b.member_id || b.id} style={{ paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ flex: 2.5, color: isMe ? c.indigo : c.textPrimary, fontSize: 12, fontFamily: "RobotoMono_400Regular", fontWeight: isMe ? "700" : "400" }}>
                      {isMe ? "You" : b.name}
                    </Text>
                    <Text style={{ flex: 1.5, color: c.textSecondary, fontSize: 11, fontFamily: "RobotoMono_400Regular", textAlign: "right" }}>
                      {sym}{Math.round(b.paid || 0).toLocaleString("en-IN")}
                    </Text>
                    <Text style={{ flex: 1.5, color: c.textSecondary, fontSize: 11, fontFamily: "RobotoMono_400Regular", textAlign: "right" }}>
                      {sym}{Math.round(b.share || 0).toLocaleString("en-IN")}
                    </Text>
                    <Text style={{ flex: 1.5, color: net > 0.5 ? c.positive : net < -0.5 ? c.negative : c.textMuted, fontSize: 12, fontFamily: "RobotoMono_700Bold", textAlign: "right", fontVariant: ["tabular-nums"] as any }}>
                      {net >= 0 ? "+" : ""}{sym}{Math.round(Math.abs(net)).toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <Text style={{ color: c.textMuted, fontSize: 8, fontFamily: "RobotoMono_400Regular", marginTop: 3, lineHeight: 12 }}>
                    {net > 0.5 ? `↑ Is owed ${sym}${Math.round(net).toLocaleString("en-IN")} from the group`
                      : net < -0.5 ? `↓ Needs to pay ${sym}${Math.round(Math.abs(net)).toLocaleString("en-IN")} to the group`
                      : "✓ Fully settled"}
                  </Text>
                </View>
              );
            })}

            <View style={{ flexDirection: "row", paddingTop: 8, marginTop: 2 }}>
              <Text style={{ flex: 2.5, color: c.textMuted, fontSize: 9, fontFamily: "RobotoMono_400Regular" }}>TOTAL</Text>
              <Text style={{ flex: 1.5, color: c.textPrimary, fontSize: 11, fontFamily: "RobotoMono_700Bold", textAlign: "right", fontVariant: ["tabular-nums"] as any }}>
                {sym}{Math.round(total).toLocaleString("en-IN")}
              </Text>
              <Text style={{ flex: 1.5, color: c.textSecondary, fontSize: 11, fontFamily: "RobotoMono_400Regular", textAlign: "right" }}></Text>
              <Text style={{ flex: 1.5, color: unsettled > 0 ? c.negative : c.positive, fontSize: 11, fontFamily: "RobotoMono_700Bold", textAlign: "right" }}>
                {unsettled > 0 ? `${sym}${Math.round(unsettled).toLocaleString("en-IN")} left` : "✓ clear"}
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 60 }} />
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INSIGHTS TAB
// ─────────────────────────────────────────────────────────────────────────────
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

  const topPayer   = [...balances].sort((a: any, b: any) => (b.paid || 0) - (a.paid || 0))[0];
  const categories = trip.by_category || {};
  const topCatKey  = Object.keys(categories).sort((a, b) => categories[b] - categories[a])[0];
  const topCatPct  = topCatKey && total > 0 ? Math.round(categories[topCatKey] / total * 100) : 0;
  const catLabel   = { food: "Food & Dining", trip: "Travel", home: "Home", friends: "Events", shopping: "Shopping", bills: "Bills", other: "Other" };

  const maxPaid  = Math.max(...balances.map((b: any) => b.paid || 0), 0);
  const avgPaid  = total / Math.max(balances.length, 1);
  const isUneven = maxPaid > avgPaid * 2;
  const health   = txns.length === 0
    ? { emoji: "🟢", label: "Fully settled",           detail: "Everyone is square. Great job!",                                                           color: c.positive }
    : isUneven
    ? { emoji: "🔴", label: "Payment burden uneven",   detail: `${topPayer?.name} has covered disproportionately more than others.`,                       color: c.negative }
    : { emoji: "🟡", label: "Pending settlements",     detail: `${txns.length} payment${txns.length !== 1 ? "s" : ""} needed to fully balance the group.`, color: "#F59E0B" };

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

      {/* Key Insights */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: c.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 2 }}>KEY INSIGHTS</Text>
        {(insights?.recommendations || staticInsights).slice(0, 5).map((ins: string, i: number) => (
          <View key={i} style={{ flexDirection: "row", gap: 10, backgroundColor: c.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ color: isDark ? c.indigo : "#6D28D9", fontSize: 14 }}>✦</Text>
            <Text style={{ color: c.textPrimary, fontSize: 13, lineHeight: 20, flex: 1 }}>{ins}</Text>
          </View>
        ))}
      </View>

      {/* Smart Settlement */}
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

      {/* Savings Score */}
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

// ─────────────────────────────────────────────────────────────────────────────
// MEMBERS TAB
// ─────────────────────────────────────────────────────────────────────────────
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
          style: "destructive",
          onPress: async () => {
            setDeletingId(memberId);
            try {
              await api.delete(`/trips/${trip.id}/members/${memberId}`);
              await onUpdate();
              Alert.alert("Success", `${memberName} has been removed`);
            } catch (e: any) {
              const errorMsg = e.response?.data?.detail || "Failed to remove member";
              Alert.alert("Error", errorMsg);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ padding: 24, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: "700" }}>{trip.members.length} members</Text>
        <TouchableOpacity testID="member-add" onPress={onAdd} style={[styles.smallBtn, { backgroundColor: isDark ? c.indigo : "#0A0A0A" }]}>
          <Ionicons name="person-add-outline" size={14} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", marginLeft: 6 }}>Add Member</Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: 10 }}>
        {trip.members.map((m: any) => (
          <View
            key={m.id}
            style={[styles.memberRow, { backgroundColor: c.surface, borderColor: c.border, opacity: deletingId === m.id ? 0.6 : 1 }]}
          >
            <View style={[styles.avatarSm, { backgroundColor: isDark ? c.indigo : "#0A0A0A" }]}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>{m.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>{m.name}</Text>
            </View>

            {trip.owner_id === user?.id && m.id !== user?.id && (
              <TouchableOpacity
                testID={`delete-member-${m.id}`}
                disabled={deletingId === m.id}
                onPress={() => deleteMember(m.id, m.name)}
                style={{ padding: 8, opacity: deletingId === m.id ? 0.5 : 1 }}
              >
                {deletingId === m.id
                  ? <ActivityIndicator size="small" color="#EF4444" />
                  : <Ionicons name="trash-outline" size={18} color="#EF4444" />
                }
              </TouchableOpacity>
            )}

            <View style={[styles.badge, { backgroundColor: m.registered ? (isDark ? "rgba(124,92,255,0.18)" : "#EEF2FF") : c.bg }]}>
              <Text style={{ color: m.registered ? c.indigo : c.textSecondary, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}>
                {m.registered ? "REGISTERED" : "GUEST"}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity testID="member-invite" onPress={onShare} style={[styles.inviteBtn, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Ionicons name="link-outline" size={18} color={c.textPrimary} />
        <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700", marginLeft: 8 }}>Invite via link</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD EXPENSE SHEET
// ─────────────────────────────────────────────────────────────────────────────
function AddExpenseSheet({ trip, onClose, onAdded }: any) {
  const { c, isDark } = useTheme();
  const [name, setName]           = useState("");
  const [amount, setAmount]       = useState("");
  const [currency, setCurrency]   = useState(trip.currency || "INR");
  const [paidBy, setPaidBy]       = useState(trip.members[0]?.id || "");
  const [splitAmong, setSplitAmong] = useState<string[]>(trip.members.map((m: any) => m.id));
  const [submitting, setSubmitting] = useState(false);
  const [showUpi, setShowUpi]     = useState(false);
  const [upiText, setUpiText]     = useState("");
  const [upiLoading, setUpiLoading] = useState(false);
  const [upiFilled, setUpiFilled] = useState<{ name: boolean; amount: boolean; category: boolean }>({ name: false, amount: false, category: false });
  const [manualCat, setManualCat] = useState<string | null>(null);

  const autoCat = manualCat || detectCategory(name);
  const cat     = autoCat;
  const meta    = categoryMeta[cat] || categoryMeta.other;

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
      const subKeys: Record<string, number> = { netflix: 2, spotify: 1, disney: 4, prime: 3, youtube: 6 };
      const lower      = name.trim().toLowerCase();
      const matchedSub = Object.keys(subKeys).find((k) => lower.includes(k));
      if (matchedSub && trip.members.length > subKeys[matchedSub]) {
        const cap = matchedSub.charAt(0).toUpperCase() + matchedSub.slice(1);
        Alert.alert("Heads up", `${cap} typically supports ${subKeys[matchedSub]} screens — splitting among ${trip.members.length} people may cause issues 📺`, [{ text: "OK" }]);
      }

      const r = await api.post(`/trips/${trip.id}/expenses`, {
        name: name.trim(), amount: amt, currency, category: cat, emoji: meta.emoji, paid_by: paidBy, split_among: splitAmong,
      });

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
                  await api.post("/reminders", { title: `Recurring: ${suggestion.name}`, amount: amt, due_date: due.toISOString().slice(0, 10), trip_id: trip.id });
                } catch {}
              },
            },
          ]
        );
      }

      onAdded();
    } catch {
      Alert.alert("Error", "Could not add expense");
    } finally {
      setSubmitting(false);
    }
  };

  const onParseUpi = async () => {
    if (!upiText.trim()) { Alert.alert("Paste a message", "Paste your UPI / SMS text first."); return; }
    setUpiLoading(true);
    try {
      const r = await api.post("/expenses/parse-upi", { text: upiText });
      const d = r.data;
      const filled = { name: false, amount: false, category: false };
      if (d.merchant)          { setName(d.merchant);         filled.name     = true; }
      if (d.amount && d.amount > 0) { setAmount(String(d.amount)); filled.amount   = true; }
      if (d.category)          { setManualCat(d.category);    filled.category = true; }
      if (d.currency)          setCurrency(d.currency);
      setUpiFilled(filled);
      setShowUpi(false);
      setUpiText("");
    } catch {
      Alert.alert("Could not parse", "Please type the expense manually.");
    } finally {
      setUpiLoading(false);
    }
  };

  const onChangeName = (t: string) => {
    setName(t);
    if (upiFilled.name) setUpiFilled((f) => ({ ...f, name: false }));
    if (manualCat && !upiFilled.category) setManualCat(null);
  };

  const onChangeAmount = (t: string) => {
    setAmount(t.replace(/[^0-9.]/g, ""));
    if (upiFilled.amount) setUpiFilled((f) => ({ ...f, amount: false }));
  };

  const allSelected = splitAmong.length === trip.members.length;
  const toggleAll   = () => { if (allSelected) setSplitAmong([]); else setSplitAmong(trip.members.map((m: any) => m.id)); };

  const indigo      = isDark ? c.indigo : "#0A0A0A";
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
            <TouchableOpacity testID="add-exp-paste-upi" onPress={() => setShowUpi(true)} style={[styles.upiBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={{ fontSize: 16 }}>📋</Text>
              <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: "700", marginLeft: 8 }}>Paste UPI Message</Text>
              <View style={[styles.aiBadge, { backgroundColor: isDark ? "rgba(124,92,255,0.18)" : "#EEF2FF" }]}>
                <Text style={{ color: indigo, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }}>AI</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Name */}
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>NAME</Text>
            <TextInput
              testID="add-exp-name"
              value={name}
              onChangeText={onChangeName}
              placeholder="What is this for?"
              placeholderTextColor={c.textMuted}
              style={[styles.input, { backgroundColor: c.surface, borderColor: upiFilled.name ? aiHighlight : c.border, borderWidth: upiFilled.name ? 1.5 : 1, color: c.textPrimary }]}
            />
            {(name.length > 0 || manualCat) && (
              <View style={{ flexDirection: "row", marginTop: 8, alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <View testID="add-exp-cat-chip" style={[styles.catTag, { backgroundColor: meta.tint + "22", borderColor: upiFilled.category ? aiHighlight : meta.tint + "55", borderWidth: upiFilled.category ? 1.5 : 1 }]}>
                  <Text style={{ fontSize: 13 }}>{meta.emoji}</Text>
                  <Text style={{ color: c.textPrimary, fontSize: 11, fontWeight: "700", marginLeft: 5 }}>{meta.label}</Text>
                </View>
                <Text style={{ color: c.textMuted, fontSize: 10 }}>{upiFilled.category ? "(AI)" : "(auto · tap to change)"}</Text>
              </View>
            )}
            {(name.length > 0 || manualCat) && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 8 }}>
                {Object.entries(categoryMeta)
                  .filter(([k]) => k !== "settlement" && k !== "other")
                  .map(([k, m]) => {
                    const active = cat === k;
                    return (
                      <TouchableOpacity
                        key={k}
                        testID={`add-exp-cat-${k}`}
                        onPress={() => { setManualCat(k); if (upiFilled.category) setUpiFilled((f) => ({ ...f, category: false })); }}
                        style={[styles.catPick, { backgroundColor: active ? m.tint + "22" : c.surface, borderColor: active ? m.tint : c.border }]}
                      >
                        <Text style={{ fontSize: 12 }}>{m.emoji}</Text>
                        <Text style={{ color: c.textPrimary, fontSize: 10, fontWeight: "700", marginLeft: 4 }}>{m.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            )}
          </View>

          {/* Amount */}
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
                      style={[styles.curMini, { backgroundColor: active ? indigo : c.surface, borderColor: active ? "transparent" : c.border }]}
                    >
                      <Text style={{ color: active ? "#fff" : c.textPrimary, fontSize: 11, fontWeight: "700" }}>{cur}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            <View style={[styles.amountInputWrap, { backgroundColor: c.surface, borderColor: upiFilled.amount ? aiHighlight : c.border, borderWidth: upiFilled.amount ? 1.5 : 1 }]}>
              <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: "900", marginRight: 6 }}>{currencySymbol(currency)}</Text>
              <TextInput
                testID="add-exp-amount"
                value={amount}
                onChangeText={onChangeAmount}
                placeholder="0.00"
                placeholderTextColor={c.textMuted}
                keyboardType="decimal-pad"
                style={{ flex: 1, fontSize: 22, fontWeight: "800", color: c.textPrimary, padding: 0, minWidth: 60 }}
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
                  <TouchableOpacity key={m.id} testID={`add-exp-payer-${m.id}`} onPress={() => setPaidBy(m.id)} style={[styles.payerChip, { backgroundColor: active ? indigo : c.surface, borderColor: c.border }]}>
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
                <Text style={{ color: indigo, fontSize: 12, fontWeight: "700" }}>{allSelected ? "Clear all" : "Select all"}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 8, gap: 8 }}>
              {trip.members.map((m: any) => {
                const checked = splitAmong.includes(m.id);
                return (
                  <TouchableOpacity key={m.id} testID={`add-exp-split-${m.id}`} onPress={() => toggleMember(m.id)} style={[styles.splitRow, { backgroundColor: c.surface, borderColor: c.border }]}>
                    <View style={[styles.checkbox, { backgroundColor: checked ? indigo : "transparent", borderColor: checked ? "transparent" : c.border }]}>
                      {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "600", marginLeft: 12 }}>{m.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity testID="add-exp-submit" disabled={submitting} onPress={onSubmit} style={[styles.primaryBtn, { backgroundColor: indigo, marginTop: 22, opacity: submitting ? 0.7 : 1 }]}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Add expense</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* UPI Parser Modal */}
      <Modal visible={showUpi} animationType="fade" transparent onRequestClose={() => setShowUpi(false)}>
        <View style={[styles.modalRoot, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
          <View style={[styles.upiModal, { backgroundColor: c.bg, borderColor: c.border }]}>
            <Text style={{ color: c.textPrimary, fontSize: 18, fontFamily: "Syne_700Bold" }}>Paste your UPI message</Text>
            <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 4 }}>AI will fill the fields for you. You can edit before saving.</Text>
            <TextInput
              testID="upi-text"
              value={upiText}
              onChangeText={setUpiText}
              multiline
              autoFocus
              placeholder="e.g. Rs 350 debited to Swiggy on 02 May…"
              placeholderTextColor={c.textMuted}
              style={[styles.upiInput, { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary }]}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity testID="upi-cancel" onPress={() => setShowUpi(false)} style={[styles.upiBtnSecondary, { borderColor: c.border, backgroundColor: c.surface }]}>
                <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="upi-parse" onPress={onParseUpi} disabled={upiLoading} style={[styles.upiBtnPrimary, { backgroundColor: indigo, opacity: upiLoading ? 0.6 : 1 }]}>
                {upiLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Parse with AI</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD MEMBER SHEET
// ─────────────────────────────────────────────────────────────────────────────
function AddMemberSheet({ trip, onClose, onAdded }: any) {
  const { c, isDark } = useTheme();
  const [name, setName]           = useState("");
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
          <TouchableOpacity testID="add-member-submit" onPress={onSubmit} disabled={submitting} style={[styles.primaryBtn, { backgroundColor: isDark ? c.indigo : "#0A0A0A", marginTop: 18 }]}>
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

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS SHEET
// ─────────────────────────────────────────────────────────────────────────────
function SettingsSheet({ trip, isOwner: _isOwner, onClose, onShare, onAddMember, onDeleted, onCurrencyChanged }: any) {
  const { c } = useTheme();
  const [showCur, setShowCur] = useState(false);

  const onDelete = async () => {
    const ok = await confirmAction("Are you sure?", "This cannot be undone.", "Delete", true);
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
            <SettingsRow label="Add member"                             icon="person-add-outline"     onPress={onAddMember}            testID="settings-add-member" />
            <SettingsRow label="Invite via link"                        icon="link-outline"           onPress={onShare}                testID="settings-invite" />
            <SettingsRow label={`Change currency · ${trip.currency || "INR"}`} icon="swap-horizontal-outline" onPress={() => setShowCur(true)} testID="settings-change-currency" />
            <SettingsRow label="Delete split"                           icon="trash-outline"          onPress={onDelete}  danger       testID="settings-delete" />
          </View>
        </View>
      </View>

      <Modal visible={showCur} animationType="fade" transparent onRequestClose={() => setShowCur(false)}>
        <CurrencyPicker current={trip.currency || "INR"} onPick={changeCurrency} onClose={() => setShowCur(false)} />
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CURRENCY PICKER
// ─────────────────────────────────────────────────────────────────────────────
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
                style={[styles.curRow, { backgroundColor: active ? (isDark ? "rgba(124,92,255,0.18)" : "#F5F5F5") : "transparent", borderColor: c.border }]}
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

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS ROW
// ─────────────────────────────────────────────────────────────────────────────
function SettingsRow({ label, icon, onPress, danger, testID }: any) {
  const { c } = useTheme();
  const color = danger ? c.negative : c.textPrimary;
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={[styles.settingsRow, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={{ color, fontSize: 14, fontWeight: "700", marginLeft: 10, flex: 1 }}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={18} color={c.textMuted} />}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES (single definition)
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  searchBox:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  exportBtn:       { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  hero:            { width: "100%", height: 220, position: "relative", justifyContent: "flex-end" },
  heroTop:         { position: "absolute", top: 60, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
  heroInfo:        { padding: 20 },
  frostBtn:        { width: 38, height: 38, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  tabBar:          { flexDirection: "row", borderRadius: 999, borderWidth: 1, padding: 4, marginHorizontal: 24, marginTop: -22 },
  tab:             { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  fab:             { position: "absolute", right: 24, bottom: 28, width: 58, height: 58, borderRadius: 999, alignItems: "center", justifyContent: "center", elevation: 8 },
  balRow:          { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1 },
  expRow:          { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 14, borderWidth: 1 },
  expEmoji:        { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  catEmojiSm:      { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  memberRow:       { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 14, borderWidth: 1 },
  avatarSm:        { width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  badge:           { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  inviteBtn:       { marginTop: 18, paddingVertical: 14, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  smallBtn:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  settleRow:       { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1 },
  markPaidBtn:     { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  modalRoot:       { flex: 1, justifyContent: "flex-end" },
  modalBackdrop:   { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet:           { paddingTop: 0, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, maxHeight: "90%" },
  sheetHandle:     { alignItems: "center", paddingVertical: 12 },
  handleBar:       { width: 36, height: 4, borderRadius: 999 },
  input:           { paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12, borderWidth: 1, fontSize: 15 },
  curMini:         { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  catChip:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  payerChip:       { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  splitRow:        { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1 },
  checkbox:        { width: 22, height: 22, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  primaryBtn:      { paddingVertical: 16, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  settingsRow:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  upiBtn:          { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  aiBadge:         { marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  catTag:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  catPick:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  amountInputWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, width: "100%" },
  upiModal:        { margin: 24, padding: 22, borderRadius: 20, borderWidth: 1, width: "85%", maxWidth: 420, alignSelf: "center", marginTop: "auto", marginBottom: "auto" },
  upiInput:        { marginTop: 14, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, fontSize: 14, minHeight: 90, textAlignVertical: "top" },
  upiBtnSecondary: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  upiBtnPrimary:   { flex: 1.5, paddingVertical: 12, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  aiSection:       { marginTop: 22 },
  aiSkel:          { height: 60, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  forecastChip:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, alignSelf: "center", marginTop: 12, maxWidth: "100%" },
  insightCard:     { padding: 14, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center" },
  personalityCard: { padding: 18, borderRadius: 18 },
  factCard:        { width: 220, padding: 14, borderRadius: 14, borderWidth: 1, minHeight: 110 },
  curRow:          { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6 },
  fieldLabel:      { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
});
