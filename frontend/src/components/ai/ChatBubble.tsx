import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../lib/theme";
import { ActionCard } from "./ActionCard";
import { type } from "../../lib/tokens";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  action_type?: string | null;
  action_data?: Record<string, any> | null;
  quickReplies?: { label: string; value: string }[];
}

interface ChatBubbleProps {
  message: Message;
  onNavigate?: (groupId: string) => void;
  onQuickReply?: (label: string, value: string) => void;
}

export function ChatBubble({ message, onNavigate, onQuickReply }: ChatBubbleProps) {
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

      {/* Quick reply chips */}
      {!isUser && message.quickReplies && message.quickReplies.length > 0 && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap", maxWidth: "92%" }}>
          {message.quickReplies.map((qr, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => onQuickReply?.(qr.label, qr.value)}
              activeOpacity={0.7}
              style={{
                borderWidth: 1,
                borderColor: `${c.border}60`,
                paddingHorizontal: 13,
                paddingVertical: 8,
                backgroundColor: i === 0 ? c.textPrimary : "transparent",
              }}
            >
              <Text style={{
                fontFamily: type.family.regular,
                fontSize: 13,
                color: i === 0 ? c.bg : c.textSecondary,
              }}>
                {qr.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
