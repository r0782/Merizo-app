import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../lib/theme";
import { api } from "../../lib/api";

export function BalanceExplainer({ trip, userId }: { trip: any; userId: string }) {
  const { c, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [visible, setVisible] = useState(false);

  const explain = async () => {
    setLoading(true);
    setVisible(true);
    try {
      const balances: Record<string, number> = {};
      (trip.balances || []).forEach((b: any) => {
        balances[b.name || b.member_name || "Member"] = b.net || 0;
      });
      const r = await api.post("/ai/explain/balances", {
        balances,
        currency: trip.currency || "INR",
        language: "en"
      });
      setExplanation(r.data.explanation || "Could not generate explanation.");
    } catch {
      setExplanation("Could not connect to AI. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={explain}
        style={{
          flexDirection: "row", alignItems: "center", justifyContent: "center",
          gap: 8, padding: 14, borderRadius: 14, marginHorizontal: 16, marginTop: 4,
          backgroundColor: isDark ? "rgba(157,123,255,0.12)" : "#F0EDF8",
          borderWidth: 1, borderColor: isDark ? "rgba(157,123,255,0.3)" : "#DDD6FE"
        }}
      >
        <Ionicons name="sparkles" size={16} color={isDark ? "#9D7BFF" : "#6D28D9"} />
        <Text style={{ color: isDark ? "#9D7BFF" : "#6D28D9", fontSize: 14, fontWeight: "700" }}>
          Explain Every Rupee
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24, maxHeight: "70%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="sparkles" size={20} color={isDark ? "#9D7BFF" : "#6D28D9"} />
                <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: "800" }}>AI Explanation</Text>
              </View>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={22} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={{ alignItems: "center", padding: 32, gap: 12 }}>
                <ActivityIndicator size="large" color={isDark ? "#9D7BFF" : "#6D28D9"} />
                <Text style={{ color: c.textMuted, fontSize: 14 }}>Analyzing balances...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Visual breakdown bars */}
                {(trip.balances || []).slice(0, 5).map((b: any, i: number) => {
                  const maxAbs = Math.max(...(trip.balances||[]).map((x: any) => Math.abs(x.net||0)), 1);
                  const pct = Math.abs(b.net||0) / maxAbs;
                  const isPos = (b.net||0) >= 0;
                  return (
                    <View key={i} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: "500", color: c.textPrimary }}>{b.name}</Text>
                        <Text style={{ fontSize: 13, fontWeight: "500", color: isPos ? "#00C48C" : "#FF453A" }}>
                          {isPos ? "+" : "-"}₹{Math.abs(Math.round(b.net||0)).toLocaleString("en-IN")}
                        </Text>
                      </View>
                      <View style={{ height: 6, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#F0EDE8", borderRadius: 3, overflow: "hidden" }}>
                        <View style={{ width: `${Math.round(pct * 100)}%` as any, height: 6, backgroundColor: isPos ? "#00C48C" : "#FF453A", borderRadius: 3 }} />
                      </View>
                      <Text style={{ fontSize: 11, color: c.textSecondary, marginTop: 2 }}>
                        {isPos ? "Owed to them" : "They owe"}
                      </Text>
                    </View>
                  );
                })}
                <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#F0EDE8", marginVertical: 12 }} />
                <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#F5F3FF", borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: isDark ? "rgba(109,93,252,0.2)" : "#E0D9FF" }}>
                  <Text style={{ fontSize: 11, color: "#6D5DFC", fontWeight: "500", marginBottom: 6 }}>✦ AI says</Text>
                  <Text style={{ color: c.textPrimary, fontSize: 14, lineHeight: 22 }}>{explanation}</Text>
                </View>
                <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 12, textAlign: "center" }}>
                  Powered by Merizo AI
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
