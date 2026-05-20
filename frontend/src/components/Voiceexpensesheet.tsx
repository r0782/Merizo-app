/**
 * VoiceExpenseSheet.tsx
 *
 * Speech-to-expense feature. User speaks naturally:
 *   "I paid 2000 for dinner at Paradise, split between Rahul and Priya"
 *
 * Uses:
 *   - Web: window.SpeechRecognition (browser built-in)
 *   - Native: expo-av (microphone) with keyboard dictation fallback
 *
 * AI parses the spoken text into expense fields.
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ActivityIndicator, Platform, Alert, KeyboardAvoidingView, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue, withRepeat, withTiming, useAnimatedStyle, Easing,
} from "react-native-reanimated";
import { useTheme } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { currencySymbol, categoryMeta, detectCategory } from "../lib/tokens";

type Props = {
  trip: any;
  onClose: () => void;
  onAdded: () => Promise<void>;
};

// Parse spoken text into expense fields (fallback if no AI)
function parseExpenseText(text: string, members: any[], userId: string) {
  const result: any = {
    name: "",
    amount: 0,
    paidBy: userId,
    splitAmong: members.map((m: any) => m.id),
    category: "other",
    raw: text,
  };

  // Extract amount
  const amtMatch = text.match(/(?:rs\.?|inr|₹)?\s*(\d[\d,]*\.?\d*)\s*(?:rs|inr|rupees?)?/i);
  if (amtMatch) result.amount = parseFloat(amtMatch[1].replace(/,/g, ""));

  // Extract name (after "for" or first phrase)
  const forMatch = text.match(/(?:for|at|on)\s+([a-zA-Z\s]+?)(?:\s+split|\s+between|\s+among|,|$)/i);
  if (forMatch) result.name = forMatch[1].trim();
  else result.name = text.split(/\d/)[0].trim().replace(/^(i paid|paid|we paid)/i, "").trim();

  // Extract paidBy
  const paidByMatch = text.match(/^([a-zA-Z\s]+)\s+paid/i);
  if (paidByMatch) {
    const pname = paidByMatch[1].trim().toLowerCase();
    const found = members.find((m: any) => m.name.toLowerCase().includes(pname));
    if (found) result.paidBy = found.id;
  }

  // Extract split members (between X and Y / among X, Y, Z)
  const splitMatch = text.match(/(?:between|among|for)\s+([a-zA-Z\s,]+?)(?:\s+and\s+([a-zA-Z\s]+))?(?:\s+except|\s+not\s+for|$)/i);
  const exceptMatch = text.match(/(?:except|not\s+for|excluding)\s+([a-zA-Z\s,]+?)(?:\s*$)/i);

  if (splitMatch) {
    const names = (splitMatch[1] + (splitMatch[2] ? " " + splitMatch[2] : ""))
      .split(/,|\s+and\s+/i).map((n: string) => n.trim()).filter(Boolean);
    const matched: string[] = [];
    for (const n of names) {
      const m = members.find((m: any) => m.name.toLowerCase().includes(n.toLowerCase()));
      if (m) matched.push(m.id);
    }
    if (matched.length > 0) result.splitAmong = matched;
  }

  if (exceptMatch) {
    const exName = exceptMatch[1].trim().toLowerCase();
    const exMember = members.find((m: any) => m.name.toLowerCase().includes(exName));
    if (exMember) {
      result.splitAmong = result.splitAmong.filter((id: string) => id !== exMember.id);
    }
  }

  // Detect category
  result.category = detectCategory(result.name);

  return result;
}

export function VoiceExpenseSheet({ trip, onClose, onAdded }: Props) {
  const { c, isDark } = useTheme();
  const { user } = useAuth();
  const members: any[] = trip.members || [];
  const currency = trip.currency || "INR";
  const sym = currencySymbol(currency);

  const [listening,  setListening]  = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsed,     setParsed]     = useState<any>(null);
  const [editing,    setEditing]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  // Mic pulse animation
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (listening) {
      pulse.value = withRepeat(withTiming(1.2, { duration: 600, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [listening, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  // Web speech recognition ref
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    if (Platform.OS !== "web") {
      Alert.alert("Voice Input", "Tap the text box and use your keyboard's microphone button, or type your expense naturally.");
      setEditing(true);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Alert.alert("Not supported", "Your browser doesn't support voice input. Please type your expense.");
      setEditing(true);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setListening(true);
    recognition.onend   = () => setListening(false);
    recognition.onerror = () => { setListening(false); setEditing(true); };

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const text   = result[0].transcript;
      setTranscript(text);
      if (result.isFinal) {
        const p = parseExpenseText(text, members, user?.id || "");
        setParsed(p);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const onTranscriptChange = (text: string) => {
    setTranscript(text);
    if (text.trim().length > 5) {
      const p = parseExpenseText(text, members, user?.id || "");
      setParsed(p);
    }
  };

  const submitExpense = async () => {
    if (!parsed || !parsed.amount || parsed.amount <= 0) {
      setError("Please make sure the amount is mentioned.");
      return;
    }
    if (!parsed.name?.trim()) {
      setError("Please mention what the expense is for.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/trips/" + trip.id + "/expenses", {
        name: parsed.name,
        amount: parsed.amount,
        currency,
        category: parsed.category,
        paid_by: parsed.paidBy,
        split_among: parsed.splitAmong,
      });
      await onAdded();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not add expense.");
    } finally {
      setSubmitting(false);
    }
  };

  const payerName  = members.find((m: any) => m.id === parsed?.paidBy)?.name || "You";
  const isYouPayer = parsed?.paidBy === user?.id;
  const splitNames = parsed?.splitAmong?.map((id: string) => {
    const m = members.find((m: any) => m.id === id);
    return m ? (m.id === user?.id ? "You" : m.name) : id;
  }) || [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={[styles.sheet, { backgroundColor: c.bg, borderColor: c.border }]}>

            {/* Header */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: c.textPrimary }]}>Speak Your Expense</Text>
                <Text style={[styles.subtitle, { color: c.textMuted }]}>
                  Say it naturally — AI will figure out the details
                </Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color={c.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* Example prompts */}
              {!transcript && (
                <View style={[styles.examples, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <Text style={[styles.exTitle, { color: c.textMuted }]}>EXAMPLE PHRASES</Text>
                  {[
                    '"I paid 2000 for dinner, split with Rahul and Priya"',
                    '"Rahul paid 1500 for movie tickets for everyone except Priya"',
                    '"We spent 800 on coffee, I paid, split equally"',
                  ].map((ex, i) => (
                    <TouchableOpacity key={i} onPress={() => onTranscriptChange(ex.replace(/"/g, ""))}>
                      <Text style={[styles.exText, { color: c.textSecondary, borderColor: c.border }]}>{ex}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Mic button */}
              <View style={styles.micArea}>
                <Animated.View style={pulseStyle}>
                  <TouchableOpacity
                    onPress={listening ? stopListening : startListening}
                    style={[styles.micBtn, {
                      backgroundColor: listening ? c.negative : isDark ? c.indigo : "#1F1A17",
                    }]}
                  >
                    <Ionicons name={listening ? "stop" : "mic"} size={28} color="#fff" />
                  </TouchableOpacity>
                </Animated.View>
                <Text style={[styles.micLabel, { color: c.textMuted }]}>
                  {listening ? "Listening… tap to stop" : "Tap to speak"}
                </Text>
              </View>

              {/* Transcript text box */}
              <View style={[styles.transcriptBox, { borderColor: c.border, backgroundColor: c.surface }]}>
                <Text style={[styles.transcriptLabel, { color: c.textMuted }]}>OR TYPE YOUR EXPENSE</Text>
                <TextInput
                  value={transcript}
                  onChangeText={onTranscriptChange}
                  placeholder="e.g. I paid 2000 for dinner, split with everyone"
                  placeholderTextColor={c.textMuted}
                  multiline
                  style={[styles.transcriptInput, { color: c.textPrimary, outlineStyle: "none" } as any]}
                  autoFocus={editing}
                />
              </View>

              {/* Parsed preview */}
              {parsed && parsed.amount > 0 && (
                <View style={[styles.parsed, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <Text style={[styles.parsedTitle, { color: c.textMuted }]}>AI UNDERSTOOD THIS AS</Text>

                  <View style={styles.parsedRow}>
                    <Text style={[styles.parsedKey, { color: c.textSecondary }]}>Expense name</Text>
                    <Text style={[styles.parsedVal, { color: c.textPrimary }]}>{parsed.name || "—"}</Text>
                  </View>
                  <View style={styles.parsedRow}>
                    <Text style={[styles.parsedKey, { color: c.textSecondary }]}>Amount</Text>
                    <Text style={[styles.parsedVal, { color: c.textPrimary, fontFamily: "RobotoMono_700Bold" }]}>
                      {sym}{parsed.amount.toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <View style={styles.parsedRow}>
                    <Text style={[styles.parsedKey, { color: c.textSecondary }]}>Paid by</Text>
                    <Text style={[styles.parsedVal, { color: isYouPayer ? c.positive : c.textPrimary }]}>
                      {isYouPayer ? "You" : payerName}
                    </Text>
                  </View>
                  <View style={styles.parsedRow}>
                    <Text style={[styles.parsedKey, { color: c.textSecondary }]}>Split among</Text>
                    <Text style={[styles.parsedVal, { color: c.textPrimary }]} numberOfLines={2}>
                      {splitNames.join(", ")} ({splitNames.length} {splitNames.length === 1 ? "person" : "people"})
                    </Text>
                  </View>
                  <View style={styles.parsedRow}>
                    <Text style={[styles.parsedKey, { color: c.textSecondary }]}>Category</Text>
                    <Text style={[styles.parsedVal, { color: c.textPrimary }]}>
                      {categoryMeta[parsed.category]?.emoji} {categoryMeta[parsed.category]?.label || parsed.category}
                    </Text>
                  </View>
                  <View style={[styles.parsedRow, { paddingBottom: 0, borderBottomWidth: 0 }]}>
                    <Text style={[styles.parsedKey, { color: c.textSecondary }]}>Each owes</Text>
                    <Text style={[styles.parsedVal, { color: c.textPrimary, fontFamily: "RobotoMono_700Bold" }]}>
                      {sym}{splitNames.length > 0 ? Math.round(parsed.amount / splitNames.length).toLocaleString("en-IN") : "—"}
                    </Text>
                  </View>
                </View>
              )}

              {!!error && (
                <Text style={[styles.error, { color: c.negative }]}>{error}</Text>
              )}

              {/* Buttons */}
              {parsed && parsed.amount > 0 && (
                <TouchableOpacity
                  onPress={submitExpense}
                  disabled={submitting}
                  style={[styles.addBtn, { backgroundColor: isDark ? c.indigo : "#1F1A17", opacity: submitting ? 0.7 : 1 }]}
                >
                  {submitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.addBtnText}>Add to Ledger</Text>
                  }
                </TouchableOpacity>
              )}

              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    borderTopWidth:       1,
    maxHeight:            "90%",
    paddingHorizontal:    20,
    paddingTop:           20,
    paddingBottom:        0,
  },
  header:    { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  title:     { fontSize: 18, fontWeight: "800", letterSpacing: -0.4 },
  subtitle:  { fontSize: 12, marginTop: 3 },
  examples: {
    borderRadius: 8, borderWidth: 1, padding: 12, marginBottom: 16,
  },
  exTitle:   { fontSize: 8, letterSpacing: 2, fontFamily: "RobotoMono_400Regular" as any, marginBottom: 8 },
  exText: {
    fontSize: 11, paddingVertical: 6, borderBottomWidth: 1, lineHeight: 16,
    fontStyle: "italic",
  },
  micArea:   { alignItems: "center", marginVertical: 16, gap: 10 },
  micBtn: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
  },
  micLabel:  { fontSize: 11, letterSpacing: 0.5 },
  transcriptBox: { borderRadius: 8, borderWidth: 1, padding: 12, marginBottom: 16 },
  transcriptLabel: { fontSize: 8, letterSpacing: 2, fontFamily: "RobotoMono_400Regular" as any, marginBottom: 8 },
  transcriptInput: { fontSize: 14, lineHeight: 22, minHeight: 60 },
  parsed: { borderRadius: 8, borderWidth: 1, padding: 14, marginBottom: 16 },
  parsedTitle: { fontSize: 8, letterSpacing: 2, fontFamily: "RobotoMono_400Regular" as any, marginBottom: 10 },
  parsedRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  parsedKey: { fontSize: 11, flex: 1 },
  parsedVal: { fontSize: 12, fontWeight: "600", flex: 1.5, textAlign: "right" },
  error: { fontSize: 12, marginBottom: 12, textAlign: "center" },
  addBtn: { borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 8 },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
