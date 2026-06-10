import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, getToken, authHooks } from "./api";

type User = { id: string; email: string; name: string; avatar?: string | null };
type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
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
    const r = await api.post("/auth/register", { email, password, name });
    await setToken(r.data.access_token);
    setUser(r.data.user);
  }, []);

  const logout = useCallback(async () => {
    await setToken(null);
    setUser(null);
    // Router redirect happens via the root layout watching user state
  }, []);

  const loginWithToken = useCallback(async (token: string, userData?: User) => {
    try {
      // Store token in AsyncStorage with correct key
      await setToken(token);

      // Set user data if provided, otherwise set a placeholder that will be refreshed
      if (userData) {
        setUser(userData);
      } else {
        // Set a temporary user object - will be populated on next refresh
        setUser({
          id: "pending",
          email: "pending",
          name: "User",
        });
      }

      setLoading(false);
    } catch (e) {
      console.error("Token login failed:", e);
      await setToken(null);
      setUser(null);
      throw e;
    }
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        login,
        register,
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
