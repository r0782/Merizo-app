/**
 * NumberTicker.tsx
 *
 * Smooth linear counting ticker using Roboto Mono font.
 * Keeps the 60fps linear animation, drops the dot-matrix rendering.
 */

import React, { useEffect } from "react";
import { Text, View } from "react-native";

type Props = {
  value: number;
  currency?: string;
  decimals?: number;
  duration?: number;
  testID?: string;
};

export function NumberTicker({
  value,
  currency = "₹",
  decimals = 2,
  duration = 100,
  testID,
}: Props) {
  const [displayValue, setDisplayValue] = React.useState(0);

  useEffect(() => {
    const startValue = displayValue;
    const diff       = value - startValue;
    const steps      = Math.max(60, Math.floor(duration / 16));
    let   currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;   // linear — all digits move at same speed
      const newValue = startValue + diff * progress;
      setDisplayValue(newValue);

      if (currentStep >= steps) {
        setDisplayValue(value);
        clearInterval(interval);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [value, duration]);

  const formatted = displayValue.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <View testID={testID}>
      <Text
        style={{
          fontFamily: "RobotoMono_700Bold",
          fontSize: 24,
          color: "#7C5CFF",
          fontVariant: ["tabular-nums"],
          includeFontPadding: false,
          letterSpacing: 0.5,
        }}
      >
        {currency}{formatted}
      </Text>
    </View>
  );
}