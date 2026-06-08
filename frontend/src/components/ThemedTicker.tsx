import React from "react";
import { Text } from "react-native";
import { useTheme } from "../lib/theme";
interface TickerProps { value: number; currency?: string; size?: string; }
export function ThemedTicker({ value, currency = "₹", size }: TickerProps) {
  const { c } = useTheme();
  const fs = size === "hero" ? 36 : size === "card" ? 22 : 16;
  return <Text style={{ fontSize: fs, fontWeight: "500", color: value >= 0 ? c.positive : c.negative }}>{value >= 0 ? "+" : ""}{currency}{Math.abs(Math.round(value)).toLocaleString("en-IN")}</Text>;
}
export default ThemedTicker;
