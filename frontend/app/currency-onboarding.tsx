import { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../src/lib/theme";
import { currencyOptions } from "../src/lib/tokens";
import { type } from "../src/lib/tokens";
import AsyncStorage from "@react-native-async-storage/async-storage";

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path d="M 3 8 L 6.5 11.5 L 13 5" stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ArrowIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path d="M 3 8 L 13 8 M 9 4 L 13 8 L 9 12" stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function CurrencyOnboarding() {
  const { c } = useTheme();
  const router = useRouter();
  const [selectedCurrency, setSelectedCurrency] = useState("INR");

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
          <Text style={{ color: c.textMuted, fontSize: 9, letterSpacing: 3, fontFamily: type.family.regular, marginBottom: 10, textTransform: "uppercase" }}>
            Welcome to Merizo
          </Text>
          <Text style={{ color: c.textPrimary, fontSize: 28, fontFamily: type.family.bold, letterSpacing: -1, marginBottom: 8 }}>
            Choose your currency
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 13, fontFamily: type.family.regular, lineHeight: 20 }}>
            This will be the default for all new groups. You can change it anytime.
          </Text>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: c.border, opacity: 0.15, marginBottom: 20 }} />

        {/* Currency list */}
        <View style={{ gap: 0, marginBottom: 32 }}>
          {currencyOptions.map((opt, i) => {
            const active = selectedCurrency === opt.code;
            return (
              <TouchableOpacity
                key={opt.code}
                onPress={() => setSelectedCurrency(opt.code)}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 14,
                  backgroundColor: active ? c.textPrimary : "transparent",
                  padding: 14,
                  borderWidth: 1,
                  borderColor: active ? c.textPrimary : `${c.border}30`,
                  marginBottom: i < currencyOptions.length - 1 ? -1 : 0,
                }}
              >
                {/* Symbol box */}
                <View style={{
                  width: 40, height: 40,
                  borderWidth: 1,
                  borderColor: active ? `${c.bg}40` : `${c.border}30`,
                  alignItems: "center", justifyContent: "center",
                  backgroundColor: active ? `${c.bg}15` : "transparent",
                }}>
                  <Text style={{
                    color: active ? c.bg : c.textSecondary,
                    fontSize: 17,
                    fontFamily: type.family.bold,
                  }}>
                    {opt.symbol}
                  </Text>
                </View>

                {/* Labels */}
                <View style={{ flex: 1 }}>
                  <Text style={{
                    color: active ? c.bg : c.textPrimary,
                    fontSize: 14,
                    fontFamily: type.family.semibold,
                  }}>
                    {opt.label}
                  </Text>
                  <Text style={{
                    color: active ? `${c.bg}70` : c.textMuted,
                    fontSize: 11,
                    fontFamily: type.family.regular,
                    marginTop: 1,
                  }}>
                    {opt.code}
                  </Text>
                </View>

                {/* Check */}
                {active && <CheckIcon color={c.bg} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Continue button */}
        <TouchableOpacity
          onPress={onFinish}
          activeOpacity={0.8}
          style={{
            backgroundColor: c.textPrimary,
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <Text style={{
            color: c.bg,
            fontSize: 14,
            fontFamily: type.family.semibold,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}>
            Continue
          </Text>
          <ArrowIcon color={c.bg} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
