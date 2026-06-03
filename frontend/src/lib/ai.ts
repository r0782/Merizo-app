import { api } from "./api";

export async function sendChat(message: string, history: any[], context: any = {}) {
  const token = await getStoredToken();
  const r = await api.post("/ai/chat", { message, history, context, token });
  return r.data.reply as string;
}

async function getStoredToken(): Promise<string> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    return (await AsyncStorage.getItem("token")) || "";
  } catch { return ""; }
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
