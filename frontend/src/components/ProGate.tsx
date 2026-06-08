import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";

const FEATURES = [
  { icon: "sparkles", label: "Unlimited AI chat messages" },
  { icon: "bar-chart", label: "Spending analytics & graphs" },
  { icon: "document-text", label: "Export to spreadsheet" },
  { icon: "scan", label: "Unlimited bill scanning" },
  { icon: "people", label: "Unlimited groups" },
  { icon: "cloud-done", label: "Cloud sync & backup" },
  { icon: "trending-up", label: "Financial score & insights" },
  { icon: "notifications", label: "Smart reminders" },
];

export function ProGate({ visible, onClose, feature = "This feature" }: {
  visible: boolean;
  onClose: () => void;
  feature?: string;
}) {
  const { c, isDark } = useTheme();
  const [selected, setSelected] = useState<"monthly" | "yearly">("monthly");

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "92%", overflow: "hidden" }}>
          {/* Header */}
          <View style={{ backgroundColor: "#111", padding: 28, paddingBottom: 24 }}>
            <TouchableOpacity onPress={onClose} style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <View style={{ backgroundColor: "#6D5DFC", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>PRO</Text>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Merizo</Text>
            </View>
            <Text style={{ color: "#fff", fontSize: 26, fontWeight: "500", letterSpacing: -0.5, marginBottom: 6 }}>
              Unlock Merizo Pro
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 20 }}>
              {feature} requires Pro. Get unlimited AI, analytics, and more.
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {/* Pricing toggle */}
            <View style={{ flexDirection: "row", backgroundColor: isDark ? "#1C1C1E" : "#F0EDE8", borderRadius: 14, padding: 3, marginBottom: 20 }}>
              <TouchableOpacity onPress={() => setSelected("monthly")} style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 11, backgroundColor: selected === "monthly" ? (isDark ? "#2C2C2E" : "#fff") : "transparent" }}>
                <Text style={{ fontSize: 13, fontWeight: "500", color: selected === "monthly" ? c.textPrimary : c.textSecondary }}>Monthly</Text>
                <Text style={{ fontSize: 18, fontWeight: "500", color: selected === "monthly" ? "#6D5DFC" : c.textSecondary, letterSpacing: -0.5 }}>₹299</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelected("yearly")} style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 11, backgroundColor: selected === "yearly" ? (isDark ? "#2C2C2E" : "#fff") : "transparent" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: "500", color: selected === "yearly" ? c.textPrimary : c.textSecondary }}>Yearly</Text>
                  <View style={{ backgroundColor: "#00C48C", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 9, color: "#fff", fontWeight: "700" }}>SAVE 40%</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 18, fontWeight: "500", color: selected === "yearly" ? "#6D5DFC" : c.textSecondary, letterSpacing: -0.5 }}>₹1,999</Text>
              </TouchableOpacity>
            </View>

            {/* Features */}
            <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 18, overflow: "hidden", borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", marginBottom: 20 }}>
              {FEATURES.map((f, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: i < FEATURES.length - 1 ? 0.5 : 0, borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(109,93,252,0.1)", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={f.icon as any} size={16} color="#6D5DFC" />
                  </View>
                  <Text style={{ fontSize: 14, color: c.textPrimary, flex: 1 }}>{f.label}</Text>
                  <Ionicons name="checkmark-circle" size={18} color="#00C48C" />
                </View>
              ))}
            </View>

            {/* Free trial note */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,196,140,0.08)", borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 0.5, borderColor: "rgba(0,196,140,0.2)" }}>
              <Ionicons name="gift" size={16} color="#00C48C" />
              <Text style={{ fontSize: 13, color: "#00C48C", flex: 1 }}>3 free AI messages included with every account</Text>
            </View>

            {/* CTA */}
            <TouchableOpacity
              onPress={() => { onClose(); /* TODO: payment gateway */ }}
              style={{ backgroundColor: "#6D5DFC", borderRadius: 16, padding: 18, alignItems: "center", marginBottom: 12 }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "500" }}>
                Start Free Trial · {selected === "monthly" ? "₹299/mo" : "₹1,999/yr"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ alignItems: "center", padding: 8 }}>
              <Text style={{ color: c.textSecondary, fontSize: 13 }}>Maybe later</Text>
            </TouchableOpacity>
            <Text style={{ color: c.textMuted, fontSize: 11, textAlign: "center", marginTop: 12, lineHeight: 16 }}>
              Cancel anytime. No hidden fees. Billed through Razorpay.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function ProBadge() {
  return (
    <View style={{ backgroundColor: "#6D5DFC", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>PRO</Text>
    </View>
  );
}
