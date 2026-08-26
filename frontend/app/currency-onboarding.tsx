import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "../src/lib/theme";
import { currencyOptions, type } from "../src/lib/tokens";
import { STORAGE_KEYS } from "../src/lib/storage-keys";
import { ROUTES } from "../src/lib/routes";
import { detectLocaleCurrency } from "../src/lib/currency";
import { useCurrency } from "../src/lib/CurrencyContext";

const ICON_STROKE_WIDTH = 1.5;

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path
        d="M 3 8 L 6.5 11.5 L 13 5"
        stroke={color}
        strokeWidth={ICON_STROKE_WIDTH}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ArrowIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path
        d="M 3 8 L 13 8 M 9 4 L 13 8 L 9 12"
        stroke={color}
        strokeWidth={ICON_STROKE_WIDTH}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function CurrencyOnboarding() {
  const { c } = useTheme();
  const router = useRouter();
  const { setCurrency: setAppCurrency } = useCurrency();

  // Automatically detect user's locale currency.
  // Falls back to the first available currency if detection
  // returns something that isn't in currencyOptions.
  const detectedCurrency = detectLocaleCurrency();

  const initialCurrency =
    currencyOptions.some((option) => option.code === detectedCurrency)
      ? detectedCurrency
      : currencyOptions[0]?.code ?? "USD";

  const [selectedCurrency, setSelectedCurrency] =
    useState<string>(initialCurrency);

  const onFinish = async () => {
    try {
      // Updates both the context (so it's live immediately) and AsyncStorage
      // (via the context's own setter) in one call.
      setAppCurrency(selectedCurrency);

      await AsyncStorage.setItem(
        STORAGE_KEYS.ONBOARDING_DONE,
        "true"
      );

      router.replace(ROUTES.HOME);
    } catch (error) {
      console.error("Failed to save onboarding data:", error);

      // Even if local storage fails, don't trap the user
      // on the onboarding screen.
      router.replace(ROUTES.HOME);
    }
  };

  const selectedOption = currencyOptions.find(
    (option) => option.code === selectedCurrency
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bg,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingTop: Platform.OS === "ios" ? 60 : 40,
          paddingBottom: 60,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              color: c.textMuted,
              fontSize: 9,
              letterSpacing: 3,
              fontFamily: type.family.regular,
              marginBottom: 10,
              textTransform: "uppercase",
            }}
          >
            Welcome to Merizo
          </Text>

          <Text
            style={{
              color: c.textPrimary,
              fontSize: 28,
              fontFamily: type.family.bold,
              letterSpacing: -1,
              marginBottom: 8,
            }}
          >
            Choose your currency
          </Text>

          <Text
            style={{
              color: c.textMuted,
              fontSize: 13,
              fontFamily: type.family.regular,
              lineHeight: 20,
            }}
          >
            This will be the default for all new groups. You can change it
            anytime.
          </Text>
        </View>

        {/* Divider */}
        <View
          style={{
            height: 1,
            backgroundColor: c.border,
            opacity: 0.15,
            marginBottom: 20,
          }}
        />

        {/* Currency List */}
        <View style={{ marginBottom: 32 }}>
          {currencyOptions.map((option, index) => {
            const active = selectedCurrency === option.code;

            return (
              <TouchableOpacity
                key={option.code}
                onPress={() => setSelectedCurrency(option.code)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{
                  selected: active,
                }}
                accessibilityLabel={`${option.label}, ${option.code}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  backgroundColor: active
                    ? c.textPrimary
                    : "transparent",
                  padding: 14,
                  borderWidth: 1,
                  borderColor: active
                    ? c.textPrimary
                    : `${c.border}30`,
                  marginBottom:
                    index < currencyOptions.length - 1 ? -1 : 0,
                }}
              >
                {/* Currency Symbol */}
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderWidth: 1,
                    borderColor: active
                      ? `${c.bg}40`
                      : `${c.border}30`,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: active
                      ? `${c.bg}15`
                      : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: active
                        ? c.bg
                        : c.textSecondary,
                      fontSize: 17,
                      fontFamily: type.family.bold,
                    }}
                  >
                    {option.symbol}
                  </Text>
                </View>

                {/* Currency Information */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: active
                        ? c.bg
                        : c.textPrimary,
                      fontSize: 14,
                      fontFamily: type.family.semibold,
                    }}
                  >
                    {option.label}
                  </Text>

                  <Text
                    style={{
                      color: active
                        ? `${c.bg}70`
                        : c.textMuted,
                      fontSize: 11,
                      fontFamily: type.family.regular,
                      marginTop: 1,
                    }}
                  >
                    {option.code}
                  </Text>
                </View>

                {/* Selected Indicator */}
                {active && <CheckIcon color={c.bg} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Currency Preview */}
        {selectedOption && (
          <Text
            style={{
              color: c.textMuted,
              fontSize: 11,
              fontFamily: type.family.regular,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            Default currency: {selectedOption.symbol}{" "}
            {selectedOption.code}
          </Text>
        )}

        {/* Continue */}
        <TouchableOpacity
          onPress={onFinish}
          activeOpacity={0.8}
          disabled={!selectedCurrency}
          style={{
            backgroundColor: c.textPrimary,
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            opacity: selectedCurrency ? 1 : 0.5,
          }}
        >
          <Text
            style={{
              color: c.bg,
              fontSize: 14,
              fontFamily: type.family.semibold,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Continue
          </Text>

          <ArrowIcon color={c.bg} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}