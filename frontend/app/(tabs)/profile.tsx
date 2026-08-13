/**
 * MERIZO Profile — Notebook-style personal page
 * White paper + black ink + minimal hand-drawn borders
 */
import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  Platform, Linking, Modal, TextInput, Switch, Share,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { useTheme } from "../../src/lib/theme";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";
import { currencySymbol, type } from "../../src/lib/tokens";
import { getLanguageMeta, getCurrentLanguage } from "../../src/lib/i18n";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "JPY", "AUD", "CAD"];

// ── Ink divider ───────────────────────────────────────────────────────────────
function InkDivider({ c }: any) {
  return <View style={{ height: 1, backgroundColor: c.border, opacity: 0.15, marginHorizontal: 20 }} />;
}

// ── Arrow icon (hand-drawn chevron) ──────────────────────────────────────────
function ChevronRight({ c }: any) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path d="M 5 3 L 11 8 L 5 13" stroke={c.textMuted} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Settings row ──────────────────────────────────────────────────────────────
function ProfileRow({ icon, label, sub, onPress, right, danger = false, c }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, gap: 14 }}
    >
      <View style={{ width: 20, alignItems: "center", opacity: 0.7 }}>
        {icon({ size: 18, color: danger ? c.textPrimary : c.textPrimary })}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: type.family.medium, fontSize: type.size.sm, color: danger ? "#cc0000" : c.textPrimary }}>
          {label}
        </Text>
        {sub && (
          <Text style={{ fontFamily: type.family.regular, fontSize: 11, color: c.textMuted, marginTop: 1 }}>
            {sub}
          </Text>
        )}
      </View>
      {right !== undefined ? right : <ChevronRight c={c} />}
    </TouchableOpacity>
  );
}

// ── Deterministic QR-like SVG from user id ────────────────────────────────────
function SketchQR({ userId, size = 120, c }: { userId: string; size?: number; c: any }) {
  const cells = 11;
  const cell = size / cells;
  // Deterministic hash from userId string
  const hash = (s: string) => {
    let h = 0x9e3779b9;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x9e3779b9);
    return h >>> 0;
  };
  const bits: boolean[][] = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, col) => {
      // Always fill corners (3×3 finder patterns)
      if ((r < 3 && col < 3) || (r < 3 && col >= cells - 3) || (r >= cells - 3 && col < 3)) return true;
      // Mirror left half to right for symmetry
      const c2 = col < Math.ceil(cells / 2) ? col : cells - 1 - col;
      return !!(hash(userId + r + c2) & 1);
    })
  );
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {bits.map((row, r) =>
        row.map((on, col) =>
          on ? (
            <Path
              key={`${r}-${col}`}
              d={`M ${col * cell + 1} ${r * cell + 1} h ${cell - 2} v ${cell - 2} h -${cell - 2} Z`}
              fill={c.textPrimary}
            />
          ) : null
        )
      )}
    </Svg>
  );
}

// ── SVG profile icon ──────────────────────────────────────────────────────────
function ProfileSketchIcon({ size = 48, initial, c }: any) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center", position: "relative" }}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {/* Slightly imperfect circle */}
        <Path
          d="M 24 4 Q 40 4 44 20 Q 44 38 24 44 Q 6 42 4 26 Q 2 8 24 4 Z"
          stroke={c.textPrimary} strokeWidth={1.5} fill={c.surfaceAlt}
        />
        {/* Person sketch */}
        <Circle cx={24} cy={19} r={6} stroke={c.textPrimary} strokeWidth={1.3} fill="none" />
        <Path d="M 10 40 Q 10 30 24 30 Q 38 30 38 40" stroke={c.textPrimary} strokeWidth={1.3} fill="none" strokeLinecap="round" />
      </Svg>
      {/* Initial overlay */}
      <Text style={{ position: "absolute", fontFamily: type.family.bold, fontSize: size * 0.32, color: c.textPrimary, letterSpacing: -0.5 }}>
        {initial}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { c, isDark, toggle } = useTheme();
  const { user, logout, refresh } = useAuth();
  const router = useRouter();

  const [currency,    setCurrency]    = useState("INR");
  const [editProfile, setEditProfile] = useState(false);
  const [editName,    setEditName]    = useState(user?.name || "");
  const [notifications, setNotifications] = useState(true);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [totalGroups, setTotalGroups] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem("merizo_currency").then(cur => { if (cur) setCurrency(cur); }).catch(() => {});
    api.get("/trips").then(r => setTotalGroups((r.data || []).length)).catch(() => {});
  }, []);

  // Sync editName whenever the live user object changes (e.g. after refresh)
  useEffect(() => { setEditName(user?.name || ""); }, [user?.name]);

  const initial  = (user?.name || "U").charAt(0).toUpperCase();
  const sym      = currencySymbol(currency);
  const langMeta = getLanguageMeta(getCurrentLanguage());

  const onSignOut = () => {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          try { await logout(); } catch {}
          // Navigate outside tabs unconditionally
          router.replace("/login");
        },
      },
    ]);
  };

  const onDeleteAccount = () => {
    Alert.alert("Delete account",
      "Email support@merizo.app to permanently delete your account.",
      [{ text: "Cancel", style: "cancel" },
       { text: "Email Support", onPress: () => Linking.openURL("mailto:support@merizo.app?subject=Delete%20my%20account") }]);
  };

  // Simple inline SVG icons
  const icons = {
    currency:  (p: any) => <Svg width={p.size} height={p.size} viewBox="0 0 20 20"><Path d="M 10 2 Q 16 2 18 10 Q 16 18 10 18 Q 4 18 2 10 Q 4 2 10 2 Z" stroke={p.color} strokeWidth={1.3} fill="none" /><Text style={{ fontSize: 10, color: p.color, position: "absolute", left: 5, top: 4 }}>₹</Text></Svg>,
    language:  (p: any) => <Svg width={p.size} height={p.size} viewBox="0 0 20 20"><Circle cx={10} cy={10} r={7} stroke={p.color} strokeWidth={1.3} fill="none" /><Path d="M 3 10 L 17 10" stroke={p.color} strokeWidth={1} strokeLinecap="round" /><Path d="M 10 3 Q 7 10 10 17" stroke={p.color} strokeWidth={1} fill="none" /><Path d="M 10 3 Q 13 10 10 17" stroke={p.color} strokeWidth={1} fill="none" /></Svg>,
    ai:        (p: any) => <Svg width={p.size} height={p.size} viewBox="0 0 20 20"><Path d="M 3 5 Q 3 3 5 3 L 15 3 Q 17 3 17 5 L 17 12 Q 17 14 15 14 L 7 14 L 3 17 L 3 5 Z" stroke={p.color} strokeWidth={1.3} fill="none" strokeLinejoin="round" /></Svg>,
    bell:      (p: any) => <Svg width={p.size} height={p.size} viewBox="0 0 20 20"><Path d="M 5 9 Q 5 4 10 4 Q 15 4 15 9 L 16 14 L 4 14 Z" stroke={p.color} strokeWidth={1.3} fill="none" strokeLinejoin="round" /><Path d="M 8 14 Q 8 17 10 17 Q 12 17 12 14" stroke={p.color} strokeWidth={1.2} fill="none" /></Svg>,
    chart:     (p: any) => <Svg width={p.size} height={p.size} viewBox="0 0 20 20"><Line x1={2} y1={17} x2={18} y2={17} stroke={p.color} strokeWidth={1.3} strokeLinecap="round" /><Line x1={5} y1={17} x2={5} y2={11} stroke={p.color} strokeWidth={1.3} strokeLinecap="round" /><Line x1={9} y1={17} x2={9} y2={7} stroke={p.color} strokeWidth={1.3} strokeLinecap="round" /><Line x1={13} y1={17} x2={13} y2={12} stroke={p.color} strokeWidth={1.3} strokeLinecap="round" /><Line x1={17} y1={17} x2={17} y2={4} stroke={p.color} strokeWidth={1.3} strokeLinecap="round" /></Svg>,
    repeat:    (p: any) => <Svg width={p.size} height={p.size} viewBox="0 0 20 20"><Path d="M 4 6 Q 4 3 10 3 Q 16 3 16 8" stroke={p.color} strokeWidth={1.3} fill="none" strokeLinecap="round" /><Path d="M 13 1 L 16 3 L 13 5" stroke={p.color} strokeWidth={1.2} fill="none" strokeLinejoin="round" /><Path d="M 16 14 Q 16 17 10 17 Q 4 17 4 12" stroke={p.color} strokeWidth={1.3} fill="none" strokeLinecap="round" /><Path d="M 7 19 L 4 17 L 7 15" stroke={p.color} strokeWidth={1.2} fill="none" strokeLinejoin="round" /></Svg>,
    question:  (p: any) => <Svg width={p.size} height={p.size} viewBox="0 0 20 20"><Circle cx={10} cy={10} r={7} stroke={p.color} strokeWidth={1.3} fill="none" /><Path d="M 7 8 Q 7 5 10 5 Q 13 5 13 8 Q 13 10 10 11" stroke={p.color} strokeWidth={1.2} fill="none" strokeLinecap="round" /><Circle cx={10} cy={14.5} r={0.8} fill={p.color} /></Svg>,
    mail:      (p: any) => <Svg width={p.size} height={p.size} viewBox="0 0 20 20"><Path d="M 2 5 L 10 11 L 18 5" stroke={p.color} strokeWidth={1.2} fill="none" strokeLinejoin="round" /><Path d="M 2 5 L 2 16 L 18 16 L 18 5 L 2 5 Z" stroke={p.color} strokeWidth={1.3} fill="none" strokeLinejoin="round" /></Svg>,
    download:  (p: any) => <Svg width={p.size} height={p.size} viewBox="0 0 20 20"><Path d="M 10 3 L 10 13 M 6 10 L 10 14 L 14 10" stroke={p.color} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" /><Line x1={3} y1={17} x2={17} y2={17} stroke={p.color} strokeWidth={1.3} strokeLinecap="round" /></Svg>,
    trash:     (p: any) => <Svg width={p.size} height={p.size} viewBox="0 0 20 20"><Path d="M 4 6 L 16 6 L 15 17 L 5 17 Z" stroke={p.color} strokeWidth={1.3} fill="none" strokeLinejoin="round" /><Line x1={2} y1={6} x2={18} y2={6} stroke={p.color} strokeWidth={1.3} strokeLinecap="round" /><Path d="M 7 6 L 7 4 L 13 4 L 13 6" stroke={p.color} strokeWidth={1.2} fill="none" strokeLinejoin="round" /></Svg>,
    logout:    (p: any) => <Svg width={p.size} height={p.size} viewBox="0 0 20 20"><Path d="M 8 3 L 3 3 L 3 17 L 8 17" stroke={p.color} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" /><Path d="M 12 7 L 17 10 L 12 13" stroke={p.color} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" /><Line x1={8} y1={10} x2={17} y2={10} stroke={p.color} strokeWidth={1.3} strokeLinecap="round" /></Svg>,
    theme:     (p: any) => isDark
      ? <Svg width={p.size} height={p.size} viewBox="0 0 20 20"><Circle cx={10} cy={10} r={4} stroke={p.color} strokeWidth={1.3} fill="none" /><Line x1={10} y1={2} x2={10} y2={4} stroke={p.color} strokeWidth={1.2} strokeLinecap="round" /><Line x1={10} y1={16} x2={10} y2={18} stroke={p.color} strokeWidth={1.2} strokeLinecap="round" /><Line x1={2} y1={10} x2={4} y2={10} stroke={p.color} strokeWidth={1.2} strokeLinecap="round" /><Line x1={16} y1={10} x2={18} y2={10} stroke={p.color} strokeWidth={1.2} strokeLinecap="round" /></Svg>
      : <Svg width={p.size} height={p.size} viewBox="0 0 20 20"><Path d="M 10 3 Q 16 4 16 12 Q 16 18 8 18 Q 2 16 3 10 Q 5 3 10 3 Z" stroke={p.color} strokeWidth={1.3} fill="none" /></Svg>,
  };

  // ── Section label ──────────────────────────────────────────────────────────
  const SectionLabel = ({ label }: { label: string }) => (
    <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
      <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase" }}>
        {label}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 40, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page heading ── */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>
            Account
          </Text>
          <Text style={{ fontFamily: type.family.bold, fontSize: 28, color: c.textPrimary, letterSpacing: -1 }}>
            Profile
          </Text>
        </View>

        <View style={{ height: 1, backgroundColor: c.border, opacity: 0.3, marginHorizontal: 20 }} />

        {/* ── User identity card ── */}
        <TouchableOpacity
          onPress={() => setEditProfile(true)}
          activeOpacity={0.7}
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 20, gap: 16 }}
        >
          <ProfileSketchIcon size={52} initial={initial} c={c} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: type.family.bold, fontSize: type.size.md, color: c.textPrimary, letterSpacing: -0.3 }}>
              {user?.name || "User"}
            </Text>
            <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textSecondary, marginTop: 2 }}>
              {user?.email || ""}
            </Text>
            <Text style={{ fontFamily: type.family.light, fontSize: 11, color: c.textMuted, marginTop: 4 }}>
              {totalGroups} group{totalGroups !== 1 ? "s" : ""} · tap to edit
            </Text>
          </View>
          <Svg width={16} height={16} viewBox="0 0 16 16">
            <Path d="M 3 12 L 10 5 M 8 3 L 13 3 L 13 8" stroke={c.textMuted} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>

        <View style={{ height: 1, backgroundColor: c.border, opacity: 0.3, marginHorizontal: 20 }} />

        {/* ── Preferences ── */}
        <SectionLabel label="Preferences" />
        <ProfileRow icon={icons.currency} label="Currency" sub={`${sym} · ${currency}`} onPress={() => setShowCurrencyPicker(true)} c={c} />
        <InkDivider c={c} />
        <ProfileRow icon={icons.language} label="Language" sub={langMeta.nativeName} onPress={() => router.push("/language-settings")} c={c} />
        <InkDivider c={c} />
        <ProfileRow icon={icons.ai} label="AI Settings" sub="Voice, provider, TTS" onPress={() => router.push("/ai-settings")} c={c} />
        <InkDivider c={c} />
        <ProfileRow icon={icons.theme}   label={isDark ? "Light Mode" : "Dark Mode"} onPress={toggle} c={c} right={null} />
        <InkDivider c={c} />
        <ProfileRow
          icon={icons.bell}
          label="Notifications"
          onPress={() => {}}
          c={c}
          right={
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: c.surfaceAlt, true: c.textPrimary }}
              thumbColor={c.bg}
              style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
            />
          }
        />

        {/* ── Features ── */}
        <SectionLabel label="Features" />
        <ProfileRow icon={icons.chart}  label="Spending Analytics" sub="Charts & insights" onPress={() => router.push("/(tabs)/insights")} c={c} />
        <InkDivider c={c} />
        <ProfileRow icon={icons.repeat} label="Recurring Expenses" sub="Subscriptions" onPress={() => router.push("/recurring")} c={c} />

        {/* ── QR & Profile Link ── */}
        <SectionLabel label="My QR Code" />
        <View style={{ paddingHorizontal: 20, paddingBottom: 24, alignItems: "center", gap: 16 }}>
          {/* QR visual */}
          <View style={{ borderWidth: 1, borderColor: c.border, padding: 12, backgroundColor: c.bg }}>
            <SketchQR userId={user?.id || user?.email || "merizo"} size={130} c={c} />
          </View>
          {/* Profile link */}
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ fontFamily: type.family.regular, fontSize: 9, color: c.textMuted, letterSpacing: 2, textTransform: "uppercase" }}>
              Profile Link
            </Text>
            <Text style={{ fontFamily: type.family.medium, fontSize: 12, color: c.textSecondary, letterSpacing: 0.3 }}>
              merizo.app/u/{(user?.id || "").slice(0, 8) || "you"}
            </Text>
          </View>
          {/* Action buttons */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={() => Share.share({
                message: `Add me on Merizo! merizo.app/u/${(user?.id || "").slice(0, 8)}`,
                title: "Merizo Profile",
              })}
              style={{ borderWidth: 1, borderColor: c.border, paddingVertical: 10, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Svg width={14} height={14} viewBox="0 0 14 14">
                <Path d="M 2 7 L 7 2 L 12 7 M 7 2 L 7 12" stroke={c.textPrimary} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={{ fontFamily: type.family.medium, fontSize: 12, color: c.textPrimary }}>Share Link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/scan")}
              style={{ borderWidth: 1, borderColor: c.border, paddingVertical: 10, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Svg width={14} height={14} viewBox="0 0 14 14">
                <Path d="M 2 4 L 2 2 L 4 2" stroke={c.textPrimary} strokeWidth={1.2} fill="none" strokeLinecap="round" />
                <Path d="M 10 2 L 12 2 L 12 4" stroke={c.textPrimary} strokeWidth={1.2} fill="none" strokeLinecap="round" />
                <Path d="M 2 10 L 2 12 L 4 12" stroke={c.textPrimary} strokeWidth={1.2} fill="none" strokeLinecap="round" />
                <Path d="M 10 12 L 12 12 L 12 10" stroke={c.textPrimary} strokeWidth={1.2} fill="none" strokeLinecap="round" />
                <Line x1={2} y1={7} x2={12} y2={7} stroke={c.textPrimary} strokeWidth={0.8} opacity={0.4} />
              </Svg>
              <Text style={{ fontFamily: type.family.medium, fontSize: 12, color: c.textPrimary }}>Scan Friend</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: c.border, opacity: 0.15, marginHorizontal: 20, marginBottom: 8 }} />

        {/* ── Support ── */}
        <SectionLabel label="Support" />
        <ProfileRow icon={icons.question} label="Help & FAQ" onPress={() => Linking.openURL("https://merizo-app.onrender.com")} c={c} />
        <InkDivider c={c} />
        <ProfileRow icon={icons.mail} label="Contact Us" sub="support@merizo.app" onPress={() => Linking.openURL("mailto:support@merizo.app")} c={c} />

        {/* ── Data ── */}
        <SectionLabel label="Data" />
        <ProfileRow icon={icons.download} label="Export Data" sub="Download expense history" onPress={() => Alert.alert("Export", "This feature is coming soon.")} c={c} />

        {/* ── Account actions ── */}
        <SectionLabel label="Account" />
        <ProfileRow icon={icons.logout} label="Sign Out" onPress={onSignOut} c={c} danger />
        <InkDivider c={c} />
        <ProfileRow icon={icons.trash} label="Delete Account" onPress={onDeleteAccount} c={c} danger />

        {/* ── Footer ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 32, paddingBottom: 8 }}>
          <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted, textAlign: "center", letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.4 }}>
            MERIZO · v1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* ── Currency Picker ── */}
      <Modal visible={showCurrencyPicker} transparent animationType="slide" onRequestClose={() => setShowCurrencyPicker(false)}>
        <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: c.bg, borderTopWidth: 1.5, borderTopColor: c.border, padding: 24, paddingBottom: 48 }}>
            <Text style={{ fontFamily: type.family.bold, fontSize: type.size.md, color: c.textPrimary, marginBottom: 20, letterSpacing: -0.3 }}>
              Select Currency
            </Text>
            {CURRENCIES.map(cur => (
              <TouchableOpacity
                key={cur}
                onPress={() => { setCurrency(cur); AsyncStorage.setItem("merizo_currency", cur).catch(() => {}); setShowCurrencyPicker(false); }}
                style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border, opacity: currency === cur ? 1 : 0.7 }}
              >
                <Text style={{ fontFamily: currency === cur ? type.family.semibold : type.family.regular, fontSize: type.size.base, color: c.textPrimary }}>
                  {cur}
                </Text>
                {currency === cur && (
                  <Svg width={16} height={16} viewBox="0 0 16 16">
                    <Path d="M 2 8 L 6 12 L 14 4" stroke={c.textPrimary} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Edit Profile Modal ── */}
      <Modal visible={editProfile} transparent animationType="slide" onRequestClose={() => setEditProfile(false)}>
        <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: c.bg, borderTopWidth: 1.5, borderTopColor: c.border, padding: 24, paddingBottom: 48 }}>
            <Text style={{ fontFamily: type.family.bold, fontSize: type.size.md, color: c.textPrimary, marginBottom: 20, letterSpacing: -0.3 }}>
              Edit Profile
            </Text>
            <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
              Name
            </Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={c.textMuted}
              style={{
                borderWidth: 1, borderColor: c.border,
                paddingHorizontal: 14, paddingVertical: 12,
                fontSize: type.size.base, color: c.textPrimary,
                fontFamily: type.family.regular, marginBottom: 20,
              } as any}
            />
            <TouchableOpacity
              onPress={async () => {
                try {
                  await api.patch("/auth/profile", { name: editName });
                  await refresh();
                  setEditProfile(false);
                } catch { Alert.alert("Error", "Could not update profile."); }
              }}
              style={{ borderWidth: 1.5, borderColor: c.border, paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ fontFamily: type.family.semibold, fontSize: type.size.base, color: c.textPrimary }}>
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
