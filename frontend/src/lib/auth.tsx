import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, getToken, authHooks } from "./api";

type User = { id: string; email: string; name: string; avatar?: string | null };
type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<{ email: string }>;
  verifyRegistrationOtp: (email: string, otp: string) => Promise<void>;
  resendRegistrationOtp: (email: string) => Promise<void>;
  requestDeleteOtp: () => Promise<void>;
  confirmDeleteAccount: (otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  loginWithToken: (token: string, user?: User) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const t = await getToken();
      if (!t) {
        setUser(null);
        return;
      }
      const r = await api.get("/auth/me");
      setUser(r.data);
    } catch (e: any) {
      // Only clear the token when the server explicitly rejects it (401/403).
      // Network errors or 5xx should NOT log the user out.
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        await setToken(null);
        setUser(null);
      }
      // On network errors keep the cached user so the app stays usable.
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
    // Wire the api 401 interceptor: when token is invalid/expired anywhere in the app,
    // clear the in-memory user so all guarded routes redirect to /login automatically.
    authHooks.onUnauthorized = () => {
      setUser(null);
    };
    return () => {
      authHooks.onUnauthorized = undefined;
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.post("/auth/login", { email, password });
    await setToken(r.data.access_token);
    setUser(r.data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    // No token yet — the account stays unverified until the emailed OTP is confirmed.
    const r = await api.post("/auth/register", { email, password, name });
    return { email: r.data.email as string };
  }, []);

  const verifyRegistrationOtp = useCallback(async (email: string, otp: string) => {
    const r = await api.post("/auth/verify-register-otp", { email, otp });
    await setToken(r.data.access_token);
    setUser(r.data.user);
  }, []);

  const resendRegistrationOtp = useCallback(async (email: string) => {
    await api.post("/auth/resend-register-otp", { email });
  }, []);

  const requestDeleteOtp = useCallback(async () => {
    await api.post("/auth/account/request-delete-otp");
  }, []);

  const confirmDeleteAccount = useCallback(async (otp: string) => {
    await api.post("/auth/account/confirm-delete", { otp });
    await setToken(null);
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    await setToken(null);
    setUser(null);
    // Router redirect happens via the root layout watching user state
  }, []);

  const loginWithToken = useCallback(async (token: string, userData?: User) => {
    try {
      await setToken(token);
      // Always verify with server — avoids stale/placeholder user data
      const r = await api.get("/auth/me");
      setUser(r.data);
      setLoading(false);
    } catch (e) {
      // If /auth/me fails but we have userData, use it as fallback
      if (userData && userData.id !== "pending") {
        setUser(userData);
        setLoading(false);
      } else {
        await setToken(null);
        setUser(null);
        throw e;
      }
    }
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        login,
        register,
        verifyRegistrationOtp,
        resendRegistrationOtp,
        requestDeleteOtp,
        confirmDeleteAccount,
        logout,
        refresh,
        loginWithToken,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside provider");
  return v;
}
