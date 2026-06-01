import axios, { AxiosInstance } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export const TOKEN_KEY = "merizo_token";

// Hooks set by the AuthProvider so 401 responses force a sign-out + redirect.
type AuthHooks = { onUnauthorized?: () => void };
export const authHooks: AuthHooks = {};

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 60000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const status = err?.response?.status;
    
    // Retry on timeout errors
    if (err.code === 'ECONNABORTED') {
      console.warn('Request timeout, retrying...');
      if (err.config) {
        err.config.timeout = 120000;
        try {
          return await api.request(err.config);
        } catch (retryErr) {
          return Promise.reject(retryErr);
        }
      }
    }
    
    if (status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      try {
        authHooks.onUnauthorized?.();
      } catch {}
    }
    return Promise.reject(err);
  }
);
export async function setToken(t: string | null) {
  if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function createGroup(data: any) {
  try {
    // Limit members to 50
    if (data.member_ids && data.member_ids.length > 50) {
      throw new Error('Maximum 50 members allowed per group');
    }

    const response = await api.post('/groups', data);
    return response.data;
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Group creation took too long. Try with fewer members.');
    }
    throw error;
  }
}
export async function removeMemberFromGroup(
  groupId: string,
  memberId: string
) {
  return api.delete(`/groups/${groupId}/members/${memberId}`);
}
// ── Keep Render warm — ping every 14 min to prevent cold start ───────────────
let _pingTimer: any = null;
export function startKeepAlive() {
  if (_pingTimer) return;
  const ping = () => {
    api.get("/").catch(() => {}); // silent — just wake the server
  };
  ping(); // immediate ping on app start
  _pingTimer = setInterval(ping, 14 * 60 * 1000); // every 14 minutes
}
export function stopKeepAlive() {
  if (_pingTimer) { clearInterval(_pingTimer); _pingTimer = null; }
}