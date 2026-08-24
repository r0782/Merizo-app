/**
 * Merizo — Invite Members
 * QR code + shareable link for a trip's invite. Reuses the same B&W
 * bordered-box style as app/split/[id].tsx (this screen is reached from
 * there), the app's Toast for feedback, and the existing invite endpoints.
 */
import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Platform, Share, SafeAreaView, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import { toast } from "../../src/components/Toast";
import { confirmAction } from "../../src/lib/confirm";
import { QRCodeGenerator } from "../../src/components/QRCodeGenerator";
import { type as t } from "../../src/lib/tokens";
import { ROUTES } from "../../src/lib/routes";

function IcoBack({ color = "", size = 18 }: any) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M5 12L12 19M5 12L12 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IcoCopy({ color = "", size = 16 }: any) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M16 8h2a2 2 0 012 2v8a2 2 0 01-2 2h-8a2 2 0 01-2-2v-2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IcoShare({ color = "", size = 16 }: any) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IcoRefresh({ color = "", size = 16 }: any) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M21 12a9 9 0 11-3-6.7M21 3v6h-6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IcoScan({ color = "", size = 16 }: any) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M4 8V5a1 1 0 011-1h3M20 8V5a1 1 0 00-1-1h-3M4 16v3a1 1 0 001 1h3M20 16v3a1 1 0 01-1 1h-3M4 12h16" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

interface InviteInfo {
  token: string;
  trip_name: string;
  join_url: string;
  expires_at: string | null;
  usage_count: number;
  max_uses: number | null;
}

export default function InviteMembersScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    setError("");
    try {
      const r = await api.get(`/trips/${tripId}/invite`);
      setInvite(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not load invite link");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  const copyLink = async () => {
    if (!invite) return;
    await Clipboard.setStringAsync(invite.join_url);
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (!invite) return;
    const message = `Join "${invite.trip_name}" on Merizo:\n${invite.join_url}`;
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title: `Join ${invite.trip_name} on Merizo`, text: message, url: invite.join_url });
      } else {
        await Share.share({ message, title: `Join ${invite.trip_name} on Merizo` });
      }
    } catch {
      // user cancelled the native share sheet — nothing to do
    }
  };

  const regenerate = async (ttlDays: number | null) => {
    const ok = await confirmAction(
      "Regenerate invite link?",
      "The old QR code and link will stop working immediately.",
      "Regenerate",
      true
    );
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api.post(`/trips/${tripId}/invite/regenerate`, { ttl_days: ttlDays });
      setInvite(r.data);
      toast.success("New invite link generated");
    } catch {
      toast.error("Could not regenerate invite link");
    } finally {
      setBusy(false);
    }
  };

  const expiresLabel = (() => {
    if (!invite) return "";
    if (!invite.expires_at) return "No expiry";
    const days = Math.ceil((new Date(invite.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Expires today";
    return `Expires in ${days} day${days === 1 ? "" : "s"}`;
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Header */}
      <View style={{ paddingTop: Platform.OS === "ios" ? 12 : 20, paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: c.border }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
          <IcoBack color={c.textPrimary} size={18} />
        </TouchableOpacity>
        <Text style={{ color: c.textPrimary, fontSize: 16, fontFamily: t.family.semibold }}>Invite Members</Text>
        <TouchableOpacity onPress={() => router.push(ROUTES.SCAN_QR)} style={{ width: 36, height: 36, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
          <IcoScan color={c.textPrimary} size={18} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, alignItems: "center" }}>
        {loading ? (
          <View style={{ paddingVertical: 80, alignItems: "center", gap: 12 }}>
            <ActivityIndicator color={c.textPrimary} />
            <Text style={{ color: c.textMuted, fontSize: 13 }}>Loading invite…</Text>
          </View>
        ) : error ? (
          <View style={{ paddingVertical: 80, alignItems: "center", gap: 12 }}>
            <Text style={{ color: c.textPrimary, fontSize: 15, fontFamily: t.family.semibold, textAlign: "center" }}>{error}</Text>
            <TouchableOpacity onPress={load} style={{ borderWidth: 1, borderColor: c.border, paddingHorizontal: 20, paddingVertical: 10 }}>
              <Text style={{ color: c.textPrimary, fontSize: 13, fontFamily: t.family.semibold }}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : invite ? (
          <>
            <Text style={{ color: c.textMuted, fontSize: 11, letterSpacing: 1.2, fontFamily: t.family.medium, marginTop: 20, marginBottom: 4, textTransform: "uppercase" }}>
              Invite to
            </Text>
            <Text style={{ color: c.textPrimary, fontSize: 22, fontFamily: t.family.bold, marginBottom: 24, textAlign: "center" }}>
              {invite.trip_name}
            </Text>

            <QRCodeGenerator value={invite.join_url} size={220} caption="Scan to join this group" />

            {/* Status */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.surface }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.textPrimary }} />
              <Text style={{ color: c.textSecondary, fontSize: 12, fontFamily: t.family.medium }}>{expiresLabel}</Text>
              {invite.max_uses ? (
                <Text style={{ color: c.textMuted, fontSize: 12 }}>· {invite.usage_count}/{invite.max_uses} used</Text>
              ) : null}
            </View>

            {/* Link row */}
            <TouchableOpacity
              onPress={copyLink}
              style={{ width: "100%", marginTop: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Text numberOfLines={1} style={{ flex: 1, color: c.textSecondary, fontSize: 13 }}>{invite.join_url}</Text>
              <IcoCopy color={c.textPrimary} size={16} />
            </TouchableOpacity>

            {/* Actions */}
            <View style={{ width: "100%", flexDirection: "row", gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                onPress={copyLink}
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: c.border, paddingVertical: 14 }}
              >
                <IcoCopy color={c.textPrimary} size={16} />
                <Text style={{ color: c.textPrimary, fontSize: 14, fontFamily: t.family.semibold }}>{copied ? "Copied" : "Copy Link"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={shareLink}
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.textPrimary, paddingVertical: 14 }}
              >
                <IcoShare color={c.bg} size={16} />
                <Text style={{ color: c.bg, fontSize: 14, fontFamily: t.family.semibold }}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* Expiration options */}
            <Text style={{ color: c.textMuted, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginTop: 28, marginBottom: 10, alignSelf: "flex-start" }}>
              Expiration
            </Text>
            <View style={{ width: "100%", flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                disabled={busy}
                onPress={() => regenerate(7)}
                style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderWidth: 1, borderColor: c.border, backgroundColor: invite.expires_at ? c.textPrimary : "transparent" }}
              >
                <Text style={{ fontSize: 13, fontFamily: t.family.semibold, color: invite.expires_at ? c.bg : c.textPrimary }}>7 days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={busy}
                onPress={() => regenerate(null)}
                style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderWidth: 1, borderColor: c.border, backgroundColor: !invite.expires_at ? c.textPrimary : "transparent" }}
              >
                <Text style={{ fontSize: 13, fontFamily: t.family.semibold, color: !invite.expires_at ? c.bg : c.textPrimary }}>No expiry</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 8, alignSelf: "flex-start" }}>
              Changing this regenerates the link — the old QR stops working.
            </Text>

            {/* Regenerate */}
            <TouchableOpacity
              disabled={busy}
              onPress={() => regenerate(invite.expires_at ? 7 : null)}
              style={{ marginTop: 24, flexDirection: "row", alignItems: "center", gap: 8, opacity: busy ? 0.5 : 1 }}
            >
              {busy ? <ActivityIndicator size="small" color={c.textSecondary} /> : <IcoRefresh color={c.textSecondary} size={14} />}
              <Text style={{ color: c.textSecondary, fontSize: 13, fontFamily: t.family.medium }}>Regenerate link</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
