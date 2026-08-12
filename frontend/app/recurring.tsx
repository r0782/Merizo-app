import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Platform, Modal, TextInput, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@merizo:recurring";

const TEMPLATES = [
  { emoji: "📺", name: "Netflix",        amount: 649,  period: "monthly", color: "#E50914" },
  { emoji: "🎵", name: "Spotify",        amount: 119,  period: "monthly", color: "#1DB954" },
  { emoji: "☁️", name: "iCloud",         amount: 75,   period: "monthly", color: "#007AFF" },
  { emoji: "📦", name: "Amazon Prime",   amount: 299,  period: "monthly", color: "#FF9900" },
  { emoji: "🏠", name: "Rent",           amount: 0,    period: "monthly", color: "#6D5DFC" },
  { emoji: "💡", name: "Electricity",    amount: 0,    period: "monthly", color: "#FF9F0A" },
  { emoji: "🌊", name: "Water Bill",     amount: 0,    period: "monthly", color: "#00C48C" },
  { emoji: "📱", name: "Mobile Plan",    amount: 0,    period: "monthly", color: "#6D5DFC" },
];

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

export default function RecurringScreen() {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const [saved, setSaved] = useState<Subscription[]>([]);
  const [editItem, setEditItem] = useState<Subscription | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editName, setEditName] = useState("");

  useFocusEffect(useCallback(() => {
    loadRecurring().then(setSaved);
  }, []));

  const isAdded = (name: string) => saved.some(s => s.name === name);

  const toggle = async (t: (typeof TEMPLATES)[0]) => {
    let next: Subscription[];
    if (isAdded(t.name)) {
      next = saved.filter(s => s.name !== t.name);
    } else {
      next = [...saved, { name: t.name, emoji: t.emoji, amount: t.amount, period: t.period, color: t.color }];
    }
    setSaved(next);
    await saveRecurring(next);
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

  const deleteItem = async (name: string) => {
    const next = saved.filter(s => s.name !== name);
    setSaved(next);
    await saveRecurring(next);
  };

  const confirmDelete = (sub: Subscription) => {
    if (Platform.OS === "web") {
      if ((window as any).confirm(`Remove ${sub.name}?`)) deleteItem(sub.name);
    } else {
      Alert.alert("Remove subscription", `Remove ${sub.name} from your list?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => deleteItem(sub.name) },
      ]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 36, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingHorizontal: 20, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={18} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: "700", color: c.textPrimary, letterSpacing: -0.5 }}>Subscriptions</Text>
        </View>
        <Text style={{ paddingHorizontal: 20, fontSize: 13, color: c.textSecondary, marginBottom: 24, lineHeight: 20 }}>
          Track recurring bills. Tap ✓ to add, tap a saved item to edit amount, long-press to remove.
        </Text>

        {/* Active subscriptions */}
        {saved.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Your subscriptions</Text>
            <View style={{ gap: 8 }}>
              {saved.map((sub, i) => (
                <View key={i} style={{ backgroundColor: c.surface, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: c.border }}>
                  <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Text style={{ fontSize: 20 }}>{sub.emoji}</Text>
                  </View>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => openEdit(sub)}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary }}>{sub.name}</Text>
                    <Text style={{ fontSize: 12, color: c.textSecondary }}>
                      {sub.amount > 0 ? `₹${sub.amount.toLocaleString("en-IN")}/month` : "Tap to set amount"} · Tap to edit
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(sub)} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={18} color={c.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* AI banner */}
        <View style={{ marginHorizontal: 20, marginBottom: 24, backgroundColor: c.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Ionicons name="sparkles" size={16} color={c.textSecondary} />
            <Text style={{ fontSize: 13, fontWeight: "500", color: c.textPrimary }}>AI auto-detection</Text>
          </View>
          <Text style={{ fontSize: 12, color: c.textSecondary, lineHeight: 18 }}>
            Merizo AI scans your expense history to detect recurring patterns automatically.
          </Text>
        </View>

        {/* Quick add templates */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Quick add</Text>
          <View style={{ gap: 8 }}>
            {TEMPLATES.map((t, i) => {
              const added = isAdded(t.name);
              return (
                <View key={i} style={{ backgroundColor: c.surface, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: added ? c.borderActive : c.border }}>
                  <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary }}>{t.name}</Text>
                    <Text style={{ fontSize: 12, color: c.textSecondary }}>
                      {t.amount > 0 ? `₹${t.amount}/month` : "Set amount"} · Monthly
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => toggle(t)}
                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: added ? c.textPrimary : c.surfaceAlt, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name={added ? "checkmark" : "add"} size={18} color={added ? c.bg : c.textSecondary} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={!!editItem} transparent animationType="slide" onRequestClose={() => setEditItem(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: "500", color: c.textPrimary }}>Edit Subscription</Text>
              <TouchableOpacity onPress={() => setEditItem(null)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={16} color={c.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: c.textSecondary, marginBottom: 6 }}>Name</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={{ backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.textPrimary, marginBottom: 16 }}
            />
            <Text style={{ fontSize: 12, color: c.textSecondary, marginBottom: 6 }}>Monthly amount (₹)</Text>
            <TextInput
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={c.textMuted}
              style={{ backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, fontWeight: "700", color: c.textPrimary, marginBottom: 24 }}
            />
            <TouchableOpacity onPress={saveEdit} style={{ backgroundColor: c.textPrimary, borderRadius: 14, padding: 16, alignItems: "center" }}>
              <Text style={{ color: c.bg, fontSize: 15, fontWeight: "600" }}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
