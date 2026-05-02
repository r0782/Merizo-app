import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";
import { SmartNum } from "../../src/components/DotNum";
import { currencySymbol } from "../../src/lib/tokens";

export default function ProfileScreen() {
  const { c, isDark, mode, setMode } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ count: 0, settled: 0 });

  const load = useCallback(async () => {
    try {
      const r = await api.get("/trips");
      const trips = r.data || [];
      const count = trips.length;
      let settled = 0;
      trips.forEach((t: any) => {
        const total = t.total_spent || 0;
        settled += total;
      });
      setStats({ count, settled: Math.round(settled) });
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const initial = (user?.name || "M").trim().charAt(0).toUpperCase();

  const onLogout = () => {
    Alert.alert("Sign out?", "You'll need to sign in again to use Merizo.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: 60, paddingBottom: 40, paddingHorizontal: 24 }}>
        <View style={styles.topBar}>
          <Text style={{ color: c.textPrimary, fontSize: 26, fontFamily: "Syne_700Bold", letterSpacing: -0.5 }}>
            Profile
          </Text>
          <TouchableOpacity
            testID="profile-theme-toggle"
            onPress={() => setMode(mode === "light" ? "dark" : "light")}
            style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color={c.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.profileCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[styles.avatar, { backgroundColor: isDark ? c.indigo : "#0A0A0A" }]}>
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800" }}>{initial}</Text>
          </View>
          <Text testID="profile-name" style={{ color: c.textPrimary, fontSize: 22, fontWeight: "800", marginTop: 14, letterSpacing: -0.5 }}>
            {user?.name || "—"}
          </Text>
          <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 4 }}>{user?.email || ""}</Text>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          <StatCard label="SPLITS" value={String(stats.count)} testID="stat-splits" />
          <StatCard label="TOTAL SPENT" value={`${currencySymbol("INR")}${stats.settled.toLocaleString("en-IN")}`} testID="stat-settled" />
        </View>

        {/* Theme card */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, marginTop: 16 }]}>
          <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>APPEARANCE</Text>
          <View style={styles.themeRow}>
            <ThemePill label="Light" active={mode === "light"} onPress={() => setMode("light")} icon="sunny-outline" testID="theme-light" />
            <ThemePill label="Dark" active={mode === "dark"} onPress={() => setMode("dark")} icon="moon-outline" testID="theme-dark" />
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          testID="logout-btn"
          onPress={onLogout}
          style={[styles.logoutBtn, { borderColor: c.border, backgroundColor: c.surface }]}
        >
          <Ionicons name="log-out-outline" size={18} color={c.negative} />
          <Text style={{ color: c.negative, fontSize: 15, fontWeight: "700", marginLeft: 8 }}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const { c, isDark } = useTheme();
  return (
    <View testID={testID} style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>{label}</Text>
      <View style={{ marginTop: 8 }}>
        <SmartNum value={value} size="lg" color={isDark ? "indigo" : "black"} />
      </View>
    </View>
  );
}

function ThemePill({ label, active, onPress, icon, testID }: { label: string; active: boolean; onPress: () => void; icon: any; testID?: string }) {
  const { c, isDark } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[
        styles.themePill,
        {
          backgroundColor: active ? (isDark ? c.indigo : "#0A0A0A") : "transparent",
          borderColor: active ? "transparent" : c.border,
        },
      ]}
    >
      <Ionicons name={icon} size={16} color={active ? "#fff" : c.textPrimary} />
      <Text style={{ color: active ? "#fff" : c.textPrimary, fontSize: 13, fontWeight: "700", marginLeft: 6 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    marginTop: 24,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  themeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  themePill: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
