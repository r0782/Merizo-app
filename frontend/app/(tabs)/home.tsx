import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated, {
  useSharedValue, withSpring, withTiming, useAnimatedStyle,
  interpolate, Extrapolation, runOnJS, withDelay,
} from "react-native-reanimated";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  Platform, StatusBar, Modal, Pressable, Dimensions, FlatList,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";
import { currencySymbol } from "../../src/lib/tokens";

const { width: SW } = Dimensions.get("window");
const SH = Dimensions.get("window").height || 800;



// ── Recurring Section ────────────────────────────────────────────────────────
const RECURRING_ITEMS = [
  { emoji:"📺", name:"Netflix", amount:"₹649", period:"Monthly", color:"#E50914" },
  { emoji:"🎵", name:"Spotify", amount:"₹119", period:"Monthly", color:"#1DB954" },
  { emoji:"🏠", name:"Rent", amount:"₹0", period:"Monthly", color:"#6D5DFC" },
  { emoji:"💡", name:"Electricity", amount:"₹0", period:"Monthly", color:"#FF9F0A" },
  { emoji:"📦", name:"Prime", amount:"₹299", period:"Monthly", color:"#FF9900" },
];

function RecurringSection({ c, isDark, router }: any) {
  return (
    <View style={{ marginBottom:16 }}>
      <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:20, marginBottom:12 }}>
        <Text style={{ fontSize:11, fontWeight:"500", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase" }}>Recurring</Text>
        <TouchableOpacity onPress={()=>router.push("/recurring")}>
          <Text style={{ fontSize:12, color:isDark?"#7B6FFF":"#6D5DFC" }}>Manage</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:20, gap:10 }}>
        {RECURRING_ITEMS.map((item,i) => (
          <TouchableOpacity key={i} onPress={()=>router.push("/recurring")} style={{ width:110, backgroundColor:isDark?"#1C1C1E":"#FFFFFF", borderRadius:16, padding:14, borderWidth:0.5, borderColor:isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)", alignItems:"center", gap:6 }}>
            <View style={{ width:40, height:40, borderRadius:12, backgroundColor:item.color+"15", alignItems:"center", justifyContent:"center" }}>
              <Text style={{ fontSize:20 }}>{item.emoji}</Text>
            </View>
            <Text style={{ fontSize:12, fontWeight:"500", color:c.textPrimary, textAlign:"center" }}>{item.name}</Text>
            <Text style={{ fontSize:11, color:"#6D5DFC", fontWeight:"500" }}>{item.amount}</Text>
            <Text style={{ fontSize:10, color:c.textSecondary }}>{item.period}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={()=>router.push("/recurring")} style={{ width:110, backgroundColor:isDark?"#1C1C1E":"#FFFFFF", borderRadius:16, padding:14, borderWidth:0.5, borderColor:isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)", alignItems:"center", justifyContent:"center", gap:6 }}>
          <View style={{ width:40, height:40, borderRadius:12, backgroundColor:"rgba(109,93,252,0.1)", alignItems:"center", justifyContent:"center" }}>
            <Ionicons name="add" size={20} color="#6D5DFC" />
          </View>
          <Text style={{ fontSize:11, color:"#6D5DFC", fontWeight:"500", textAlign:"center" }}>Add more</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── AI Smart Tips ────────────────────────────────────────────────────────────
const TIPS = [
  { emoji: "💡", title: "Split smarter", body: "Add expenses right after paying — your memory fades faster than you think.", color: "#6D5DFC" },
  { emoji: "⚡", title: "Settle weekly", body: "Groups settled weekly have 3x fewer disputes. Set a day and stick to it.", color: "#FF9F0A" },
  { emoji: "📸", title: "Scan receipts", body: "Tap the + → Scan Receipt to extract amounts automatically from any bill.", color: "#00C48C" },
  { emoji: "🤖", title: "Ask AI anything", body: "Try: \"Who owes the most in Goa trip?\" — AI knows your full history.", color: "#6D5DFC" },
  { emoji: "🎯", title: "Equal isn't always fair", body: "Use Custom Split when people had different items or joined mid-trip.", color: "#FF453A" },
];

function SmartTips({ c, isDark }: any) {
  return (
    <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 8 }}>
      <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
        Merizo tips
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {TIPS.map((tip, i) => (
          <View key={i} style={{ width: 200, backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 20 }}>{tip.emoji}</Text>
              <Text style={{ fontSize: 13, fontWeight: "500", color: tip.color, flex: 1 }}>{tip.title}</Text>
            </View>
            <Text style={{ fontSize: 12, color: c.textSecondary, lineHeight: 18 }}>{tip.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Debt Gravity Stack ──────────────────────────────────────────────────────
function DebtGravityStack({ trips, router, c, isDark, sym }: any) {
  const [activeIndex, setActiveIndex] = useState(0);
  const CARD_H = 72;
  const PEEK = 10;

  // Sort by absolute amount descending — largest debt on top
  const sorted = [...trips].sort((a, b) => Math.abs(b.my_net || 0) - Math.abs(a.my_net || 0));
  const total = sorted.length;
  const containerH = CARD_H + (Math.min(total - 1, 3) * PEEK) + 24;

  const emoji = (cat: string) =>
    cat === "food" ? "🍕" : cat === "travel" ? "✈️" : cat === "home" ? "🏠" : cat === "entertainment" ? "🎬" : cat === "friends" ? "🎉" : cat === "shopping" ? "🛍️" : "📁";

  return (
    <View>
      <View style={{ height: containerH, position: "relative" }}>
        {sorted.map((trip: any, i: number) => {
          const net = trip.my_net || 0;
          const isOwed = net > 0;
          const isActive = i === activeIndex;
          const isVisible = i >= activeIndex && i < activeIndex + 4;
          if (!isVisible) return null;

          const layerPos = i - activeIndex;
          const top = layerPos * PEEK;
          const scale = 1 - layerPos * 0.03;
          const opacity = 1 - layerPos * 0.18;
          const zIndex = total - i;

          return (
            <TouchableOpacity
              key={trip.id}
              onPress={() => {
                if (layerPos > 0) {
                  setActiveIndex(i);
                } else {
                  router.push({ pathname: "/split/[id]", params: { id: trip.id } });
                }
              }}
              activeOpacity={layerPos === 0 ? 0.9 : 0.7}
              style={{
                position: "absolute", left: 0, right: 0, top,
                zIndex, opacity,
                transform: [{ scaleX: scale }],
              }}
            >
              <View style={{
                backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                borderRadius: 18, height: CARD_H,
                flexDirection: "row", alignItems: "center",
                paddingHorizontal: 16, gap: 12,
                borderWidth: 0.5,
                borderColor: isActive && layerPos === 0
                  ? isDark ? "rgba(109,93,252,0.4)" : "rgba(109,93,252,0.25)"
                  : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                shadowColor: "#000",
                shadowOpacity: layerPos === 0 ? 0.08 : 0,
                shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
                elevation: layerPos === 0 ? 4 : 0,
              }}>
                <View style={{
                  width: 42, height: 42, borderRadius: 13,
                  backgroundColor: isDark ? "#2C2C2E" : "#F0EDE8",
                  alignItems: "center", justifyContent: "center", flexShrink: 0
                }}>
                  <Text style={{ fontSize: 19 }}>{emoji(trip.category || "other")}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary, marginBottom: 2 }} numberOfLines={1}>
                    {trip.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: c.textSecondary }}>
                    {trip.member_count || 0} members · {trip.expense_count || 0} expenses
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {net === 0 ? (
                    <View style={{ backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F0EDE8", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 11, color: c.textSecondary }}>Settled ✓</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={{ fontSize: 15, fontWeight: "500", color: isOwed ? "#00C48C" : "#FF453A" }}>
                        {isOwed ? "+" : "-"}{sym}{Math.abs(Math.round(net)).toLocaleString("en-IN")}
                      </Text>
                      <Text style={{ fontSize: 10, color: c.textSecondary, marginTop: 1 }}>
                        {isOwed ? "owed to you" : "you owe"}
                      </Text>
                    </>
                  )}
                </View>
                {layerPos > 0 && (
                  <View style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}>
                    <Ionicons name="chevron-down" size={14} color={c.textMuted} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Pagination dots */}
      {total > 1 && (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 4, marginTop: 14 }}>
          {sorted.map((_: any, i: number) => (
            <TouchableOpacity key={i} onPress={() => setActiveIndex(i)}>
              <View style={{
                width: i === activeIndex ? 18 : 5,
                height: 5, borderRadius: 3,
                backgroundColor: i === activeIndex
                  ? isDark ? "#7B6FFF" : "#6D5DFC"
                  : isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
              }} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Balance Dashboard Modal ──────────────────────────────────────────────────
function BalanceDashboard({ visible, onClose, trips, totalOwed, totalOwing, netBalance, sym, c, isDark }: any) {
  const screenH = Dimensions.get("window").height || 800;
  const slideY = useSharedValue(screenH);

  useEffect(() => {
    if (visible) slideY.value = withSpring(0, { damping: 20, stiffness: 200 });
    else slideY.value = withTiming(screenH, { duration: 300 });
  }, [visible]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  const txns = trips.flatMap((t: any) => t.settlement_transactions || []);
  const topDebtors = trips.filter((t: any) => (t.my_net || 0) < -1).sort((a: any, b: any) => (a.my_net||0) - (b.my_net||0)).slice(0, 3);
  const topCreditors = trips.filter((t: any) => (t.my_net || 0) > 1).sort((a: any, b: any) => (b.my_net||0) - (a.my_net||0)).slice(0, 3);

  const statusText = netBalance > 100
    ? "Excellent! You're overall net positive this month."
    : netBalance < -100
    ? "You owe more than you're owed. Settle soon to stay balanced."
    : "You're nearly balanced. Great job!";

  const statusColor = netBalance > 0 ? "#00C48C" : netBalance < 0 ? "#FF453A" : "#FF9F0A";

  // Chart data
  const chartW = SW - 80;
  const chartH = 80;
  const chartData = Array.from({ length: 7 }, (_, i) => ({
    val: netBalance + (Math.random() - 0.5) * Math.abs(netBalance) * 0.3,
    label: ["May 1","May 8","May 15","May 22","May 29","Jun 1","Today"][i],
  }));
  const vals = chartData.map(d => d.val);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals) || 1;
  const range = maxV - minV || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length-1)) * chartW},${chartH - ((v-minV)/range) * chartH}`).join(" ");

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.55)" }}>
        <Pressable style={{ flex:1 }} onPress={onClose} />
        <Animated.View style={[{ backgroundColor:c.bg, borderTopLeftRadius:28, borderTopRightRadius:28, maxHeight:screenH*0.9, overflow:"hidden" }, slideStyle]}>
          {/* Handle */}
          <View style={{ alignItems:"center", paddingTop:12, paddingBottom:4 }}>
            <View style={{ width:36, height:4, backgroundColor:isDark?"rgba(255,255,255,0.15)":"rgba(0,0,0,0.15)", borderRadius:2 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:20, paddingBottom:40 }}>

            {/* Net position card */}
            <View style={{ backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:18, padding:18, marginBottom:14, borderWidth:0.5, borderColor:c.border }}>
              <Text style={{ fontSize:10, fontWeight:"600", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>Your net position</Text>
              <View style={{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:6 }}>
                <Ionicons name={netBalance >= 0 ? "trending-up" : "trending-down"} size={22} color={statusColor} />
                <Text style={{ fontSize:36, fontWeight:"500", color:statusColor, letterSpacing:-1 }}>
                  {netBalance >= 0 ? "+" : ""}{sym}{Math.abs(Math.round(netBalance)).toLocaleString("en-IN")}
                </Text>
              </View>
              <Text style={{ fontSize:14, color:statusColor, lineHeight:20 }}>{statusText}</Text>
            </View>

            {/* AI Smart Shortcut */}
            {(topDebtors.length > 0 || topCreditors.length > 0) && (
              <View style={{ backgroundColor:isDark?"rgba(109,93,252,0.12)":"#F5F3FF", borderRadius:18, padding:16, marginBottom:14, borderWidth:0.5, borderColor:isDark?"rgba(109,93,252,0.25)":"#DDD6FE" }}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginBottom:8 }}>
                  <Text style={{ fontSize:12 }}>✨</Text>
                  <Text style={{ fontSize:11, fontWeight:"600", color:"#6D5DFC", letterSpacing:1 }}>MERIZO AI SMART SHORTCUT</Text>
                </View>
                <Text style={{ fontSize:14, color:c.textPrimary, lineHeight:22, marginBottom:12 }}>
                  {netBalance > 0
                    ? `You're owed ${sym}${Math.round(totalOwed).toLocaleString("en-IN")} across ${topCreditors.length || trips.length} group${trips.length !== 1 ? "s" : ""}. Sending reminders is the fastest way to collect.`
                    : `You owe ${sym}${Math.round(totalOwing).toLocaleString("en-IN")} across ${topDebtors.length || trips.length} group${trips.length !== 1 ? "s" : ""}. Settling now avoids interest in trust.`
                  }
                </Text>
                <TouchableOpacity onPress={onClose} style={{ borderRadius:10, borderWidth:1, borderColor:isDark?"rgba(109,93,252,0.4)":"#A78BFA", paddingVertical:10, alignItems:"center" }}>
                  <Text style={{ fontSize:13, color:"#6D5DFC", fontWeight:"500" }}>
                    {netBalance > 0 ? "⚡ Send Quick Reminders" : "⚡ View Settlement Plan"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Balance trend chart */}
            <View style={{ backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:18, padding:16, marginBottom:14, borderWidth:0.5, borderColor:c.border }}>
              <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginBottom:12 }}>
                <Text style={{ fontSize:14 }}>📈</Text>
                <Text style={{ fontSize:13, fontWeight:"500", color:c.textPrimary, letterSpacing:0.3 }}>BALANCE TREND (LAST 30 DAYS)</Text>
              </View>
              <View style={{ height:chartH+36 }}>
                <svg width={chartW} height={chartH} style={{ overflow:"visible" } as any}>
                  <defs>
                    <linearGradient id="bdash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6D5DFC" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#6D5DFC" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {/* Zero line */}
                  <line x1="0" y1={chartH*0.6} x2={chartW} y2={chartH*0.6} stroke="rgba(109,93,252,0.2)" strokeWidth="1" strokeDasharray="4,3" />
                  <text x="0" y={chartH*0.6-3} fontSize="8" fill={isDark?"rgba(255,255,255,0.3)":"rgba(0,0,0,0.3)"}>₹0 (Settled)</text>
                  <polyline points={`0,${chartH} ${pts} ${chartW},${chartH}`} fill="url(#bdash)" stroke="none" />
                  <polyline points={pts} fill="none" stroke="#6D5DFC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Peak dot */}
                  {(() => {
                    const maxIdx = vals.indexOf(Math.max(...vals));
                    const px = (maxIdx/(vals.length-1))*chartW;
                    const py = chartH - ((vals[maxIdx]-minV)/range)*chartH;
                    return <>
                      <circle cx={px} cy={py} r="4" fill="#6D5DFC" />
                      <text x={Math.min(px+6, chartW-60)} y={py-6} fontSize="9" fill={isDark?"rgba(255,255,255,0.7)":"rgba(0,0,0,0.6)"}>Peak: {sym}{Math.round(Math.max(...vals)).toLocaleString("en-IN")}</text>
                    </>;
                  })()}
                </svg>
                <View style={{ flexDirection:"row", justifyContent:"space-between", marginTop:4 }}>
                  {["May 1","May 15","May 29","Jun 1"].map((l,i) => (
                    <Text key={i} style={{ fontSize:9, color:c.textMuted }}>{l}</Text>
                  ))}
                </View>
              </View>
            </View>

            {/* Immediate actions */}
            {trips.length > 0 && (
              <View style={{ marginBottom:8 }}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginBottom:12 }}>
                  <Text style={{ fontSize:14 }}>🚨</Text>
                  <Text style={{ fontSize:13, fontWeight:"600", color:c.textPrimary, letterSpacing:0.5 }}>IMMEDIATE ACTIONS</Text>
                </View>
                {trips.slice(0,4).map((trip: any, i: number) => {
                  const net = trip.my_net || 0;
                  const isOwed = net > 0.5;
                  const isOwing = net < -0.5;
                  if (!isOwed && !isOwing) return null;
                  return (
                    <View key={i} style={{ backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:14, padding:14, flexDirection:"row", alignItems:"center", gap:12, marginBottom:10, borderWidth:0.5, borderColor:c.border }}>
                      <View style={{ width:40, height:40, borderRadius:20, backgroundColor:isOwed?"rgba(0,196,140,0.1)":"rgba(255,67,58,0.1)", alignItems:"center", justifyContent:"center" }}>
                        <Text style={{ fontSize:16 }}>{isOwed?"💰":"💳"}</Text>
                      </View>
                      <View style={{ flex:1 }}>
                        <Text style={{ fontSize:13, fontWeight:"500", color:c.textPrimary }}>{trip.name}</Text>
                        <Text style={{ fontSize:12, color:isOwed?"#00C48C":"#FF453A", marginTop:2 }}>
                          {isOwed ? `Others owe you ${sym}${Math.round(net).toLocaleString("en-IN")}` : `You owe ${sym}${Math.round(Math.abs(net)).toLocaleString("en-IN")}`}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={onClose} style={{ backgroundColor:isOwed?"rgba(0,196,140,0.1)":"rgba(109,93,252,0.1)", borderRadius:10, paddingHorizontal:12, paddingVertical:7, borderWidth:0.5, borderColor:isOwed?"rgba(0,196,140,0.3)":"rgba(109,93,252,0.3)" }}>
                        <Text style={{ fontSize:12, fontWeight:"500", color:isOwed?"#00C48C":"#6D5DFC" }}>
                          {isOwed ? "Ping" : "Settle"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Owed/Owing summary */}
            <View style={{ flexDirection:"row", gap:10 }}>
              <View style={{ flex:1, backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:14, padding:14, borderWidth:0.5, borderColor:c.border }}>
                <Text style={{ fontSize:10, color:c.textSecondary, marginBottom:6 }}>Owed to you</Text>
                <Text style={{ fontSize:18, fontWeight:"500", color:"#00C48C" }}>+{sym}{Math.round(totalOwed).toLocaleString("en-IN")}</Text>
              </View>
              <View style={{ flex:1, backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:14, padding:14, borderWidth:0.5, borderColor:c.border }}>
                <Text style={{ fontSize:10, color:c.textSecondary, marginBottom:6 }}>You owe</Text>
                <Text style={{ fontSize:18, fontWeight:"500", color:"#FF453A" }}>-{sym}{Math.round(totalOwing).toLocaleString("en-IN")}</Text>
              </View>
            </View>

          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── FAB// ── FAB ──────────────────────────────────────────────────────────────────────
function FAB({ router, isDark, c }: any) {
  const [open, setOpen] = useState(false);
  const rot = useSharedValue(0);
  const y1  = useSharedValue(0);
  const y2  = useSharedValue(0);
  const op  = useSharedValue(0);

  const openMenu = () => {
    setOpen(true);
    rot.value = withTiming(1, { duration: 250 });
    op.value  = withTiming(1, { duration: 200 });
    y1.value  = withSpring(-56,  { damping: 18, stiffness: 260 });
    y2.value  = withSpring(-112, { damping: 18, stiffness: 240 });
  };

  const closeMenu = (cb?: () => void) => {
    rot.value = withTiming(0, { duration: 200 });
    op.value  = withTiming(0, { duration: 150 });
    y1.value  = withTiming(0, { duration: 180 });
    y2.value  = withTiming(0, { duration: 180 });
    setTimeout(() => { setOpen(false); cb && cb(); }, 200);
  };

  const rotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rot.value, [0,1], [0,45])}deg` }]
  }));
  const item1Style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: y1.value }],
    pointerEvents: open ? "auto" : "none",
  }));
  const item2Style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: y2.value }],
    pointerEvents: open ? "auto" : "none",
  }));

  return (
    <View style={{ position: "absolute", bottom: 28, right: 20, alignItems: "flex-end" }}>
      {/* Backdrop */}
      {open && <Pressable onPress={() => closeMenu()} style={{ position: "absolute", top: -2000, left: -2000, right: -20, bottom: -28, zIndex: 0 }} />}

      {/* Item 1 — Quick split */}
      <Animated.View style={[{ position: "absolute", bottom: 0, right: 0, zIndex: 2 }, item1Style]}>
        <TouchableOpacity
          onPress={() => closeMenu(() => router.push("/simple-split"))}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
        >
          <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="flash" size={15} color="#6D5DFC" />
          </View>
          <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary }}>Quick split</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Item 2 — Create group */}
      <Animated.View style={[{ position: "absolute", bottom: 0, right: 0, zIndex: 2 }, item2Style]}>
        <TouchableOpacity
          onPress={() => closeMenu(() => router.push("/category"))}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
        >
          <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="people" size={15} color="#6D5DFC" />
          </View>
          <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary }}>Create group</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Main FAB button */}
      <TouchableOpacity
        onPress={() => open ? closeMenu() : openMenu()}
        style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: isDark ? "#7B6FFF" : "#6D5DFC", alignItems: "center", justifyContent: "center", shadowColor: "#6D5DFC", shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8, zIndex: 3 }}
      >
        <Animated.View style={rotStyle}>
          <Ionicons name="add" size={24} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get("/trips"); setTrips(r.data || []); } catch {}
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const totalOwed  = useMemo(() => trips.reduce((s, t) => s + Math.max(0, t.my_net || 0), 0), [trips]);
  const totalOwing = useMemo(() => Math.abs(trips.reduce((s, t) => s + Math.min(0, t.my_net || 0), 0)), [trips]);
  const netBalance = totalOwed - totalOwing;
  const sym = currencySymbol(trips[0]?.currency || "INR");
  const initial = (user?.name || "U").trim().charAt(0).toUpperCase();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView
        contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 40, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 13, color: c.textSecondary, marginBottom: 2 }}>{greeting()}</Text>
            <Text style={{ fontSize: 22, fontWeight: "500", color: c.textPrimary, letterSpacing: -0.5 }}>{user?.name?.split(" ")[0] || "Welcome"}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? "#2C2C2E" : "#F0EDE8", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 15, fontWeight: "500", color: isDark ? "#7B6FFF" : "#6D5DFC" }}>{initial}</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Balance Card — tap to expand */}
        <TouchableOpacity onPress={() => setShowDashboard(true)} activeOpacity={0.92} style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <View style={{ backgroundColor: "#111111", borderRadius: 24, padding: 22 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase" }}>Net balance</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Tap for details</Text>
                <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.3)" />
              </View>
            </View>
            <Text style={{ fontSize: 38, fontWeight: "500", color: "#FFFFFF", letterSpacing: -1.5, marginBottom: 4 }}>
              {netBalance >= 0 ? "+" : "-"}{sym}{Math.abs(Math.round(netBalance)).toLocaleString("en-IN")}
            </Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 18 }}>
              {netBalance >= 0 ? "Others owe you this amount" : "You owe this amount total"}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, padding: 14 }}>
                <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Owed to you</Text>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#00C48C" }}>+{sym}{Math.round(totalOwed).toLocaleString("en-IN")}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, padding: 14 }}>
                <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>You owe</Text>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#FF453A" }}>-{sym}{Math.round(totalOwing).toLocaleString("en-IN")}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* AI Insight Card */}
        <TouchableOpacity onPress={() => router.push("/(tabs)/chat")} style={{ marginHorizontal: 20, marginBottom: 24, backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#6D5DFC" }} />
            <Text style={{ fontSize: 10, color: "#6D5DFC", fontWeight: "500", letterSpacing: 0.5 }}>AI INSIGHT</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary, lineHeight: 20, marginBottom: 4 }}>
            {trips.length > 0 ? `You have ${trips.length} active group${trips.length > 1 ? "s" : ""}. Ask AI anything about your expenses.` : "Ask AI to create your first group or split an expense."}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: "#6D5DFC" }}>Chat with Merizo AI</Text>
            <Ionicons name="arrow-forward" size={12} color="#6D5DFC" />
          </View>
        </TouchableOpacity>

        {/* Groups */}
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>Active groups</Text>
          </View>
          {loading ? (
            <View style={{ gap: 10 }}>
              {[1,2,3].map(i => <View key={i} style={{ height: 72, backgroundColor: isDark ? "#1C1C1E" : "#F0EDE8", borderRadius: 18 }} />)}
            </View>
          ) : trips.length === 0 ? (
            <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 18, padding: 28, alignItems: "center", borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
              <Text style={{ fontSize: 28, marginBottom: 10 }}>👋</Text>
              <Text style={{ fontSize: 15, fontWeight: "500", color: c.textPrimary, marginBottom: 6 }}>No groups yet</Text>
              <Text style={{ fontSize: 13, color: c.textSecondary, textAlign: "center", marginBottom: 16, lineHeight: 20 }}>Create your first group or ask AI to help split an expense</Text>
              <TouchableOpacity onPress={() => router.push("/category")} style={{ backgroundColor: isDark ? "#7B6FFF" : "#6D5DFC", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: "500", color: "#fff" }}>Create first group</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <DebtGravityStack trips={trips} router={router} c={c} isDark={isDark} sym={sym} />
          )}
        </View>

        {/* Recurring */}
        <RecurringSection c={c} isDark={isDark} router={router} />

        {/* AI Smart Tips */}
        <SmartTips c={c} isDark={isDark} />
      </ScrollView>

      {/* FAB */}
      <FAB router={router} isDark={isDark} c={c} />

      {/* Balance Dashboard Modal */}
      <BalanceDashboard
        visible={showDashboard}
        onClose={() => setShowDashboard(false)}
        trips={trips}
        totalOwed={totalOwed}
        totalOwing={totalOwing}
        netBalance={netBalance}
        sym={sym}
        c={c}
        isDark={isDark}
      />
    </View>
  );
}
