import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storage-keys";
import { detectLocaleCurrency } from "./currency";

interface CurrencyCtx {
  currency: string;
  setCurrency: (code: string) => void;
}

const Ctx = createContext<CurrencyCtx | null>(null);
const KEY = STORAGE_KEYS.DEFAULT_CURRENCY;

// App-wide currency preference, mirroring ThemeProvider's pattern: one
// source of truth in context + AsyncStorage, so every screen that reads it
// updates immediately when it's changed anywhere (e.g. Profile settings)
// instead of only picking up the new value on next mount.
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<string>("INR");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => {
      setCurrencyState(v || detectLocaleCurrency());
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code);
    AsyncStorage.setItem(KEY, code).catch(() => {});
  }, []);

  if (!loaded) return null;

  return <Ctx.Provider value={{ currency, setCurrency }}>{children}</Ctx.Provider>;
}

export function useCurrency(): CurrencyCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCurrency must be inside CurrencyProvider");
  return ctx;
}
