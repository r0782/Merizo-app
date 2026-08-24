import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, Platform } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../lib/theme";
import { currencySymbol } from "../../lib/tokens";
import { getDeviceLocale } from "../../lib/currency";

function IcoSparkles({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}
function IcoClose({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
    </Svg>
  );
}

function SketchArrow({ width }: { width: number }) {
  const { c } = useTheme();
  const mid = width / 2;
  const y = 22;
  const headLen = 10;
  return (
    <Svg width={width} height={44} style={{ overflow: "visible" }}>
      <Path
        d={`M 8 ${y} Q ${mid} ${y - 4} ${width - 14} ${y}`}
        stroke={c.textMuted}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={`M ${width - 14} ${y} L ${width - 14 - headLen} ${y - 6} M ${width - 14} ${y} L ${width - 14 - headLen} ${y + 6}`}
        stroke={c.textMuted}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function PersonNode({ name, isSource, sym }: { name: string; isSource: boolean; sym: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 5, minWidth: 64 }}>
      <View style={{
        width: 48, height: 48,
        backgroundColor: isSource ? c.textPrimary : c.surface,
        borderWidth: 1, borderColor: c.border,
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ fontSize: 18, fontFamily: "Manrope_700Bold", color: isSource ? c.bg : c.textPrimary }}>
          {(name || "?")[0].toUpperCase()}
        </Text>
      </View>
      <Text style={{ fontSize: 11, fontFamily: "Manrope_600SemiBold", color: c.textPrimary, textAlign: "center" }} numberOfLines={1}>
        {name}
      </Text>
      <Text style={{ fontSize: 10, color: c.textMuted }}>
        {isSource ? "owes" : "receives"}
      </Text>
    </View>
  );
}

function SettlementFlow({
  from, to, amount, sym, paid, perPerson,
}: {
  from: string; to: string; amount: number; sym: string; paid: number; perPerson: number;
}) {
  const { c } = useTheme();
  return (
    <View style={{
      borderWidth: 1, borderColor: c.border,
      backgroundColor: c.surface,
      padding: 16, marginBottom: 10,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <PersonNode name={from} isSource sym={sym} />
        <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
          <SketchArrow width={80} />
          <View style={{ borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: c.textPrimary, fontSize: 13, fontFamily: "Manrope_700Bold" }}>
              {sym}{Math.round(amount).toLocaleString(getDeviceLocale())}
            </Text>
          </View>
        </View>
        <PersonNode name={to} isSource={false} sym={sym} />
      </View>

      <View style={{ marginTop: 12, padding: 10, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, gap: 4 }}>
        <Text style={{ fontSize: 10, color: c.textMuted, letterSpacing: 1.2, fontFamily: "Manrope_700Bold" }}>WHY THIS PAYMENT</Text>
        <Text style={{ fontSize: 12, color: c.textSecondary, lineHeight: 18, marginTop: 4 }}>
          <Text style={{ fontFamily: "Manrope_600SemiBold", color: c.textPrimary }}>{from}</Text>
          {` paid ${sym}${Math.round(paid).toLocaleString(getDeviceLocale())} but fair share is ${sym}${Math.round(perPerson).toLocaleString(getDeviceLocale())} — shortfall of ${sym}${Math.round(amount).toLocaleString(getDeviceLocale())}.`}
        </Text>
      </View>
    </View>
  );
}

const CATEGORY_META: Record<string, { emoji: string; label: string }> = {
  food:          { emoji: "🍽️", label: "Food" },
  travel:        { emoji: "✈️", label: "Travel" },
  entertainment: { emoji: "🎬", label: "Fun" },
  utilities:     { emoji: "⚡", label: "Bills" },
  shopping:      { emoji: "🛍️", label: "Shop" },
  health:        { emoji: "💊", label: "Health" },
  accommodation: { emoji: "🏨", label: "Stay" },
  trip:          { emoji: "🗺️", label: "Trip" },
  other:         { emoji: "📦", label: "Other" },
};

export function BalanceExplainer({ trip, userId }: { trip: any; userId: string }) {
  const { c } = useTheme();
  const [visible, setVisible] = useState(false);

  const sym = currencySymbol(trip.currency || "INR");
  const txns: any[] = trip.settlement_transactions || [];
  const bals: any[] = trip.balances || [];
  const members = trip.members || [];
  const total = trip.total_spent || 0;
  const perPerson = total / Math.max(members.length, 1);
  const byCategory: Record<string, number> = trip.by_category || {};
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={{
          flexDirection: "row", alignItems: "center", justifyContent: "center",
          gap: 8, padding: 14, marginHorizontal: 16, marginTop: 4,
          backgroundColor: c.surface,
          borderWidth: 1, borderColor: c.border,
        }}
      >
        <IcoSparkles color={c.textPrimary} size={16} />
        <Text style={{ color: c.textPrimary, fontSize: 14, fontFamily: "Manrope_700Bold" }}>
          Explain Every Rupee
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}>
          <View style={{
            backgroundColor: c.bg,
            padding: 24,
            paddingBottom: Platform.OS === "ios" ? 44 : 28,
            maxHeight: "88%",
            borderTopWidth: 1, borderColor: c.border,
          }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{
                  width: 32, height: 32,
                  backgroundColor: c.textPrimary,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <IcoSparkles color={c.bg} size={15} />
                </View>
                <View>
                  <Text style={{ color: c.textPrimary, fontSize: 18, fontFamily: "Manrope_700Bold" }}>Money Flow</Text>
                  <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 1 }}>Who owes whom and why</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setVisible(false)}
                style={{ width: 32, height: 32, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
                <IcoClose color={c.textMuted} size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* No settlements needed */}
              {txns.length === 0 && (
                <View style={{
                  alignItems: "center", padding: 32, gap: 12,
                  borderWidth: 1, borderColor: c.border,
                  backgroundColor: c.surface, marginBottom: 16,
                }}>
                  <Text style={{ fontSize: 40 }}>🎉</Text>
                  <Text style={{ fontSize: 18, fontFamily: "Manrope_700Bold", color: c.textPrimary }}>All Settled!</Text>
                  <Text style={{ fontSize: 14, color: c.textSecondary, textAlign: "center", lineHeight: 20 }}>
                    Everyone has paid their fair share. No payments needed right now.
                  </Text>
                </View>
              )}

              {/* Settlement flows */}
              {txns.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 10, color: c.textMuted, fontFamily: "Manrope_700Bold", letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>
                    {txns.length === 1 ? "1 payment needed" : `${txns.length} payments needed`}
                  </Text>
                  {txns.map((t: any, i: number) => {
                    const fromBal = bals.find((b: any) => b.id === t.from_id || b.member_id === t.from_id);
                    return (
                      <SettlementFlow
                        key={i}
                        from={t.from_name}
                        to={t.to_name}
                        amount={t.amount}
                        sym={sym}
                        paid={fromBal?.paid || 0}
                        perPerson={perPerson}
                      />
                    );
                  })}
                </View>
              )}

              {/* Balance sheet */}
              {bals.length > 0 && (
                <View style={{ borderWidth: 1, borderColor: c.border, marginBottom: 16 }}>
                  <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 12, fontFamily: "Manrope_700Bold", color: c.textPrimary }}>Balance Sheet</Text>
                    <Text style={{ fontSize: 11, color: c.textMuted }}>
                      fair share {sym}{Math.round(perPerson).toLocaleString(getDeviceLocale())} each
                    </Text>
                  </View>
                  {bals.map((b: any, i: number) => {
                    const maxAbs = Math.max(...bals.map((x: any) => Math.abs(x.net || 0)), 1);
                    const pct = Math.abs(b.net || 0) / maxAbs;
                    const isPos = (b.net || 0) >= 0;
                    const isMe = b.id === userId || b.member_id === userId;
                    return (
                      <View key={i} style={{
                        padding: 14,
                        borderBottomWidth: i < bals.length - 1 ? 1 : 0,
                        borderBottomColor: c.border,
                      }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <Text style={{ fontSize: 13, fontFamily: "Manrope_600SemiBold", color: c.textPrimary }}>
                            {isMe ? `${b.name} (You)` : b.name}
                          </Text>
                          <Text style={{ fontSize: 13, fontFamily: "Manrope_700Bold", color: c.textPrimary }}>
                            {isPos ? "+" : "-"}{sym}{Math.abs(Math.round(b.net || 0)).toLocaleString(getDeviceLocale())}
                          </Text>
                        </View>
                        <View style={{ height: 5, backgroundColor: c.border }}>
                          <View style={{
                            width: `${Math.round(pct * 100)}%` as any,
                            height: 5,
                            backgroundColor: isPos ? c.textPrimary : c.textMuted,
                          }} />
                        </View>
                        <Text style={{ fontSize: 11, color: c.textSecondary, marginTop: 4 }}>
                          {isPos
                            ? `Paid ${sym}${Math.round(b.paid || 0).toLocaleString(getDeviceLocale())} · over-contributed ${sym}${Math.abs(Math.round(b.net || 0)).toLocaleString(getDeviceLocale())}`
                            : `Paid ${sym}${Math.round(b.paid || 0).toLocaleString(getDeviceLocale())} · under-contributed ${sym}${Math.abs(Math.round(b.net || 0)).toLocaleString(getDeviceLocale())}`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Where money went */}
              {topCategories.length > 0 && total > 0 && (
                <View style={{ borderWidth: 1, borderColor: c.border, marginBottom: 16 }}>
                  <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: c.border }}>
                    <Text style={{ fontSize: 12, fontFamily: "Manrope_700Bold", color: c.textPrimary }}>Where Money Went</Text>
                  </View>
                  {topCategories.map(([cat, amt], i) => {
                    const meta = CATEGORY_META[cat] || CATEGORY_META.other;
                    const pct = (amt / total) * 100;
                    return (
                      <View key={cat} style={{
                        padding: 14,
                        borderBottomWidth: i < topCategories.length - 1 ? 1 : 0,
                        borderBottomColor: c.border,
                        flexDirection: "row", alignItems: "center", gap: 12,
                      }}>
                        <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                            <Text style={{ fontSize: 13, fontFamily: "Manrope_600SemiBold", color: c.textPrimary }}>{meta.label}</Text>
                            <Text style={{ fontSize: 13, fontFamily: "Manrope_700Bold", color: c.textPrimary }}>
                              {sym}{Math.round(amt).toLocaleString(getDeviceLocale())}
                              <Text style={{ fontSize: 11, color: c.textMuted, fontFamily: "Manrope_400Regular" }}> · {Math.round(pct)}%</Text>
                            </Text>
                          </View>
                          <View style={{ height: 4, backgroundColor: c.border }}>
                            <View style={{ width: `${Math.round(pct)}%` as any, height: 4, backgroundColor: c.textPrimary }} />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 4, textAlign: "center", marginBottom: 8 }}>
                Powered by Merizo AI
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
