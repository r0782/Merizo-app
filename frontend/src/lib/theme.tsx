import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { palette } from "./tokens";
import { STORAGE_KEYS } from "./storage-keys";

type ThemeColors = typeof palette.dark;
type Mode = "light" | "dark";

interface ThemeCtx {
  mode:    Mode;
  setMode: (m: Mode) => void;
  toggle:  () => void;
  c:       ThemeColors;
  isDark:  boolean;
}

const Ctx    = createContext<ThemeCtx | null>(null);
const KEY    = STORAGE_KEYS.THEME;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [mode, setModeState] = useState<Mode>(scheme === "light" ? "light" : "dark");
  const [loaded, setLoaded]  = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => {
      if (v === "light" || v === "dark") setModeState(v);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const value = React.useMemo(() => ({
    mode,
    setMode,
    toggle,
    c:      palette[mode],
    isDark: mode === "dark",
  }), [mode, setMode, toggle]);

  if (!loaded) return null;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}