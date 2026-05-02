import React, { useEffect, useState, useCallback } from "react";
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
import { GaugeDial, DonutRing, HybridBar } from "../../src/components/Charts";
import { SmartNum, DotNum } from "../../src/components/DotNum";
import {
  resolveCover,
  categoryMeta,
  currencySymbol,
  currencyOptions,
  detectCategory,
} from "../../src/lib/tokens";

type Tab = "overview" | "expenses" | "members" | "settle";

export default function SplitDetailScreen() {
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; tab?: string; action?: string }>();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>((params.tab as Tab) || "overview");
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
  const currency = trip.currency || "INR";
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
          {(["overview", "expenses", "members", "settle"] as Tab[]).map((t) => {
            const active = tab === t;
            return (
              <TouchableOpacity
                key={t}
                testID={`tab-${t}`}
                onPress={() => setTab(t)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: active ? (isDark ? c.indigo : "#0A0A0A") : "transparent",
                  },
                ]}
              >
                <Text style={{ color: active ? "#fff" : c.textSecondary, fontWeight: "700", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {t}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {tab === "overview" && <OverviewTab trip={trip} />}
        {tab === "expenses" && <ExpensesTab trip={trip} onChange={load} />}
        {tab === "members" && <MembersTab trip={trip} onAdd={() => setShowMember(true)} onShare={onShareInvite} />}
        {tab === "settle" && <SettleTab trip={trip} onChange={load} />}
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
          onDeleted={() => {
            setShowSettings(false);
            router.back();
          }}
        />
      </Modal>
    </View>
  );
}

// --- Overview Tab ---
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

  const segments = cats.slice(0, 6).map((cc: any) => ({
    color: categoryMeta[cc.category]?.tint || "#6B7280",
    value: cc.amount,
  }));

  return (
    <View style={{ padding: 24 }}>
      <View style={{ alignItems: "center" }}>
        {isDark ? (
          <GaugeDial percent={pct} size={220}>
            <DotNum value={`${Math.round(pct)}%`} size="lg" color="gold" />
            <View style={{ marginTop: 6 }}>
              <DotNum value={`${currencySymbol(currency)}${Math.round(total).toLocaleString("en-IN")}`} size="sm" color="white" />
            </View>
          </GaugeDial>
        ) : (
          <DonutRing percent={pct} segments={segments.length ? segments : undefined} size={200}>
            <Text style={{ color: c.textPrimary, fontSize: 32, fontWeight: "900", letterSpacing: -1 }}>
              {currencySymbol(currency)}{Math.round(total).toLocaleString("en-IN")}
            </Text>
            <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 4 }}>total spent</Text>
          </DonutRing>
        )}
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
        {trip.balances.map((b: any) => {
          const positive = b.net > 0.5;
          const negative = b.net < -0.5;
          const color = positive ? "green" : negative ? "red" : "muted";
          return (
            <View key={b.member_id} style={[styles.balRow, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>{b.name}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 2 }}>
                  Paid {currencySymbol(currency)}{Math.round(b.paid).toLocaleString("en-IN")} · Share {currencySymbol(currency)}{Math.round(b.share).toLocaleString("en-IN")}
                </Text>
              </View>
              <SmartNum
                value={`${b.net >= 0 ? "+" : "-"}${currencySymbol(currency)}${Math.round(Math.abs(b.net)).toLocaleString("en-IN")}`}
                size="md"
                color={color as any}
              />
            </View>
          );
        })}
      </View>

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
                    <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: "700" }}>{meta.label}</Text>
                    <View style={{ marginTop: 4 }}>
                      <HybridBar
                        percent={cc.percent}
                        accent={isDark ? c.indigo : "#0A0A0A"}
                        muted={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}
                        width={140}
                        height={5}
                      />
                    </View>
                  </View>
                  <SmartNum
                    value={`${currencySymbol(currency)}${Math.round(cc.amount).toLocaleString("en-IN")}`}
                    size="sm"
                    color={isDark ? "white" : "black"}
                  />
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
  const { c } = useTheme();
  const expenses = (trip.expenses || []).filter((e: any) => !e.is_settlement).slice().reverse();
  const currency = trip.currency || "INR";
  const memberMap = new Map((trip.members || []).map((m: any) => [m.id, m.name]));

  const onDelete = (eid: string) => {
    Alert.alert("Delete expense?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/trips/${trip.id}/expenses/${eid}`);
            onChange();
          } catch {
            Alert.alert("Error", "Could not delete");
          }
        },
      },
    ]);
  };

  if (expenses.length === 0) {
    return (
      <View style={{ padding: 40, alignItems: "center" }}>
        <Text style={{ color: c.textSecondary, fontSize: 14 }}>No expenses yet</Text>
        <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: "700", marginTop: 8 }}>Tap + to add one</Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 24, gap: 10 }}>
      {expenses.map((exp: any) => (
        <View key={exp.id} style={[styles.expRow, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[styles.expEmoji, { backgroundColor: c.bg }]}>
            <Text style={{ fontSize: 20 }}>{exp.emoji || "💸"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>{exp.name}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 2 }}>
              Paid by {memberMap.get(exp.paid_by) || "—"}{exp.created_at ? ` · ${String(exp.created_at).slice(0, 10)}` : ""}
            </Text>
          </View>
          <SmartNum
            value={`${currencySymbol(currency)}${Math.round(exp.amount_base || exp.amount).toLocaleString("en-IN")}`}
            size="sm"
            color="white"
          />
          <TouchableOpacity testID={`del-exp-${exp.id}`} onPress={() => onDelete(exp.id)} style={{ marginLeft: 8, padding: 6 }}>
            <Ionicons name="trash-outline" size={18} color={c.textMuted} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// --- Members Tab ---
function MembersTab({ trip, onAdd, onShare }: { trip: any; onAdd: () => void; onShare: () => void }) {
  const { c, isDark } = useTheme();
  return (
    <View style={{ padding: 24 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: "700" }}>{trip.members.length} members</Text>
        <TouchableOpacity
          testID="member-add"
          onPress={onAdd}
          style={[styles.smallBtn, { backgroundColor: isDark ? c.indigo : "#0A0A0A" }]}
        >
          <Ionicons name="person-add-outline" size={14} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", marginLeft: 6 }}>Add Member</Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: 10 }}>
        {trip.members.map((m: any) => (
          <View key={m.id} style={[styles.memberRow, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={[styles.avatarSm, { backgroundColor: isDark ? c.indigo : "#0A0A0A" }]}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>{m.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>{m.name}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: m.registered ? (isDark ? "rgba(124,92,255,0.18)" : "#EEF2FF") : c.bg }]}>
              <Text style={{ color: m.registered ? c.indigo : c.textSecondary, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}>
                {m.registered ? "REGISTERED" : "GUEST"}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        testID="member-invite"
        onPress={onShare}
        style={[styles.inviteBtn, { borderColor: c.border, backgroundColor: c.surface }]}
      >
        <Ionicons name="link-outline" size={18} color={c.textPrimary} />
        <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700", marginLeft: 8 }}>Invite via link</Text>
      </TouchableOpacity>
    </View>
  );
}

// --- Settle Tab ---
function SettleTab({ trip, onChange }: { trip: any; onChange: () => void }) {
  const { c, isDark } = useTheme();
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
              <SmartNum
                value={`${currencySymbol(currency)}${Math.round(t.amount).toLocaleString("en-IN")}`}
                size="md"
                color={isDark ? "indigo" : "black"}
              />
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
  const cat = detectCategory(name);
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
      await api.post(`/trips/${trip.id}/expenses`, {
        name: name.trim(),
        amount: amt,
        currency,
        category: cat,
        emoji: meta.emoji,
        paid_by: paidBy,
        split_among: splitAmong,
      });
      onAdded();
    } catch (e: any) {
      Alert.alert("Error", "Could not add expense");
    } finally {
      setSubmitting(false);
    }
  };

  const allSelected = splitAmong.length === trip.members.length;
  const toggleAll = () => {
    if (allSelected) setSplitAmong([]);
    else setSplitAmong(trip.members.map((m: any) => m.id));
  };

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

          <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
            <TextInput
              testID="add-exp-name"
              value={name}
              onChangeText={setName}
              placeholder="What is this for?"
              placeholderTextColor={c.textMuted}
              style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary }]}
            />

            {/* Big centered amount */}
            <View style={{ alignItems: "center", marginTop: 26 }}>
              <Text style={{ color: c.textSecondary, fontSize: 11, letterSpacing: 1.6, fontWeight: "700" }}>AMOUNT</Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
                <Text style={{ color: c.textPrimary, fontSize: 42, fontWeight: "900" }}>
                  {currencySymbol(currency)}
                </Text>
                <TextInput
                  testID="add-exp-amount"
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  placeholderTextColor={c.textMuted}
                  keyboardType="decimal-pad"
                  style={{
                    fontSize: 48,
                    fontWeight: "900",
                    color: c.textPrimary,
                    minWidth: 100,
                    textAlign: "left",
                    padding: 0,
                  }}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 14 }}>
                {currencyOptions.slice(0, 8).map((cur) => {
                  const active = currency === cur;
                  return (
                    <TouchableOpacity
                      key={cur}
                      testID={`add-exp-cur-${cur}`}
                      onPress={() => setCurrency(cur)}
                      style={[styles.curMini, { backgroundColor: active ? (isDark ? c.indigo : "#0A0A0A") : c.surface, borderColor: c.border }]}
                    >
                      <Text style={{ color: active ? "#fff" : c.textPrimary, fontSize: 11, fontWeight: "700" }}>{cur}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Auto category */}
            <View style={[styles.catChip, { backgroundColor: c.surface, borderColor: c.border, alignSelf: "center", marginTop: 18 }]}>
              <Text style={{ fontSize: 14 }}>{meta.emoji}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 11, marginLeft: 6 }}>auto:</Text>
              <Text style={{ color: c.textPrimary, fontSize: 12, fontWeight: "700", marginLeft: 4 }}>{meta.label}</Text>
            </View>

            {/* Paid by */}
            <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 22 }}>PAID BY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
              {trip.members.map((m: any) => {
                const active = paidBy === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    testID={`add-exp-payer-${m.id}`}
                    onPress={() => setPaidBy(m.id)}
                    style={[styles.payerChip, { backgroundColor: active ? (isDark ? c.indigo : "#0A0A0A") : c.surface, borderColor: c.border }]}
                  >
                    <Text style={{ color: active ? "#fff" : c.textPrimary, fontSize: 12, fontWeight: "700" }}>{m.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Split among */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
              <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>SPLIT AMONG</Text>
              <TouchableOpacity testID="add-exp-toggle-all" onPress={toggleAll}>
                <Text style={{ color: isDark ? c.indigo : "#0A0A0A", fontSize: 12, fontWeight: "700" }}>
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
                          backgroundColor: checked ? (isDark ? c.indigo : "#0A0A0A") : "transparent",
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
              style={[styles.primaryBtn, { backgroundColor: isDark ? c.indigo : "#0A0A0A", marginTop: 22, opacity: submitting ? 0.7 : 1 }]}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Add expense</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
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
function SettingsSheet({ trip, isOwner, onClose, onShare, onAddMember, onDeleted }: any) {
  const { c } = useTheme();

  const onDelete = () => {
    Alert.alert("Delete split?", `"${trip.name}" will be removed for everyone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/trips/${trip.id}`);
            onDeleted();
          } catch (e: any) {
            const detail = e?.response?.data?.detail;
            Alert.alert("Could not delete", typeof detail === "string" ? detail : "Try again later");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.modalRoot}>
      <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.bg, borderColor: c.border, maxHeight: 420 }]}>
        <View style={styles.sheetHandle}>
          <View style={[styles.handleBar, { backgroundColor: c.textMuted }]} />
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: c.textPrimary, fontSize: 22, fontFamily: "Syne_700Bold" }}>{trip.name}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 4 }}>
            {trip.members.length} members · {trip.expenses?.length || 0} expenses
          </Text>

          <View style={{ marginTop: 18, gap: 8 }}>
            <SettingsRow label="Add member" icon="person-add-outline" onPress={onAddMember} testID="settings-add-member" />
            <SettingsRow label="Invite via link" icon="link-outline" onPress={onShare} testID="settings-invite" />
            {isOwner && (
              <SettingsRow label="Delete split" icon="trash-outline" danger onPress={onDelete} testID="settings-delete" />
            )}
          </View>
        </View>
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
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
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
});
