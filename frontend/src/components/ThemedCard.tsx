import React from "react";
import { View, ViewStyle } from "react-native";
interface CardProps { children?: React.ReactNode; style?: ViewStyle; compact?: boolean; }
export function ThemedCard({ children, style }: CardProps) {
  return <View style={style}>{children}</View>;
}
export default ThemedCard;
