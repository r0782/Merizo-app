import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";

const SMART_TEMPLATES = [
  { emoji: "📺", name: "Netflix", amount: 649, period: "monthly", category: "entertainment", color: "#E50914" },
  { emoji: "🎵", name: "Spotify", amount: 119, period: "monthly", category: "entertainment", color: "#1DB954" },
  { emoji: "☁️", name: "iCloud", amount: 75, period: "monthly", category: "bills", color: "#007AFF" },
  { emoji: "📦", name: "Amazon Prime", amount: 299, period: "monthly", category: "shopping", color: "#FF9900" },
  { emoji: "🏠", name: "Rent", amount: 0, period: "monthly", category: "home", color: "#6D5DFC" },
  { emoji: "💡", name: "Electricity", amount: 0, period: "monthly", category: "bills", color: "#FF9F0A" },
  { emoji: "🌊", name: "Water Bill", amount: 0, period: "monthly", category: "bills", color: "#00C48C" },
  { emoji: "📱", name: "Mobile Plan", amount: 0, period: "monthly", category: "bills", color: "#6D5DFC" },
];

export default function RecurringScreen() {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const [added, setAdded] = useState<string[]>([]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 36, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 20, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? "#1C1C1E" : "#F0EDE8", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={18} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: "500", color: c.textPrimary, letterSpacing: -0.5 }}>Smart Subscriptions</Text>
        </View>
        <Text style={{ paddingHorizontal: 20, fontSize: 13, color: c.textSecondary, marginBottom: 24, lineHeight: 20 }}>
          Track recurring bills and subscriptions. Merizo automatically adds them to your groups on the due date.
        </Text>

        {/* Auto-detect banner */}
        <View style={{ marginHorizontal: 20, marginBottom: 24, backgroundColor: isDark ? "rgba(109,93,252,0.15)" : "#F5F3FF", borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: isDark ? "rgba(109,93,252,0.3)" : "#DDD6FE" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Ionicons name="sparkles" size={16} color="#6D5DFC" />
            <Text style={{ fontSize: 13, fontWeight: "500", color: "#6D5DFC" }}>AI auto-detection</Text>
          </View>
          <Text style={{ fontSize: 12, color: isDark ? "#C4B5FD" : "#7C3AED", lineHeight: 18 }}>
            Merizo AI scans your expense history to detect recurring patterns and suggests adding them here automatically.
          </Text>
        </View>

        {/* Quick add templates */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Quick add</Text>
          <View style={{ gap: 8 }}>
            {SMART_TEMPLATES.map((t, i) => {
              const isAdded = added.includes(t.name);
              return (
                <View key={i} style={{ backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 0.5, borderColor: isAdded ? "rgba(0,196,140,0.3)" : c.border }}>
                  <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: t.color + "15", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary }}>{t.name}</Text>
                    <Text style={{ fontSize: 12, color: c.textSecondary }}>
                      {t.amount > 0 ? `₹${t.amount}/month` : "Set amount"} · Monthly
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setAdded(prev => isAdded ? prev.filter(n => n !== t.name) : [...prev, t.name])}
                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isAdded ? "#00C48C" : (isDark ? "#2C2C2E" : "#F0EDE8"), alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name={isAdded ? "checkmark" : "add"} size={18} color={isAdded ? "#fff" : c.textSecondary} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {added.length > 0 && (
          <View style={{ paddingHorizontal: 20 }}>
            <TouchableOpacity style={{ backgroundColor: "#6D5DFC", borderRadius: 16, padding: 16, alignItems: "center" }}
              onPress={() => { router.back(); }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "500" }}>Save {added.length} subscription{added.length > 1 ? "s" : ""}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
