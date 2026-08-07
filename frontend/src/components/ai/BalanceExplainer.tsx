import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, Platform } from "react-native";
import Svg, { Path, Circle, Line, G } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../lib/theme";
import { currencySymbol } from "../../lib/tokens";

// ── Sketch-style arrow between two people ─────────────────────────────────────

function SketchArrow({ width, color }: { width: number; color: string }) {
  const mid = width / 2;
  const y = 22;
  const headLen = 10;
  return (
    <Svg width={width} height={44} style={{ overflow: "visible" }}>
      {/* Main line — slightly wavy for sketch feel */}
      <Path
        d={`M 8 ${y} Q ${mid} ${y - 4} ${width - 14} ${y}`}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
      {/* Arrowhead */}
      <Path
        d={`M ${width - 14} ${y} L ${width - 14 - headLen} ${y - 6} M ${width - 14} ${y} L ${width - 14 - headLen} ${y + 6}`}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

// ── Person avatar (sketch circle with initial) ────────────────────────────────

function PersonNode({
  name,
  amount,
  isSource,
  sym,
}: {
  name: string;
  amount?: number;
  isSource: boolean;
  sym: string;
}) {
  const { c, isDark } = useTheme();
  const bg = isSource
    ? (isDark ? "rgba(255,67,58,0.12)" : "#FFF0EF")
    : (isDark ? "rgba(0,196,140,0.12)" : "#EDFFF8");
  const borderColor = isSource ? "#FF453A" : "#00C48C";
  const textColor = isSource ? "#FF453A" : "#00C48C";

  return (
    <View style={{ alignItems: "center", gap: 5, minWidth: 64 }}>
      {/* Sketch circle */}
      <View style={{
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: bg,
        borderWidth: 2, borderColor,
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: textColor }}>
          {(name || "?")[0].toUpperCase()}
        </Text>
      </View>
      <Text style={{ fontSize: 11, fontWeight: "600", color: c.textPrimary, textAlign: "center" }} numberOfLines={1}>
        {name}
      </Text>
      {amount !== undefined && (
        <Text style={{ fontSize: 10, color: textColor, fontWeight: "500" }}>
          {isSource ? "owes" : "receives"}
        </Text>
      )}
    </View>
  );
}

// ── Single settlement row ─────────────────────────────────────────────────────

function SettlementFlow({
  from,
  to,
  amount,
  sym,
  paid,
  perPerson,
}: {
  from: string;
  to: string;
  amount: number;
  sym: string;
  paid: number;
  perPerson: number;
}) {
  const { c, isDark } = useTheme();
  return (
    <View style={{
      backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#FAFAF8",
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "#EAE6E0",
      padding: 16,
      marginBottom: 10,
    }}>
      {/* Flow diagram */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <PersonNode name={from} isSource sym={sym} />
        <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
          <SketchArrow width={80} color="#FF453A" />
          <View style={{
            backgroundColor: isDark ? "rgba(255,67,58,0.15)" : "#FFF0EF",
            borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
            borderWidth: 1, borderColor: isDark ? "rgba(255,67,58,0.3)" : "#FFCCC9",
          }}>
            <Text style={{ color: "#FF453A", fontSize: 13, fontWeight: "700" }}>
              {sym}{Math.round(amount).toLocaleString("en-IN")}
            </Text>
          </View>
        </View>
        <PersonNode name={to} isSource={false} sym={sym} />
      </View>

      {/* Why breakdown */}
      <View style={{
        marginTop: 12, padding: 10,
        backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#F5F3EF",
        borderRadius: 10, gap: 4,
      }}>
        <Text style={{ fontSize: 10, color: c.textMuted, letterSpacing: 1.2, fontWeight: "700" }}>WHY THIS PAYMENT</Text>
        <Text style={{ fontSize: 12, color: c.textSecondary, lineHeight: 18, marginTop: 4 }}>
          <Text style={{ fontWeight: "600", color: c.textPrimary }}>{from}</Text>
          {` paid ${sym}${Math.round(paid).toLocaleString("en-IN")} but fair share is ${sym}${Math.round(perPerson).toLocaleString("en-IN")} — shortfall of ${sym}${Math.round(amount).toLocaleString("en-IN")}.`}
        </Text>
      </View>
    </View>
  );
}

// ── Category flow bar ─────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { emoji: string; label: string; color: string }> = {
  food:          { emoji: "🍽️", label: "Food",    color: "#FF8B7B" },
  travel:        { emoji: "✈️", label: "Travel",  color: "#60A5FA" },
  entertainment: { emoji: "🎬", label: "Fun",     color: "#A78BFA" },
  utilities:     { emoji: "⚡", label: "Bills",   color: "#FBBF24" },
  shopping:      { emoji: "🛍️", label: "Shop",    color: "#F472B6" },
  health:        { emoji: "💊", label: "Health",  color: "#34D399" },
  accommodation: { emoji: "🏨", label: "Stay",    color: "#E8B04E" },
  trip:          { emoji: "🗺️", label: "Trip",    color: "#9D7BFF" },
  other:         { emoji: "📦", label: "Other",   color: "#9CA3AF" },
};

// ── Main component ────────────────────────────────────────────────────────────

export function BalanceExplainer({ trip, userId }: { trip: any; userId: string }) {
  const { c, isDark } = useTheme();
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
          gap: 8, padding: 14, borderRadius: 14, marginHorizontal: 16, marginTop: 4,
          backgroundColor: isDark ? "rgba(157,123,255,0.12)" : "#F0EDF8",
          borderWidth: 1, borderColor: isDark ? "rgba(157,123,255,0.3)" : "#DDD6FE",
        }}
      >
        <Ionicons name="sparkles" size={16} color={isDark ? "#9D7BFF" : "#6D28D9"} />
        <Text style={{ color: isDark ? "#9D7BFF" : "#6D28D9", fontSize: 14, fontWeight: "700" }}>
          Explain Every Rupee
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }}>
          <View style={{
            backgroundColor: c.bg,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 24,
            paddingBottom: Platform.OS === "ios" ? 44 : 28,
            maxHeight: "88%",
            borderTopWidth: 1, borderColor: c.border,
          }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{
                  width: 32, height: 32, borderRadius: 10,
                  backgroundColor: isDark ? "rgba(157,123,255,0.2)" : "#EDE9FE",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons name="sparkles" size={16} color={isDark ? "#9D7BFF" : "#6D28D9"} />
                </View>
                <View>
                  <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: "800" }}>Money Flow</Text>
                  <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 1 }}>Who owes whom and why</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={22} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* ── No settlements needed ── */}
              {txns.length === 0 && (
                <View style={{
                  alignItems: "center", padding: 32, gap: 12,
                  backgroundColor: isDark ? "rgba(0,196,140,0.08)" : "#EDFFF8",
                  borderRadius: 20, borderWidth: 1,
                  borderColor: isDark ? "rgba(0,196,140,0.2)" : "#A7F3D0",
                  marginBottom: 16,
                }}>
                  <Text style={{ fontSize: 40 }}>🎉</Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#00C48C" }}>All Settled!</Text>
                  <Text style={{ fontSize: 14, color: c.textSecondary, textAlign: "center", lineHeight: 20 }}>
                    Everyone has paid their fair share. No payments needed right now.
                  </Text>
                </View>
              )}

              {/* ── Settlement flows ── */}
              {txns.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 11, color: c.textMuted, fontWeight: "700", letterSpacing: 1.2, marginBottom: 12 }}>
                    {txns.length === 1 ? "1 PAYMENT NEEDED" : `${txns.length} PAYMENTS NEEDED`}
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

              {/* ── Balance bars ── */}
              {bals.length > 0 && (
                <View style={{
                  backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                  borderRadius: 20, overflow: "hidden",
                  borderWidth: 1, borderColor: c.border,
                  marginBottom: 16,
                }}>
                  <View style={{
                    padding: 14, borderBottomWidth: 1, borderBottomColor: c.border,
                    flexDirection: "row", alignItems: "center", gap: 8,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: c.textPrimary }}>Balance Sheet</Text>
                    <Text style={{ fontSize: 11, color: c.textMuted }}>
                      fair share {sym}{Math.round(perPerson).toLocaleString("en-IN")} each
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
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={{ fontSize: 13, fontWeight: "600", color: c.textPrimary }}>
                              {isMe ? `${b.name} (You)` : b.name}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: isPos ? "#00C48C" : "#FF453A" }}>
                            {isPos ? "+" : "-"}{sym}{Math.abs(Math.round(b.net || 0)).toLocaleString("en-IN")}
                          </Text>
                        </View>
                        {/* Sketch-style bar */}
                        <View style={{ height: 7, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F0EDE8", borderRadius: 4, overflow: "hidden" }}>
                          <View style={{
                            width: `${Math.round(pct * 100)}%` as any,
                            height: 7,
                            backgroundColor: isPos ? "#00C48C" : "#FF453A",
                            borderRadius: 4,
                          }} />
                        </View>
                        <Text style={{ fontSize: 11, color: c.textSecondary, marginTop: 4 }}>
                          {isPos
                            ? `Paid ${sym}${Math.round(b.paid || 0).toLocaleString("en-IN")} · over-contributed ${sym}${Math.abs(Math.round(b.net || 0)).toLocaleString("en-IN")}`
                            : `Paid ${sym}${Math.round(b.paid || 0).toLocaleString("en-IN")} · under-contributed ${sym}${Math.abs(Math.round(b.net || 0)).toLocaleString("en-IN")}`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* ── Where money went ── */}
              {topCategories.length > 0 && total > 0 && (
                <View style={{
                  backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                  borderRadius: 20, overflow: "hidden",
                  borderWidth: 1, borderColor: c.border,
                  marginBottom: 16,
                }}>
                  <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: c.border }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: c.textPrimary }}>Where Money Went</Text>
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
                            <Text style={{ fontSize: 13, fontWeight: "500", color: c.textPrimary }}>{meta.label}</Text>
                            <Text style={{ fontSize: 13, fontWeight: "600", color: c.textPrimary }}>
                              {sym}{Math.round(amt).toLocaleString("en-IN")}
                              <Text style={{ fontSize: 11, color: c.textMuted }}> · {Math.round(pct)}%</Text>
                            </Text>
                          </View>
                          <View style={{ height: 6, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F0EDE8", borderRadius: 3, overflow: "hidden" }}>
                            <View style={{ width: `${Math.round(pct)}%` as any, height: 6, backgroundColor: meta.color, borderRadius: 3 }} />
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
