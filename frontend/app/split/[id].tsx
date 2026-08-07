import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SkeletonGroupDetail, SkeletonExpenseCard, FadeIn } from "../../src/components/Skeleton";
import { EmptyExpenses } from "../../src/components/EmptyStates";
import { cache, CK, TTL } from "../../src/lib/cache";
import { useTheme } from "../../src/lib/theme";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";
import { confirmAction } from "../../src/lib/confirm";
import { GaugeDial, HybridBar, DonutRing } from "../../src/components/Charts";
import { AnimatedSmartNum } from "../../src/components/AnimatedSmartNum";
import {
  resolveCover,
  categoryMeta,
  currencySymbol,
  currencyOptions,
  detectCategory,
} from "../../src/lib/tokens";
import { SmartNum } from "../../src/components/DotNum";
import { BalanceExplainer } from "../../src/components/ai/BalanceExplainer";
import { ExpandingFAB } from "../../src/components/ExpandingFAB";
import { VoiceExpenseSheet } from "../../src/components/VoiceExpenseSheet";
import * as Print from "expo-print";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";

// Web fix: prevent scroll container from stealing focus from inputs
if (typeof document !== "undefined") {
  document.addEventListener("mousedown", (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      e.stopPropagation();
    }
  }, true);
}


// Web-safe input that doesn't lose focus in ScrollView
function WebInput({ value, onChange, placeholder, style }: any) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#999"
      keyboardType="decimal-pad"
      style={{
        color: style?.color || "#000",
        fontSize: style?.fontSize || 15,
        fontWeight: style?.fontWeight?.toString() || "700",
        minWidth: style?.minWidth || 60,
        paddingVertical: 0,
      }}
    />
  );
}



// ── UPI payment deep link ─────────────────────────────────────────────────────
function openUPI(upiId: string, name: string, amount: number, note: string) {
  const url = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}&mode=02`;
  Linking.canOpenURL(url).then(can => {
    if (can) Linking.openURL(url);
    else Alert.alert("No UPI App", "Install GPay, PhonePe or Paytm to pay directly.", [
      { text: "OK" },
    ]);
  });
}

// ── Share summary - WhatsApp on mobile, web URL on browser, native share fallback ─
async function shareGroupSummary(tripId: string, tripName: string, mode: "whatsapp" | "share" = "whatsapp") {
  try {
    const r = await api.get("/trips/" + tripId + "/share-summary");
    const text = r.data.text;

    if (Platform.OS === "web") {
      if (mode === "whatsapp") {
        // WhatsApp Web API
        (window as any).open("https://api.whatsapp.com/send?text=" + encodeURIComponent(text), "_blank");
      } else {
        // Copy to clipboard + alert
        try {
          await (navigator as any).clipboard.writeText(text);
          Alert.alert("Copied!", "Summary copied to clipboard. Paste it anywhere.");
        } catch {
          // Fallback: open in new tab
          const blob = new Blob([text], { type: "text/plain" });
          const url  = URL.createObjectURL(blob);
          (window as any).open(url, "_blank");
        }
      }
    } else {
      // Native: try WhatsApp deep link first
      const wa = "whatsapp://send?text=" + encodeURIComponent(text);
      const canWA = await Linking.canOpenURL(wa);
      if (canWA && mode === "whatsapp") {
        await Linking.openURL(wa);
      } else {
        await Share.share({ message: text, title: tripName + " - Merizo Summary" });
      }
    }
  } catch {
    Alert.alert("Error", "Could not generate summary. Make sure you're connected.");
  }
}

type Tab = "journal" | "settle" | "insights" | "members";

export default function SplitDetailScreen() {
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; tab?: string; action?: string }>();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>((params.tab as Tab) || "journal");
  const [showAdd, setShowAdd] = useState(params.action === "add");
  const [showMember, setShowMember] = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [showVoice,     setShowVoice]     = useState(false);
  const [reportData,    setReportData]    = useState<any>(null);
  const [pdfLoading,    setPdfLoading]    = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: cached, isStale } = cache.get(CK.trip(tripId));
      if (cached) {
        setTrip(cached);
        if (!silent) setLoading(false);
        if (!isStale) return;
      }
      const r = await api.get("/trips/" + tripId);
      cache.set(CK.trip(tripId), r.data, TTL.TRIP_DETAIL);
      setTrip(r.data);
    } catch (e: any) {
      if (e?.response?.status === 401) router.replace("/login");
    }
    if (!silent) setLoading(false);
  }, [tripId]);

  const silentLoad = useCallback(() => { load(true); }, [load]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  if (loading || !trip) { return <SkeletonGroupDetail />; }

  const cover = resolveCover(trip.destinations, trip.split_category, trip.cover_key);
  const isOwner = trip.owner_id === user?.id;

  const onDownloadPDF = async () => {
    const unsettled = (trip.balances || []).filter((b: any) => Math.abs(b.net || 0) > 1);
    if (unsettled.length > 0) {
      Alert.alert(
        "Unsettled payments",
        `There are ${unsettled.length} unsettled balance${unsettled.length > 1 ? "s" : ""}. It's best to settle before downloading the final report.\n\nDownload anyway?`,
        [
          { text: "Settle first", style: "cancel" },
          { text: "Download anyway", onPress: () => generateReport() }
        ]
      );
    } else {
      generateReport();
    }
  };

  const generateReport = async () => {
    try {
      const sym = currencySymbol(trip.currency || "INR");
      const balances: any[] = trip.balances || [];
      const total = trip.total_spent || 0;
      const perPerson = total / Math.max(balances.length, 1);
      const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      const txns: any[] = trip.settlement_transactions || [];

      // Build CSV
      const lines: string[] = [];

      // Header info
      lines.push(`Merizo Expense Report`);
      lines.push(`Group,${trip.name}`);
      lines.push(`Generated,${date}`);
      lines.push(`Total Spent,${sym}${Math.round(total).toLocaleString("en-IN")}`);
      lines.push(`Members,${balances.length}`);
      lines.push(`Expenses,${trip.expense_count || 0}`);
      lines.push(`Per Person,${sym}${Math.round(perPerson).toLocaleString("en-IN")}`);
      lines.push(``);

      // Member balances
      lines.push(`MEMBER BALANCES`);
      lines.push(`Name,Amount Paid,Net Balance,Status`);
      balances.forEach((b: any) => {
        const net = b.net || 0;
        const status = net > 1 ? "Owed to them" : net < -1 ? "Owes money" : "Settled";
        lines.push(`${b.name},${sym}${Math.round(b.paid || 0)},${net >= 0 ? "+" : ""}${sym}${Math.round(net)},${status}`);
      });
      lines.push(``);

      // Settlement plan
      if (txns.length > 0) {
        lines.push(`SETTLEMENT PLAN`);
        lines.push(`From,To,Amount`);
        txns.forEach((t: any) => {
          lines.push(`${t.from_name},${t.to_name},${sym}${Math.round(t.amount)}`);
        });
        lines.push(``);
      }

      // Footer
      lines.push(`Generated by Merizo AI - merizo-app.onrender.com`);

      const csv = lines.join("\n");
      const filename = `${trip.name.replace(/[^a-z0-9]/gi, "-")}-expenses.csv`;

      if (typeof window !== "undefined") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Mobile - use expo-sharing or clipboard
        Alert.alert(
          "Export ready",
          `Spreadsheet exported as ${filename}. Open in Excel, Google Sheets, or Numbers.`
        );
      }
    } catch {
      Alert.alert("Error", "Could not generate spreadsheet");
    }
  };

  const unsettledBalances = (t: any) => {
    const txns = t.settlement_transactions || [];
    return txns.length === 0 ? "All balances settled." : `${txns.length} payment${txns.length > 1 ? "s" : ""} needed to settle.`;
  };

  const onShareInvite = async () => {
    try {
      const inv = await api.get(`/trips/${tripId}/invite`);
      const token = inv.data.token;
      const webLink = `https://merizo-app.onrender.com/join/${token}`;
      const message = [
        `Join "${trip.name}" on Merizo! 💸`,
        "",
        "Split expenses effortlessly with the group.",
        "",
        `👇 Tap to join:`,
        webLink,
        "",
        `Or open the Merizo app and use invite code: ${token}`,
      ].join("\n");
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: `Join ${trip.name} on Merizo`, text: message, url: webLink });
      } else {
        await Share.share({ message, title: `Join ${trip.name} on Merizo` });
      }
    } catch (e: any) {
      if (e?.message !== "Share canceled") {
        Alert.alert("Invite link ready", "Link copied! Send it to your friends.");
      }
    }
  };

  const net = trip.my_net || 0;
  const isOwed = net > 0;
  const sym = currencySymbol(trip.currency || "INR");

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* ── Premium Hero ── */}
        <View style={{ height: 260, position: "relative" }}>
          <Image source={{ uri: cover }} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 260 }} resizeMode="cover" />
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 260, backgroundColor: "rgba(0,0,0,0.38)" }} />

          {/* Top controls */}
          <View style={{ position: "absolute", top: Platform.OS === "ios" ? 52 : 36, left: 20, right: 20, flexDirection: "row", justifyContent: "space-between" }}>
            <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="arrow-back" size={18} color="#fff" />
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={onShareInvite} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="share-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowSettings(true)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="settings-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Group info */}
          <View style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
            <Text style={{ color: "#fff", fontSize: 30, fontWeight: "500", letterSpacing: -1, marginBottom: 4 }}>{trip.name}</Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              {trip.members.length} members{trip.start_date ? ` · ${trip.start_date}` : ""}{trip.end_date ? ` → ${trip.end_date}` : ""}
            </Text>
          </View>
        </View>

        {/* ── Balance pill ── */}
        <View style={{ marginHorizontal: 20, marginTop: -18, marginBottom: 16, zIndex: 10 }}>
          <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
            <View>
              <Text style={{ fontSize: 11, color: c.textSecondary, marginBottom: 3, letterSpacing: 0.3 }}>Your balance</Text>
              <Text style={{ fontSize: 24, fontWeight: "500", color: net === 0 ? c.textSecondary : isOwed ? "#00C48C" : "#FF453A", letterSpacing: -0.5 }}>
                {net === 0 ? "Settled ✓" : `${isOwed ? "+" : "-"}${sym}${Math.abs(Math.round(net)).toLocaleString("en-IN")}`}
              </Text>
              {net !== 0 && <Text style={{ fontSize: 12, color: c.textSecondary, marginTop: 2 }}>{isOwed ? "Others owe you" : "You owe"}</Text>}
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <View style={{ backgroundColor: isDark ? "#2C2C2E" : "#F0EDE8", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ fontSize: 12, color: c.textSecondary }}>{sym}{Math.round(trip.total_spent || 0).toLocaleString("en-IN")} total</Text>
              </View>
              <Text style={{ fontSize: 11, color: c.textSecondary }}>{trip.expense_count || 0} expenses</Text>
            </View>
          </View>
        </View>

        {/* ── Pill tab bar ── */}
        <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", backgroundColor: isDark ? "#1C1C1E" : "#F0EDE8", borderRadius: 14, padding: 3, gap: 2 }}>
            {([
              { id: "journal",  label: "Journal",  icon: "book-outline" },
              { id: "settle",   label: "Settle",   icon: "swap-horizontal-outline" },
              { id: "insights", label: "AI",       icon: "sparkles-outline" },
              { id: "members",  label: "Members",  icon: "people-outline" },
            ] as { id: Tab; label: string; icon: any }[]).map(({ id: t, label, icon }) => {
              const active = tab === t;
              return (
                <TouchableOpacity
                  key={t}
                  testID={`tab-${t}`}
                  onPress={() => setTab(t)}
                  style={{ flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 11, backgroundColor: active ? (isDark ? "#2C2C2E" : "#FFFFFF") : "transparent", gap: 3, shadowColor: active ? "#000" : "transparent", shadowOpacity: 0.06, shadowRadius: 4, elevation: active ? 2 : 0 }}
                >
                  <Ionicons name={icon} size={13} color={active ? (isDark ? "#7B6FFF" : "#6D5DFC") : c.textSecondary} />
                  <Text style={{ fontSize: 10, fontWeight: active ? "500" : "400", color: active ? (isDark ? "#7B6FFF" : "#6D5DFC") : c.textSecondary }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {tab === "journal"  && <LedgerTab   trip={trip} onChange={silentLoad} userId={user?.id || ""} onAddExpense={() => setShowAdd(true)} />}
        {tab === "settle"   && <BalancesTab trip={trip} onChange={silentLoad} userId={user?.id || ""} />}
        {tab === "insights" && <InsightsTab trip={trip} />}
        {tab === "members"  && <MembersTab  trip={trip} onAdd={() => setShowMember(true)} onShare={onShareInvite} onUpdate={load} />}
      </ScrollView>

      {/* Expanding FAB - all actions */}
      <ExpandingFAB options={[
        { label: "Quick Add",       sublabel: "Type expense manually",    icon: "create-outline",           onPress: () => setShowAdd(true) },
        { label: "Speak Expense",   sublabel: "Say it, AI parses it",     icon: "mic-outline",              onPress: () => setShowVoice(true) },
        { label: "Scan Receipt",    sublabel: "Camera · auto-fill",       icon: "camera-outline",           onPress: () => setShowAdd(true) },
        { label: "Custom Split",    sublabel: "Split by person or %",     icon: "git-branch-outline",       onPress: () => router.push({ pathname: "/simple-split", params: { tripId: trip.id, tripName: trip.name } }) },
        { label: "Export Spreadsheet", sublabel: "CSV for Excel/Sheets",          icon: "document-text-outline",    onPress: onDownloadPDF },
      ]} />

      {/* Voice Expense modal */}
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
                    fontFamily: "Manrope_700Bold",
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
                      fontFamily: "Manrope_500Medium",
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
// LEDGER TAB - chronological financial timeline
// ═══════════════════════════════════════════════════════════════════════════════
function LedgerTab({ trip, onChange, userId, onAddExpense }: { trip: any; onChange: () => void; userId: string; onAddExpense: () => void }) {
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
    return <EmptyExpenses onPrimary={onAddExpense} onSecondary={onAddExpense} />;
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
            /* ── Use ONLY the actual split members, not all trip members ── */
            const allMems: any[] = trip.members || [];
            const nMap = new Map(allMems.map((m: any) => [m.id, m.name]));

            /* splitIds = who is actually in this expense's split */
            const splitIds: string[] =
              exp.split_among && exp.split_among.length > 0
                ? exp.split_among
                : allMems.map((m: any) => m.id);

            const splitCount = Math.max(splitIds.length, 1);
            const perPerson  = Math.round(exp.amount / splitCount); // ← uses actual split size

            const payerId    = exp.paid_by || "";
            const payerName  = exp.paid_by_name || nMap.get(payerId) || "-";
            const isYouPaid  = payerId === userId;

            /* Build display list from splitIds only */
            const splitDisplay = splitIds.map((id: string) => ({
              id,
              name: id === userId ? "You" : (nMap.get(id) || id),
              isPayer: id === payerId,
              isYou: id === userId,
            }));

            const doDelete = () => {
              if (Platform.OS === "web") {
                if ((window as any).confirm("Remove this expense from the ledger?")) {
                  deleteExpense(exp.id);
                }
              } else {
                Alert.alert("Delete", "Remove this expense?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => deleteExpense(exp.id) },
                ]);
              }
            };

            return (
              <View key={exp.id} style={{ marginBottom: 12, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
                {/* Header */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", padding: 14, paddingBottom: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F0F0F0", alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0 }}>
                    <Text style={{ fontSize: 17 }}>{categoryMeta[exp.category]?.emoji || "💸"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: "700", letterSpacing: -0.2 }} numberOfLines={1}>
                      {exp.description || exp.name}
                    </Text>
                    <Text style={{ color: isYouPaid ? c.positive : c.textMuted, fontSize: 11, marginTop: 2 }}>
                      {isYouPaid ? "✓ You paid" : `Paid by ${payerName}`}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", flexShrink: 0, marginLeft: 8 }}>
                    <Text style={{ fontFamily: "Manrope_700Bold", fontSize: 18, color: c.textPrimary, fontVariant: ["tabular-nums"] as any }}>
                      {sym}{Math.round(exp.amount).toLocaleString("en-IN")}
                    </Text>
                    <TouchableOpacity onPress={doDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="trash-outline" size={14} color={c.textMuted} style={{ marginTop: 4 }} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Split - shows ONLY actual split members */}
                <View style={{ paddingHorizontal: 14, paddingBottom: 10, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
                  <Text style={{ color: c.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 6 }}>
                    SPLIT AMONG {splitCount} · {sym}{perPerson.toLocaleString("en-IN")} EACH
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {splitDisplay.slice(0, 4).map((m) => (
                      <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
                        backgroundColor: m.isPayer
                          ? (isDark ? "rgba(74,222,128,0.12)" : "#F0FFF4")
                          : m.isYou
                            ? (isDark ? "rgba(124,92,255,0.12)" : "#F0EDFF")
                            : (isDark ? "rgba(255,255,255,0.06)" : "#F5F5F5"),
                        borderWidth: 1,
                        borderColor: m.isPayer
                          ? (isDark ? "rgba(74,222,128,0.3)" : "#A7F3D0")
                          : m.isYou
                            ? (isDark ? "rgba(124,92,255,0.3)" : "#D4CAFF")
                            : c.border,
                      }}>
                        <Text style={{ fontSize: 9 }}>{m.isPayer ? "✓" : "·"}</Text>
                        <Text style={{ color: m.isPayer ? c.positive : m.isYou ? c.indigo : c.textSecondary, fontSize: 11, fontWeight: (m.isPayer || m.isYou) ? "700" : "400" }}>
                          {m.name}
                        </Text>
                      </View>
                    ))}
                    {splitDisplay.length > 4 && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
                        <Text style={{ color: c.textMuted, fontSize: 11 }}>+{splitDisplay.length - 4} more</Text>
                      </View>
                    )}
                  </View>
                  {/* One-line plain English summary */}
                  <Text style={{ color: c.textMuted, fontSize: 10, marginTop: 7, lineHeight: 15 }}>
                    {isYouPaid
                      ? `You paid ${sym}${Math.round(exp.amount).toLocaleString("en-IN")} for ${splitCount} ${splitCount === 1 ? "person" : "people"} - each owes you ${sym}${perPerson.toLocaleString("en-IN")}.`
                      : `${payerName} paid ${sym}${Math.round(exp.amount).toLocaleString("en-IN")} for ${splitCount} ${splitCount === 1 ? "person" : "people"}.${splitIds.includes(userId) ? ` You owe ${sym}${perPerson.toLocaleString("en-IN")}.` : " You are not in this split."}`
                    }
                  </Text>
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
// BALANCES TAB - who owes whom, human language with arrows
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// INSIGHTS TAB - AI financial storytelling
// ═══════════════════════════════════════════════════════════════════════════════
// --- Expenses Tab ---
// --- Members Tab ---
// --- Members Tab ---
// --- Settle Tab ---
// --- Add Expense bottom sheet ---
// --- Add Member sheet ---
// --- Settings sheet ---
// SETTLE TAB - human language + action cards
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// INSIGHTS TAB - AI financial storytelling
// ═══════════════════════════════════════════════════════════════════════════════
// --- Expenses Tab ---
// --- Members Tab ---
// --- Members Tab ---
// --- Settle Tab ---
// --- Add Expense bottom sheet ---
// --- Add Member sheet ---
// --- Settings sheet ---
// SETTLE TAB - ultra-clear human settlement instructions
// ═══════════════════════════════════════════════════════════════════════════════
// SETTLE TAB - My Tab · All · Leaderboard
// ═══════════════════════════════════════════════════════════════════════════════
function BalancesTab({ trip, onChange, userId }: { trip: any; onChange: () => void; userId: string }) {
  const { c, isDark } = useTheme();
  const sym        = currencySymbol(trip.currency || "INR");
  const txns: any[] = trip.settlement_transactions || [];
  const bals: any[] = trip.balances || [];
  const total      = trip.total_spent || 0;
  const members    = trip.members || [];
  const perPerson  = total / Math.max(members.length, 1);
  const me         = bals.find((b: any) => b.id === userId || b.member_id === userId);
  const myNet      = me?.net || 0;
  const [view, setView] = React.useState<"mine"|"all"|"board">("mine");
  const [marking, setMarking] = React.useState<string | null>(null);
  const [localPaid, setLocalPaid] = React.useState<Record<string, boolean>>({});
  const [expandedTxn, setExpandedTxn] = React.useState<string | null>(null);

  const myPay = txns.filter((t: any) => t.from_id === userId);
  const myRec = txns.filter((t: any) => t.to_id === userId);

  const mark = async (t: any) => {
    const key = t.from_id + t.to_id;
    setMarking(key);
    setLocalPaid(prev => ({ ...prev, [key]: true }));
    try {
      await api.post("/trips/" + trip.id + "/settle", {
        from_member: t.from_id, to_member: t.to_id, amount: t.amount,
      });
      onChange();
    } catch (e: any) {
      setLocalPaid(prev => ({ ...prev, [key]: false }));
      Alert.alert("Error", e?.response?.data?.detail || "Could not record");
    } finally { setMarking(null); }
  };

  // ── Premium Settlement Card ───────────────────────────────────────────────
  const PremiumSettlementCard = ({ t, showMark }: { t: any; showMark: boolean }) => {
    const key    = t.from_id + t.to_id;
    const yPay   = t.from_id === userId;
    const yRec   = t.to_id === userId;
    const done   = localPaid[key];
    const busy   = marking === key;
    const isExpanded = expandedTxn === key;
    const payee  = members.find((m: any) => m.id === t.to_id);
    const payer  = members.find((m: any) => m.id === t.from_id);
    const fromBal = bals.find((b: any) => b.id === t.from_id || b.member_id === t.from_id);
    const toBal   = bals.find((b: any) => b.id === t.to_id || b.member_id === t.to_id);

    return (
      <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 20, overflow: "hidden", borderWidth: 0.5, borderColor: done ? "rgba(0,196,140,0.3)" : yPay ? "rgba(255,67,58,0.2)" : yRec ? "rgba(0,196,140,0.2)" : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"), marginBottom: 10, opacity: done ? 0.6 : 1 }}>

        {/* Top label */}
        <View style={{ backgroundColor: done ? "rgba(0,196,140,0.08)" : yPay ? "rgba(255,67,58,0.06)" : yRec ? "rgba(0,196,140,0.06)" : (isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"), paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
          <Text style={{ fontSize: 11, fontWeight: "500", color: done ? "#00C48C" : yPay ? "#FF453A" : yRec ? "#00C48C" : c.textSecondary, letterSpacing: 0.3 }}>
            {done ? "✓ Settled" : yPay ? "You need to pay" : yRec ? "You will receive" : "Payment required"}
          </Text>
        </View>

        {/* Main content */}
        <View style={{ padding: 16 }}>
          {/* Who pays who */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
            {/* Payer */}
            <View style={{ alignItems: "center", gap: 4 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: yPay ? "rgba(255,67,58,0.1)" : (isDark ? "#2C2C2E" : "#F0EDE8"), alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 17, fontWeight: "500", color: yPay ? "#FF453A" : c.textPrimary }}>{t.from_name?.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={{ fontSize: 11, color: c.textSecondary, fontWeight: "500" }}>{yPay ? "You" : t.from_name}</Text>
            </View>

            {/* Arrow with amount */}
            <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 22, fontWeight: "500", color: done ? "#00C48C" : yPay ? "#FF453A" : yRec ? "#00C48C" : c.textPrimary, letterSpacing: -0.5 }}>
                {sym}{Math.round(t.amount).toLocaleString("en-IN")}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ height: 1, flex: 1, backgroundColor: done ? "#00C48C" : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }} />
                <Ionicons name="arrow-forward" size={14} color={done ? "#00C48C" : c.textMuted} />
                <View style={{ height: 1, flex: 1, backgroundColor: done ? "#00C48C" : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }} />
              </View>
              <Text style={{ fontSize: 11, color: c.textMuted }}>to settle</Text>
            </View>

            {/* Receiver */}
            <View style={{ alignItems: "center", gap: 4 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: yRec ? "rgba(0,196,140,0.1)" : (isDark ? "#2C2C2E" : "#F0EDE8"), alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 17, fontWeight: "500", color: yRec ? "#00C48C" : c.textPrimary }}>{t.to_name?.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={{ fontSize: 11, color: c.textSecondary, fontWeight: "500" }}>{yRec ? "You" : t.to_name}</Text>
            </View>
          </View>

          {/* Breakdown rows */}
          <View style={{ backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#F7F5F2", borderRadius: 12, padding: 12, gap: 6, marginBottom: 12 }}>
            {[
              { label: "Paid", value: sym + Math.round(fromBal?.paid || 0).toLocaleString("en-IN"), sub: t.from_name },
              { label: "Fair share", value: sym + Math.round(perPerson).toLocaleString("en-IN"), sub: "per person" },
              { label: "Difference", value: "-" + sym + Math.round(t.amount).toLocaleString("en-IN"), color: "#FF453A" },
            ].map((row, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, color: c.textSecondary }}>{row.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: "500", color: row.color || c.textPrimary }}>{row.value}</Text>
              </View>
            ))}
          </View>

          {/* Why this payment expandable */}
          <TouchableOpacity
            onPress={() => setExpandedTxn(isExpanded ? null : key)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="sparkles" size={13} color="#6D5DFC" />
              <Text style={{ fontSize: 13, color: "#6D5DFC", fontWeight: "500" }}>Why this payment?</Text>
            </View>
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={c.textMuted} />
          </TouchableOpacity>

          {isExpanded && (
            <View style={{ backgroundColor: isDark ? "rgba(109,93,252,0.08)" : "#F5F3FF", borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 0.5, borderColor: isDark ? "rgba(109,93,252,0.2)" : "#DDD6FE", gap: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: "500", color: isDark ? "#A78BFA" : "#6D5DFC", marginBottom: 4 }}>Settlement Breakdown</Text>

              {/* From person */}
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "500", color: c.textPrimary }}>{t.from_name} {yPay ? "(You)" : ""}</Text>
                <Text style={{ fontSize: 12, color: c.textSecondary }}>Paid: {sym}{Math.round(fromBal?.paid || 0).toLocaleString("en-IN")} · Fair share: {sym}{Math.round(perPerson).toLocaleString("en-IN")} · Shortfall: {sym}{Math.round(t.amount).toLocaleString("en-IN")}</Text>
              </View>

              <View style={{ height: 0.5, backgroundColor: isDark ? "rgba(109,93,252,0.2)" : "#DDD6FE" }} />

              {/* To person */}
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "500", color: c.textPrimary }}>{t.to_name} {yRec ? "(You)" : ""}</Text>
                <Text style={{ fontSize: 12, color: c.textSecondary }}>Paid: {sym}{Math.round(toBal?.paid || 0).toLocaleString("en-IN")} · Fair share: {sym}{Math.round(perPerson).toLocaleString("en-IN")} · Extra contribution: {sym}{Math.round((toBal?.paid || 0) - perPerson).toLocaleString("en-IN")}</Text>
              </View>

              <View style={{ height: 0.5, backgroundColor: isDark ? "rgba(109,93,252,0.2)" : "#DDD6FE" }} />

              <Text style={{ fontSize: 12, color: isDark ? "#A78BFA" : "#6D5DFC", lineHeight: 18 }}>
                Therefore {t.from_name} should pay {t.to_name} {sym}{Math.round(t.amount).toLocaleString("en-IN")}. After this payment, both will have contributed their fair share of {sym}{Math.round(perPerson).toLocaleString("en-IN")}.
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        {showMark && !done && (
          <View style={{ padding: 14, paddingTop: 0, gap: 8 }}>
            <TouchableOpacity
              onPress={() => mark(t)}
              disabled={!!busy}
              style={{ backgroundColor: yPay ? "#FF453A" : "#00C48C", borderRadius: 12, padding: 14, alignItems: "center" }}
            >
              {busy ? <ActivityIndicator color="#fff" size="small" /> :
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "500" }}>
                  {yPay ? `Mark as paid · ${sym}${Math.round(t.amount).toLocaleString("en-IN")}` : "Mark as received"}
                </Text>
              }
            </TouchableOpacity>
            {yPay && payee?.upi_id && (
              <TouchableOpacity
                onPress={() => openUPI(payee.upi_id, t.to_name, t.amount, trip.name + " via Merizo")}
                style={{ backgroundColor: isDark ? "rgba(109,93,252,0.15)" : "#EDE9FE", borderRadius: 12, padding: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
              >
                <Ionicons name="phone-portrait-outline" size={15} color="#6D5DFC" />
                <Text style={{ color: "#6D5DFC", fontSize: 13, fontWeight: "500" }}>Pay via UPI</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tab bar */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 14, gap: 6, paddingBottom: 4 }}>
        {[{ id: "mine" as const, label: "My Tab" }, { id: "all" as const, label: "All" }, { id: "board" as const, label: "Leaderboard" }].map(tab => (
          <TouchableOpacity key={tab.id} onPress={() => setView(tab.id)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: view === tab.id ? (isDark ? "#7B6FFF" : "#111") : (isDark ? "#1C1C1E" : "#F0EDE8"), alignItems: "center", borderWidth: 0.5, borderColor: view === tab.id ? "transparent" : c.border }}>
            <Text style={{ color: view === tab.id ? "#fff" : c.textSecondary, fontSize: 12, fontWeight: "500" }}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <BalanceExplainer trip={trip} userId={userId} />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 80, gap: 12 }}>

          {/* Group Summary Card */}
          {total > 0 && (
            <View style={{ backgroundColor: "#111", borderRadius: 20, padding: 18, gap: 0 }}>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Group Summary</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {[
                  { label: "Total spent", value: sym + Math.round(total).toLocaleString("en-IN"), color: "#fff" },
                  { label: "Per person", value: sym + Math.round(perPerson).toLocaleString("en-IN"), color: "#fff" },
                  { label: "Members", value: String(members.length), color: "#fff" },
                ].map((s, i) => (
                  <View key={i} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12, padding: 10 }}>
                    <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 4, letterSpacing: 0.5 }}>{s.label}</Text>
                    <Text style={{ fontSize: 15, fontWeight: "500", color: s.color }}>{s.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ══ MY TAB ══ */}
          {view === "mine" && (
            <>
              {/* My net */}
              <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 0.5, borderColor: myNet > 0.5 ? "rgba(0,196,140,0.2)" : myNet < -0.5 ? "rgba(255,67,58,0.2)" : c.border }}>
                <View>
                  <Text style={{ fontSize: 11, color: c.textSecondary, marginBottom: 4 }}>Your balance</Text>
                  <Text style={{ fontSize: 28, fontWeight: "500", color: myNet > 0.5 ? "#00C48C" : myNet < -0.5 ? "#FF453A" : c.textSecondary, letterSpacing: -0.5 }}>
                    {myNet === 0 ? "Settled ✓" : (myNet > 0 ? "+" : "") + sym + Math.round(Math.abs(myNet)).toLocaleString("en-IN")}
                  </Text>
                  <Text style={{ fontSize: 12, color: c.textSecondary, marginTop: 2 }}>
                    {myNet > 0.5 ? "Others owe you" : myNet < -0.5 ? "You owe others" : "All balanced"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <View style={{ backgroundColor: isDark ? "#2C2C2E" : "#F0EDE8", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 12, color: c.textSecondary }}>{sym}{Math.round(total).toLocaleString("en-IN")} total</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: c.textMuted }}>{trip.expense_count || 0} expenses</Text>
                </View>
              </View>

              {/* WhatsApp + Copy share */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity onPress={() => {
                  const msg = `${trip.name} - Split Summary
Total: ${sym}${Math.round(total).toLocaleString("en-IN")}

${txns.map((t: any) => `${t.from_name} → ${t.to_name}: ${sym}${Math.round(t.amount).toLocaleString("en-IN")}`).join("\n")}

Tracked with Merizo - merizo.app`;
                  const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
                  Linking.openURL(url);
                }} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: c.border }}>
                  <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                  <Text style={{ fontSize: 13, fontWeight: "500", color: c.textPrimary }}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={async () => {
                  const msg = `${trip.name} - Split Summary\nTotal: ${sym}${Math.round(total).toLocaleString("en-IN")}\n\n${txns.map((t: any) => `${t.from_name} → ${t.to_name}: ${sym}${Math.round(t.amount).toLocaleString("en-IN")}`).join("\n")}\n\nTracked with Merizo - merizo.app`;
                  if (Platform.OS === "web") {
                    try { await (navigator as any).clipboard.writeText(msg); Alert.alert("Copied!", "Summary copied to clipboard."); }
                    catch { Share.share({ message: msg, title: trip.name }); }
                  } else {
                    Share.share({ message: msg, title: trip.name });
                  }
                }} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: c.border }}>
                  <Ionicons name="copy-outline" size={18} color={c.textPrimary} />
                  <Text style={{ fontSize: 13, fontWeight: "500", color: c.textPrimary }}>Copy</Text>
                </TouchableOpacity>
              </View>

              {/* My payments */}
              {myPay.length === 0 && myRec.length === 0 ? (
                <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 18, padding: 28, alignItems: "center", borderWidth: 0.5, borderColor: c.border }}>
                  <Text style={{ fontSize: 28, marginBottom: 10 }}>🎉</Text>
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#00C48C", marginBottom: 6 }}>You're all clear!</Text>
                  <Text style={{ fontSize: 13, color: c.textSecondary, textAlign: "center" }}>Nothing to pay or receive in this group.</Text>
                </View>
              ) : (
                <>
                  {myPay.length > 0 && (
                    <>
                      <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>YOU PAY ({myPay.length})</Text>
                      {myPay.map((t: any, i: number) => <PremiumSettlementCard key={i} t={t} showMark={true} />)}
                    </>
                  )}
                  {myRec.length > 0 && (
                    <>
                      <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>YOU RECEIVE ({myRec.length})</Text>
                      {myRec.map((t: any, i: number) => <PremiumSettlementCard key={i} t={t} showMark={false} />)}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* ══ ALL TAB ══ */}
          {view === "all" && (
            <>
              {/* Balance status cards */}
              <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>Member balances</Text>
              <View style={{ gap: 8 }}>
                {bals.map((b: any, i: number) => {
                  const net = b.net || 0;
                  const isMe = b.id === userId || b.member_id === userId;
                  const status = net > 0.5 ? "Gets Back" : net < -0.5 ? "Owes" : "Settled";
                  const statusColor = net > 0.5 ? "#00C48C" : net < -0.5 ? "#FF453A" : c.textSecondary;
                  return (
                    <View key={i} style={{ backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: net > 0.5 ? "rgba(0,196,140,0.1)" : net < -0.5 ? "rgba(255,67,58,0.1)" : (isDark ? "#2C2C2E" : "#F0EDE8"), alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 16, fontWeight: "500", color: statusColor }}>{(b.name || "?").charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary }}>{b.name || "Member"} {isMe ? "(You)" : ""}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <View style={{ backgroundColor: net > 0.5 ? "rgba(0,196,140,0.1)" : net < -0.5 ? "rgba(255,67,58,0.1)" : (isDark ? "#2C2C2E" : "#F0EDE8"), borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 11, color: statusColor, fontWeight: "500" }}>{status}</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: c.textSecondary }}>Paid {sym}{Math.round(b.paid || 0).toLocaleString("en-IN")}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 18, fontWeight: "500", color: statusColor, letterSpacing: -0.5 }}>
                        {net === 0 ? "✓" : (net > 0 ? "+" : "") + sym + Math.round(Math.abs(net)).toLocaleString("en-IN")}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {txns.length > 0 && (
                <>
                  <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>Settlement plan</Text>
                  {txns.map((t: any, i: number) => <PremiumSettlementCard key={i} t={t} showMark={false} />)}
                </>
              )}
            </>
          )}

          {/* ══ LEADERBOARD ══ */}
          {view === "board" && (
            <>
              <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>Who paid the most</Text>
              {[...bals].sort((a: any, b: any) => (b.paid || 0) - (a.paid || 0)).map((b: any, i: number) => {
                const maxPaid = Math.max(...bals.map((x: any) => x.paid || 0), 1);
                const pct = ((b.paid || 0) / maxPaid) * 100;
                const isMe = b.id === userId || b.member_id === userId;
                return (
                  <View key={i} style={{ backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: i === 0 ? "rgba(255,159,10,0.3)" : c.border }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <Text style={{ fontSize: 18 }}>{i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  "}</Text>
                      <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary, flex: 1 }}>{b.name} {isMe ? "(You)" : ""}</Text>
                      <Text style={{ fontSize: 15, fontWeight: "500", color: c.textPrimary }}>{sym}{Math.round(b.paid || 0).toLocaleString("en-IN")}</Text>
                    </View>
                    <View style={{ height: 4, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#F0EDE8", borderRadius: 2, overflow: "hidden" }}>
                      <View style={{ width: `${pct}%` as any, height: 4, backgroundColor: i === 0 ? "#FF9F0A" : "#6D5DFC", borderRadius: 2 }} />
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function InsightsTab({ trip }: { trip: any }) {
  const { c, isDark } = useTheme();
  const sym      = currencySymbol(trip.currency || "INR");
  const total    = trip.total_spent || 0;
  const balances = trip.balances || [];
  const txns     = trip.settlement_transactions || [];

  const [insights, setInsights]   = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(true);

  useEffect(() => {
    api.get("/trips/" + trip.id + "/ai-report")
      .then(r => setInsights(r.data))
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, [trip.id]);

  if (total === 0 && (trip.expense_count || 0) === 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
        <Text style={{ fontSize: 32 }}>📊</Text>
        <Text style={{ fontSize: 17, fontWeight: "500", color: c.textPrimary, textAlign: "center" }}>No spending data yet</Text>
        <Text style={{ fontSize: 14, color: c.textSecondary, textAlign: "center", lineHeight: 22 }}>Add expenses to see AI insights, financial score, and settlement recommendations.</Text>
      </View>
    );
  }
  const topPayer   = [...balances].sort((a: any, b: any) => (b.paid || 0) - (a.paid || 0))[0];
  const categories = trip.by_category || {};
  const topCatKey  = Object.keys(categories).sort((a, b) => categories[b] - categories[a])[0];
  const topCatPct  = topCatKey && total > 0 ? Math.round(categories[topCatKey] / total * 100) : 0;
  const catLabel: any = { food: "Food & Dining", trip: "Travel", home: "Home", friends: "Events", shopping: "Shopping", bills: "Bills", other: "Other" };
  const maxPaid    = Math.max(...balances.map((b: any) => b.paid || 0), 0);
  const avgPaid    = total / Math.max(balances.length, 1);
  const isUneven   = maxPaid > avgPaid * 2;
  const health     = txns.length === 0
    ? { label: "Fully settled", detail: "Everyone is square.", color: "#00C48C", bg: "rgba(0,196,140,0.08)", border: "rgba(0,196,140,0.2)" }
    : isUneven
    ? { label: "Uneven load", detail: `${topPayer?.name} covered most.`, color: "#FF453A", bg: "rgba(255,67,58,0.08)", border: "rgba(255,67,58,0.2)" }
    : { label: "Pending", detail: `${txns.length} payment${txns.length !== 1 ? "s" : ""} needed.`, color: "#FF9F0A", bg: "rgba(255,159,10,0.08)", border: "rgba(255,159,10,0.2)" };

  const staticInsights = [
    topPayer && `${topPayer.name} covered the most - ${sym}${Math.round(topPayer.paid || 0).toLocaleString("en-IN")}.`,
    topCatKey && `${catLabel[topCatKey] || topCatKey} is ${topCatPct}% of total spending.`,
    txns.length === 0 ? "The group is fully balanced." : `${txns.length} payment${txns.length !== 1 ? "s" : ""} will clear all balances.`,
    `Average spend: ${sym}${Math.round(total / Math.max(balances.length, 1)).toLocaleString("en-IN")} per person.`,
  ].filter(Boolean) as string[];

  const scoreRaw = txns.length === 0 ? 100 : isUneven ? 42 : Math.max(50, 100 - txns.length * 12);
  const score    = Math.min(100, Math.max(0, scoreRaw));
  const scoreColor = score >= 80 ? "#00C48C" : score >= 50 ? "#FF9F0A" : "#FF453A";

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100, gap: 14 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero AI card ── */}
      <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 20, overflow: "hidden", borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
        <View style={{ backgroundColor: isDark ? "rgba(109,93,252,0.15)" : "#F5F3FF", padding: 16, borderBottomWidth: 0.5, borderBottomColor: isDark ? "rgba(109,93,252,0.2)" : "#E0D9FF" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: isDark ? "rgba(109,93,252,0.3)" : "#EDE9FE", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="sparkles" size={14} color={isDark ? "#A78BFA" : "#6D5DFC"} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: "500", color: isDark ? "#A78BFA" : "#6D5DFC", letterSpacing: 0.3 }}>Merizo AI</Text>
          </View>
        </View>
        <View style={{ padding: 16 }}>
          {aiLoading ? (
            <View style={{ gap: 8 }}>
              <View style={{ height: 14, borderRadius: 7, backgroundColor: c.border, width: "90%" }} />
              <View style={{ height: 14, borderRadius: 7, backgroundColor: c.border, width: "70%" }} />
            </View>
          ) : (
            <Text style={{ fontSize: 15, color: c.textPrimary, lineHeight: 24, fontWeight: "400" }}>
              {insights?.summary || `Total ${sym}${Math.round(total).toLocaleString("en-IN")} across ${trip.expense_count || 0} expenses, ${balances.length} members.`}
            </Text>
          )}
        </View>
      </View>

      {/* ── Stats row ── */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <Text style={{ fontSize: 10, color: c.textSecondary, letterSpacing: 0.5, marginBottom: 6 }}>Total spent</Text>
          <Text style={{ fontSize: 20, fontWeight: "500", color: c.textPrimary, letterSpacing: -0.5 }}>{sym}{Math.round(total).toLocaleString("en-IN")}</Text>
          <Text style={{ fontSize: 11, color: c.textSecondary, marginTop: 2 }}>{trip.expense_count || 0} expenses</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <Text style={{ fontSize: 10, color: c.textSecondary, letterSpacing: 0.5, marginBottom: 6 }}>Per person</Text>
          <Text style={{ fontSize: 20, fontWeight: "500", color: c.textPrimary, letterSpacing: -0.5 }}>{sym}{Math.round(total / Math.max(balances.length, 1)).toLocaleString("en-IN")}</Text>
          <Text style={{ fontSize: 11, color: c.textSecondary, marginTop: 2 }}>{balances.length} members</Text>
        </View>
      </View>

      {/* ── Financial score ── */}
      <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 20, padding: 20, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", alignItems: "center" }}>
        <Text style={{ fontSize: 10, color: c.textSecondary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Financial score</Text>
        <Text style={{ fontSize: 64, fontWeight: "500", color: scoreColor, letterSpacing: -3, lineHeight: 72 }}>{score}</Text>
        <View style={{ width: "100%", height: 4, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#F0EDE8", borderRadius: 2, marginTop: 12, overflow: "hidden" }}>
          <View style={{ width: `${score}%`, height: 4, backgroundColor: scoreColor, borderRadius: 2 }} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: health.bg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: health.border }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: health.color }} />
          <Text style={{ fontSize: 12, fontWeight: "500", color: health.color }}>{health.label}</Text>
          <Text style={{ fontSize: 12, color: c.textSecondary }}>· {health.detail}</Text>
        </View>
      </View>

      {/* ── Sketch spending donut ── */}
      {topCatKey && total > 0 && (() => {
        const CAT_COLORS: Record<string, string> = {
          food: "#FF8B7B", travel: "#60A5FA", entertainment: "#A78BFA",
          utilities: "#FBBF24", shopping: "#F472B6", health: "#34D399",
          accommodation: "#E8B04E", trip: "#9D7BFF", other: "#9CA3AF",
        };
        const CAT_LABELS: Record<string, string> = {
          food: "Food", travel: "Travel", entertainment: "Fun",
          utilities: "Bills", shopping: "Shopping", health: "Health",
          accommodation: "Stay", trip: "Trip", other: "Other",
        };
        const CAT_EMOJI: Record<string, string> = {
          food: "🍽️", travel: "✈️", entertainment: "🎬",
          utilities: "⚡", shopping: "🛍️", health: "💊",
          accommodation: "🏨", trip: "🗺️", other: "📦",
        };
        const entries = Object.entries(categories)
          .filter(([, v]) => (v as number) > 0)
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .slice(0, 6);
        const segments = entries.map(([k, v]) => ({
          color: CAT_COLORS[k] || "#9CA3AF",
          value: v as number,
        }));
        return (
          <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 20, overflow: "hidden", borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
            <View style={{ padding: 16, borderBottomWidth: 0.5, borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "500", color: c.textPrimary }}>Spending Breakdown</Text>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isDark ? "#A78BFA" : "#6D5DFC" }} />
            </View>
            <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 16 }}>
              {/* Donut chart */}
              <DonutRing size={130} thickness={22} segments={segments}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: c.textMuted, textAlign: "center" }}>
                  {CAT_EMOJI[topCatKey] || "📦"}
                </Text>
                <Text style={{ fontSize: 9, color: c.textMuted, textAlign: "center" }}>
                  {topCatPct}%
                </Text>
              </DonutRing>
              {/* Legend */}
              <View style={{ flex: 1, gap: 6 }}>
                {entries.map(([k, v]) => {
                  const pct = total > 0 ? Math.round((v as number) / total * 100) : 0;
                  return (
                    <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: CAT_COLORS[k] || "#9CA3AF", flexShrink: 0 }} />
                      <Text style={{ flex: 1, fontSize: 12, color: c.textSecondary }} numberOfLines={1}>
                        {CAT_EMOJI[k]} {CAT_LABELS[k] || k}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: c.textPrimary }}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        );
      })()}

      {/* ── Key insights ── */}
      <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 20, overflow: "hidden", borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
        <View style={{ padding: 16, borderBottomWidth: 0.5, borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
          <Text style={{ fontSize: 13, fontWeight: "500", color: c.textPrimary }}>Key insights</Text>
        </View>
        {(insights?.recommendations || staticInsights).slice(0, 4).map((ins: string, i: number, arr: string[]) => (
          <View key={i} style={{ flexDirection: "row", gap: 12, padding: 14, borderBottomWidth: i < arr.length - 1 ? 0.5 : 0, borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", alignItems: "flex-start" }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isDark ? "#A78BFA" : "#6D5DFC", marginTop: 6, flexShrink: 0 }} />
            <Text style={{ fontSize: 14, color: c.textPrimary, lineHeight: 22, flex: 1 }}>{ins}</Text>
          </View>
        ))}
      </View>

      {/* ── Smart settlement ── */}
      {txns.length > 0 && (
        <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 20, overflow: "hidden", borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <View style={{ padding: 16, borderBottomWidth: 0.5, borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: c.textPrimary }}>Settle in {txns.length} payment{txns.length !== 1 ? "s" : ""}</Text>
            <Text style={{ fontSize: 12, color: c.textSecondary, marginTop: 2 }}>Fewest transactions to balance everyone</Text>
          </View>
          {txns.map((t: any, i: number) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: i < txns.length - 1 ? 0.5 : 0, borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", gap: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,67,58,0.1)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="arrow-forward" size={14} color="#FF453A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: c.textPrimary }}>
                  <Text style={{ fontWeight: "500" }}>{t.from_name}</Text>
                  <Text style={{ color: c.textSecondary }}> pays </Text>
                  <Text style={{ fontWeight: "500" }}>{t.to_name}</Text>
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "500", color: "#FF453A" }}>{sym}{Math.round(t.amount).toLocaleString("en-IN")}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
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

      {/* AI Insights - Forecast / Place Facts / Food Insight / Personality (above categories so it's visible without scrolling) */}
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
      const response = await api.get(`/trips/${trip.id}/export/csv`, { responseType: "text" });
      await Share.share({ message: response.data, title: `${trip.name}-expenses.csv` });
    } catch {
      Alert.alert("Export", "Could not export expenses. Please try again.");
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
                {String(memberMap.get(exp.paid_by) || "-")}
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
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Reset to all members every time the sheet opens
  React.useEffect(() => {
    setSplitAmong(trip.members.map((m: any) => m.id));
    setPaidBy(trip.members[0]?.id || "");
    setName(""); setAmount(""); setManualCat(null); setSplitMode("equal"); setCustomAmounts({}); setNotes(""); setRecurring("none"); setSplitMethod("equal"); setAiQuick("");
  }, []);
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
  const [notes, setNotes] = useState("");
  const [recurring, setRecurring] = useState<"none"|"weekly"|"biweekly"|"monthly">("none");
  const [splitMethod, setSplitMethod] = useState<"equal"|"percent"|"shares"|"exact">("equal");
  const [aiQuick, setAiQuick] = useState("");
  const [scanCount] = useState(3);

  // Auto-tag - runs as user types unless they manually picked
  const autoCat = manualCat || detectCategory(name);
  const cat = autoCat;
  const meta = categoryMeta[cat] || categoryMeta.other;

  // When payer changes, auto-add them to split if not already there
  const handleSetPaidBy = (id: string) => {
    setPaidBy(id);
    setSplitAmong((prev) => prev.includes(id) ? prev : [...prev, id]);
  };

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
          `${cap} typically supports ${limit} screens - splitting among ${memberCount} people may cause issues 📺`,
          [{ text: "OK" }]
        );
      }

      const customSplits = splitMode === "custom"
        ? splitAmong.map(id => ({ member_id: id, amount: parseFloat(customAmounts[id] || "0") }))
        : null;

      const r = await api.post(`/trips/${trip.id}/expenses`, {
        name: name.trim(),
        amount: amt,
        currency,
        category: cat,
        emoji: meta.emoji,
        paid_by: paidBy,
        split_among: splitAmong,
        ...(customSplits ? { split_type: "exact", custom_splits: customSplits } : {}),
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
    // user is typing - clear manual category override so auto-tag kicks back in
    if (manualCat && !upiFilled.category) setManualCat(null);
  };

  const onChangeAmount = (t: string) => {
    setAmount(t.replace(/[^0-9.]/g, ""));
    if (upiFilled.amount) setUpiFilled((f) => ({ ...f, amount: false }));
  };

  const allSelected = splitAmong.length === trip.members.length;
  const equalEach = splitAmong.length > 0 ? (parseFloat(amount || "0") / splitAmong.length) : 0;
  const customTotal = Object.values(customAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
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
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="always" style={Platform.OS === "web" ? { overflow: "auto" } as any : undefined}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 }}>
            <Text style={{ color: c.textPrimary, fontSize: 22, fontFamily: "Manrope_700Bold" }}>Add expense</Text>
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

          {/* Amount field - full width with currency pill on the label row */}
          <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={[styles.fieldLabel, { color: c.textSecondary, marginBottom: 0 }]}>AMOUNT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {currencyOptions.slice(0, 8).map((cur) => {
                  const active = currency === cur.code;
                  return (
                    <TouchableOpacity
                      key={cur.code}
                      testID={`add-exp-cur-${cur.code}`}
                      onPress={() => setCurrency(cur.code)}
                      style={[
                        styles.curMini,
                        {
                          backgroundColor: active ? indigo : c.surface,
                          borderColor: active ? "transparent" : c.border,
                        },
                      ]}
                    >
                      <Text style={{ color: active ? "#fff" : c.textPrimary, fontSize: 11, fontWeight: "700" }}>
                        {cur.code} {cur.symbol}
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
                    onPress={() => handleSetPaidBy(m.id)}
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
              {/* Split Method */}
              <View style={{ marginBottom:12 }}>
                <Text style={{ fontSize:11, fontWeight:"600", color:c.textSecondary, letterSpacing:1.2, textTransform:"uppercase", marginBottom:8 }}>Split Method</Text>
                <View style={{ flexDirection:"row", backgroundColor:isDark?"#1C1C1E":"#F0EDE8", borderRadius:12, padding:3, gap:2 }}>
                  {(["Equal","%","Shares","Exact"] as const).map((m,i)=>{
                    const key = ["equal","percent","shares","exact"][i] as any;
                    const active = splitMethod===key;
                    return (
                      <TouchableOpacity key={m} onPress={()=>{setSplitMethod(key); if(key==="equal")setSplitMode("equal"); else setSplitMode("custom");}} style={{ flex:1, paddingVertical:8, alignItems:"center", borderRadius:9, backgroundColor:active?(isDark?"#2C2C2E":"#fff"):"transparent" }}>
                        <Text style={{ fontSize:12, fontWeight:active?"600":"400", color:active?(isDark?"#7B6FFF":"#6D5DFC"):c.textSecondary }}>{m}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {splitMethod==="equal" && splitAmong.length>0 && parseFloat(amount||"0")>0 && (
                  <View style={{ backgroundColor:isDark?"#1C1C1E":"#F5F3FF", borderRadius:12, padding:12, marginTop:8, alignItems:"center", borderWidth:0.5, borderColor:isDark?"rgba(109,93,252,0.2)":"#DDD6FE" }}>
                    <Text style={{ fontSize:12, color:c.textSecondary }}>Each person pays</Text>
                    <Text style={{ fontSize:20, fontWeight:"500", color:"#6D5DFC", letterSpacing:-0.5 }}>
                      {currencySymbol(currency)}{(parseFloat(amount||"0")/splitAmong.length).toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Equal / Custom toggle */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => setSplitMode("equal")}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: 10, borderRadius: 12, borderWidth: 1.5,
                    backgroundColor: splitMode === "equal" ? indigo : c.surface,
                    borderColor: splitMode === "equal" ? indigo : c.border }}
                >
                  <Ionicons name="git-branch-outline" size={14} color={splitMode === "equal" ? "#fff" : c.textSecondary} />
                  <Text style={{ color: splitMode === "equal" ? "#fff" : c.textSecondary, fontSize: 13, fontWeight: "700" }}>Equal Split</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSplitMode("custom")}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: 10, borderRadius: 12, borderWidth: 1.5,
                    backgroundColor: splitMode === "custom" ? indigo : c.surface,
                    borderColor: splitMode === "custom" ? indigo : c.border }}
                >
                  <Ionicons name="create-outline" size={14} color={splitMode === "custom" ? "#fff" : c.textSecondary} />
                  <Text style={{ color: splitMode === "custom" ? "#fff" : c.textSecondary, fontSize: 13, fontWeight: "700" }}>Custom Split</Text>
                </TouchableOpacity>
              </View>

              {trip.members.map((m: any) => {
                const checked = splitAmong.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    testID={`add-exp-split-${m.id}`}
                    onPress={() => toggleMember(m.id)}
                    style={[styles.splitRow, { backgroundColor: c.surface, borderColor: c.border }]}
                  >
                    <View style={[styles.checkbox, { backgroundColor: checked ? indigo : "transparent", borderColor: checked ? "transparent" : c.border }]}>
                      {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "600", marginLeft: 12, flex: 1 }}>{m.name}</Text>
                    {splitMode === "equal" && checked && (
                      <Text style={{ color: c.textMuted, fontSize: 13, fontVariant: ["tabular-nums"] as any }}>
                        {currencySymbol(currency)}{equalEach > 0 ? Math.round(equalEach).toLocaleString("en-IN") : "0"}
                      </Text>
                    )}
                    {splitMode === "custom" && checked && (
                      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 6, minWidth: 90 }}>
                        <Text style={{ color: c.textMuted, fontSize: 14, fontWeight: "600" }}>{currencySymbol(currency)}</Text>
<WebInput
                            value={customAmounts[m.id] || ""}
                            onChange={(v: string) => setCustomAmounts(prev => ({ ...prev, [m.id]: v.replace(/[^0-9.]/g, "") }))}
                            placeholder="0"
                            type="number"
                            style={{ color: c.textPrimary, fontSize: 15, fontWeight: "700", minWidth: 60 }}
                          />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {splitMode === "custom" && (
                <View style={{ marginTop: 8, gap: 8 }}>
                  <View style={{ backgroundColor: isDark ? "rgba(157,123,255,0.08)" : "#F5F3FF", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: isDark ? "rgba(157,123,255,0.2)" : "#DDD6FE" }}>
                    <Text style={{ color: isDark ? "#9D7BFF" : "#6D28D9", fontSize: 13, fontWeight: "700", marginBottom: 4 }}>✏️ How Custom Split works</Text>
                    <Text style={{ color: isDark ? "#C4B5FD" : "#7C3AED", fontSize: 12, lineHeight: 18 }}>
                      Type how much each person owes. Like sharing pizza - ramu ate more slices, so they pay more! The total should match the bill amount.
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4 }}>
                    <Text style={{ color: c.textMuted, fontSize: 13 }}>Total entered</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ color: customTotal === parseFloat(amount || "0") ? c.positive : c.negative, fontSize: 14, fontWeight: "800" }}>
                        {currencySymbol(currency)}{Math.round(customTotal).toLocaleString("en-IN")}
                      </Text>
                      <Text style={{ color: c.textMuted, fontSize: 13 }}>
                        / {currencySymbol(currency)}{Math.round(parseFloat(amount || "0")).toLocaleString("en-IN")}
                      </Text>
                      {customTotal === parseFloat(amount || "0") && <Ionicons name="checkmark-circle" size={18} color={c.positive} />}
                    </View>
                  </View>
                  {customTotal > 0 && customTotal !== parseFloat(amount || "0") && (
                    <Text style={{ color: c.negative, fontSize: 12, textAlign: "center" }}>
                      {customTotal > parseFloat(amount || "0") ? "⚠️ Over by" : "⚠️ Still need"} {currencySymbol(currency)}{Math.abs(Math.round(parseFloat(amount || "0") - customTotal)).toLocaleString("en-IN")}
                    </Text>
                  )}
                </View>
              )}
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
            <Text style={{ color: c.textPrimary, fontSize: 18, fontFamily: "Manrope_700Bold" }}>
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
          <Text style={{ color: c.textPrimary, fontSize: 22, fontFamily: "Manrope_700Bold" }}>Add member</Text>
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
          <Text style={{ color: c.textPrimary, fontSize: 22, fontFamily: "Manrope_700Bold" }}>{trip.name}</Text>
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
  const list = currencyOptions.filter((cu) => cu.code.toLowerCase().includes(query.toLowerCase()));
  return (
    <View style={[styles.modalRoot, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
      <View style={[styles.upiModal, { backgroundColor: c.bg, borderColor: c.border, maxWidth: 420, padding: 18 }]}>
        <Text style={{ color: c.textPrimary, fontSize: 18, fontFamily: "Manrope_700Bold" }}>Change currency</Text>
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
            const cuCode = typeof cu === "object" ? (cu as any).code : cu as string;
            const active = cuCode === current;
            return (
              <TouchableOpacity
                key={cuCode}
                testID={`cur-pick-${cuCode}`}
                onPress={() => onPick(cuCode)}
                style={[
                  styles.curRow,
                  {
                    backgroundColor: active ? (isDark ? "rgba(124,92,255,0.18)" : "#F5F5F5") : "transparent",
                    borderColor: c.border,
                  },
                ]}
              >
                <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700", flex: 1 }}>{cuCode}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 13 }}>{currencySymbol(cuCode)}</Text>
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