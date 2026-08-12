import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { currencyOptions } from "../src/lib/tokens";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function CurrencyOnboarding() {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const [selectedCurrency, setSelectedCurrency] = useState("INR");

  const ind = isDark ? "#9D7BFF" : "#1F1A17";

  const onFinish = async () => {
    try {
      await AsyncStorage.setItem("default_currency", selectedCurrency);
      await AsyncStorage.setItem("onboarding_done", "true");
      router.replace("/(tabs)/home");
    } catch {
      router.replace("/(tabs)/home");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ color: c.textMuted, fontSize: 9, letterSpacing: 3, fontFamily: "Manrope_400Regular" as any, marginBottom: 10 }}>
            WELCOME TO MERIZO
          </Text>
          <Text style={{ color: c.textPrimary, fontSize: 28, fontFamily: "Manrope_800ExtraBold" as any, letterSpacing: -0.5, marginBottom: 8 }}>
            Choose your currency
          </Text>
          <Text style={{ color: c.textSecondary, fontSize: 14, lineHeight: 22 }}>
            This will be the default for all new groups. You can change it anytime.
          </Text>
        </View>

        {/* Currency list */}
        <View style={{ gap: 10, marginBottom: 32 }}>
          {currencyOptions.map(opt => {
            const active = selectedCurrency === opt.code;
            return (
              <TouchableOpacity
                key={opt.code}
                onPress={() => setSelectedCurrency(opt.code)}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 14,
                  backgroundColor: active
                    ? (isDark ? "rgba(157,123,255,0.12)" : "#F0EDF8")
                    : (isDark ? "#1B1612" : c.surface),
                  borderRadius: 14, padding: 16,
                  borderWidth: 1.5,
                  borderColor: active
                    ? (isDark ? "#9D7BFF" : "#5B3FD4")
                    : c.border,
                }}
              >
                {/* Symbol bubble */}
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: active
                    ? (isDark ? "rgba(157,123,255,0.2)" : "#E8E0FF")
                    : (isDark ? "rgba(255,255,255,0.06)" : "#F0EDE8"),
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ color: active ? (isDark ? "#9D7BFF" : "#5B3FD4") : c.textSecondary, fontSize: 18, fontWeight: "800" }}>
                    {opt.symbol}
                  </Text>
                </View>

                {/* Labels */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: "700" }}>{opt.label}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>{opt.code}</Text>
                </View>

                {/* Check */}
                {active && (
                  <Ionicons name="checkmark-circle" size={22} color={isDark ? "#9D7BFF" : "#5B3FD4"} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Continue button */}
        <TouchableOpacity
          onPress={onFinish}
          style={{
            backgroundColor: ind, borderRadius: 16, padding: 18,
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}