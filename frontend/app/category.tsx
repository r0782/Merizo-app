import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../src/lib/theme";
import { ROUTES } from "../src/lib/routes";

const items = [
  { key: "trip", icon: "airplane-outline", label: "Trip / Travel", description: "Beach, mountains, road trips", grad: ["#0EA5E9", "#0369A1"] },
  { key: "food", icon: "restaurant-outline", label: "Food & Dining", description: "Restaurants, drinks, takeout", grad: ["#F97316", "#9A3412"] },
  { key: "home", icon: "home-outline", label: "Home & Rent", description: "Rent, bills, utilities", grad: ["#10B981", "#065F46"] },
  { key: "friends", icon: "sparkles-outline", label: "Friends & Events", description: "Parties, meetups, gigs", grad: ["#F59E0B", "#92400E"] },
  { key: "shopping", icon: "bag-handle-outline", label: "Shopping", description: "Gifts, gear, groceries", grad: ["#A855F7", "#5B21B6"] },
  { key: "bills", icon: "flash-outline", label: "Bills & Subs", description: "Recurring expenses", grad: ["#14B8A6", "#0F766E"] },
] as const;

export default function CategoryScreen() {
  const { c, isDark } = useTheme();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: 60, paddingBottom: 40, paddingHorizontal: 24 }}>
        <View style={styles.topBar}>
          <TouchableOpacity
            testID="cat-back"
            onPress={() => router.back()}
            style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Ionicons name="arrow-back" size={20} color={c.textPrimary} />
          </TouchableOpacity>
        </View>

        <Text
          testID="cat-heading"
          style={{
            color: c.textPrimary,
            fontSize: 30,
            fontFamily: "Manrope_700Bold",
            letterSpacing: -1,
            marginTop: 24,
            lineHeight: 36,
          }}
        >
          What are you{"\n"}splitting?
        </Text>

        <View style={styles.grid}>
          {items.map((it) => (
            <TouchableOpacity
              key={it.key}
              testID={`cat-${it.key}`}
              onPress={() => router.push({ pathname: ROUTES.CREATE_SPLIT, params: { category: it.key } })}
              style={styles.cardWrap}
            >
              {isDark ? (
                <LinearGradient
                  colors={it.grad as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.card, { borderColor: c.border }]}
                >
                  <Ionicons name={it.icon} size={28} color={isDark ? "#fff" : c.textPrimary} />
                  <Text style={{ color: "#fff", fontFamily: "Manrope_700Bold", fontSize: 14, marginTop: 10 }}>
                    {it.label}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 4 }}>
                    {it.description}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <Ionicons name={it.icon} size={28} color={isDark ? "#fff" : c.textPrimary} />
                  <Text style={{ color: c.textPrimary, fontFamily: "Manrope_700Bold", fontSize: 14, marginTop: 10 }}>
                    {it.label}
                  </Text>
                  <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 4 }}>
                    {it.description}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center" },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    marginTop: 28,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  cardWrap: {
    width: "48.5%",
  },
  card: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 130,
  },
});
