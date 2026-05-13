/**
 * AnimatedSmartNum.tsx
 *
 * Animated number display using Roboto Mono font.
 * Keeps the ease-out cubic counting animation, drops the dot-matrix rendering.
 */

import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

// ── Size → font size map (mirrors old DotNum sizes) ──────────────────────────
const SIZES: Record<string, number> = {
  sm:  14,
  md:  20,
  lg:  26,
  xl:  34,
  xxl: 44,
};

// ── Color → hex ───────────────────────────────────────────────────────────────
const COLORS: Record<string, string> = {
  indigo: "#7C5CFF",
  black:  "#0A0A0A",
  white:  "#FFFFFF",
  red:    "#F87171",
  green:  "#4ADE80",
  gold:   "#F5C842",
  muted:  "#888888",
};

type Props = {
  value: string | number;
  size?: "sm" | "md" | "lg" | "xl" | "xxl";
  color?: "indigo" | "black" | "red" | "green" | "gold" | "white" | "muted";
  duration?: number;
  testID?: string;
};

export function AnimatedSmartNum({
  value,
  size = "md",
  color = "black",
  duration = 800,
  testID,
}: Props) {
  const safeValue  = typeof value === "string" ? value : String(value || "0");
  const prefix     = safeValue.match(/^[^\d]*/)?.[0] ?? "";
  const numericTarget = parseFloat(safeValue.replace(/[^0-9.-]+/g, "")) || 0;

  const [displayValue, setDisplayValue] = useState(safeValue);
  const prevTargetRef = useRef<number>(0);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const startNum = prevTargetRef.current;
    const endNum   = numericTarget;
    if (startNum === endNum) return;
    prevTargetRef.current = endNum;

    if (intervalRef.current) clearInterval(intervalRef.current);

    const diff  = endNum - startNum;
    const steps = Math.ceil(duration / 16);
    let step    = 0;

    intervalRef.current = setInterval(() => {
      step++;
      const t     = step / steps;
      const eased = 1 - Math.pow(1 - t, 3);          // ease-out cubic
      const current = startNum + diff * eased;
      setDisplayValue(prefix + Math.round(current).toLocaleString("en-IN"));

      if (step >= steps) {
        setDisplayValue(safeValue);
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
      }
    }, 16);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [numericTarget, safeValue, prefix, duration]);

  return (
    <View testID={testID}>
      <Text
        style={{
          fontFamily: "RobotoMono_700Bold",
          fontSize:   SIZES[size] ?? 20,
          color:      COLORS[color] ?? "#0A0A0A",
          fontVariant: ["tabular-nums"],
          includeFontPadding: false,
        }}
      >
        {displayValue}
      </Text>
    </View>
  );
}