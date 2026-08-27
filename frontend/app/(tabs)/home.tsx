/**
 * MERIZO Home — Financial Ledger
 * Looks like a premium black-ink notebook page.
 */
import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  Platform, Modal, useWindowDimensions,
} from "react-native";
import Animated, {
  useSharedValue, withSpring, withTiming, withDelay,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useRouter, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import Svg, { Path, Line, Circle } from "react-native-svg";
import {
  PlusIcon, ScanIcon, UsersThreeIcon, ChatCircleTextIcon,
  AirplaneIcon, ForkKnifeIcon, HouseIcon as HouseCategoryIcon,
  ShoppingBagIcon, FilmSlateIcon, PackageIcon,
} from "phosphor-react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";
import { currencySymbol, type } from "../../src/lib/tokens";
import { getDeviceLocale } from "../../src/lib/currency";
import { useCurrency } from "../../src/lib/CurrencyContext";
import { BalanceSplit } from "../../src/components/merizo/LedgerRow";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadRecurring, type Subscription } from "../recurring";

// ── Thin ink separator ────────────────────────────────────────────────────────
function InkLine({ opacity = 0.2 }: { opacity?: number }) {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.border, opacity, marginHorizontal: 20, marginVertical: 4 }} />;
}

// ── Dotted notebook-style separator ──────────────────────────────────────────
function DottedLine({ c }: { c: any }) {
  return (
    <View style={{ paddingHorizontal: 20 }}>
      <Svg width="100%" height={6} viewBox="0 0 300 6" preserveAspectRatio="none">
        <Path
          d="M 0 3 L 300 3"
          stroke={c.border}
          strokeWidth={1}
          strokeDasharray="3 5"
          fill="none"
          opacity={0.2}
        />
      </Svg>
    </View>
  );
}

// ── Page header ───────────────────────────────────────────────────────────────
function NotebookHeader({ greeting, date, c }: any) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(-12);

  useEffect(() => {
    opacity.value    = withTiming(1, { duration: 500 });
    translateY.value = withSpring(0, { damping: 20 });
  }, [opacity, translateY]);

  const as = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translateY.value }] }));

  return (
    <Animated.View style={[as, { paddingHorizontal: 20, paddingBottom: 16 }]}>
      <Text style={{ fontFamily: type.family.light, fontSize: type.size.xs, color: c.textMuted, letterSpacing: 3, textTransform: "uppercase", marginBottom: 2 }}>
        {date}
      </Text>
      <Text style={{ fontFamily: type.family.bold, fontSize: 32, color: c.textPrimary, letterSpacing: -1.5, lineHeight: 36 }}>
        MERIZO
      </Text>
      <Text style={{ fontFamily: type.family.light, fontSize: type.size.sm, color: c.textSecondary, marginTop: 2, letterSpacing: 0.5 }}>
        {greeting}
      </Text>
    </Animated.View>
  );
}

// ── Total balance ─────────────────────────────────────────────────────────────
function TotalBalance({ amount, sym, c }: any) {
  const { t } = useTranslation();
  const scale   = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value   = withDelay(200, withSpring(1, { damping: 16 }));
    opacity.value = withDelay(200, withTiming(1, { duration: 400 }));
  }, [opacity, scale]);

  const as = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  return (
    <Animated.View style={[as, { paddingHorizontal: 20, paddingVertical: 20 }]}>
      <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 8 }}>
        {t("home.totalBalance")}
      </Text>
      <Text style={{ fontFamily: type.family.bold, fontSize: 48, color: c.textPrimary, letterSpacing: -2.5, lineHeight: 52 }}>
        {sym}{Math.abs(amount).toLocaleString(getDeviceLocale())}
      </Text>
    </Animated.View>
  );
}

// ── Quick action button — individual bordered box ─────────────────────────────
function QuickAction({ label, icon, onPress, c }: any) {
  const scale = useSharedValue(1);
  const as = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[as, { flex: 1 }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.93, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); }}
        activeOpacity={1}
        style={{
          borderWidth: 1,
          borderColor: c.border,
          paddingVertical: 14,
          paddingHorizontal: 4,
          alignItems: "center",
          gap: 8,
        }}
      >
        {icon}
        <Text style={{
          fontFamily: type.family.medium,
          fontSize: 9,
          color: c.textPrimary,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          textAlign: "center",
          lineHeight: 13,
        }}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Contextual doodle icons for groups ────────────────────────────────────────
function TVIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Path d="M 4 8 Q 4 6 6 6 L 22 6 Q 24 6 24 8 L 24 19 Q 24 21 22 21 L 6 21 Q 4 21 4 19 Z"
        stroke={color} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={10} y1={24} x2={18} y2={24} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Line x1={14} y1={21} x2={14} y2={24} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      {/* Play triangle */}
      <Path d="M 11 11 L 11 17 L 18 14 Z" stroke={color} strokeWidth={1.1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChampagneIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      {/* Left glass */}
      <Path d="M 8 4 L 6 12 Q 6 16 10 16 L 10 22 L 8 22"
        stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Right glass */}
      <Path d="M 20 4 L 22 12 Q 22 16 18 16 L 18 22 L 20 22"
        stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Bubbles */}
      <Circle cx={10} cy={9} r={1} stroke={color} strokeWidth={1} fill="none" />
      <Circle cx={18} cy={8} r={1} stroke={color} strokeWidth={1} fill="none" />
      {/* Clink lines */}
      <Line x1={12} y1={6} x2={16} y2={6} stroke={color} strokeWidth={1.1} strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}

function PlaneIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Path d="M 4 14 L 20 6 L 18 14 L 20 22 Z"
        stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M 10 11 L 6 18" stroke={color} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <Path d="M 14 13 L 11 21" stroke={color} strokeWidth={1} fill="none" strokeLinecap="round" opacity={0.6} />
    </Svg>
  );
}

function HouseIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Path d="M 4 14 L 14 5 L 24 14" stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M 6 12 L 6 23 L 11 23 L 11 17 L 17 17 L 17 23 L 22 23 L 22 12"
        stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function GroupIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle cx={10} cy={10} r={4} stroke={color} strokeWidth={1.2} fill="none" />
      <Path d="M 3 23 Q 3 18 10 18 Q 17 18 17 23" stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Circle cx={19} cy={9} r={3} stroke={color} strokeWidth={1.1} fill="none" />
      <Path d="M 16 22 Q 16 18 19 18 Q 25 18 25 22" stroke={color} strokeWidth={1.1} fill="none" strokeLinecap="round" opacity={0.7} />
    </Svg>
  );
}

function ShoppingIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Path d="M 7 10 L 5 23 L 23 23 L 21 10 Z"
        stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M 10 10 Q 10 5 14 5 Q 18 5 18 10"
        stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function getGroupIconType(trip: any): string {
  const name = (trip.name || "").toLowerCase();
  const cat  = (trip.split_category || trip.category || trip.group_type || "").toLowerCase();
  if (cat === "home"   || name.includes("flat") || name.includes("home") || name.includes("house") || name.includes("rent"))
    return "house";
  if (cat === "travel" || cat === "trip" || name.includes("trip") || name.includes("goa") || name.includes("bali") || name.includes("travel") || name.includes("flight"))
    return "plane";
  if (cat === "food"   || name.includes("dinner") || name.includes("lunch") || name.includes("food") || name.includes("cafe") || name.includes("restaurant") || name.includes("party"))
    return "champagne";
  if (cat === "entertainment" || name.includes("netflix") || name.includes("prime") || name.includes("bill") || name.includes("hulu") || name.includes("subscription"))
    return "tv";
  if (cat === "shopping" || name.includes("shopping") || name.includes("mall"))
    return "shopping";
  return "group";
}

function GroupDoodleIcon({ trip, color, size = 28 }: { trip: any; color: string; size?: number }) {
  const iconType = getGroupIconType(trip);
  switch (iconType) {
    case "house":     return <HouseIcon     color={color} size={size} />;
    case "plane":     return <PlaneIcon     color={color} size={size} />;
    case "champagne": return <ChampagneIcon color={color} size={size} />;
    case "tv":        return <TVIcon        color={color} size={size} />;
    case "shopping":  return <ShoppingIcon  color={color} size={size} />;
    default:          return <GroupIcon     color={color} size={size} />;
  }
}

// ── Compact group row ─────────────────────────────────────────────────────────
// ── People horizontal scroll ─────────────────────────────────────────────────
function ScrollViewH({ contacts, c, type }: { contacts: { name: string; groups: string[] }[]; c: any; type: any }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
    >
      {contacts.map((ct, i) => {
        const initial = (ct.name || "?").charAt(0).toUpperCase();
        const groupHint = ct.groups.length === 1
          ? ct.groups[0]
          : `${ct.groups.length} groups`;
        return (
          <View key={i} style={{ alignItems: "center", width: 64 }}>
            {/* Square avatar with initial */}
            <View style={{ width: 44, height: 44, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: type.family.bold, fontSize: 18, color: c.textPrimary }}>
                {initial}
              </Text>
            </View>
            <Text style={{ fontFamily: type.family.medium, fontSize: 10, color: c.textPrimary, marginTop: 5, textAlign: "center" }} numberOfLines={1}>
              {ct.name.split(" ")[0]}
            </Text>
            <Text style={{ fontFamily: type.family.regular, fontSize: 9, color: c.textMuted, marginTop: 1, textAlign: "center" }} numberOfLines={1}>
              {groupHint}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function GroupRow({ trip, sym, onPress, c }: any) {
  const { t } = useTranslation();
  const net      = trip.my_net || 0;
  const absNet   = Math.abs(net);
  const hint     = net > 0 ? t("home.hintYouAreOwed") : net < 0 ? t("home.hintYouOwe") : t("home.hintSettled");
  const amtStr   = net === 0
    ? "—"
    : `${net > 0 ? "+" : "-"}${sym}${absNet.toLocaleString(getDeviceLocale())}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.65}
      style={{ flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 20, gap: 12 }}
    >
      {/* Doodle icon */}
      <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <GroupDoodleIcon trip={trip} color={c.textPrimary} size={30} />
      </View>

      {/* Name + members */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: type.family.medium, fontSize: type.size.sm, color: c.textPrimary }} numberOfLines={1}>
          {trip.name}
        </Text>
        <Text style={{ fontFamily: type.family.regular, fontSize: 11, color: c.textMuted, marginTop: 1 }}>
          {t("groups.memberCount", { count: trip.member_count || trip.members?.length || 0 })}
        </Text>
      </View>

      {/* Amount + hint */}
      <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
        <Text style={{ fontFamily: type.family.semibold, fontSize: type.size.sm, color: c.textPrimary, letterSpacing: -0.3 }}>
          {amtStr}
        </Text>
        <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, marginTop: 1 }}>
          {hint}
        </Text>
      </View>

      {/* Chevron */}
      <Svg width={12} height={12} viewBox="0 0 12 12" style={{ flexShrink: 0, marginLeft: 2 }}>
        <Path d="M 4 2 L 8 6 L 4 10" stroke={c.textMuted} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { c } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  // Scanning a paper bill via camera isn't a desktop/PC workflow — hide the
  // quick action there while keeping it on mobile and tablet-width web.
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;

  const [trips,          setTrips]          = useState<any[]>([]);
  const [recentExp,      setRecentExp]      = useState<any[]>([]);
  const [totalOwed,      setTotalOwed]      = useState(0);
  const { currency } = useCurrency();
  const sym = currencySymbol(currency);
  const [totalOwing,     setTotalOwing]     = useState(0);
  const [totalSpent,     setTotalSpent]     = useState(0);
  const [refreshing,     setRefreshing]     = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [showAddExpense,  setShowAddExpense]  = useState(false);
  const [showNewGroup,    setShowNewGroup]    = useState(false);
  const [recurring,       setRecurring]       = useState<Subscription[]>([]);
  const [showAllGroups,   setShowAllGroups]   = useState(false);
  const [contacts,        setContacts]        = useState<{ name: string; groups: string[] }[]>([]);

  const load = useCallback(async () => {
    try {
      const tripsR    = await api.get("/trips");
      const trips: any[] = tripsR.data || [];
      setTrips(trips);

      let owed = 0, owing = 0, spent = 0;
      const allExp: any[] = [];
      const contactMap = new Map<string, { name: string; groups: string[] }>();

      await Promise.all(trips.slice(0, 5).map(async (t: any) => {
        try {
          const [expR, detailR] = await Promise.all([
            api.get(`/expenses/${t.id}`),
            api.get(`/trips/${t.id}`),
          ]);
          const exps = (expR.data || []).map((e: any) => ({ ...e, tripName: t.name, tripId: t.id }));
          allExp.push(...exps);
          const net = t.my_net || 0;
          if (net > 0) owed  += net;
          if (net < 0) owing += Math.abs(net);
          exps.forEach((e: any) => { spent += e.amount || 0; });
          // Aggregate unique contacts from group members
          const members: any[] = detailR.data?.members || [];
          members.forEach((m: any) => {
            if (!m.id || !m.name) return;
            if (contactMap.has(m.id)) {
              contactMap.get(m.id)!.groups.push(t.name);
            } else {
              contactMap.set(m.id, { name: m.name, groups: [t.name] });
            }
          });
        } catch {}
      }));

      allExp.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentExp(allExp.slice(0, 5));
      setTotalOwed(Math.round(owed));
      setTotalOwing(Math.round(owing));
      setTotalSpent(Math.round(spent));

      // Save contacts for quick-add in create-split
      const contactList = Array.from(contactMap.values()).slice(0, 20);
      setContacts(contactList);
      AsyncStorage.setItem("merizo_contacts_cache", JSON.stringify(contactList)).catch(() => {});
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  useFocusEffect(useCallback(() => { loadRecurring().then(setRecurring); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); loadRecurring().then(setRecurring); setRefreshing(false); };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("time.goodMorning") : hour < 17 ? t("time.goodAfternoon") : t("time.goodEvening");
  const name  = user?.name?.split(" ")[0] || "";
  const today = new Date().toLocaleDateString(getDeviceLocale(), { weekday: "long", day: "numeric", month: "long" });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 40, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textMuted} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <NotebookHeader greeting={`${greeting}${name ? ", " + name : ""}.`} date={today} c={c} />
        <InkLine opacity={0.3} />

        {/* ── Total Balance ── */}
        <TotalBalance amount={totalSpent} sym={sym} c={c} />

        {/* ── Balance split ── */}
        {(totalOwed > 0 || totalOwing > 0) && (
          <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
            <BalanceSplit
              leftLabel={t("home.youOwe")}      leftAmount={totalOwing}
              rightLabel={t("home.owedToYou")} rightAmount={totalOwed}
              sym={sym}
            />
          </View>
        )}

        <InkLine opacity={0.2} />

        {/* ── Quick Actions — 4 equal-width separate boxes ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 }}>
          <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 12 }}>
            {t("home.quickActionsLabel")}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <QuickAction
              label={`${t("home.wordAdd")}\n${t("home.wordExpense")}`}
              onPress={() => setShowAddExpense(true)}
              c={c}
              icon={<PlusIcon size={22} color={c.textPrimary} weight="regular" />}
            />
            {!isDesktopWeb && (
              <QuickAction
                label={`${t("home.wordScan")}\n${t("home.wordBill")}`}
                onPress={() => router.push("/scan")}
                c={c}
                icon={<ScanIcon size={22} color={c.textPrimary} weight="regular" />}
              />
            )}
            <QuickAction
              label={`${t("home.wordNew")}\n${t("home.wordGroup")}`}
              onPress={() => setShowNewGroup(true)}
              c={c}
              icon={<UsersThreeIcon size={22} color={c.textPrimary} weight="regular" />}
            />
            <QuickAction
              label={`${t("home.wordAi")}\n${t("home.wordAdvisor")}`}
              onPress={() => router.push("/(tabs)/chat")}
              c={c}
              icon={<ChatCircleTextIcon size={22} color={c.textPrimary} weight="regular" />}
            />
          </View>
        </View>

        <InkLine opacity={0.2} />

        {/* ── Recurring Bills ── */}
        {recurring.length > 0 && (
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase" }}>
                {t("home.recurringBillsLabel")}
              </Text>
              <TouchableOpacity onPress={() => router.push("/recurring")}>
                <Text style={{ fontFamily: type.family.medium, fontSize: type.size.xs, color: c.textSecondary }}>
                  {t("home.manageArrow")}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ borderTopWidth: 1, borderColor: c.border, opacity: 0.25 }} />
            {recurring.slice(0, 4).map((bill) => (
              <TouchableOpacity
                key={bill.name}
                onPress={() => router.push("/recurring")}
                activeOpacity={0.65}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: `${c.border}25` }}
              >
                <View style={{ width: 28, marginRight: 10 }}>
                  <Ionicons name={bill.icon as any} size={18} color={c.textMuted} />
                </View>
                <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textPrimary, flex: 1 }}>
                  {bill.name}
                </Text>
                <Text style={{ fontFamily: type.family.semibold, fontSize: type.size.sm, color: c.textPrimary, marginRight: 4 }}>
                  {sym}{bill.amount > 0 ? bill.amount.toLocaleString(getDeviceLocale()) : "—"}
                </Text>
                <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted }}>
                  {bill.period === "monthly" ? t("home.perMonth") : t("home.perYear")}
                </Text>
              </TouchableOpacity>
            ))}
            {recurring.length > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 10 }}>
                <Text style={{ fontFamily: type.family.light, fontSize: 11, color: c.textMuted }}>
                  {t("home.billCount", { count: recurring.length })}
                </Text>
                <Text style={{ fontFamily: type.family.semibold, fontSize: 12, color: c.textPrimary }}>
                  {sym}{recurring.reduce((s, b) => s + (b.amount || 0), 0).toLocaleString(getDeviceLocale())}{t("home.perMonth")}
                </Text>
              </View>
            )}
          </View>
        )}

        {recurring.length === 0 && !loading && (
          <TouchableOpacity
            onPress={() => router.push("/recurring")}
            style={{ marginHorizontal: 20, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: `${c.border}50`, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}
          >
            <View>
              <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>{t("home.recurringBillsLabel")}</Text>
              <Text style={{ fontFamily: type.family.medium, fontSize: type.size.sm, color: c.textSecondary }}>
                {t("home.trackSubscriptions")}
              </Text>
            </View>
            <Text style={{ fontFamily: type.family.light, fontSize: 16, color: c.textMuted }}>+</Text>
          </TouchableOpacity>
        )}

        <InkLine opacity={0.2} />

        {/* ── Groups — compact notebook rows ── */}
        {trips.length > 0 && (
          <View style={{ paddingTop: 16, marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 4 }}>
              <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase" }}>
                {t("groups.title")}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                {trips.length > 5 && (
                  <TouchableOpacity onPress={() => setShowAllGroups(v => !v)}>
                    <Text style={{ fontFamily: type.family.medium, fontSize: type.size.xs, color: c.textSecondary }}>
                      {showAllGroups ? t("home.showLess") : t("home.seeAllCount", { count: trips.length })}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowNewGroup(true)}>
                  <Text style={{ fontFamily: type.family.medium, fontSize: type.size.xs, color: c.textSecondary }}>
                    {t("home.addNew")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {/* Top border */}
            <View style={{ height: 1, backgroundColor: c.border, opacity: 0.25, marginHorizontal: 20, marginBottom: 0 }} />
            {(showAllGroups ? trips : trips.slice(0, 5)).map((trip, i) => {
              const visibleTrips = showAllGroups ? trips : trips.slice(0, 5);
              return (
                <View key={trip.id}>
                  <GroupRow
                    trip={trip}
                    sym={sym}
                    c={c}
                    onPress={() => router.push({ pathname: "/split/[id]", params: { id: trip.id } })}
                  />
                  {i < visibleTrips.length - 1 && <DottedLine c={c} />}
                </View>
              );
            })}
            {/* Bottom border */}
            <View style={{ height: 1, backgroundColor: c.border, opacity: 0.25, marginHorizontal: 20, marginTop: 0 }} />
          </View>
        )}

        {trips.length === 0 && !loading && (
          <View style={{ paddingHorizontal: 20, paddingVertical: 24, alignItems: "flex-start" }}>
            <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textMuted, lineHeight: 22 }}>
              {t("home.noGroupsMessage")}
            </Text>
            <TouchableOpacity
              onPress={() => setShowNewGroup(true)}
              style={{ marginTop: 16, borderWidth: 1, borderColor: c.border, paddingVertical: 12, paddingHorizontal: 20 }}
            >
              <Text style={{ fontFamily: type.family.medium, fontSize: type.size.sm, color: c.textPrimary }}>
                {t("home.createGroupCta")}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <InkLine opacity={0.2} />

        {/* ── People ── contacts from shared groups ── */}
        {contacts.length > 0 && (
          <View style={{ paddingTop: 16, marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 10 }}>
              <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase" }}>
                {t("home.peopleLabel")}
              </Text>
              <TouchableOpacity onPress={() => setShowNewGroup(true)}>
                <Text style={{ fontFamily: type.family.medium, fontSize: type.size.xs, color: c.textSecondary }}>
                  {t("home.newGroupCta")}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollViewH contacts={contacts} c={c} type={type} />
          </View>
        )}

        <InkLine opacity={0.2} />

        {/* ── Recent activity ── */}
        {recentExp.length > 0 && (
          <View style={{ paddingTop: 16, marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 8 }}>
              <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase" }}>
                {t("home.recentActivityLabel")}
              </Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/activity")}>
                <Text style={{ fontFamily: type.family.medium, fontSize: type.size.xs, color: c.textSecondary }}>
                  {t("home.seeAllArrow")}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 1, backgroundColor: c.border, opacity: 0.25, marginHorizontal: 20 }} />
            {recentExp.map((exp, i) => (
              <View key={exp.id || i}>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/split/[id]", params: { id: exp.tripId } })}
                  activeOpacity={0.65}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 20, gap: 12 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: type.family.medium, fontSize: type.size.sm, color: c.textPrimary }} numberOfLines={1}>
                      {exp.name || t("expenses.expense")}
                    </Text>
                    <Text style={{ fontFamily: type.family.regular, fontSize: 11, color: c.textMuted, marginTop: 1 }}>
                      {exp.tripName}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: type.family.semibold, fontSize: type.size.sm, color: c.textPrimary, letterSpacing: -0.3 }}>
                    {sym}{Math.round(exp.amount || 0).toLocaleString(getDeviceLocale())}
                  </Text>
                </TouchableOpacity>
                {i < recentExp.length - 1 && <DottedLine c={c} />}
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: c.border, opacity: 0.25, marginHorizontal: 20 }} />
          </View>
        )}

        {/* ── Footer ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
          <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted, letterSpacing: 1.5, textTransform: "uppercase", textAlign: "center", opacity: 0.5 }}>
            {t("home.footerTagline")}
          </Text>
        </View>
      </ScrollView>

      {/* ── Add Expense modal ── */}
      <Modal visible={showAddExpense} transparent animationType="slide" onRequestClose={() => setShowAddExpense(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setShowAddExpense(false)}
        >
          <View style={{ backgroundColor: c.bg, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }}>
            <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 4 }}>
              {t("home.addExpenseTitle")}
            </Text>
            <Text style={{ fontFamily: type.family.bold, fontSize: 20, color: c.textPrimary, marginBottom: 20 }}>
              {t("home.howToAdd")}
            </Text>
            <TouchableOpacity
              onPress={() => { setShowAddExpense(false); router.push("/simple-split"); }}
              style={{ borderWidth: 1, borderColor: c.border, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 10 }}
            >
              <Text style={{ fontFamily: type.family.semibold, fontSize: 14, color: c.textPrimary }}>{t("home.quickSplitLabel")}</Text>
              <Text style={{ fontFamily: type.family.regular, fontSize: 12, color: c.textMuted, marginTop: 2 }}>
                {t("home.quickSplitDesc")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setShowAddExpense(false); setShowNewGroup(true); }}
              style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.textPrimary, paddingVertical: 16, paddingHorizontal: 16 }}
            >
              <Text style={{ fontFamily: type.family.semibold, fontSize: 14, color: c.bg }}>{t("home.createGroupLabel")}</Text>
              <Text style={{ fontFamily: type.family.regular, fontSize: 12, color: `${c.bg}99`, marginTop: 2 }}>
                {t("home.createGroupDesc")}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── New Group category modal ── */}
      <Modal visible={showNewGroup} transparent animationType="slide" onRequestClose={() => setShowNewGroup(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setShowNewGroup(false)}
        >
          <View style={{ backgroundColor: c.bg, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }}>
            <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 4 }}>
              {t("home.newGroupTitle")}
            </Text>
            <Text style={{ fontFamily: type.family.bold, fontSize: 20, color: c.textPrimary, marginBottom: 20 }}>
              {t("home.whatsItFor")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {([
                { label: t("home.catTravel"),        category: "travel",        Icon: AirplaneIcon },
                { label: t("home.catFood"),          category: "food",          Icon: ForkKnifeIcon },
                { label: t("home.catHome"),          category: "home",          Icon: HouseCategoryIcon },
                { label: t("home.catShopping"),      category: "shopping",      Icon: ShoppingBagIcon },
                { label: t("home.catEntertainment"), category: "entertainment",  Icon: FilmSlateIcon },
                { label: t("home.catOther"),         category: "other",         Icon: PackageIcon },
              ]).map(({ label, category, Icon }) => (
                <TouchableOpacity
                  key={category}
                  onPress={() => {
                    setShowNewGroup(false);
                    router.push({ pathname: "/create-split", params: { category } });
                  }}
                  style={{
                    borderWidth: 1, borderColor: c.border,
                    paddingVertical: 14, paddingHorizontal: 12,
                    alignItems: "center", gap: 6,
                    width: "30%",
                  }}
                >
                  <Icon size={22} color={c.textPrimary} weight="regular" />
                  <Text style={{ fontFamily: type.family.medium, fontSize: 11, color: c.textPrimary, textAlign: "center" }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
