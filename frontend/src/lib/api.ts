import axios, { AxiosInstance } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export const TOKEN_KEY = "merizo_token";

// Hooks set by the AuthProvider so 401 responses force a sign-out + redirect.
type AuthHooks = { onUnauthorized?: () => void };
export const authHooks: AuthHooks = {};

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 20000,
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
