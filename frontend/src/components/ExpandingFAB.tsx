/**
 * ExpandingFAB — B&W notebook-style expanding action button.
 * Square ink button, no rounded corners, no color accents.
 */
import React, { useState } from "react";
import { View, Text, TouchableOpacity, Pressable } from "react-native";
import Animated, {
  useSharedValue, withSpring, withTiming,
  useAnimatedStyle, interpolate, Extrapolation,
} from "react-native-reanimated";
import Svg, { Path, Line } from "react-native-svg";
import { useTheme } from "../lib/theme";

type Option = { label: string; sublabel: string; icon: "write" | "mic" | "camera" | "branch" | "download"; onPress: () => void };
type Props  = { options: Option[] };

function IcoWrite({ color, size = 18 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}
function IcoMic({ color, size = 18 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke={color} strokeWidth={1.8} strokeLinecap="round"/><Path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke={color} strokeWidth={1.8} strokeLinecap="round"/></Svg>;
}
function IcoCamera({ color, size = 18 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/><Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={color} strokeWidth={1.8}/></Svg>;
}
function IcoBranch({ color, size = 18 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9c0 6-6 9-12 9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}
function IcoDownload({ color, size = 18 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}
function IcoClose({ color, size = 18 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={1.8} strokeLinecap="round"/></Svg>;
}
function IcoPlus({ color, size = 18 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2} strokeLinecap="round"/></Svg>;
}

const ICON_MAP: Record<Option["icon"], (color: string) => React.ReactElement> = {
  write:    (c) => <IcoWrite    color={c} size={16} />,
  mic:      (c) => <IcoMic      color={c} size={16} />,
  camera:   (c) => <IcoCamera   color={c} size={16} />,
  branch:   (c) => <IcoBranch   color={c} size={16} />,
  download: (c) => <IcoDownload color={c} size={16} />,
};

function FABOption({ option, index, open, onPress }: { option: Option; index: number; open: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const anim = useSharedValue(0);
  React.useEffect(() => {
    anim.value = withSpring(open ? 1 : 0, { damping: 20, stiffness: 200 } as any);
  }, [open]);
  const style = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ translateY: interpolate(anim.value, [0, 1], [12, 0], Extrapolation.CLAMP) }],
  }));
  return (
    <Animated.View style={[style, { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10, marginBottom: 6 }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 10 }}>
        <View style={{ opacity: 0.7 }}>
          {ICON_MAP[option.icon]?.(c.textPrimary)}
        </View>
        <View>
          <Text style={{ color: c.textPrimary, fontSize: 13, fontFamily: "Manrope_700Bold" }}>{option.label}</Text>
          <Text style={{ color: c.textMuted, fontSize: 10, marginTop: 1 }}>{option.sublabel}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ExpandingFAB({ options }: Props) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const rotation  = useSharedValue(0);
  const backdrop  = useSharedValue(0);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    rotation.value = withSpring(next ? 1 : 0, { damping: 16, stiffness: 220 });
    backdrop.value = withTiming(next ? 1 : 0, { duration: 180 });
  };

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 45], Extrapolation.CLAMP)}deg` }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value * 0.3,
    pointerEvents: open ? "auto" : "none",
  }));

  return (
    <>
      {open && (
        <Pressable onPress={toggle} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.textPrimary }, backdropStyle]} />
        </Pressable>
      )}
      <View style={{ position: "absolute", bottom: 24, right: 20, alignItems: "flex-end" }} pointerEvents="box-none">
        {/* Options */}
        <View style={{ marginBottom: 10, alignItems: "flex-end" }} pointerEvents={open ? "auto" : "none"}>
          {[...options].reverse().map((opt, ri) => {
            const idx = options.length - 1 - ri;
            return (
              <FABOption
                key={opt.label}
                option={opt}
                index={idx}
                open={open}
                onPress={() => { toggle(); opt.onPress(); }}
              />
            );
          })}
        </View>

        {/* Square ink FAB */}
        <TouchableOpacity
          onPress={toggle}
          activeOpacity={0.85}
          style={{ width: 52, height: 52, backgroundColor: c.textPrimary, alignItems: "center", justifyContent: "center" }}
        >
          <Animated.View style={iconStyle}>
            {open
              ? <IcoClose color={c.bg} size={20} />
              : <IcoPlus  color={c.bg} size={20} />
            }
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
}
