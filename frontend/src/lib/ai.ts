import { api } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

async function getStoredToken(): Promise<string> {
  try { return (await AsyncStorage.getItem("merizo_token")) || ""; }
  catch { return ""; }
}

export async function sendChat(message: string, history: any[], context: any = {}) {
  const token = await getStoredToken();
  const r = await api.post("/ai/chat", { message, history, context, token });
  return r.data.reply as string;
}

export async function parseExpenseText(text: string, members: string[], currency: string = "INR") {
  const r = await api.post("/ai/expense/parse", { text, members, currency });
  return r.data;
}

export async function optimizeSettlement(balances: Record<string, number>, currency: string, language: string = "en") {
  const r = await api.post("/ai/settle/optimize", { balances, currency, language });
  return r.data;
}

export async function explainBalances(balances: Record<string, number>, currency: string, language: string = "en") {
  const r = await api.post("/ai/explain/balances", { balances, currency, language });
  return r.data.explanation as string;
}

export async function transcribeVoice(audioUri: string, language: string = "en") {
  const formData = new FormData();
  formData.append("audio", { uri: audioUri, type: "audio/m4a", name: "voice.m4a" } as any);
  formData.append("language", language);
  try {
    const { api } = await import("./api");
    const r = await api.post("/ai/voice/transcribe", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data;
  } catch { return { transcript: "" }; }
}
