/**
 * MerizoButton — ink-fill button with hand-drawn border.
 * On press: the border "fills" with ink like a pen drawing.
 * States: idle → pressing (ink spreads) → loading → done (checkmark draws)
 */
import { useRef, useEffect } from "react";
import { Animated, TouchableOpacity, View, ViewStyle } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useTheme } from "../../lib/theme";
import { type } from "../../lib/tokens";

// Animated SVG path length trick for "drawing" effect
import Animated2, { useSharedValue, withTiming, useAnimatedProps, Easing as REasing } from "react-native-reanimated";
const AnimatedPath = Animated2.createAnimatedComponent(Path);

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  done?: boolean;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  style?: ViewStyle;
  disabled?: boolean;
  fullWidth?: boolean;
}

// Checkmark SVG path (normalized to 24x24)
const CHECK_PATH = "M 4 12 L 9 17 L 20 7";
const CHECK_LENGTH = 22; // approximate stroke length

export function MerizoButton({
  label, onPress, loading = false, done = false,
  variant = "primary", size = "md", style, disabled = false, fullWidth = true,
}: Props) {
  const { c } = useTheme();
  const scale       = useRef(new Animated.Value(1)).current;
  const inkFill     = useRef(new Animated.Value(0)).current;   // 0=outline, 1=filled

  // Checkmark stroke-dashoffset animation
  const checkProgress = useSharedValue(CHECK_LENGTH);

  const isPrimary = variant === "primary";

  const heights = { sm: 40, md: 48, lg: 56 };
  const fontSizes = { sm: type.size.sm, md: type.size.base, lg: type.size.md };
  const h = heights[size];
  const fs = fontSizes[size];

  // Background interpolates from transparent → ink black on press
  const bgColor = inkFill.interpolate({
    inputRange:  [0, 1],
    outputRange: isPrimary ? [c.bg, c.ink] : ["transparent", `${c.ink}12`],
  });
  const textColor = inkFill.interpolate({
    inputRange:  [0, 1],
    outputRange: isPrimary ? [c.textPrimary, c.bg] : [c.textPrimary, c.textPrimary],
  });

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 0 }),
      Animated.timing(inkFill, { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1,   useNativeDriver: true, speed: 40, bounciness: 6 }),
      Animated.timing(inkFill, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start();
  };

  // Animate checkmark when done=true
  useEffect(() => {
    if (done) {
      checkProgress.value = CHECK_LENGTH;
      checkProgress.value = withTiming(0, {
        duration: 400,
        easing: REasing.out(REasing.cubic),
      });
    }
  }, [done, checkProgress]);

  const animatedCheckProps = useAnimatedProps(() => ({
    strokeDashoffset: checkProgress.value,
  }));

  const borderColor = disabled ? `${c.border}40` : c.border;

  return (
    <Animated.View style={[
      { transform: [{ scale }] },
      fullWidth ? { alignSelf: "stretch" } : { alignSelf: "center" },
      style,
    ]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading || done}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
      >
        <Animated.View style={{
          height: h,
          backgroundColor: bgColor as any,
          borderWidth: 1.5,
          borderColor: borderColor,
          borderRadius: 4,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: disabled ? 0.4 : 1,
        }}>
          {loading ? (
            <InkLoader color={c.textPrimary} />
          ) : done ? (
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <AnimatedPath
                d={CHECK_PATH}
                stroke={isPrimary ? c.bg : c.textPrimary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray={CHECK_LENGTH}
                animatedProps={animatedCheckProps}
              />
            </Svg>
          ) : (
            <Animated.Text style={{
              fontFamily: type.family.semibold,
              fontSize: fs,
              color: textColor as any,
              letterSpacing: 0.3,
            }}>
              {label}
            </Animated.Text>
          )}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Ink loader — three dots that animate like an ink pen writing ──────────────
export function InkLoader({ color, size = 5 }: { color?: string; size?: number }) {
  const { c } = useTheme();
  const dots = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(d, { toValue: -4, duration: 220, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0,  duration: 220, useNativeDriver: true }),
          Animated.delay(360 - i * 120),
        ])
      )
    );
    Animated.parallel(anims).start();
    return () => anims.forEach(a => a.stop());
  }, [dots]);

  const ink = color ?? c.textPrimary;

  return (
    <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{
          width: size, height: size,
          borderRadius: size / 2,
          backgroundColor: ink,
          transform: [{ translateY: d }],
        }} />
      ))}
    </View>
  );
}

// ── Animated ink check — standalone use ──────────────────────────────────────
export function InkCheck({ size = 24, color, strokeWidth = 2 }: {
  size?: number; color?: string; strokeWidth?: number;
}) {
  const { c } = useTheme();
  const progress = useSharedValue(CHECK_LENGTH);

  useEffect(() => {
    progress.value = withTiming(0, {
      duration: 450,
      easing: REasing.out(REasing.cubic),
    });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: progress.value,
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Circle draws separately */}
      <Circle
        cx={12} cy={12} r={10}
        stroke={color ?? c.textPrimary}
        strokeWidth={strokeWidth}
        fill="none"
        opacity={0.15}
      />
      <AnimatedPath
        d={CHECK_PATH}
        stroke={color ?? c.textPrimary}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={CHECK_LENGTH}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
