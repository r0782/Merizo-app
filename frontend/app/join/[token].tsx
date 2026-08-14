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
  const { c } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [tripInfo, setTripInfo] = useState<{
    trip_id: string;
    trip_name: string;
    member_count: number;
    currency: string;
    invited_by?: string;
  } | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Fetch trip info (public endpoint — no auth required)
  useEffect(() => {
    if (!token) return;
    api.get(`/invite/${token}`, { skipAuth: true } as any)
      .then(r => setTripInfo(r.data))
      .catch(e => {
        const status = e?.response?.status;
        if (status === 410) setFetchError("This invite link has expired.");
        else if (status === 409) setFetchError("This invite link is no longer available.");
        else setFetchError("This invite link is invalid.");
      });
  }, [token]);

  const join = async () => {
    if (!user) {
      router.push(`/login?redirect=/join/${token}` as any);
      return;
    }
    setJoining(true);
    setJoinError("");
    try {
      const r = await api.post(`/invite/${token}/join`, {});
      setAlreadyMember(!!r.data?.already_member);
      setJoined(true);
      setTimeout(() => {
        router.replace(`/split/${tripInfo?.trip_id}` as any);
      }, 1200);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 410) setJoinError("This invite link has expired.");
      else if (status === 409) setJoinError("This invite link is no longer available.");
      else setJoinError(e?.response?.data?.detail || "Could not join. Please try again.");
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
          width: 64, height: 64,
          backgroundColor: c.surface,
          alignItems: "center", justifyContent: "center",
          marginBottom: 24,
          borderWidth: 1, borderColor: c.border,
        }}>
          <Ionicons name="people" size={30} color={c.textPrimary} />
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
                marginTop: 16, backgroundColor: c.textPrimary,
                paddingHorizontal: 28, paddingVertical: 14,
              }}
            >
              <Text style={{ color: c.bg, fontSize: 15, fontWeight: "700" }}>Go Home</Text>
            </TouchableOpacity>
          </View>
        ) : !tripInfo ? (
          // Loading
          <View style={{ alignItems: "center", gap: 12 }}>
            <ActivityIndicator size="large" color={c.textPrimary} />
            <Text style={{ color: c.textMuted, fontSize: 14 }}>Loading invite…</Text>
          </View>
        ) : joined ? (
          // Success
          <View style={{ alignItems: "center", gap: 12 }}>
            <View style={{
              width: 64, height: 64,
              backgroundColor: c.surface,
              alignItems: "center", justifyContent: "center",
              borderWidth: 1, borderColor: c.border,
            }}>
              <Ionicons name="checkmark" size={34} color={c.textPrimary} />
            </View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: c.textPrimary }}>
              {alreadyMember ? "Already a member" : "Joined!"}
            </Text>
            <Text style={{ fontSize: 15, color: c.textSecondary, textAlign: "center" }}>
              You're in <Text style={{ fontWeight: "700", color: c.textPrimary }}>{tripInfo.trip_name}</Text>
            </Text>
            <ActivityIndicator size="small" color={c.textMuted} style={{ marginTop: 8 }} />
            <Text style={{ fontSize: 12, color: c.textMuted }}>Opening group…</Text>
          </View>
        ) : (
          // Main invite card
          <View style={{ width: "100%", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 13, color: c.textSecondary, fontWeight: "600", letterSpacing: 1.2 }}>
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
              {tripInfo.invited_by ? ` · invited by ${tripInfo.invited_by}` : ""}
            </Text>

            {/* Info card */}
            <View style={{
              width: "100%", marginTop: 20, marginBottom: 8,
              backgroundColor: c.surface,
              padding: 18,
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
                    width: 36, height: 36,
                    backgroundColor: c.bg,
                    borderWidth: 1, borderColor: c.border,
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
              <Text style={{ color: c.textPrimary, fontSize: 13, textAlign: "center", fontWeight: "600" }}>{joinError}</Text>
            ) : null}

            {/* Join button */}
            <TouchableOpacity
              onPress={join}
              disabled={joining}
              style={{
                width: "100%", backgroundColor: c.textPrimary,
                paddingVertical: 16, alignItems: "center",
                opacity: joining ? 0.7 : 1, marginTop: 4,
              }}
            >
              {joining ? (
                <ActivityIndicator color={c.bg} size="small" />
              ) : (
                <Text style={{ color: c.bg, fontSize: 16, fontWeight: "800" }}>
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
