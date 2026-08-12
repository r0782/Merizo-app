import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../lib/theme";
import { ActionCard } from "./ActionCard";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  action_type?: string | null;
  action_data?: Record<string, any> | null;
}

interface ChatBubbleProps {
  message: Message;
  onNavigate?: (groupId: string) => void;
}

export function ChatBubble({ message, onNavigate }: ChatBubbleProps) {
  const { c, isDark } = useTheme();
  const isUser = message.role === "user";

  return (
    <View style={{ alignItems: isUser ? "flex-end" : "flex-start", marginVertical: 3 }}>
      {/* Text bubble */}
      {!!message.content && (
        <View style={{
          maxWidth: "82%",
          backgroundColor: isUser
            ? (isDark ? "#F0F0F0" : "#1C1A14")
            : c.surface,
          borderRadius: 18,
          borderBottomRightRadius: isUser ? 4 : 18,
          borderBottomLeftRadius: isUser ? 18 : 4,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: isUser ? 0 : 1,
          borderColor: c.border,
        }}>
          <Text style={{
            color: isUser ? (isDark ? "#0C0C0C" : "#F0F0F0") : c.textPrimary,
            fontSize: 14,
            lineHeight: 21,
            fontFamily: "Manrope_400Regular",
          }}>
            {message.content}
          </Text>
        </View>
      )}

      {/* Action card — rendered below the assistant bubble */}
      {!isUser && message.action_type && message.action_data && (
        <View style={{ maxWidth: "92%", width: "92%" }}>
          <ActionCard
            actionType={message.action_type}
            data={message.action_data}
            onNavigate={onNavigate}
          />
        </View>
      )}
    </View>
  );
}
