/**
 * ExpandingFAB.tsx
 *
 * Expanding action menu that unfolds upward like receipt strips.
 * Tapping "+" reveals 4 options with spring animation.
 * Each option slides up with a slight stagger delay.
 */

import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Pressable,
} from "react-native";
import Animated, {
  useSharedValue, withSpring, withDelay,
  useAnimatedStyle, interpolate, Extrapolation,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";

type Option = {
  label: string;
  sublabel: string;
  icon: any;
  onPress: () => void;
};

type Props = {
  options: Option[];
};

function FABOption({ option, index, open }: { option: Option; index: number; open: boolean }) {
  const { c, isDark } = useTheme();
  const anim = useSharedValue(0);

  React.useEffect(() => {
    anim.value = withDelay(
      open ? index * 55 : (3 - index) * 40,
      withSpring(open ? 1 : 0, { damping: 18, stiffness: 180 })
    );
  }, [anim, index, open]);

  const style = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [
      { translateY: interpolate(anim.value, [0, 1], [20, 0], Extrapolation.CLAMP) },
      { scale:      interpolate(anim.value, [0, 1], [0.92, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <Animated.View style={style}>
      <TouchableOpacity onPress={option.onPress} activeOpacity={0.75} style={styles.optionRow}>
        {/* Label strip */}
        <View style={[styles.labelStrip, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View>
            <Text style={[styles.optLabel, { color: c.textPrimary }]}>{option.label}</Text>
            <Text style={[styles.optSub, { color: c.textMuted }]}>{option.sublabel}</Text>
          </View>
        </View>
        {/* Icon circle */}
        <View style={[styles.iconCircle, { backgroundColor: isDark ? c.accent : "#1F1A17", borderColor: c.border }]}>
          <Ionicons name={option.icon} size={18} color={isDark ? "#1C1712" : "#F5F1E8"} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ExpandingFAB({ options }: Props) {
  const { c, isDark } = useTheme();
  const [open, setOpen] = useState(false);

  const rotation = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    rotation.value    = withSpring(next ? 1 : 0, { damping: 15, stiffness: 200 });
    backdropOpacity.value = withSpring(next ? 1 : 0);
  };

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 45])}deg` }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value * 0.35,
    pointerEvents: open ? "auto" : "none",
  }));

  return (
    <>
      {/* Backdrop */}
      {open && (
        <Pressable onPress={toggle} style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#1F1A17" }, backdropStyle]} />
        </Pressable>
      )}

      {/* FAB container */}
      <View style={styles.container} pointerEvents="box-none">
        {/* Options — render in reverse so first option is closest to FAB */}
        <View style={styles.options} pointerEvents={open ? "auto" : "none"}>
          {[...options].reverse().map((opt, revIdx) => {
            const idx = options.length - 1 - revIdx;
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

        {/* Main FAB button */}
        <TouchableOpacity onPress={toggle} activeOpacity={0.88} style={[styles.fab, { backgroundColor: isDark ? c.accent : "#1F1A17" }]}>
          <Animated.View style={fabStyle}>
            <Ionicons name="add" size={26} color={isDark ? "#1C1712" : "#F5F1E8"} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position:        "absolute",
    bottom:          28,
    right:           24,
    alignItems:      "flex-end",
    gap:             10,
  },
  options: {
    alignItems: "flex-end",
    gap:        10,
    marginBottom: 4,
  },
  optionRow: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            10,
  },
  labelStrip: {
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderRadius:      6,
    borderWidth:       1,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.08,
    shadowRadius:      6,
    elevation:         3,
  },
  optLabel: {
    fontSize:      13,
    fontWeight:    "700",
    letterSpacing: 0.2,
  },
  optSub: {
    fontSize:  10,
    marginTop: 1,
  },
  iconCircle: {
    width:         44,
    height:        44,
    borderRadius:  22,
    alignItems:    "center",
    justifyContent:"center",
    borderWidth:   1,
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius:  8,
    elevation:     4,
  },
  fab: {
    width:         54,
    height:        54,
    borderRadius:  27,
    alignItems:    "center",
    justifyContent:"center",
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius:  10,
    elevation:     6,
  },
});
