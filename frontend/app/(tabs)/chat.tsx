import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { ChatBubble } from "../src/components/ai/ChatBubble";
import { ExpenseConfirmCard } from "../src/components/ai/ExpenseConfirm";
import { sendChat } from "../src/lib/ai";

type Message = { id: string; role: string; content: string };

export default function AIChatScreen() {
  const { c, isDark } = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    { id: "0", role: "assistant", content: "Hey! I'm Merizo 👋 Tell me about an expense, ask about balances, or say \"Rahul paid ₹800 for dinner split 4 ways\"" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingExpense, setPendingExpense] = useState<any>(null);
  const listRef = useRef<FlatList>(null);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const reply = await sendChat(text, messages.slice(-10), {
        language: "en",
        currency: "INR",
      });

      // Check if reply contains expense JSON
      const jsonMatch = reply.match(/\{[\s\S]*"amount"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.amount && parsed.title) setPendingExpense(parsed);
        } catch {}
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again."
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={{
        paddingTop: Platform.OS === "ios" ? 56 : 40, paddingHorizontal: 20,
        paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: c.border,
        backgroundColor: c.bg
      }}>
        <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: "800" }}>Merizo AI</Text>
        <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>Your expense assistant</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 16, paddingBottom: 8, gap: 8 }}
        renderItem={({ item }) => <ChatBubble message={item} />}
        ListFooterComponent={loading ? (
          <View style={{ alignItems: "flex-start", paddingVertical: 8, paddingHorizontal: 4 }}>
            <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: c.border }}>
              <ActivityIndicator size="small" color={c.textMuted} />
            </View>
          </View>
        ) : null}
      />

      {pendingExpense && (
        <ExpenseConfirmCard
          expense={pendingExpense}
          onConfirm={() => setPendingExpense(null)}
          onDismiss={() => setPendingExpense(null)}
        />
      )}

      {/* Input bar */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 8,
        padding: 12, paddingBottom: Platform.OS === "ios" ? 28 : 12,
        borderTopWidth: 0.5, borderTopColor: c.border, backgroundColor: c.bg
      }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything or describe an expense..."
          placeholderTextColor={c.textMuted}
          style={{
            flex: 1, backgroundColor: c.surface, borderRadius: 22,
            paddingHorizontal: 16, paddingVertical: 11,
            color: c.textPrimary, fontSize: 14,
            borderWidth: 1, borderColor: c.border,
          }}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          multiline
        />
        <TouchableOpacity
          onPress={() => send(input)}
          disabled={loading || !input.trim()}
          style={{
            backgroundColor: input.trim() ? (isDark ? c.indigo : "#0A0A0A") : c.surface,
            borderRadius: 22, width: 44, height: 44,
            alignItems: "center", justifyContent: "center",
            borderWidth: 1, borderColor: c.border
          }}
        >
          <Ionicons name="send" size={18} color={input.trim() ? "#fff" : c.textMuted} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
