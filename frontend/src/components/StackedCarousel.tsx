import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable, Image } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../lib/theme";
import { currencySymbol } from "../lib/tokens";
import { SmartNum } from "./DotNum";

const { width: SCREEN_W } = Dimensions.get("window");

export type CarouselTrip = {
  id: string;
  name: string;
  destinations?: string[];
  split_category?: string;
  cover_key?: string;
  currency?: string;
  my_net?: number;
  total_spent?: number;
  budget?: number | null;
};

type Props = {
  trips: CarouselTrip[];
  onPressCard?: (trip: CarouselTrip) => void;
  onIndexChange?: (i: number) => void;
  showImage?: boolean;
};

const CARD_W = Math.min(SCREEN_W * 0.86, 340);
const CARD_H = Math.round(CARD_W * 1.22);
const SWIPE_DIST = 55;
const SWIPE_VEL = 400;
const BOUNCE_SPRING = { damping: 18, mass: 0.9, stiffness: 130, overshootClamping: false };

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ── Actual texture image assets — 12 dark, 12 light ──────────────────────────
const DARK_TEXTURES = [
  require("../../assets/textures/dark/1.jpg"),
  require("../../assets/textures/dark/2.jpg"),
  require("../../assets/textures/dark/3.jpg"),
  require("../../assets/textures/dark/4.jpg"),
  require("../../assets/textures/dark/5.jpg"),
  require("../../assets/textures/dark/6.jpg"),
  require("../../assets/textures/dark/7.jpg"),
  require("../../assets/textures/dark/8.jpg"),
  require("../../assets/textures/dark/9.jpg"),
  require("../../assets/textures/dark/10.jpg"),
  require("../../assets/textures/dark/11.jpg"),
  require("../../assets/textures/dark/12.jpg"),
];

const LIGHT_TEXTURES = [
  require("../../assets/textures/light/1.jpg"),
  require("../../assets/textures/light/2.jpg"),
  require("../../assets/textures/light/3.jpg"),
  require("../../assets/textures/light/4.jpg"),
  require("../../assets/textures/light/5.jpg"),
  require("../../assets/textures/light/6.jpg"),
  require("../../assets/textures/light/7.jpg"),
  require("../../assets/textures/light/8.jpg"),
  require("../../assets/textures/light/9.jpg"),
  require("../../assets/textures/light/10.jpg"),
  require("../../assets/textures/light/11.jpg"),
  require("../../assets/textures/light/12.jpg"),
];

// ─── Carousel ─────────────────────────────────────────────────────────────────
export function StackedCarousel({ trips, onPressCard, onIndexChange }: Props) {
  const [index, setIndex] = useState(0);
  const tx = useSharedValue(0);

  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  const advance = (dir: 1 | -1) => {
    setIndex((i) => Math.max(0, Math.min(trips.length - 1, i + dir)));
  };

  const pan = Gesture.Pan()
    .minDistance(6)
    .activeOffsetX([-8, 8])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      const max = CARD_W * 0.75;
      tx.value = Math.max(-max, Math.min(max, e.translationX));
    })
    .onEnd((e) => {
      const dist = e.translationX;
      const vel = e.velocityX;
      const goNext = dist < -SWIPE_DIST || vel < -SWIPE_VEL;
      const goPrev = dist > SWIPE_DIST || vel > SWIPE_VEL;
      if (goNext && index < trips.length - 1) {
        tx.value = withTiming(-CARD_W * 1.05, { duration: 220, easing: Easing.out(Easing.quad) }, () => {
          tx.value = 0; runOnJS(advance)(1);
        });
      } else if (goPrev && index > 0) {
        tx.value = withTiming(CARD_W * 1.05, { duration: 220, easing: Easing.out(Easing.quad) }, () => {
          tx.value = 0; runOnJS(advance)(-1);
        });
      } else {
        tx.value = withSpring(0, BOUNCE_SPRING);
      }
    });

  const visible = trips.slice(index, index + 3);

  return (
    <View style={{ height: CARD_H + 32, width: "100%", alignItems: "center" }}>
      <View style={{ width: CARD_W, height: CARD_H, position: "relative" }}>
        {[...visible].reverse().map((trip, revIdx) => {
          const i = visible.length - 1 - revIdx;
          return (
            <CardLayer
              key={trip.id}
              trip={trip}
              layerIndex={i}
              totalVisible={visible.length}
              tx={tx}
              isFront={i === 0}
              onPress={() => onPressCard?.(trip)}
              pan={pan}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Card layer ───────────────────────────────────────────────────────────────
function CardLayer({
  trip, layerIndex, tx, isFront, onPress, pan,
}: {
  trip: CarouselTrip;
  layerIndex: number;
  totalVisible: number;
  tx: SharedValue<number>;
  isFront: boolean;
  onPress: () => void;
  pan: ReturnType<typeof Gesture.Pan>;
}) {
  const { isDark } = useTheme();

  const scaleBase = layerIndex === 0 ? 1 : layerIndex === 1 ? 0.93 : 0.86;
  const yBase = layerIndex * 10;
  const opacityBase = layerIndex === 0 ? 1 : layerIndex === 1 ? 0.72 : 0.45;

  const animStyle = useAnimatedStyle(() => {
    if (isFront) {
      const rot = interpolate(tx.value, [-CARD_W, 0, CARD_W], [-8, 0, 8], Extrapolation.CLAMP);
      return {
        transform: [
          { translateX: tx.value }, { translateY: yBase },
          { scale: scaleBase }, { rotateZ: `${rot}deg` },
        ],
        opacity: opacityBase,
      };
    }
    const drag = Math.abs(tx.value);
    return {
      transform: [
        { translateY: yBase + interpolate(drag, [0, CARD_W], [0, -10], Extrapolation.CLAMP) },
        { scale: scaleBase + interpolate(drag, [0, CARD_W], [0, 0.05], Extrapolation.CLAMP) },
      ],
      opacity: opacityBase + interpolate(drag, [0, CARD_W], [0, 0.2], Extrapolation.CLAMP),
    };
  });

  // Pick texture deterministically from group name hash
  const h = strHash(trip.name);
  const textures = isDark ? DARK_TEXTURES : LIGHT_TEXTURES;
  const texture = textures[h % 12];

  const currency = trip.currency || "INR";
  const my = trip.my_net ?? 0;
  const even = Math.abs(my) < 0.5;
  const owed = my > 0;
  const labelText = even ? "You are even" : owed ? "YOU ARE OWED" : "YOU OWE";
  const numColor = even ? "muted" : owed ? "green" : "red";

  const total = trip.total_spent ?? 0;
  const budget = trip.budget ?? null;
  const pct = budget && budget > 0 ? Math.min(1, total / budget) : 0.5;

  // Text colours: white on dark textures, black on light textures
  const titleColor = isDark ? "#FFFFFF" : "#0A0A0A";
  const labelColor = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)";
  const borderColor = isFront
    ? isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"
    : "transparent";

  const cardContent = (
    <View style={[styles.card, { width: CARD_W, height: CARD_H, borderColor }]}>
      {/* Actual texture image — covers entire card */}
      <Image
        source={texture}
        style={[StyleSheet.absoluteFill, { width: CARD_W, height: CARD_H, borderRadius: 24 }]}
        resizeMode="cover"
      />

      {/* Content layer */}
      <View style={{ flex: 1, padding: 22, justifyContent: "space-between" }}>
        {/* Name + status */}
        <View>
          <Text
            style={{ color: titleColor, fontSize: 24, fontWeight: "800", letterSpacing: -0.6 }}
            numberOfLines={1}
          >
            {trip.name}
          </Text>
          <Text style={{
            color: labelColor, fontSize: 10, marginTop: 5,
            letterSpacing: 1.4, textTransform: "uppercase", fontWeight: "700",
          }}>
            {labelText}
          </Text>
        </View>

        {/* Amount + ring */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flexShrink: 1 }}>
            <SmartNum
              value={`${currencySymbol(currency)}${Math.abs(my).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
              size="lg"
              color={numColor}
            />
          </View>
          <ProgressRing
            pct={pct}
            size={52}
            colorOn={isDark ? "#F5C842" : "#0A0A0A"}
            colorOff={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}
          />
        </View>
      </View>
    </View>
  );

  const wrapperStyle = {
    position: "absolute" as const,
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center" as const,
  };

  if (!isFront) {
    return (
      <Animated.View style={[wrapperStyle, animStyle]} pointerEvents="none">
        {cardContent}
      </Animated.View>
    );
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[wrapperStyle, animStyle]}>
        <Pressable testID={`home-card-${trip.id}`} onPress={onPress} style={{ flex: 1, width: CARD_W }}>
          {cardContent}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Progress ring ─────────────────────────────────────────────────────────────
function ProgressRing({ pct, size = 52, colorOn, colorOff }: {
  pct: number; size?: number; colorOn: string; colorOff: string;
}) {
  const r = (size - 3) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const total = 32;
  const filled = Math.max(0, Math.min(total, Math.round(pct * total)));
  const dots = Array.from({ length: total }, (_, i) => {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), lit: i < filled };
  });
  return (
    <View style={{ width: size, height: size, flexShrink: 0 }}>
      <Svg width={size} height={size}>
        {dots.map((d, i) => (
          <Circle key={i} cx={d.x} cy={d.y} r={1.5} fill={d.lit ? colorOn : colorOff} />
        ))}
      </Svg>
      <View style={{ position: "absolute", width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colorOn, fontSize: 10, fontWeight: "800" }}>
          {Math.round(pct * 100)}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
  },
});
