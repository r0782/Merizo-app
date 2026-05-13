import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { useTheme } from "../../src/lib/theme";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";
import { SmartNum } from "../../src/components/DotNum";
import { currencySymbol } from "../../src/lib/tokens";
import { getOverbudgetAlerts, setOverbudgetAlerts } from "../../src/lib/settings";
import { FinancialRealmsSettings } from "../../src/components/FinancialRealmsSettings";
import { confirmAction } from "../../src/lib/confirm";
import { NumberTicker } from "../../src/components/NumberTicker";


export default function ProfileScreen() {
  const { c, isDark, mode, setMode } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ count: 0, settled: 0 });
  const [alertsOn, setAlertsOnState] = useState(true);

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
    getOverbudgetAlerts().then(setAlertsOnState);
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const initial = (user?.name || "M").trim().charAt(0).toUpperCase();

  const onLogout = async () => {
    const ok = await confirmAction(
      "Sign out?",
      "You'll need to sign in again to use Merizo.",
      "Sign out",
      true
    );
    if (!ok) return;
    await logout();
    router.replace("/login");
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

        {/* Stats - horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 16, marginHorizontal: -24 }}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
        >
          <StatCard label="SPLITS" value={String(stats.count)} testID="stat-splits" />
          <StatCard label="TOTAL SPENT" value={`${currencySymbol("INR")}${stats.settled.toLocaleString("en-IN")}`} testID="stat-settled" />
          <StatCard label="ACTIVE" value={String(Math.min(stats.count, 99))} testID="stat-active" />
        </ScrollView>

        {/* Theme card */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, marginTop: 16 }]}>
          <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>APPEARANCE</Text>
          <View style={styles.themeRow}>
            <ThemePill label="Light" active={mode === "light"} onPress={() => setMode("light")} icon="sunny-outline" testID="theme-light" />
            <ThemePill label="Dark" active={mode === "dark"} onPress={() => setMode("dark")} icon="moon-outline" testID="theme-dark" />
          </View>
        </View>

        <FinancialRealmsSettings />

        {/* Settings card */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, marginTop: 16 }]}>
          <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>SETTINGS</Text>

          <TouchableOpacity
            testID="overbudget-toggle"
            onPress={async () => {
              const next = !alertsOn;
              setAlertsOnState(next);
              await setOverbudgetAlerts(next);
            }}
            style={styles.settingRow}
          >
            <View style={styles.settingIcon}>
              <Ionicons name={alertsOn ? "alert-circle-outline" : "alert-circle"} size={20} color={alertsOn ? c.negative : c.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>
                Overbudget alerts
              </Text>
              <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 2 }}>
                {alertsOn
                  ? "Smart Limit turns red when you exceed your weekly budget"
                  : "Stay calm — Smart Limit always shows indigo even over budget"}
              </Text>
            </View>
            <View
              style={[
                styles.switchTrack,
                { backgroundColor: alertsOn ? (isDark ? c.indigo : "#0A0A0A") : c.border },
              ]}
            >
              <View
                style={[
                  styles.switchThumb,
                  {
                    backgroundColor: "#fff",
                    transform: [{ translateX: alertsOn ? 18 : 2 }],
                  },
                ]}
              />
            </View>
          </TouchableOpacity>
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
  
  // Extract just the number for animation
  const numericValue = parseFloat(value.replace(/[^0-9.-]+/g, "")) || 0;

  return (
    <View testID={testID} style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.border,overflow: "hidden",maxWidth: "100%", }]}>
      <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
        {label}
      </Text>
      <View style={{ marginTop: 8 ,overflow: "hidden", width: "100%"}}>
        {label === "TOTAL SPENT" ? (
          <NumberTicker 
            value={numericValue} 
            currency="₹"
            decimals={2}
            duration={2000} // 2 seconds - slower
          />
        ) : (
          <SmartNum value={value} size="lg" color={isDark ? "indigo" : "black"} />
        )}
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
    width: 160,
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
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 4,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  switchTrack: {
    width: 40,
    height: 22,
    borderRadius: 999,
    justifyContent: "center",
    marginLeft: 10,
  },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 999,
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
