/**
 * item-split.tsx
 * Item-level expense splitting — each person picks what they ordered.
 * Used after scanning a receipt or manual item entry.
 */

import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { useAuth } from "../src/lib/auth";
import { api } from "../src/lib/api";
import { currencySymbol, categoryMeta, detectCategory } from "../src/lib/tokens";

type Item = { id: string; name: string; price: number; assignedTo: string[] };
type Member = { id: string; name: string };

let nid = 1;
const mkid = () => `item_${nid++}`;

export default function ItemSplitScreen() {
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ trip_id?: string }>();
  const tripId = params.trip_id;

  const [trip, setTrip] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([
    { id: mkid(), name: "", price: 0, assignedTo: [] },
  ]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [paidBy, setPaidBy] = useState(user?.id || "");
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (tripId) {
      api.get("/trips/" + tripId).then(r => {
        setTrip(r.data);
        setPaidBy(user?.id || "");
      }).catch(() => router.back());
    }
  }, [tripId]);

  const members: Member[] = trip?.members || [];
  const sym = currencySymbol(trip?.currency || "INR");

  const addItem = () => {
    if (!newItemName.trim() || !newItemPrice) return;
    const price = parseFloat(newItemPrice.replace(/,/g, ""));
    if (isNaN(price) || price <= 0) return;
    setItems(prev => [...prev, {
      id: mkid(),
      name: newItemName.trim(),
      price,
      assignedTo: [],
    }]);
    setNewItemName("");
    setNewItemPrice("");
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const toggleAssign = (itemId: string, memberId: string) => {
    setItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const has = i.assignedTo.includes(memberId);
      return { ...i, assignedTo: has ? i.assignedTo.filter(x => x !== memberId) : [...i.assignedTo, memberId] };
    }));
  };

  const assignAll = (itemId: string) => {
    setItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, assignedTo: members.map(m => m.id) } : i
    ));
  };

  // Calculate each person's total
  const personTotals: Record<string, number> = {};
  for (const item of items) {
    if (item.assignedTo.length === 0) continue;
    const share = item.price / item.assignedTo.length;
    for (const mid of item.assignedTo) {
      personTotals[mid] = (personTotals[mid] || 0) + share;
    }
  }

  const grandTotal = items.reduce((s, i) => s + i.price, 0);
  const unassignedTotal = items.filter(i => i.assignedTo.length === 0).reduce((s, i) => s + i.price, 0);

  const submit = async () => {
    if (!tripId) return;
    if (items.length === 0) { Alert.alert("Add items first"); return; }
    if (unassignedTotal > 0) {
      Alert.alert("Unassigned items", `${sym}${Math.round(unassignedTotal).toLocaleString("en-IN")} worth of items have no one assigned. Assign them or remove them.`);
      return;
    }

    setSubmitting(true);
    try {
      // Create one expense per unique split pattern, or one combined expense
      // Simplest: one expense for the whole bill, split custom
      const allMemberIds = [...new Set(items.flatMap(i => i.assignedTo))];

      await api.post("/trips/" + tripId + "/expenses", {
        name: items.map(i => i.name).join(", "),
        amount: grandTotal,
        currency: trip?.currency || "INR",
        category: detectCategory(items[0]?.name || ""),
        paid_by: paidBy,
        split_among: allMemberIds,
        item_splits: items.map(i => ({
          name: i.name,
          price: i.price,
          assigned_to: i.assignedTo,
        })),
      });

      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not save");
    } finally {
      setSubmitting(false);
    }
  };

  if (!trip) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: c.bg }}>
      <ActivityIndicator color={isDark ? "#9D7BFF" : "#1F1A17"} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: Platform.OS === "web" ? 16 : 52, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Ionicons name="arrow-back" size={20} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: c.textMuted, fontSize: 8, letterSpacing: 3, fontFamily: "RobotoMono_400Regular" as any, marginBottom: 4 }}>
            ITEM-LEVEL SPLIT
          </Text>
          <Text style={{ color: c.textPrimary, fontSize: 22, fontFamily: "Syne_700Bold" as any, letterSpacing: -0.5 }}>
            {trip.name}
          </Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 4 }}>
            Assign each item to the people who ordered it.
          </Text>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 16 }}>

          {/* Who paid */}
          <View>
            <Text style={{ color: c.textMuted, fontSize: 9, letterSpacing: 2, fontFamily: "RobotoMono_400Regular" as any, marginBottom: 8 }}>WHO PAID THE BILL</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {members.map((m: Member) => (
                  <TouchableOpacity key={m.id} onPress={() => setPaidBy(m.id)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: paidBy === m.id ? (isDark ? "#9D7BFF" : "#1F1A17") : c.surface, borderWidth: 1, borderColor: paidBy === m.id ? "transparent" : c.border }}>
                    <Text style={{ color: paidBy === m.id ? "#fff" : c.textSecondary, fontSize: 13, fontWeight: "600" }}>
                      {m.id === user?.id ? "You" : m.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Add item */}
          <View>
            <Text style={{ color: c.textMuted, fontSize: 9, letterSpacing: 2, fontFamily: "RobotoMono_400Regular" as any, marginBottom: 8 }}>ADD ITEMS</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={newItemName}
                onChangeText={setNewItemName}
                placeholder="Item name (e.g. Pizza)"
                placeholderTextColor={c.textMuted}
                style={{ flex: 2, backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 10, color: c.textPrimary, fontSize: 13 } as any}
              />
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10 }}>
                <Text style={{ color: c.textMuted, fontSize: 13 }}>{sym}</Text>
                <TextInput
                  value={newItemPrice}
                  onChangeText={setNewItemPrice}
                  placeholder="0"
                  placeholderTextColor={c.textMuted}
                  keyboardType="decimal-pad"
                  onSubmitEditing={addItem}
                  style={{ flex: 1, color: c.textPrimary, fontSize: 13, fontFamily: "RobotoMono_700Bold" as any, padding: 10 } as any}
                />
              </View>
              <TouchableOpacity onPress={addItem}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? "#9D7BFF" : "#1F1A17", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Items list */}
          {items.map(item => (
            <View key={item.id} style={{ backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: item.assignedTo.length === 0 ? "rgba(255,139,123,0.4)" : c.border, overflow: "hidden" }}>
              {/* Item header */}
              <View style={{ flexDirection: "row", alignItems: "center", padding: 14, paddingBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>{item.name || "Unnamed item"}</Text>
                  {item.assignedTo.length > 0 && (
                    <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 2 }}>
                      {sym}{Math.round(item.price / item.assignedTo.length).toLocaleString("en-IN")} each · {item.assignedTo.length} {item.assignedTo.length === 1 ? "person" : "people"}
                    </Text>
                  )}
                  {item.assignedTo.length === 0 && (
                    <Text style={{ color: "#FF8B7B", fontSize: 11, marginTop: 2 }}>⚠️ No one assigned yet</Text>
                  )}
                </View>
                <Text style={{ fontFamily: "RobotoMono_700Bold" as any, fontSize: 16, color: c.textPrimary, marginRight: 12, fontVariant: ["tabular-nums"] as any }}>
                  {sym}{item.price.toLocaleString("en-IN")}
                </Text>
                <TouchableOpacity onPress={() => removeItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={18} color={c.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Member assignment */}
              <View style={{ paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text style={{ color: c.textMuted, fontSize: 9, letterSpacing: 1.5, fontFamily: "RobotoMono_400Regular" as any }}>WHO HAD THIS?</Text>
                  <TouchableOpacity onPress={() => assignAll(item.id)}>
                    <Text style={{ color: isDark ? "#9D7BFF" : "#6D28D9", fontSize: 11, fontWeight: "700" }}>Everyone</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {members.map((m: Member) => {
                    const checked = item.assignedTo.includes(m.id);
                    return (
                      <TouchableOpacity key={m.id} onPress={() => toggleAssign(item.id, m.id)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: checked ? (isDark ? "rgba(126,211,139,0.15)" : "#F0FFF4") : (isDark ? "rgba(255,255,255,0.05)" : "#F5F5F5"), borderWidth: 1.5, borderColor: checked ? (isDark ? "#7ED38B" : "#A7F3D0") : c.border }}>
                        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: checked ? (isDark ? "#7ED38B" : "#16A34A") : "transparent", borderWidth: checked ? 0 : 1.5, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
                          {checked && <Ionicons name="checkmark" size={10} color="#fff" />}
                        </View>
                        <Text style={{ color: checked ? (isDark ? "#7ED38B" : "#15803D") : c.textSecondary, fontSize: 12, fontWeight: checked ? "700" : "400" }}>
                          {m.id === user?.id ? "You" : m.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          ))}

          {/* Summary */}
          {items.length > 0 && (
            <View style={{ backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14 }}>
              <Text style={{ color: c.textMuted, fontSize: 9, letterSpacing: 2, fontFamily: "RobotoMono_400Regular" as any, marginBottom: 10 }}>SPLIT SUMMARY</Text>
              {members.filter(m => personTotals[m.id] > 0).map(m => (
                <View key={m.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.border }}>
                  <Text style={{ color: m.id === user?.id ? (isDark ? "#9D7BFF" : "#6D28D9") : c.textPrimary, fontSize: 13 }}>
                    {m.id === user?.id ? "You" : m.name}
                  </Text>
                  <Text style={{ fontFamily: "RobotoMono_700Bold" as any, fontSize: 14, color: m.id === paidBy ? c.positive : c.textPrimary, fontVariant: ["tabular-nums"] as any }}>
                    {sym}{Math.round(personTotals[m.id] || 0).toLocaleString("en-IN")}
                    {m.id === paidBy ? " (paid)" : ""}
                  </Text>
                </View>
              ))}
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 10 }}>
                <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: "700" }}>Total</Text>
                <Text style={{ fontFamily: "RobotoMono_700Bold" as any, fontSize: 15, color: c.textPrimary, fontVariant: ["tabular-nums"] as any }}>
                  {sym}{Math.round(grandTotal).toLocaleString("en-IN")}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Save button */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.border }}>
        <TouchableOpacity
          onPress={submit}
          disabled={submitting || items.length === 0 || unassignedTotal > 0}
          style={{ backgroundColor: isDark ? "#9D7BFF" : "#1F1A17", borderRadius: 14, paddingVertical: 16, alignItems: "center", opacity: (submitting || items.length === 0 || unassignedTotal > 0) ? 0.6 : 1 }}
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                Save to Ledger — {sym}{Math.round(grandTotal).toLocaleString("en-IN")}
              </Text>
          }
        </TouchableOpacity>
        {unassignedTotal > 0 && (
          <Text style={{ color: "#FF8B7B", fontSize: 12, textAlign: "center", marginTop: 8 }}>
            {sym}{Math.round(unassignedTotal).toLocaleString("en-IN")} still unassigned — tap "Everyone" or select people for each item
          </Text>
        )}
      </View>
    </View>
  );
}