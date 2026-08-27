/**
 * Merizo Toast — lightweight global feedback overlay
 * Usage:
 *   import { toast } from "../components/Toast";
 *   toast.success("Expense added!");
 *   toast.error("Something went wrong");
 *   toast.info("Group context set");
 *
 * Mount <ToastContainer /> once at the root (inside ThemeProvider).
 */
import { useEffect, useRef, useState } from "react";
import { Animated, Text, View, Platform, Easing } from "react-native";
import { CheckCircleIcon, XCircleIcon, InfoIcon } from "phosphor-react-native";
import { useTheme } from "../lib/theme";
import { spacing, radius, type } from "../lib/tokens";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

// ── Event bus ─────────────────────────────────────────────────────────────────
type Listener = (item: ToastItem) => void;
const listeners: Listener[] = [];
let counter = 0;

function emit(message: string, kind: ToastKind) {
  const item: ToastItem = { id: ++counter, message, kind };
  listeners.forEach(fn => fn(item));
}

export const toast = {
  success: (msg: string) => emit(msg, "success"),
  error:   (msg: string) => emit(msg, "error"),
  info:    (msg: string) => emit(msg, "info"),
};

// ── Single toast view ─────────────────────────────────────────────────────────
function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const { c } = useTheme();
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  const KIND_CONFIG = {
    success: { bg: c.positive,  icon: (p: any) => <CheckCircleIcon {...p} weight="fill" />,  text: c.bg },
    error:   { bg: c.negative,  icon: (p: any) => <XCircleIcon     {...p} weight="fill" />,  text: c.bg },
    info:    { bg: c.textPrimary, icon: (p: any) => <InfoIcon       {...p} weight="fill" />,  text: c.bg  },
  };
  const cfg = KIND_CONFIG[item.kind];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0,   duration: 320, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1,   duration: 220, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 240, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start(() => onDone());
    }, 2800);

    return () => clearTimeout(t);
  }, [onDone, opacity, translateY]);

  return (
    <Animated.View style={{
      transform: [{ translateY }], opacity,
      marginHorizontal: spacing["5"], marginBottom: spacing["2"],
      backgroundColor: cfg.bg,
      borderRadius: radius.xl,
      paddingVertical: 14,
      paddingHorizontal: spacing["4"],
      flexDirection: "row",
      alignItems: "center",
      gap: spacing["2"],
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 8,
    }}>
      {cfg.icon({ size: 18, color: cfg.text })}
      <Text style={{
        fontFamily: type.family.semibold,
        fontSize: type.size.sm,
        color: cfg.text,
        flex: 1,
        lineHeight: 20,
      }}>
        {item.message}
      </Text>
    </Animated.View>
  );
}

// ── Container — mount once at the app root ────────────────────────────────────
export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (item) => {
      setItems(prev => [...prev, item]);
    };
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  const remove = (id: number) => setItems(prev => prev.filter(i => i.id !== id));

  if (items.length === 0) return null;

  return (
    <View style={{
      position: "absolute",
      top: Platform.OS === "ios" ? 56 : 40,
      left: 0, right: 0,
      zIndex: 9999,
      pointerEvents: "none",
    }}>
      {items.map(item => (
        <ToastView key={item.id} item={item} onDone={() => remove(item.id)} />
      ))}
    </View>
  );
}
