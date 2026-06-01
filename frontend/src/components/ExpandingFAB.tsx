/**
 * ExpandingFAB.tsx — Glowing AI orb with expanding options
 */
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue, withSpring, withRepeat, withTiming, withSequence,
  useAnimatedStyle, interpolate, Extrapolation,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";

type Option = { label: string; sublabel: string; icon: any; onPress: () => void; };
type Props  = { options: Option[] };

function FABOption({ option, index, open }: { option: Option; index: number; open: boolean }) {
  const { c, isDark } = useTheme();
  const anim = useSharedValue(0);
  React.useEffect(() => {
    anim.value = withSpring(open ? 1 : 0, { damping: 18, stiffness: 180, delay: open ? index * 60 : (3 - index) * 40 } as any);
  }, [open]);
  const style = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [
      { translateY: interpolate(anim.value, [0,1], [24,0], Extrapolation.CLAMP) },
      { scale:      interpolate(anim.value, [0,1], [0.88,1], Extrapolation.CLAMP) },
    ],
  }));
  return (
    <Animated.View style={[style, { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }]}>
      <TouchableOpacity
        onPress={option.onPress}
        activeOpacity={0.78}
        style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
      >
        {/* Label */}
        <View style={{ backgroundColor: isDark ? "#1B1612" : "#F5F1E8", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: isDark ? "rgba(201,170,120,0.2)" : "#C4B89A", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 }}>
          <Text style={{ color: isDark ? "#F4E6D0" : "#1F1A17", fontSize: 13, fontWeight: "700" }}>{option.label}</Text>
          <Text style={{ color: isDark ? "#7A6550" : "#9A8970", fontSize: 10, marginTop: 1 }}>{option.sublabel}</Text>
        </View>
        {/* Icon orb */}
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? "rgba(157,123,255,0.2)" : "#1F1A17", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: isDark ? "rgba(157,123,255,0.4)" : "rgba(0,0,0,0.1)", shadowColor: isDark ? "#9D7BFF" : "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0.5 : 0.15, shadowRadius: 8, elevation: 4 }}>
          <Ionicons name={option.icon} size={18} color={isDark ? "#C4A8FF" : "#fff"} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ExpandingFAB({ options }: Props) {
  const { c, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const rotation  = useSharedValue(0);
  const glow      = useSharedValue(1);
  const backdrop  = useSharedValue(0);

  // Idle pulse glow
  React.useEffect(() => {
    glow.value = withRepeat(withSequence(
      withTiming(1.12, { duration: 1800 }),
      withTiming(1.0,  { duration: 1800 }),
    ), -1, false);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    rotation.value = withSpring(next ? 1 : 0, { damping: 14, stiffness: 200 });
    backdrop.value = withTiming(next ? 1 : 0, { duration: 200 });
  };

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0,1], [0,45], Extrapolation.CLAMP)}deg` }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: open ? 1 : glow.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value * 0.4,
    pointerEvents: open ? "auto" : "none",
  }));

  return (
    <>
      {open && (
        <Pressable onPress={toggle} style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#0A0806" }, backdropStyle]} />
        </Pressable>
      )}
      <View style={{ position: "absolute", bottom: 24, right: 20, alignItems: "flex-end" }} pointerEvents="box-none">
        {/* Options */}
        <View style={{ marginBottom: 8, alignItems: "flex-end" }} pointerEvents={open ? "auto" : "none"}>
          {[...options].reverse().map((opt, ri) => {
            const idx = options.length - 1 - ri;
            return (
              <FABOption
                key={opt.label}
                option={{ ...opt, onPress: () => { toggle(); opt.onPress(); } }}
                index={idx}
                open={open}
              />
            );
          })}
        </View>

        {/* Glowing orb FAB */}
        <Animated.View style={[glowStyle, { shadowColor: "#9D7BFF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: isDark ? 0.7 : 0.3, shadowRadius: 20, elevation: 10 }]}>
          <TouchableOpacity onPress={toggle} activeOpacity={0.85}
            style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: isDark ? "#9D7BFF" : "#1F1A17", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: isDark ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)" }}
          >
            <Animated.View style={fabStyle}>
              <Ionicons name="add" size={26} color="#fff" />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </>
  );
}