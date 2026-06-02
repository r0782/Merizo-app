import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../lib/theme";

export function ChatBubble({ message }: { message: { role: string; content: string } }) {
  const { c, isDark } = useTheme();
  const isUser = message.role === "user";
  return (
    <View style={{ alignItems: isUser ? "flex-end" : "flex-start", marginVertical: 4 }}>
      <View style={{
        maxWidth: "80%",
        backgroundColor: isUser ? (isDark ? c.indigo : "#0A0A0A") : c.surface,
        borderRadius: 16,
        borderBottomRightRadius: isUser ? 4 : 16,
        borderBottomLeftRadius: isUser ? 16 : 4,
        paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: isUser ? 0 : 1,
        borderColor: c.border,
      }}>
        <Text style={{ color: isUser ? "#fff" : c.textPrimary, fontSize: 14, lineHeight: 20 }}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}
