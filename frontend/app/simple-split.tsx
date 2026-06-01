/**
 * Smart Split — AI-native expense splitting
 * Merizo · 2026
 *
 * Design direction: "Calm Intelligence"
 * Inspired by Linear, Arc, Apple Intelligence
 * Dark premium · Minimal chrome · Conversational AI
 */
import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Animated, KeyboardAvoidingView,
  Platform, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { api } from "../src/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = "hero" | "chat" | "result";
type Mode   = "type" | "receipt" | "voice";
interface Message { role: "ai" | "user"; text: string; ts: number; }
interface SplitResult {
  total: number; currency: string; people: number;
  description: string; each: number;
  rows: { name: string; amount: number }[];
  tip?: number;
}

// ─── AI Parser (Anthropic API) ────────────────────────────────────────────────
async function parseExpenseAI(conversation: string): Promise<{
  done: boolean; reply: string; result?: SplitResult;
}> {
  const BACKEND = (process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8000").replace(/\/$/,"");
  try {
    const res = await fetch(BACKEND + "/api/smart-split", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation }),
    });
    if (!res.ok) throw new Error("Backend " + res.status);
    const json = await res.json();
    const parsed = JSON.parse(json.data);
    if (!parsed || typeof parsed !== "object") throw new Error("bad json");
    return parsed;
  } catch (e) {
    console.warn("Smart split fallback:", e);
    return fallbackParse(conversation);
  }
}


// ── Offline fallback parser (no API needed for simple cases) ──────────────────
function fallbackParse(text: string): { done: boolean; reply: string; result?: SplitResult } {
  const lower = text.toLowerCase();

  // Extract amount
  let amount = 0;
  const amtMatch = lower.match(/(\d+(?:\.\d+)?)\s*k/) ||
                   lower.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)/) ||
                   lower.match(/[₹$€£]?\s*(\d{3,6}(?:,\d{3})*(?:\.\d{2})?)/);
  if (amtMatch) {
    const raw = parseFloat(amtMatch[1].replace(/,/g, ""));
    if (lower.match(/\d+\s*k/)) amount = raw * 1000;
    else if (lower.match(/\d+\s*(?:lakh|lac|l)/)) amount = raw * 100000;
    else amount = raw;
  }

  // Extract people count
  const wordNums: Record<string,number> = {
    two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
    "do":2,"teen":3,"char":4,"paanch":5,"chhe":6
  };
  let people = 0;
  const numMatch = lower.match(/(\d+)\s*(?:people|persons|friends|log|bande|members|ways|way|of us)/);
  if (numMatch) people = parseInt(numMatch[1]);
  if (!people) {
    for (const [word, n] of Object.entries(wordNums)) {
      if (lower.includes(word + " people") || lower.includes(word + " friends") || lower.includes(word + " log")) {
        people = n; break;
      }
    }
  }
  // Count names
  if (!people) {
    const names = lower.match(/(?:with|between|among)\s+([\w\s,and]+?)(?:\s+and\s+\d|\s*$)/);
    if (names) people = (names[1].split(/,| and /).length) + 1;
  }

  if (amount > 0 && people > 1) {
    const each = Math.round(amount / people);
    return {
      done: true,
      reply: `₹${each.toLocaleString("en-IN")} each for ${people} people ✓`,
      result: {
        total: amount, currency: "INR", people, each,
        description: "Expense split",
        rows: Array.from({ length: people }, (_, i) => ({ name: `Person ${i + 1}`, amount: each })),
        tip: null,
      },
    };
  }
  if (amount > 0 && !people) {
    return { done: false, reply: "Got ₹" + amount.toLocaleString("en-IN") + ". How many people to split between?" };
  }
  if (!amount && people > 0) {
    return { done: false, reply: "Got " + people + " people. What's the total amount?" };
  }
  return { done: false, reply: "How much was the total, and how many people?" };
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SmartSplit() {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("hero");
  const [mode,   setMode]   = useState<Mode>("type");
  const [msgs,   setMsgs]   = useState<Message[]>([]);
  const [input,  setInput]  = useState("");
  const [loading,setLoading]= useState(false);
  const [result, setResult] = useState<SplitResult | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef  = useRef<TextInput>(null);
  const glowAnim  = useRef(new Animated.Value(0)).current;

  // Glow pulse on AI card
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  const scrollToBottom = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

  const startChat = (m: Mode, seed?: string) => {
    setMode(m);
    const opening: Message = {
      role: "ai",
      ts: Date.now(),
      text: m === "receipt"
        ? "Upload a receipt photo and I'll extract the items and calculate everyone's share automatically."
        : m === "voice"
        ? "Speak your expense — say something like 'Hotel ₹6000 split 4 ways' and I'll handle the math."
        : "Tell me about the expense — amount, what it was for, and how many people to split with.",
    };
    setMsgs([opening]);
    setScreen("chat");
    if (seed) {
      setTimeout(() => sendMessage(seed, [opening]), 300);
    }
  };

  const buildConversation = (messages: Message[], newText: string): string =>
    messages.map(m => `${m.role === "ai" ? "Assistant" : "User"}: ${m.text}`).join("\n")
    + `\nUser: ${newText}`;

  const sendMessage = async (text?: string, currentMsgs?: Message[]) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    setInput("");

    const base = currentMsgs ?? msgs;
    const userMsg: Message = { role: "user", text: userText, ts: Date.now() };
    const next = [...base, userMsg];
    setMsgs(next);
    scrollToBottom();
    setLoading(true);

    try {
      const conv = buildConversation(base, userText);
      const parsed = await parseExpenseAI(conv);
      const aiMsg: Message = { role: "ai", text: parsed.reply, ts: Date.now() };
      setMsgs(m => [...m, aiMsg]);
      scrollToBottom();

      if (parsed.done && parsed.result) {
        setResult(parsed.result);
        setTimeout(() => setScreen("result"), 600);
      }
    } catch {
      setMsgs(m => [...m, { role: "ai", text: "Something went wrong. Try again?", ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setScreen("hero"); setMsgs([]); setResult(null); setInput("");
  };

  // ── Tokens ─────────────────────────────────────────────────────────────────
  const BG    = isDark ? "#08070C" : "#F8F6FF";
  const CARD  = isDark ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.85)";
  const BORD  = isDark ? "rgba(157,123,255,0.18)" : "rgba(91,63,212,0.12)";
  const P     = isDark ? "#C8B8FF" : "#5B3FD4";   // purple
  const TXT   = isDark ? "#F0EBF8" : "#0F0A1A";
  const SUB   = isDark ? "#7A6B99" : "#8B7AAA";
  const INPBG = isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.04)";
  const AIBG  = isDark ? "rgba(157,123,255,0.1)"  : "rgba(91,63,212,0.07)";
  const USERBG= isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

  // ── HERO SCREEN ─────────────────────────────────────────────────────────────
  if (screen === "hero") return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Ambient glow */}
      <Animated.View style={{ position: "absolute", top: -80, left: "50%", marginLeft: -150,
        width: 300, height: 300, borderRadius: 150,
        backgroundColor: isDark ? "rgba(157,123,255,0.07)" : "rgba(91,63,212,0.05)",
        opacity: glowOpacity }} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: Platform.OS === "ios" ? 60 : 40 }}
          showsVerticalScrollIndicator={false}>

          {/* Back */}
          <TouchableOpacity onPress={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: CARD,
              borderWidth: 1, borderColor: BORD, alignItems: "center", justifyContent: "center", marginBottom: 40 }}>
            <Ionicons name="arrow-back" size={16} color={SUB} />
          </TouchableOpacity>

          {/* Hero card */}
          <View style={{ backgroundColor: CARD, borderRadius: 28, borderWidth: 1, borderColor: BORD,
            padding: 28, marginBottom: 20, overflow: "hidden" }}>
            {/* Glow blob inside card */}
            <View style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160,
              borderRadius: 80, backgroundColor: isDark ? "rgba(157,123,255,0.12)" : "rgba(91,63,212,0.08)" }} />

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: P + "22",
                alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="sparkles" size={14} color={P} />
              </View>
              <Text style={{ color: P, fontSize: 11, fontWeight: "700", letterSpacing: 2.5 }}>SMART SPLIT</Text>
            </View>

            <Text style={{ color: TXT, fontSize: 28, fontWeight: "800", letterSpacing: -0.5, lineHeight: 34, marginBottom: 10 }}>
              What would you{"\n"}like to split?
            </Text>
            <Text style={{ color: SUB, fontSize: 14, lineHeight: 22, marginBottom: 28 }}>
              Describe your expense in plain words — or upload a receipt. No calculators needed.
            </Text>

            {/* Quick examples */}
            <View style={{ gap: 8 }}>
              {[
                "Hotel ₹6000 split 4 ways",
                "Birthday dinner ₹4200 for 6 people",
                "Cab ₹850 split with Ramu and Priya",
              ].map((ex, i) => (
                <TouchableOpacity key={i} onPress={() => startChat("type", ex)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10,
                    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12,
                    backgroundColor: INPBG, borderWidth: 1, borderColor: BORD }}>
                  <Ionicons name="return-down-forward-outline" size={13} color={P} />
                  <Text style={{ color: SUB, fontSize: 13 }}>{ex}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Input modes */}
          <View style={{ gap: 10, marginBottom: 20 }}>
            {/* Type expense */}
            <TouchableOpacity onPress={() => startChat("type")}
              style={{ flexDirection: "row", alignItems: "center", gap: 16, padding: 20,
                backgroundColor: P, borderRadius: 20 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="create-outline" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>Type an expense</Text>
                <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 2 }}>
                  Natural language · AI parses instantly
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>

            <View style={{ flexDirection: "row", gap: 10 }}>
              {/* Receipt */}
              <TouchableOpacity onPress={() => startChat("receipt")}
                style={{ flex: 1, padding: 18, backgroundColor: CARD, borderRadius: 20,
                  borderWidth: 1, borderColor: BORD, alignItems: "center", gap: 10 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14,
                  backgroundColor: isDark ? "rgba(232,176,78,0.15)" : "rgba(184,134,11,0.1)",
                  alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="receipt-outline" size={20} color={isDark ? "#E8B04E" : "#B8860B"} />
                </View>
                <Text style={{ color: TXT, fontSize: 13, fontWeight: "700", textAlign: "center" }}>Scan Receipt</Text>
                <Text style={{ color: SUB, fontSize: 11, textAlign: "center", lineHeight: 16 }}>
                  AI reads & splits by items
                </Text>
              </TouchableOpacity>

              {/* Voice */}
              <TouchableOpacity onPress={() => startChat("voice")}
                style={{ flex: 1, padding: 18, backgroundColor: CARD, borderRadius: 20,
                  borderWidth: 1, borderColor: BORD, alignItems: "center", gap: 10 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14,
                  backgroundColor: isDark ? "rgba(126,211,139,0.12)" : "rgba(26,122,64,0.08)",
                  alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="mic-outline" size={20} color={isDark ? "#7ED38B" : "#1A7A40"} />
                </View>
                <Text style={{ color: TXT, fontSize: 13, fontWeight: "700", textAlign: "center" }}>Say it</Text>
                <Text style={{ color: SUB, fontSize: 11, textAlign: "center", lineHeight: 16 }}>
                  Speak the expense aloud
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer hint */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Ionicons name="sparkles" size={11} color={P} />
            <Text style={{ color: SUB, fontSize: 12 }}>Powered by Claude AI · No account needed</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );

  // ── CHAT SCREEN ─────────────────────────────────────────────────────────────
  if (screen === "chat") return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20,
        paddingTop: Platform.OS === "ios" ? 56 : 24, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: BORD }}>
        <TouchableOpacity onPress={reset}
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: CARD,
            borderWidth: 1, borderColor: BORD, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={16} color={SUB} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Animated.View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: P, opacity: glowOpacity }} />
            <Text style={{ color: TXT, fontSize: 15, fontWeight: "700" }}>Smart Split</Text>
          </View>
          <Text style={{ color: SUB, fontSize: 11, marginTop: 1 }}>AI expense assistant</Text>
        </View>
        <View style={{ width: 34 }} />
      </View>

      {/* Messages */}
      <ScrollView ref={scrollRef} style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        showsVerticalScrollIndicator={false}>
        {msgs.map((m, i) => (
          <View key={i} style={{ alignItems: m.role === "ai" ? "flex-start" : "flex-end" }}>
            {m.role === "ai" && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <View style={{ width: 22, height: 22, borderRadius: 8, backgroundColor: P + "22",
                  alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="sparkles" size={10} color={P} />
                </View>
                <Text style={{ color: P, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>MERIZO AI</Text>
              </View>
            )}
            <View style={{ maxWidth: "82%", paddingHorizontal: 16, paddingVertical: 13, borderRadius: 18,
              backgroundColor: m.role === "ai" ? AIBG : USERBG,
              borderWidth: 1, borderColor: m.role === "ai" ? P + "30" : BORD,
              borderBottomLeftRadius: m.role === "ai" ? 4 : 18,
              borderBottomRightRadius: m.role === "user" ? 4 : 18 }}>
              <Text style={{ color: TXT, fontSize: 15, lineHeight: 22 }}>{m.text}</Text>
            </View>
          </View>
        ))}

        {/* Typing indicator */}
        {loading && (
          <View style={{ alignItems: "flex-start" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <View style={{ width: 22, height: 22, borderRadius: 8, backgroundColor: P + "22",
                alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="sparkles" size={10} color={P} />
              </View>
              <Text style={{ color: P, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>MERIZO AI</Text>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18,
              borderBottomLeftRadius: 4, backgroundColor: AIBG, borderWidth: 1, borderColor: P + "30" }}>
              <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                {[0, 1, 2].map(d => <TypingDot key={d} delay={d * 180} color={P} />)}
              </View>
            </View>
          </View>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10,
          padding: 16, paddingBottom: Platform.OS === "ios" ? 32 : 16,
          borderTopWidth: 1, borderTopColor: BORD, backgroundColor: BG }}>
          <TextInput
            ref={inputRef}
            value={input} onChangeText={setInput}
            placeholder={mode === "receipt" ? "Describe the items (e.g. Pizza ₹500, Burger ₹300)…"
              : mode === "voice" ? "Speak or type your expense…"
              : "e.g. Hotel ₹6000 split 4 ways…"}
            placeholderTextColor={SUB}
            multiline maxLength={300}
            onSubmitEditing={() => sendMessage()}
            style={{ flex: 1, backgroundColor: INPBG, borderRadius: 16, borderWidth: 1,
              borderColor: BORD, paddingHorizontal: 16, paddingVertical: 12,
              fontSize: 15, color: TXT, maxHeight: 100 } as any}
          />
          <TouchableOpacity onPress={() => sendMessage()} disabled={loading || !input.trim()}
            style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: input.trim() ? P : INPBG,
              alignItems: "center", justifyContent: "center",
              borderWidth: 1, borderColor: input.trim() ? P : BORD }}>
            <Ionicons name="arrow-up" size={20} color={input.trim() ? "#fff" : SUB} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );

  // ── RESULT SCREEN ────────────────────────────────────────────────────────────
  if (screen === "result" && result) {
    const PALETTE = ["#9D7BFF","#7ED38B","#FF8B7B","#E8B04E","#60A5FA","#F472B6","#34D399","#FB923C"];
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        {/* Ambient */}
        <View style={{ position: "absolute", top: -60, left: "50%", marginLeft: -120,
          width: 240, height: 240, borderRadius: 120,
          backgroundColor: isDark ? "rgba(126,211,139,0.06)" : "rgba(26,122,64,0.04)" }} />

        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}>

          {/* Back */}
          <TouchableOpacity onPress={() => setScreen("chat")}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: CARD,
              borderWidth: 1, borderColor: BORD, alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
            <Ionicons name="arrow-back" size={16} color={SUB} />
          </TouchableOpacity>

          {/* Done badge */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: isDark ? "rgba(126,211,139,0.2)" : "#E8F5EE",
              alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="checkmark" size={14} color={isDark ? "#7ED38B" : "#1A7A40"} />
            </View>
            <Text style={{ color: isDark ? "#7ED38B" : "#1A7A40", fontSize: 11, fontWeight: "700", letterSpacing: 2 }}>
              SPLIT CALCULATED
            </Text>
          </View>

          {/* Total card */}
          <View style={{ backgroundColor: CARD, borderRadius: 24, borderWidth: 1, borderColor: BORD,
            padding: 26, marginBottom: 16, overflow: "hidden" }}>
            <View style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120,
              borderRadius: 60, backgroundColor: P + "12" }} />
            <Text style={{ color: SUB, fontSize: 11, fontWeight: "700", letterSpacing: 2.5, marginBottom: 8 }}>
              TOTAL AMOUNT
            </Text>
            <Text style={{ color: TXT, fontSize: 44, fontWeight: "900", letterSpacing: -1.5, fontVariant: ["tabular-nums"] as any }}>
              ₹{Math.round(result.total).toLocaleString("en-IN")}
            </Text>
            <Text style={{ color: SUB, fontSize: 13, marginTop: 6 }}>{result.description}</Text>
            {result.tip ? (
              <Text style={{ color: SUB, fontSize: 12, marginTop: 4 }}>
                includes ₹{Math.round(result.tip).toLocaleString("en-IN")} tip/tax
              </Text>
            ) : null}
          </View>

          {/* Each share highlight */}
          <View style={{ backgroundColor: P + "16", borderRadius: 20, borderWidth: 1,
            borderColor: P + "35", padding: 22, marginBottom: 16,
            flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ color: P, fontSize: 11, fontWeight: "700", letterSpacing: 2, marginBottom: 6 }}>
                EACH PERSON PAYS
              </Text>
              <Text style={{ color: TXT, fontSize: 38, fontWeight: "900", letterSpacing: -1, fontVariant: ["tabular-nums"] as any }}>
                ₹{Math.round(result.each).toLocaleString("en-IN")}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: SUB, fontSize: 11, marginBottom: 4 }}>{result.people} people</Text>
              <View style={{ flexDirection: "row" }}>
                {Array.from({ length: Math.min(result.people, 4) }).map((_, i) => (
                  <View key={i} style={{ width: 24, height: 24, borderRadius: 12,
                    backgroundColor: PALETTE[i % PALETTE.length],
                    marginLeft: i > 0 ? -8 : 0, borderWidth: 1.5,
                    borderColor: isDark ? BG : "#fff", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                      {result.rows[i]?.name?.charAt(0)?.toUpperCase() || "P"}
                    </Text>
                  </View>
                ))}
                {result.people > 4 && (
                  <View style={{ width: 24, height: 24, borderRadius: 12,
                    backgroundColor: CARD, marginLeft: -8, borderWidth: 1.5, borderColor: BORD,
                    alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: SUB, fontSize: 8, fontWeight: "800" }}>+{result.people - 4}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Per person breakdown */}
          {result.rows.length > 0 && (
            <View style={{ backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORD,
              overflow: "hidden", marginBottom: 20 }}>
              <View style={{ paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORD }}>
                <Text style={{ color: SUB, fontSize: 10, fontWeight: "700", letterSpacing: 2 }}>BREAKDOWN</Text>
              </View>
              {result.rows.map((row, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center",
                  paddingHorizontal: 18, paddingVertical: 14,
                  borderBottomWidth: i < result.rows.length - 1 ? 1 : 0, borderBottomColor: BORD }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10,
                    backgroundColor: PALETTE[i % PALETTE.length] + "25",
                    alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                    <Text style={{ color: PALETTE[i % PALETTE.length], fontSize: 13, fontWeight: "800" }}>
                      {row.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, color: TXT, fontSize: 14, fontWeight: "600" }}>{row.name}</Text>
                  <Text style={{ color: TXT, fontSize: 16, fontWeight: "800",
                    fontFamily: "RobotoMono_700Bold" as any, fontVariant: ["tabular-nums"] as any }}>
                    ₹{Math.round(row.amount).toLocaleString("en-IN")}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Action buttons */}
          <View style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={async () => {
                const text = `Smart Split via Merizo\n\n${result.description}\nTotal: ₹${Math.round(result.total).toLocaleString("en-IN")}\n\n${result.rows.map(r => `${r.name}: ₹${Math.round(r.amount).toLocaleString("en-IN")}`).join("\n")}\n\nEach pays: ₹${Math.round(result.each).toLocaleString("en-IN")}`;
                const url = Platform.OS === "web"
                  ? `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
                  : `whatsapp://send?text=${encodeURIComponent(text)}`;
                if (Platform.OS === "web") window.open(url, "_blank");
              }}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
                backgroundColor: "#25D366", borderRadius: 16, padding: 16 }}>
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>Share on WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={reset}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                backgroundColor: INPBG, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORD }}>
              <Ionicons name="refresh-outline" size={16} color={SUB} />
              <Text style={{ color: SUB, fontSize: 14, fontWeight: "700" }}>Split something else</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return null;
}

// ── Typing dot animation ───────────────────────────────────────────────────────
function TypingDot({ delay, color }: { delay: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: -5, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0,  duration: 300, useNativeDriver: true }),
          Animated.delay(400),
        ])
      ).start();
    }, delay);
  }, []);
  return (
    <Animated.View style={{ width: 6, height: 6, borderRadius: 3,
      backgroundColor: color, transform: [{ translateY: anim }] }} />
  );
}