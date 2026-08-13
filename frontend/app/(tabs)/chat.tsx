/**
 * MERIZO AI Chat — Hand-drawn notebook assistant
 * Messages look like handwritten notes from a financial advisor.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path, Line, Rect } from "react-native-svg";
import { useTheme } from "../../src/lib/theme";
import { chatV2, type ChatV2Context } from "../../src/lib/ai";
import { detectLanguage } from "../../src/lib/externalApis";
import { ChatBubble, type Message } from "../../src/components/ai/ChatBubble";
import { VoiceButton } from "../../src/components/ai/VoiceButton";
import { api } from "../../src/lib/api";
import { type } from "../../src/lib/tokens";
import { SketchAIAvatar } from "../../src/components/merizo/SketchAvatar";
import { InkLoader } from "../../src/components/merizo/MerizoButton";

interface Group { id: string; name: string; currency: string; my_net: number }

const PROMPTS_NO_GROUP = [
  { text: "Create a Goa Trip group" },
  { text: "Show all my groups" },
  { text: "What's my spending this month?" },
  { text: "Who owes me the most?" },
];

const PROMPTS_WITH_GROUP = (name: string) => [
  { text: `Who owes the most in ${name}?` },
  { text: `Show recent expenses in ${name}` },
  { text: `Add an expense to ${name}` },
  { text: `Summarise ${name}` },
];

// ── Typing indicator — three ink dots ────────────────────────────────────────
function TypingIndicator() {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 4 }}>
      <SketchAIAvatar size={28} speaking />
      <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
        <InkLoader color={c.textMuted} size={4} />
      </View>
    </View>
  );
}

// ── Suggestion chips — ledger-style ──────────────────────────────────────────
function SuggestionList({ prompts, onSelect }: { prompts: { text: string }[]; onSelect: (t: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 0, marginBottom: 16 }}>
      <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 8 }}>
        Try asking
      </Text>
      {prompts.map((p, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onSelect(p.text)}
          activeOpacity={0.6}
          style={{
            paddingVertical: 11,
            borderBottomWidth: 1,
            borderBottomColor: `${c.border}22`,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* Ledger dot */}
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.textMuted, opacity: 0.4 }} />
          <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textSecondary, flex: 1 }}>
            {p.text}
          </Text>
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Path d="M 3 7 L 11 7 M 8 4 L 11 7 L 8 10" stroke={c.textMuted} strokeWidth={1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Context pill ──────────────────────────────────────────────────────────────
function ContextBadge({ group, onClear }: { group: Group; onClear: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 16, paddingVertical: 6,
      borderBottomWidth: 1, borderBottomColor: `${c.border}22`,
    }}>
      <View style={{ width: 6, height: 6, borderWidth: 1, borderColor: c.textPrimary, transform: [{ rotate: "45deg" }] }} />
      <Text style={{ fontFamily: type.family.regular, fontSize: 11, color: c.textSecondary, flex: 1 }}>
        Context: {group.name}
      </Text>
      <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Svg width={14} height={14} viewBox="0 0 14 14">
          <Path d="M 3 3 L 11 11 M 11 3 L 3 11" stroke={c.textMuted} strokeWidth={1.2} strokeLinecap="round" />
        </Svg>
      </TouchableOpacity>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AIChatScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const listRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([{
    id: "0",
    role: "assistant",
    content: "Hello! I'm your Merizo financial assistant.\n\nI can create groups, add expenses, show balances, and more. Just tell me what you need.",
    action_type: null,
    action_data: null,
  }]);
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [groups,      setGroups]      = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [userName,    setUserName]    = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [tripsR, meR] = await Promise.all([api.get("/trips"), api.get("/auth/me")]);
        setGroups(tripsR.data || []);
        setUserName(meR.data?.name || "");
      } catch {}
    })();
  }, []);

  const buildContext = useCallback((): ChatV2Context => ({
    group_id:    activeGroup?.id,
    group_name:  activeGroup?.name,
    user_name:   userName,
    currency:    activeGroup?.currency || "INR",
    groups:      groups.map(g => ({ id: g.id, name: g.name, currency: g.currency, my_net: g.my_net })),
  }), [activeGroup, userName, groups]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const lang    = await detectLanguage(trimmed);
      const history = messages.filter(m => m.id !== "0").slice(-12).map(m => ({ role: m.role, content: m.content }));
      const result  = await chatV2(trimmed, history, buildContext(), lang);

      if (result.action_data?.group_id && !activeGroup) {
        const gid = result.action_data.group_id;
        const gname = result.action_data.name || result.action_data.group_name;
        const gcur  = result.action_data.currency || "INR";
        if (gid && gname) {
          setActiveGroup({ id: gid, name: gname, currency: gcur, my_net: 0 });
          api.get("/trips").then(r => setGroups(r.data || [])).catch(() => {});
        }
      }

      const lower = result.reply.toLowerCase();
      const suggestsCreate = !result.action_type && (
        lower.includes("create a new group") ||
        lower.includes("would you like to create") ||
        lower.includes("shall i create") ||
        lower.includes("want to create a group")
      );

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.reply,
        action_type: result.action_type,
        action_data: result.action_data,
        ...(suggestsCreate ? {
          quickReplies: [
            { label: "Create New Group", value: "__create_group__" },
            { label: "No Thanks",        value: "no thanks" },
          ],
        } : {}),
      }]);
    } catch (e: any) {
      const msg = e?.response?.status === 401
        ? "Session expired. Please log in again."
        : "Something went wrong. Please check your connection.";
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: msg }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, buildContext, activeGroup]);

  const onVoiceTranscript = useCallback((text: string) => { if (text) send(text); }, [send]);
  const handleNavigate    = useCallback((groupId: string) => { router.push(`/split/${groupId}` as any); }, [router]);
  const handleQuickReply  = useCallback((_label: string, value: string) => {
    if (value === "__create_group__") {
      router.push({ pathname: "/create-split", params: { category: "other" } } as any);
    } else {
      send(value);
    }
  }, [send, router]);

  const prompts = activeGroup ? PROMPTS_WITH_GROUP(activeGroup.name) : PROMPTS_NO_GROUP;
  const showSuggestions = messages.length <= 1;
  const hasInput = input.trim().length > 0;

  const openGroupPicker = () => {
    if (groups.length === 0) { Alert.alert("No groups", "Create a group first."); return; }
    Alert.alert("Set Context", "Focus on which group?", [
      ...groups.slice(0, 5).map(g => ({ text: g.name, onPress: () => setActiveGroup(g) })),
      { text: "Clear", onPress: () => setActiveGroup(null), style: "destructive" as const },
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* ── Header ── */}
      <View style={{
        paddingTop: Platform.OS === "ios" ? 56 : 40,
        paddingHorizontal: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: `${c.border}30`,
        backgroundColor: c.bg,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <SketchAIAvatar size={36} />
            <View>
              <Text style={{ fontFamily: type.family.bold, fontSize: type.size.md, color: c.textPrimary, letterSpacing: -0.3 }}>
                Merizo AI
              </Text>
              <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, marginTop: 1, letterSpacing: 1 }}>
                FINANCIAL ASSISTANT
              </Text>
            </View>
          </View>
          {/* Group context picker */}
          <TouchableOpacity
            onPress={openGroupPicker}
            activeOpacity={0.7}
            style={{
              borderWidth: 1, borderColor: `${c.border}50`,
              paddingHorizontal: 10, paddingVertical: 6,
              flexDirection: "row", alignItems: "center", gap: 6,
            }}
          >
            <Svg width={12} height={12} viewBox="0 0 12 12">
              <Rect x={1} y={1} width={4} height={4} stroke={c.textMuted} strokeWidth={1} fill="none" />
              <Rect x={7} y={1} width={4} height={4} stroke={c.textMuted} strokeWidth={1} fill="none" />
              <Rect x={1} y={7} width={4} height={4} stroke={c.textMuted} strokeWidth={1} fill="none" />
              <Rect x={7} y={7} width={4} height={4} stroke={c.textMuted} strokeWidth={1} fill="none" />
            </Svg>
            <Text style={{ fontFamily: type.family.regular, fontSize: 11, color: c.textSecondary }} numberOfLines={1}>
              {activeGroup ? activeGroup.name : "All groups"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Context badge */}
      {activeGroup && <ContextBadge group={activeGroup} onClear={() => setActiveGroup(null)} />}

      {/* ── Messages ── */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 8, gap: 4 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => <ChatBubble message={item} onNavigate={handleNavigate} onQuickReply={handleQuickReply} />}
        ListHeaderComponent={showSuggestions ? (
          <SuggestionList prompts={prompts} onSelect={send} />
        ) : null}
        ListFooterComponent={loading ? <TypingIndicator /> : null}
      />

      {/* ── Input bar ── */}
      <View style={{
        borderTopWidth: 1,
        borderTopColor: `${c.border}30`,
        backgroundColor: c.bg,
        paddingBottom: Platform.OS === "ios" ? 30 : 12,
        paddingTop: 12,
        paddingHorizontal: 16,
      }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
          {/* Scan button */}
          <TouchableOpacity
            onPress={() => router.push("/scan")}
            style={{
              width: 42, height: 42,
              borderWidth: 1, borderColor: `${c.border}50`,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Svg width={18} height={18} viewBox="0 0 18 18">
              <Path d="M 2 5 L 2 3 L 5 3" stroke={c.textSecondary} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M 13 3 L 16 3 L 16 5" stroke={c.textSecondary} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M 2 13 L 2 15 L 5 15" stroke={c.textSecondary} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M 13 15 L 16 15 L 16 13" stroke={c.textSecondary} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <Line x1={2} y1={9} x2={16} y2={9} stroke={c.textSecondary} strokeWidth={1} strokeLinecap="round" opacity={0.4} />
            </Svg>
          </TouchableOpacity>

          {/* Text input */}
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything or describe an expense…"
            placeholderTextColor={c.textMuted}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: `${c.border}50`,
              paddingHorizontal: 14,
              paddingVertical: 11,
              color: c.textPrimary,
              fontSize: type.size.sm,
              maxHeight: 100,
              fontFamily: type.family.regular,
            } as any}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            multiline
            blurOnSubmit
          />

          {/* Send / Voice swap */}
          {hasInput ? (
            <TouchableOpacity
              onPress={() => send(input)}
              disabled={loading}
              style={{
                width: 42, height: 42,
                backgroundColor: c.textPrimary,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Svg width={18} height={18} viewBox="0 0 18 18">
                <Path d="M 3 15 L 9 3 L 15 15 L 9 12 Z" stroke={c.bg} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          ) : (
            <VoiceButton onTranscript={onVoiceTranscript} />
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
