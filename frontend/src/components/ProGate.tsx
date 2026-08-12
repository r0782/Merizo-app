import { useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, Alert } from "react-native";
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
  const { c } = useTheme();
  const [selected, setSelected] = useState<"monthly" | "yearly">("monthly");

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "92%", overflow: "hidden" }}>
          {/* Header */}
          <View style={{ backgroundColor: c.textPrimary, padding: 28, paddingBottom: 24 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={16} color={c.bg} />
            </TouchableOpacity>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <View style={{ backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: c.textPrimary, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>PRO</Text>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Merizo</Text>
            </View>
            <Text style={{ color: c.bg, fontSize: 26, fontWeight: "700", letterSpacing: -0.5, marginBottom: 6 }}>
              Unlock Merizo Pro
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 20 }}>
              {feature} requires Pro. Get unlimited AI, analytics, and more.
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {/* Pricing toggle */}
            <View style={{ flexDirection: "row", backgroundColor: c.surfaceAlt, borderRadius: 14, padding: 3, marginBottom: 20, borderWidth: 1, borderColor: c.border }}>
              <TouchableOpacity
                onPress={() => setSelected("monthly")}
                style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 11, backgroundColor: selected === "monthly" ? c.surface : "transparent" }}
              >
                <Text style={{ fontSize: 13, fontWeight: "500", color: c.textSecondary }}>Monthly</Text>
                <Text style={{ fontSize: 18, fontWeight: "700", color: c.textPrimary, letterSpacing: -0.5 }}>₹299</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelected("yearly")}
                style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 11, backgroundColor: selected === "yearly" ? c.surface : "transparent" }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: "500", color: c.textSecondary }}>Yearly</Text>
                  <View style={{ backgroundColor: c.positive, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 9, color: "#fff", fontWeight: "700" }}>SAVE 40%</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 18, fontWeight: "700", color: c.textPrimary, letterSpacing: -0.5 }}>₹1,999</Text>
              </TouchableOpacity>
            </View>

            {/* Features */}
            <View style={{ backgroundColor: c.surface, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: c.border, marginBottom: 20 }}>
              {FEATURES.map((f, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: i < FEATURES.length - 1 ? 1 : 0, borderBottomColor: c.border }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={f.icon as any} size={16} color={c.textSecondary} />
                  </View>
                  <Text style={{ fontSize: 14, color: c.textPrimary, flex: 1 }}>{f.label}</Text>
                  <Ionicons name="checkmark-circle" size={18} color={c.positive} />
                </View>
              ))}
            </View>

            {/* Free trial note */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.surfaceAlt, borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: c.border }}>
              <Ionicons name="gift" size={16} color={c.textSecondary} />
              <Text style={{ fontSize: 13, color: c.textSecondary, flex: 1 }}>3 free AI messages included with every account</Text>
            </View>

            {/* CTA */}
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Coming Soon",
                  "Pro subscriptions are launching soon! We'll notify you when payments go live.",
                  [{ text: "Got it", onPress: onClose }]
                );
              }}
              style={{ backgroundColor: c.textPrimary, borderRadius: 16, padding: 18, alignItems: "center", marginBottom: 12 }}
            >
              <Text style={{ color: c.bg, fontSize: 16, fontWeight: "600" }}>
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
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.textPrimary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: c.bg, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>PRO</Text>
    </View>
  );
}
