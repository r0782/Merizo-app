import React, { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { ChatBubble } from "../../src/components/ai/ChatBubble";
import { ExpenseConfirmCard } from "../../src/components/ai/ExpenseConfirm";
import { sendChat } from "../../src/lib/ai";
import { ProGate } from "../../src/components/ProGate";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FREE_LIMIT = 3;
const AI_COUNT_KEY = "merizo_ai_count";

type Message = { id: string; role: string; content: string };

export default function AIChatScreen() {
  const { c, isDark } = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    { id: "0", role: "assistant", content: "Hey! I'm Merizo AI ✨\n\nI can help you:\n• Add expenses by describing them\n• Check who owes what\n• Settle up debts\n\nTry: \"Rahul paid ₹800 for dinner, split 4 ways\"" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingExpense, setPendingExpense] = useState<any>(null);
  const [showPro, setShowPro] = useState(false);
  const [aiCount, setAiCount] = useState(0);
  const listRef = useRef<FlatList>(null);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    // Check free limit
    try {
      const stored = await AsyncStorage.getItem(AI_COUNT_KEY);
      const count = parseInt(stored || "0", 10);
      if (count >= FREE_LIMIT) { setShowPro(true); return; }
      await AsyncStorage.setItem(AI_COUNT_KEY, String(count + 1));
      setAiCount(count + 1);
    } catch {}
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const reply = await sendChat(text, messages.slice(-10), {
        language: "en",
        currency: "INR",
        group_id: "",
        group_name: "",
        members: [],
      });
      const jsonMatch = reply.match(/\{[\s\S]*"amount"[\s\S]*\}/);
      if (jsonMatch) {
        try { const p = JSON.parse(jsonMatch[0]); if (p.amount && p.title) setPendingExpense(p); } catch {}
      }
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: "assistant", content: "Sorry, I couldn't process that. Please check your connection and try again." }]);
    } finally { setLoading(false); }
  };

  const onVoicePress = () => {
    if (Platform.OS === "web") {
      Alert.alert("Voice Input", "Voice input is available on the mobile app. On web, please type your expense.");
    } else {
      Alert.alert("Voice Input", "Hold to speak your expense");
    }
  };

  const onScanPress = () => {
    Alert.alert("Scan Bill", "Bill scanning is available on the mobile app. On web, describe your expense in the chat.");
  };

  const quickPrompts = [
    "Rahul paid ₹800 for dinner, split 4 ways",
    "Who owes what in this group?",
    "Split hotel ₹3000 equally between 3 people",
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      {/* Header */}
      <View style={{ paddingTop: Platform.OS === "ios" ? 56 : 40, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: c.border, backgroundColor: c.bg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: "800" }}>Merizo AI ✨</Text>
          <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>Your expense assistant</Text>
        </View>
        <TouchableOpacity onPress={onScanPress} style={{ backgroundColor: c.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="scan-outline" size={18} color={c.textPrimary} />
          <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: "600" }}>Scan Bill</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => <ChatBubble message={item} />}
        ListHeaderComponent={messages.length <= 1 ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 8 }}>TRY THESE</Text>
            {quickPrompts.map((p, i) => (
              <TouchableOpacity key={i} onPress={() => send(p)} style={{ backgroundColor: c.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: c.border }}>
                <Text style={{ color: c.textSecondary, fontSize: 13 }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        ListFooterComponent={loading ? (
          <View style={{ alignItems: "flex-start", paddingVertical: 8 }}>
            <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: c.border }}>
              <ActivityIndicator size="small" color={c.textMuted} />
            </View>
          </View>
        ) : null}
      />

      {pendingExpense && <ExpenseConfirmCard expense={pendingExpense} onConfirm={() => setPendingExpense(null)} onDismiss={() => setPendingExpense(null)} />}

      {/* Input bar */}
      <View style={{ borderTopWidth: 0.5, borderTopColor: c.border, backgroundColor: c.bg, paddingBottom: Platform.OS === "ios" ? 28 : 12 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 10 }}>
          <TouchableOpacity onPress={onVoicePress} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border }}>
            <Ionicons name="mic-outline" size={20} color={c.textPrimary} />
          </TouchableOpacity>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Describe an expense or ask anything..."
            placeholderTextColor={c.textMuted}
            style={{ flex: 1, backgroundColor: c.surface, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, color: c.textPrimary, fontSize: 14, borderWidth: 1, borderColor: c.border, maxHeight: 100 }}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity
            onPress={() => send(input)}
            disabled={loading || !input.trim()}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: input.trim() ? (isDark ? c.indigo : "#0A0A0A") : c.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: input.trim() ? "transparent" : c.border }}
          >
            <Ionicons name="send" size={18} color={input.trim() ? "#fff" : c.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
      <ProGate visible={showPro} onClose={() => setShowPro(false)} feature="Unlimited AI chat" />
    </KeyboardAvoidingView>
  );
}
