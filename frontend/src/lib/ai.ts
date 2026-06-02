import { api } from "./api";

export async function sendChat(message: string, history: any[], context: any = {}) {
  const r = await api.post("/ai/chat", { message, history, context });
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
