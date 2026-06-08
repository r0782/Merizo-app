import React from "react";
import { View, Text, TouchableOpacity, ViewStyle, TextStyle } from "react-native";
import { useTheme } from "../lib/theme";
interface DividerProps { label?: string; style?: ViewStyle; }
interface BtnProps { label: string; onPress: () => void; icon?: string; disabled?: boolean; variant?: string; style?: ViewStyle; testID?: string; }
export function ThemedDivider({ label, style }: DividerProps) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.border, marginVertical: 8 }, style]}>{label ? <Text style={{ fontSize: 10, color: c.textMuted }}>{label}</Text> : null}</View>;
}
export function ThemedButton({ label, onPress, disabled, style, testID }: BtnProps) {
  const { c, isDark } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} testID={testID} style={[{ backgroundColor: isDark ? c.indigo : "#0A0A0A", borderRadius: 12, padding: 14, alignItems: "center" }, style]}>
      <Text style={{ color: "#fff", fontWeight: "500", fontSize: 15 }}>{label}</Text>
    </TouchableOpacity>
  );
}
export default ThemedDivider;
