import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Platform, SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";
import { currencySymbol } from "../../src/lib/tokens";

export default function JoinTripPage() {
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [tripInfo, setTripInfo] = useState<{
    trip_id: string;
    trip_name: string;
    member_count: number;
    currency: string;
  } | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Fetch trip info (public endpoint — no auth required)
  useEffect(() => {
    if (!token) return;
    api.get(`/invite/${token}`, { skipAuth: true } as any)
      .then(r => setTripInfo(r.data))
      .catch(() => setFetchError("This invite link is invalid or has expired."));
  }, [token]);

  const join = async () => {
    if (!user) {
      // Save token in route state and redirect to login
      router.push(`/login?redirect=/join/${token}` as any);
      return;
    }
    setJoining(true);
    setJoinError("");
    try {
      await api.post(`/invite/${token}/join`, {});
      setJoined(true);
      // Navigate to the group after a short delay
      setTimeout(() => {
        router.replace(`/split/${tripInfo?.trip_id}` as any);
      }, 1200);
    } catch (e: any) {
      setJoinError(e?.response?.data?.detail || "Could not join. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const sym = currencySymbol(tripInfo?.currency || "INR");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>

        {/* Logo / Icon */}
        <View style={{
          width: 72, height: 72, borderRadius: 22,
          backgroundColor: isDark ? "rgba(109,93,252,0.2)" : "#EDE9FE",
          alignItems: "center", justifyContent: "center",
          marginBottom: 24,
          borderWidth: 1.5, borderColor: isDark ? "rgba(109,93,252,0.4)" : "#C4B5FD",
        }}>
          <Ionicons name="people" size={34} color={isDark ? "#A78BFA" : "#6D28D9"} />
        </View>

        {/* Error state */}
        {fetchError ? (
          <View style={{ alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: c.textPrimary, textAlign: "center" }}>
              Invalid Link
            </Text>
            <Text style={{ fontSize: 15, color: c.textSecondary, textAlign: "center", lineHeight: 22 }}>
              {fetchError}
            </Text>
            <TouchableOpacity
              onPress={() => router.replace("/(tabs)/" as any)}
              style={{
                marginTop: 16, backgroundColor: isDark ? "#7B6FFF" : "#6D28D9",
                borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Go Home</Text>
            </TouchableOpacity>
          </View>
        ) : !tripInfo ? (
          // Loading
          <View style={{ alignItems: "center", gap: 12 }}>
            <ActivityIndicator size="large" color={isDark ? "#9D7BFF" : "#6D28D9"} />
            <Text style={{ color: c.textMuted, fontSize: 14 }}>Loading invite…</Text>
          </View>
        ) : joined ? (
          // Success
          <View style={{ alignItems: "center", gap: 12 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: "rgba(0,196,140,0.12)",
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="checkmark-circle" size={40} color="#00C48C" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: c.textPrimary }}>Joined!</Text>
            <Text style={{ fontSize: 15, color: c.textSecondary, textAlign: "center" }}>
              You're now in <Text style={{ fontWeight: "700", color: c.textPrimary }}>{tripInfo.trip_name}</Text>
            </Text>
            <ActivityIndicator size="small" color={c.textMuted} style={{ marginTop: 8 }} />
            <Text style={{ fontSize: 12, color: c.textMuted }}>Opening group…</Text>
          </View>
        ) : (
          // Main invite card
          <View style={{ width: "100%", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 13, color: isDark ? "#A78BFA" : "#6D28D9", fontWeight: "600", letterSpacing: 1.2 }}>
              YOU'VE BEEN INVITED
            </Text>
            <Text style={{
              fontSize: 28, fontWeight: "800", color: c.textPrimary,
              textAlign: "center", letterSpacing: -0.5, marginBottom: 4,
            }}>
              {tripInfo.trip_name}
            </Text>
            <Text style={{ fontSize: 14, color: c.textSecondary, textAlign: "center", lineHeight: 20 }}>
              {tripInfo.member_count} member{tripInfo.member_count !== 1 ? "s" : ""} already splitting expenses
            </Text>

            {/* Info card */}
            <View style={{
              width: "100%", marginTop: 20, marginBottom: 8,
              backgroundColor: isDark ? "#1C1C1E" : "#FAFAF8",
              borderRadius: 18, padding: 18,
              borderWidth: 1, borderColor: c.border,
              gap: 12,
            }}>
              {[
                { icon: "people-outline" as const, label: "Members", value: `${tripInfo.member_count} people` },
                { icon: "cash-outline" as const, label: "Currency", value: tripInfo.currency },
                { icon: "shield-checkmark-outline" as const, label: "Privacy", value: "Invite-only group" },
              ].map(({ icon, label, value }) => (
                <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 10,
                    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F0EDE8",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Ionicons name={icon} size={17} color={c.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: c.textMuted }}>{label}</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: c.textPrimary }}>{value}</Text>
                  </View>
                </View>
              ))}
            </View>

            {joinError ? (
              <Text style={{ color: "#FF453A", fontSize: 13, textAlign: "center" }}>{joinError}</Text>
            ) : null}

            {/* Join button */}
            <TouchableOpacity
              onPress={join}
              disabled={joining}
              style={{
                width: "100%", backgroundColor: isDark ? "#7B6FFF" : "#6D28D9",
                borderRadius: 16, paddingVertical: 16, alignItems: "center",
                opacity: joining ? 0.7 : 1, marginTop: 4,
              }}
            >
              {joining ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
                  {user ? `Join ${tripInfo.trip_name}` : "Log in to join"}
                </Text>
              )}
            </TouchableOpacity>

            {!user && (
              <Text style={{ fontSize: 12, color: c.textMuted, textAlign: "center", marginTop: 4 }}>
                You'll be taken back here after logging in
              </Text>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
