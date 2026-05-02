import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";
import { palette } from "./tokens";

type Mode = "light" | "dark";
type ThemeCtx = {
  mode: Mode;
  setMode: (m: Mode) => void;
  toggle: () => void;
  c: typeof palette.light;
  isDark: boolean;
};

const Ctx = createContext<ThemeCtx | null>(null);
const KEY = "merizo_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const sysScheme = useColorScheme();
  const [mode, setModeState] = useState<Mode>("dark");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY);
        if (saved === "light" || saved === "dark") {
          setModeState(saved);
        } else {
          setModeState(sysScheme === "light" ? "light" : "dark");
        }
      } catch {
        setModeState("dark");
      } finally {
        setLoaded(true);
      }
    })();
  }, [sysScheme]);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "light" ? "dark" : "light");
  }, [mode, setMode]);

  const value = useMemo<ThemeCtx>(() => ({
    mode,
    setMode,
    toggle,
    c: palette[mode],
    isDark: mode === "dark",
  }), [mode, setMode, toggle]);

  if (!loaded) return null;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme outside provider");
  return v;
}
