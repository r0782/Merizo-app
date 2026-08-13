import { api } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

async function getStoredToken(): Promise<string> {
  try { return (await AsyncStorage.getItem("merizo_token")) || ""; }
  catch { return ""; }
}

// ── v2 — Gemini 2.5 Flash with full tool calling ─────────────────────────────

export interface ChatV2Context {
  group_id?: string;
  group_name?: string;
  user_name?: string;
  currency?: string;
  groups?: { id: string; name: string; currency: string; my_net?: number }[];
}

export interface ChatV2Response {
  reply: string;
  action_type: string | null;
  action_data: Record<string, any> | null;
  tool_called: string | null;
}

export async function chatV2(
  message: string,
  history: { role: "user" | "assistant"; content: string }[],
  context: ChatV2Context = {},
  language: string = "en",
): Promise<ChatV2Response> {
  const token = await getStoredToken();
  const r = await api.post("/ai/v2/chat", {
    message,
    history,
    context,
    token,
    language,
    provider: "groq",   // Groq key (gsk_...) is confirmed valid; Gemini key is an Emergent proxy key
  });
  return r.data as ChatV2Response;
}

// ── v1 legacy — Groq (kept for existing code that uses sendChat) ──────────────

export async function sendChat(message: string, history: any[], context: any = {}) {
  const token = await getStoredToken();
  const r = await api.post("/ai/chat", { message, history, context, token });
  return r.data.reply as string;
}

// ── Other AI utilities ────────────────────────────────────────────────────────

export async function parseExpenseText(text: string, members: string[], currency: string = "INR") {
  const r = await api.post("/ai/expense/parse", { text, members, currency });
  return r.data;
}

export async function optimizeSettlement(
  balances: Record<string, number>,
  currency: string,
  language: string = "en",
) {
  const r = await api.post("/ai/settle/optimize", { balances, currency, language });
  return r.data;
}

export async function explainBalances(
  balances: Record<string, number>,
  currency: string,
  language: string = "en",
) {
  const r = await api.post("/ai/explain/balances", { balances, currency, language });
  return r.data.explanation as string;
}

export async function transcribeVoice(audioUri: string, language: string = "en") {
  const formData = new FormData();
  formData.append("audio", { uri: audioUri, type: "audio/m4a", name: "voice.m4a" } as any);
  formData.append("language", language);
  try {
    const r = await api.post("/ai/voice/transcribe", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data;
  } catch { return { transcript: "" }; }
}
