import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Platform, Modal, TextInput, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../src/lib/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@merizo:recurring";

export type Subscription = {
  name: string;
  emoji: string;
  amount: number;
  period: string;
  color: string;
};

export async function loadRecurring(): Promise<Subscription[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveRecurring(items: Subscription[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// ── Smart platform detection from name or amount ────────────────────────────
const PLATFORM_DB: { keywords: string[]; amounts: number[]; emoji: string; period: string }[] = [
  { keywords: ["netflix"],         amounts: [149, 199, 499, 649], emoji: "📺", period: "monthly" },
  { keywords: ["spotify"],         amounts: [59, 119, 179],       emoji: "🎵", period: "monthly" },
  { keywords: ["prime", "amazon"], amounts: [179, 299, 1499],     emoji: "📦", period: "monthly" },
  { keywords: ["youtube", "yt"],   amounts: [129, 189],           emoji: "▶️", period: "monthly" },
  { keywords: ["hotstar", "disney"], amounts: [299, 499, 899],    emoji: "🎬", period: "monthly" },
  { keywords: ["jio"],             amounts: [149, 239, 299, 399], emoji: "📡", period: "monthly" },
  { keywords: ["airtel"],          amounts: [199, 299, 399, 599], emoji: "📡", period: "monthly" },
  { keywords: ["icloud"],          amounts: [75, 219, 749],       emoji: "☁️", period: "monthly" },
  { keywords: ["notion"],          amounts: [0, 990],             emoji: "📝", period: "monthly" },
  { keywords: ["rent"],            amounts: [],                   emoji: "🏠", period: "monthly" },
  { keywords: ["electricity", "electric", "eb bill"], amounts: [], emoji: "💡", period: "monthly" },
  { keywords: ["water"],           amounts: [],                   emoji: "🌊", period: "monthly" },
  { keywords: ["internet", "wifi", "broadband"], amounts: [], emoji: "📶", period: "monthly" },
  { keywords: ["gym"],             amounts: [],                   emoji: "🏋️", period: "monthly" },
  { keywords: ["insurance"],       amounts: [],                   emoji: "🛡️", period: "monthly" },
  { keywords: ["emi", "loan"],     amounts: [],                   emoji: "🏦", period: "monthly" },
];

function detectPlatform(name: string, amount: number): { emoji: string; period: string } | null {
  const lower = name.toLowerCase().trim();
  for (const p of PLATFORM_DB) {
    if (p.keywords.some(k => lower.includes(k))) {
      return { emoji: p.emoji, period: p.period };
    }
  }
  if (amount > 0) {
    for (const p of PLATFORM_DB) {
      if (p.amounts.includes(amount)) {
        return { emoji: p.emoji, period: p.period };
      }
    }
  }
  return null;
}

function IcoBack({ color, size = 18 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M5 12L12 19M5 12L12 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}
function IcoTrash({ color, size = 16 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}
function IcoEdit({ color, size = 16 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}
function IcoClose({ color, size = 18 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={1.8} strokeLinecap="round"/></Svg>;
}

export default function RecurringScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const [saved, setSaved] = useState<Subscription[]>([]);
  const [editItem, setEditItem] = useState<Subscription | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editName, setEditName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addAmount, setAddAmount] = useState("");

  useFocusEffect(useCallback(() => {
    loadRecurring().then(setSaved);
  }, []));

  const deleteItem = async (name: string) => {
    const next = saved.filter(s => s.name !== name);
    setSaved(next);
    await saveRecurring(next);
  };

  const confirmDelete = (sub: Subscription) => {
    if (Platform.OS === "web") {
      if ((window as any).confirm(`Remove ${sub.name}?`)) deleteItem(sub.name);
    } else {
      Alert.alert("Remove", `Remove ${sub.name} from your list?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => deleteItem(sub.name) },
      ]);
    }
  };

  const openEdit = (sub: Subscription) => {
    setEditItem(sub);
    setEditAmount(sub.amount > 0 ? String(sub.amount) : "");
    setEditName(sub.name);
  };

  const saveEdit = async () => {
    if (!editItem) return;
    const amt = parseFloat(editAmount);
    const next = saved.map(s =>
      s.name === editItem.name
        ? { ...s, name: editName.trim() || s.name, amount: isNaN(amt) ? s.amount : amt }
        : s
    );
    setSaved(next);
    await saveRecurring(next);
    setEditItem(null);
  };

  const handleAdd = async () => {
    const name = addName.trim();
    const amt = parseFloat(addAmount);
    if (!name) { Alert.alert("Enter a name", "Type the subscription or bill name."); return; }
    if (saved.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert("Already added", `${name} is already in your list.`); return;
    }
    const detected = detectPlatform(name, isNaN(amt) ? 0 : amt);
    const newSub: Subscription = {
      name,
      emoji: detected?.emoji || "📌",
      amount: isNaN(amt) ? 0 : amt,
      period: detected?.period || "monthly",
      color: "#9A9A97",
    };
    const next = [...saved, newSub];
    setSaved(next);
    await saveRecurring(next);
    setAddName(""); setAddAmount(""); setShowAdd(false);
  };

  const detected = detectPlatform(addName, parseFloat(addAmount) || 0);
  const monthlyTotal = saved.reduce((s, b) => s + (b.amount || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 36, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
            <IcoBack color={c.textPrimary} size={16} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontFamily: "Manrope_700Bold", color: c.textPrimary, letterSpacing: -0.5 }}>Recurring Bills</Text>
            <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>Track subscriptions & fixed monthly costs</Text>
          </View>
        </View>

        {/* Monthly total */}
        {saved.length > 0 && (
          <View style={{ marginHorizontal: 20, marginBottom: 20, borderWidth: 1, borderColor: c.border, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, color: c.textMuted, fontFamily: "Manrope_600SemiBold", letterSpacing: 1, textTransform: "uppercase" }}>Monthly total</Text>
            <Text style={{ fontSize: 22, fontFamily: "Manrope_700Bold", color: c.textPrimary }}>
              ₹{monthlyTotal.toLocaleString("en-IN")}
            </Text>
          </View>
        )}

        {/* Add new button */}
        <TouchableOpacity
          onPress={() => setShowAdd(true)}
          style={{ marginHorizontal: 20, marginBottom: 20, borderWidth: 1, borderColor: c.textPrimary, backgroundColor: c.textPrimary, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Text style={{ fontSize: 14, fontFamily: "Manrope_700Bold", color: c.bg }}>+ Add subscription / bill</Text>
        </TouchableOpacity>

        {/* Saved subscriptions */}
        {saved.length > 0 ? (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 10, color: c.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Your subscriptions ({saved.length})</Text>
            <View style={{ borderWidth: 1, borderColor: c.border }}>
              {saved.map((sub, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: c.border }}>
                  <Text style={{ fontSize: 22, width: 32, textAlign: "center" }}>{sub.emoji}</Text>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => openEdit(sub)}>
                    <Text style={{ fontSize: 14, fontFamily: "Manrope_600SemiBold", color: c.textPrimary }}>{sub.name}</Text>
                    <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>
                      {sub.amount > 0 ? `₹${sub.amount.toLocaleString("en-IN")}/month` : "Tap to set amount"} · {sub.period}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEdit(sub)} style={{ padding: 8, marginRight: 2 }}>
                    <IcoEdit color={c.textMuted} size={15} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(sub)} style={{ padding: 8 }}>
                    <IcoTrash color={c.textMuted} size={15} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={{ marginHorizontal: 20, borderWidth: 1, borderColor: c.border, padding: 32, alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 28 }}>📋</Text>
            <Text style={{ fontSize: 15, fontFamily: "Manrope_700Bold", color: c.textPrimary }}>No subscriptions yet</Text>
            <Text style={{ fontSize: 12, color: c.textMuted, textAlign: "center", lineHeight: 18 }}>
              Add your monthly bills — rent, Netflix, Spotify, electricity — to track your fixed costs.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}>
          <View style={{ backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.border, padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 28 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontFamily: "Manrope_700Bold", color: c.textPrimary }}>Add subscription</Text>
              <TouchableOpacity onPress={() => { setShowAdd(false); setAddName(""); setAddAmount(""); }}
                style={{ width: 32, height: 32, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
                <IcoClose color={c.textMuted} size={16} />
              </TouchableOpacity>
            </View>

            {/* Name */}
            <Text style={{ fontSize: 10, color: c.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Name</Text>
            <TextInput
              value={addName}
              onChangeText={setAddName}
              placeholder="e.g. Netflix, Rent, Electricity..."
              placeholderTextColor={c.textMuted}
              style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.textPrimary, marginBottom: 14 } as any}
              autoFocus
            />

            {/* Amount */}
            <Text style={{ fontSize: 10, color: c.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Monthly amount (₹)</Text>
            <TextInput
              value={addAmount}
              onChangeText={setAddAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={c.textMuted}
              style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, fontFamily: "Manrope_700Bold", color: c.textPrimary, marginBottom: 14 } as any}
            />

            {/* Smart detection hint */}
            {(addName.length > 0 || addAmount.length > 0) && detected && (
              <View style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 12, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 20 }}>{detected.emoji}</Text>
                <Text style={{ fontSize: 12, color: c.textMuted, flex: 1 }}>
                  Detected as <Text style={{ color: c.textPrimary, fontFamily: "Manrope_600SemiBold" }}>{addName.trim() || "subscription"}</Text> · {detected.period}
                </Text>
              </View>
            )}

            <TouchableOpacity onPress={handleAdd} style={{ backgroundColor: c.textPrimary, padding: 16, alignItems: "center" }}>
              <Text style={{ color: c.bg, fontSize: 15, fontFamily: "Manrope_700Bold" }}>Add to list</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit modal */}
      <Modal visible={!!editItem} transparent animationType="slide" onRequestClose={() => setEditItem(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}>
          <View style={{ backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.border, padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 28 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 24 }}>{editItem?.emoji}</Text>
                <Text style={{ fontSize: 18, fontFamily: "Manrope_700Bold", color: c.textPrimary }}>Edit</Text>
              </View>
              <TouchableOpacity onPress={() => setEditItem(null)} style={{ width: 32, height: 32, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
                <IcoClose color={c.textMuted} size={16} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 10, color: c.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Name</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.textPrimary, marginBottom: 14 } as any}
            />
            <Text style={{ fontSize: 10, color: c.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Monthly amount (₹)</Text>
            <TextInput
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={c.textMuted}
              style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, fontFamily: "Manrope_700Bold", color: c.textPrimary, marginBottom: 24 } as any}
            />
            <TouchableOpacity onPress={saveEdit} style={{ backgroundColor: c.textPrimary, padding: 16, alignItems: "center" }}>
              <Text style={{ color: c.bg, fontSize: 15, fontFamily: "Manrope_700Bold" }}>Save changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
