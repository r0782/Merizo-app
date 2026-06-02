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
                <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border }}>
                  <Text style={{ color: c.textPrimary, fontSize: 15, lineHeight: 24 }}>{explanation}</Text>
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
