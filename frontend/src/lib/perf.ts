/**
 * perf.ts — Performance Utilities
 * Merizo · Staff Engineer Grade
 *
 * GPU-accelerated animation helpers
 * 60 FPS guaranteed — only transform + opacity
 * Never animate: top, left, width, height, padding, margin
 */
import { useRef, useCallback, useEffect } from "react";
import { Animated, Easing } from "react-native";

// ─── Animation presets ────────────────────────────────────────────────────────
export const SPRING = {
  gentle:    { damping: 20, stiffness: 180, useNativeDriver: true },
  bouncy:    { damping: 12, stiffness: 200, useNativeDriver: true },
  snappy:    { damping: 25, stiffness: 300, useNativeDriver: true },
  slow:      { damping: 30, stiffness: 100, useNativeDriver: true },
};

export const TIMING = {
  fast:   (v: Animated.Value, to: number) => Animated.timing(v, { toValue: to, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: true }),
  normal: (v: Animated.Value, to: number) => Animated.timing(v, { toValue: to, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
  slow:   (v: Animated.Value, to: number) => Animated.timing(v, { toValue: to, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
};

// ─── useFadeIn ────────────────────────────────────────────────────────────────
export function useFadeIn(delay = 0, duration = 250) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1, duration, delay,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [delay, duration, opacity]);
  return { opacity };
}

// ─── useSlideIn ───────────────────────────────────────────────────────────────
export function useSlideIn(from: "bottom" | "right" = "bottom", delay = 0) {
  const translateY = useRef(new Animated.Value(from === "bottom" ? 24 : 0)).current;
  const translateX = useRef(new Animated.Value(from === "right"  ? 24 : 0)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(from === "bottom" ? translateY : translateX, {
        toValue: 0, delay, ...SPRING.gentle,
      }),
      Animated.timing(opacity, {
        toValue: 1, duration: 220, delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, from, opacity, translateX, translateY]);

  return from === "bottom"
    ? { opacity, transform: [{ translateY }] }
    : { opacity, transform: [{ translateX }] };
}

// ─── usePressScale ────────────────────────────────────────────────────────────
// GPU-accelerated press feedback
export function usePressScale(to = 0.96) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn  = useCallback(() => {
    Animated.spring(scale, { toValue: to, ...SPRING.snappy }).start();
  }, [scale, to]);
  const onPressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1,  ...SPRING.gentle }).start();
  }, [scale]);
  return { scale, onPressIn, onPressOut, style: { transform: [{ scale }] } };
}

// ─── useShimmer ───────────────────────────────────────────────────────────────
export function useShimmer() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    return () => anim.stopAnimation();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  return { opacity };
}

// ─── useGlowPulse ─────────────────────────────────────────────────────────────
export function useGlowPulse() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 2200,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 2200,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    return () => anim.stopAnimation();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  return { opacity };
}

// ─── debounce ─────────────────────────────────────────────────────────────────
export function debounce<T extends (...args: any[]) => any>(fn: T, ms = 300): T {
  let timer: any;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

// ─── throttle ────────────────────────────────────────────────────────────────
export function throttle<T extends (...args: any[]) => any>(fn: T, ms = 100): T {
  let last = 0;
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - last > ms) { last = now; fn(...args); }
  }) as T;
}

// ─── measureRender — dev helper ───────────────────────────────────────────────
export function measureRender(name: string) {
  if (!__DEV__) return { start: () => {}, end: () => {} };
  let t = 0;
  return {
    start: () => { t = Date.now(); },
    end:   () => { const ms = Date.now() - t; if (ms > 16) console.warn(`⚠️ ${name} took ${ms}ms`); },
  };
}