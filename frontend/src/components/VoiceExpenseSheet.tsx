import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  ActivityIndicator, Platform, Alert, ScrollView, KeyboardAvoidingView,
} from "react-native";
import Animated, {
  useSharedValue, withRepeat, withTiming, useAnimatedStyle, Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { currencySymbol, categoryMeta } from "../lib/tokens";

type Props = { trip: any; onClose: () => void; onAdded: () => Promise<void>; };

// ── Normalize Indian number format before sending to AI ─────────────────────
function normalizeNumbers(text: string): string {
  // "4,00" → "400"  |  "1,00,000" → "100000"  |  "4,000" → "4000"
  return text.replace(/(\d{1,2}(?:,\d{2})+)/g, m => m.replace(/,/g, ""))
             .replace(/(\d{1,3}(?:,\d{3})+)/g, m => m.replace(/,/g, ""))
             .replace(/(\d+)k/gi, (_, n) => String(parseInt(n) * 1000));
}

// ── Extract best amount from raw text as a sanity check ──────────────────────
function extractAmount(text: string): number {
  const norm = normalizeNumbers(text);
  const patterns = [
    /₹\s*(\d+(?:\.\d+)?)/,
    /(?:rs\.?|inr)\s*(\d+(?:\.\d+)?)/i,
    /paid\s+(?:rs\.?\s*)?(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:rs|inr|rupees?)/i,
    /(\d+(?:\.\d+)?)\s+for/i,
  ];
  for (const p of patterns) {
    const m = norm.match(p);
    if (m) { const n = parseFloat(m[1]); if (n >= 1) return n; }
  }
  // Last resort: largest number in text
  const nums = (norm.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n >= 1);
  return nums.length > 0 ? Math.max(...nums) : 0;
}

// ── AI-powered parsing via Anthropic API ─────────────────────────────────────
async function parseWithAI(
  text: string,
  members: any[],
  currentUserId: string,
  currency: string,
): Promise<any> {
  const memberList = members.map((m: any) => `${m.name} (id: ${m.id})`).join("\n");
  const currentMember = members.find((m: any) => m.id === currentUserId);
  const currentName = currentMember?.name || "You (current user)";

  const normalized = normalizeNumbers(text);
  const prompt = `You are parsing a natural language expense description for a bill-splitting app.

TRIP MEMBERS (use EXACT names and IDs from this list):
${memberList}

CURRENT USER: ${currentName} (id: ${currentUserId})
CURRENCY: ${currency}

USER SAID: "${normalized}"
(original: "${text}")

Extract the expense details. Return ONLY valid JSON, no explanation:
{
  "name": "what the expense is for (short description)",
  "amount": 0,
  "paidById": "exact member id from the list who paid (default to current user id if unclear)",
  "paidByName": "exact name of who paid",
  "splitAmongIds": ["array of member ids who share this expense"],
  "splitAmongNames": ["array of member names who share this expense"],
  "category": "food|trip|home|friends|shopping|bills|other",
  "confidence": "high|medium|low"
}

Rules:
- "amount" must be a NUMBER (e.g. 500 not "500")
- Indian comma format: "4,00" = 400, "4,000" = 4000, "40,000" = 40000 — remove commas
- "1.5k" or "1.5K" = 1500, "2k" = 2000
- Never return less than 1 for a real expense amount  
- If text says "member 1 paid" → find member 1 in the list
- If text says "split among only X, Y, Z" → only include X, Y, Z in splitAmongIds
- If text says "everyone" or "all" → include all members
- If text says "except X" → include everyone EXCEPT X
- Match names case-insensitively and handle typos (e.g. "memebr" = "member")
- "name" should be the item/purpose, not the payer`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const raw = data.content?.[0]?.text || "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ── Fallback: simple but improved regex parser ─────────────────────────────────
function parseFallback(text: string, members: any[], userId: string) {
  const result: any = {
    name: "",
    amount: 0,
    paidById: userId,
    paidByName: members.find((m: any) => m.id === userId)?.name || "You",
    splitAmongIds: members.map((m: any) => m.id),
    splitAmongNames: members.map((m: any) => m.name),
    category: "other",
  };

  // ── Amount: look for standalone numbers, not part of "member1" ────────────
  // Match "500", "₹500", "Rs 500" but NOT numbers inside words
  // Use the robust extractAmount for fallback
  result.amount = extractAmount(text);

  // ── Who paid ────────────────────────────────────────────────────────────────
  // Look for "[name] paid"
  const paidMatch = text.match(/^(.+?)\s+paid\b/i);
  if (paidMatch) {
    const who = paidMatch[1].trim().toLowerCase();
    // Try to match to a member name (fuzzy)
    const found = members.find((m: any) => {
      const mn = m.name.toLowerCase();
      return mn.includes(who) || who.includes(mn) ||
        // handle "member 1" vs "member1" etc
        mn.replace(/\s+/g, "").includes(who.replace(/\s+/g, "")) ||
        who.replace(/\s+/g, "").includes(mn.replace(/\s+/g, ""));
    });
    if (found) {
      result.paidById = found.id;
      result.paidByName = found.name;
    }
  }

  // ── Expense name: look for "for [item]" ────────────────────────────────────
  const forMatch = text.match(/(?:paid\s+\S+\s+for|for)\s+([a-zA-Z\s]+?)(?:\s*[.,]\s*split|\s+split|\s+among|$)/i);
  if (forMatch) result.name = forMatch[1].trim();
  else {
    // fallback: first non-number word sequence
    result.name = text.replace(/(?:rs\.?|inr|₹)?\s*\d[\d,.]*/gi, "")
      .replace(/\b(paid|split|among|only|for|and|by|the)\b/gi, "")
      .trim().split(/\s+/).slice(0, 3).join(" ");
  }

  // ── Split among ─────────────────────────────────────────────────────────────
  const splitSection = text.match(/split\s+(?:among|between|with|only)\s+(.+?)(?:\s*$)/i)?.[1];
  const exceptSection = text.match(/(?:except|not|excluding)\s+([a-zA-Z\s,]+?)(?:\s*$)/i)?.[1];

  if (splitSection) {
    // Extract names from the split section
    const parts = splitSection.split(/\s*,\s*|\s+and\s+|\s+&\s+/i);
    const matched: string[] = [];
    for (const part of parts) {
      const p = part.trim().toLowerCase().replace(/\s+/g, "");
      const m = members.find((mem: any) => {
        const mn = mem.name.toLowerCase().replace(/\s+/g, "");
        return mn.includes(p) || p.includes(mn) || mn === p;
      });
      if (m) matched.push(m.id);
    }
    if (matched.length > 0) {
      result.splitAmongIds = matched;
      result.splitAmongNames = matched.map((id: string) => members.find((m: any) => m.id === id)?.name || id);
    }
  }

  if (exceptSection) {
    const parts = exceptSection.split(/\s*,\s*|\s+and\s+/i);
    for (const part of parts) {
      const p = part.trim().toLowerCase();
      const m = members.find((mem: any) => mem.name.toLowerCase().includes(p));
      if (m) {
        result.splitAmongIds = result.splitAmongIds.filter((id: string) => id !== m.id);
        result.splitAmongNames = result.splitAmongNames.filter((n: string) => n !== m.name);
      }
    }
  }

  return result;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function VoiceExpenseSheet({ trip, onClose, onAdded }: Props) {
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const members: any[] = trip.members || [];
  const currency = trip.currency || "INR";
  const sym = currencySymbol(currency);

  const [listening,  setListening]  = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsed,     setParsed]     = useState<any>(null);
  const [parsing,    setParsing]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  const pulse = useSharedValue(1);
  const recRef = useRef<any>(null);

  useEffect(() => {
    pulse.value = listening
      ? withRepeat(withTiming(1.28, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true)
      : withTiming(1, { duration: 200 });
  }, [listening]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  // ── Parse with AI, fallback to regex ──────────────────────────────────────
  const parseTimerRef = React.useRef<any>(null);

  const doParse = async (text: string) => {
    if (!text.trim() || text.length < 4) return;
    // Don't wipe the existing result while re-parsing — just show subtle indicator
    setError("");
    setParsing(true);
    try {
      const result = await parseWithAI(text, members, user?.id || "", currency);
      // Sanity check: AI sometimes under-parses Indian comma numbers
      const clientAmt = extractAmount(text);
      if (clientAmt > 0 && result.amount < clientAmt * 0.5) {
        result.amount = clientAmt;
      }
      setParsed(result);
    } catch {
      const result = parseFallback(text, members, user?.id || "");
      result.amount = result.amount || extractAmount(text);
      setParsed(result);
    } finally {
      setParsing(false);
    }
  };

  const startListen = () => {
    if (Platform.OS !== "web") {
      Alert.alert("Tip", "Use your keyboard's microphone key, or type below.");
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { Alert.alert("Not supported", "Type your expense below."); return; }
    const r = new SR(); r.lang = "en-IN"; r.continuous = false; r.interimResults = true;
    r.onstart = () => setListening(true);
    r.onend   = () => setListening(false);
    r.onerror = () => setListening(false);
    r.onresult = (e: any) => {
      const res = e.results[e.results.length - 1];
      const t   = res[0].transcript;
      setTranscript(t);
      if (res.isFinal) doParse(t);
    };
    recRef.current = r;
    r.start();
  };

  const onType = (t: string) => {
    setTranscript(t);
    if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
    if (t.trim().length > 6) {
      parseTimerRef.current = setTimeout(() => doParse(t), 900);
    }
  };

  const submit = async () => {
    if (!parsed?.amount || parsed.amount <= 0) { setError("Amount not detected. Try typing '₹500' clearly."); return; }
    if (!parsed?.name?.trim()) { setError("What is this expense for?"); return; }
    setSubmitting(true); setError("");
    try {
      await api.post("/trips/" + trip.id + "/expenses", {
        name: parsed.name,
        amount: parsed.amount,
        currency,
        category: parsed.category || "other",
        paid_by: parsed.paidById,
        split_among: parsed.splitAmongIds,
      });
      await onAdded();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not add expense.");
    } finally { setSubmitting(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: c.border, maxHeight: "92%", paddingHorizontal: 20, paddingTop: 20 }}>

            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: "800", letterSpacing: -0.4 }}>Speak Your Expense</Text>
                <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 3 }}>
                  Say it naturally — AI understands the details
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={c.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Examples */}
              {!transcript && (
                <View style={{ backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 16 }}>
                  <Text style={{ color: c.textMuted, fontSize: 8, letterSpacing: 2, fontFamily: "RobotoMono_400Regular" as any, marginBottom: 10 }}>EXAMPLE PHRASES</Text>
                  {[
                    "member 1 paid 500 for snacks, split among member1, member2 and member4",
                    "Rahul paid 1500 for movies for everyone except Priya",
                    "I paid 2000 for dinner, split equally",
                  ].map((ex, i) => (
                    <TouchableOpacity key={i} onPress={() => { setTranscript(ex); doParse(ex); }}
                      style={{ paddingVertical: 8, borderBottomWidth: i < 2 ? 1 : 0, borderColor: c.border }}>
                      <Text style={{ color: c.textSecondary, fontSize: 12, fontStyle: "italic" }}>"{ex}"</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Mic button */}
              <View style={{ alignItems: "center", marginVertical: 16, gap: 8 }}>
                <Animated.View style={pulseStyle}>
                  <TouchableOpacity
                    onPress={listening ? () => { recRef.current?.stop(); setListening(false); } : startListen}
                    style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: listening ? c.negative : isDark ? c.indigo : "#1F1A17", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 }}
                  >
                    <Ionicons name={listening ? "stop" : "mic"} size={30} color="#fff" />
                  </TouchableOpacity>
                </Animated.View>
                <Text style={{ color: c.textMuted, fontSize: 11 }}>{listening ? "Listening… tap to stop" : "Tap to speak"}</Text>
              </View>

              {/* Text input */}
              <View style={{ borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 14, marginBottom: 16 }}>
                <Text style={{ color: c.textMuted, fontSize: 8, letterSpacing: 2, fontFamily: "RobotoMono_400Regular" as any, marginBottom: 8 }}>OR TYPE YOUR EXPENSE</Text>
                <TextInput
                  value={transcript}
                  onChangeText={onType}
                  placeholder='e.g. "member 1 paid 500 for snacks split among member1 and member4"'
                  placeholderTextColor={c.textMuted}
                  multiline
                  style={{ color: c.textPrimary, fontSize: 14, lineHeight: 22, minHeight: 60 } as any}
                />
                {transcript.trim().length > 6 && (
                  <TouchableOpacity
                    onPress={() => doParse(transcript)}
                    style={{ marginTop: 10, backgroundColor: isDark ? c.indigo : "#1F1A17", borderRadius: 8, paddingVertical: 8, alignItems: "center" }}
                  >
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                      {parsing ? "Parsing with AI…" : "Parse with AI ✦"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Parsing: subtle label, don't hide existing card */}
              {parsing && !parsed && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, justifyContent: "center" }}>
                  <ActivityIndicator size="small" color={isDark ? c.indigo : "#1F1A17"} />
                  <Text style={{ color: c.textSecondary, fontSize: 13 }}>AI is parsing…</Text>
                </View>
              )}

              {/* Parsed preview */}
              {!parsing && parsed && (
                <View style={{ borderRadius: 12, borderWidth: 1.5, borderColor: isDark ? "rgba(124,92,255,0.35)" : "#C4B89A", backgroundColor: isDark ? "rgba(124,92,255,0.06)" : c.surface, padding: 16, marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <Ionicons name="sparkles" size={14} color={isDark ? c.indigo : "#6D28D9"} />
                    <Text style={{ color: isDark ? c.indigo : "#6D28D9", fontSize: 9, fontWeight: "700", letterSpacing: 2 }}>AI UNDERSTOOD</Text>
                    {parsing && <ActivityIndicator size="small" color={isDark ? c.indigo : "#6D28D9"} style={{ marginLeft: 4 }} />}
                  </View>

                  {[
                    { k: "Expense",    v: parsed.name || "—" },
                    { k: "Amount",     v: parsed.amount > 0 ? `${sym}${parsed.amount.toLocaleString("en-IN")}` : "Not detected ⚠️" },
                    { k: "Paid by",    v: parsed.paidByName || "You" },
                    { k: "Split among",v: parsed.splitAmongNames?.length > 0 ? `${parsed.splitAmongNames.join(", ")} (${parsed.splitAmongNames.length})` : "All members" },
                    { k: "Each owes",  v: parsed.splitAmongIds?.length > 0 && parsed.amount > 0 ? `${sym}${Math.round(parsed.amount / parsed.splitAmongIds.length).toLocaleString("en-IN")}` : "—" },
                    { k: "Category",   v: `${categoryMeta[parsed.category]?.emoji || "💸"} ${categoryMeta[parsed.category]?.label || parsed.category}` },
                  ].map(({ k, v }, i, arr) => (
                    <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderColor: c.border }}>
                      <Text style={{ color: c.textSecondary, fontSize: 12, flex: 1 }}>{k}</Text>
                      <Text style={{ color: v.includes("⚠️") ? c.negative : c.textPrimary, fontSize: 12, fontWeight: "600", flex: 2, textAlign: "right" }} numberOfLines={3}>{v}</Text>
                    </View>
                  ))}

                  {parsed.confidence === "low" && (
                    <View style={{ marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: isDark ? "rgba(245,158,11,0.1)" : "#FFFBEB", borderWidth: 1, borderColor: isDark ? "rgba(245,158,11,0.3)" : "#FDE68A" }}>
                      <Text style={{ color: "#B45309", fontSize: 11 }}>⚠️ Low confidence — please check the details above before adding.</Text>
                    </View>
                  )}
                </View>
              )}

              {!!error && (
                <Text style={{ color: c.negative, fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</Text>
              )}

              {!parsing && parsed && parsed.amount > 0 && (
                <TouchableOpacity
                  onPress={submit}
                  disabled={submitting}
                  style={{ backgroundColor: isDark ? c.indigo : "#1F1A17", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 8, opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>Add to Ledger</Text>
                  }
                </TouchableOpacity>
              )}

              <View style={{ height: 28 }} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}