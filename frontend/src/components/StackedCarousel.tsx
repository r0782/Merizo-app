import React, { useState } from "react";
import { View, Text, StyleSheet, Image, Dimensions, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../lib/theme";
import { resolveCover, formatAmount, currencySymbol } from "../lib/tokens";
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
};

export function StackedCarousel({ trips, onPressCard, onIndexChange }: Props) {
  const { c, isDark } = useTheme();
  const [index, setIndex] = useState(0);
  const tx = useSharedValue(0);

  const cardW = Math.min(SCREEN_W * 0.7, 300);
  const cardH = Math.round(cardW * 1.25);
  const SWIPE = 80;

  const goPrev = () => {
    setIndex((i) => {
      const next = Math.max(0, i - 1);
      onIndexChange?.(next);
      return next;
    });
  };
  const goNext = () => {
    setIndex((i) => {
      const next = Math.min(trips.length - 1, i + 1);
      onIndexChange?.(next);
      return next;
    });
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE && index < trips.length - 1) {
        tx.value = withSpring(-cardW, { damping: 18, stiffness: 180 }, () => {
          tx.value = 0;
          runOnJS(goNext)();
        });
      } else if (e.translationX > SWIPE && index > 0) {
        tx.value = withSpring(cardW, { damping: 18, stiffness: 180 }, () => {
          tx.value = 0;
          runOnJS(goPrev)();
        });
      } else {
        tx.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  if (!trips || trips.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.border, width: cardW, height: cardH }]}>
        <Text style={{ color: c.textSecondary, fontSize: 14 }}>No splits yet</Text>
        <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 6 }}>
          Tap + to start
        </Text>
      </View>
    );
  }

  // Show up to 3 visible: current, next, next+1
  const visible = trips.slice(index, index + 3);

  return (
    <View style={{ height: cardH + 40, width: "100%", alignItems: "center" }}>
      <View style={{ width: cardW, height: cardH, position: "relative" }}>
        {/* Render back-most first (last array item) */}
        {visible
          .map((trip, i) => ({ trip, i }))
          .reverse()
          .map(({ trip, i }) => {
            const isFront = i === 0;
            return (
              <CardLayer
                key={trip.id}
                trip={trip}
                i={i}
                isFront={isFront}
                tx={tx}
                cardW={cardW}
                cardH={cardH}
                isDark={isDark}
                borderColor={c.border}
                surface={c.surface}
                indigo={c.indigo}
                textSecondary={c.textSecondary}
                onPress={() => onPressCard?.(trip)}
                pan={pan}
              />
            );
          })}
      </View>
    </View>
  );
}

function CardLayer({
  trip,
  i,
  isFront,
  tx,
  cardW,
  cardH,
  isDark,
  borderColor,
  surface,
  indigo,
  textSecondary,
  onPress,
  pan,
}: any) {
  const animStyle = useAnimatedStyle(() => {
    const scaleBase = i === 0 ? 1 : i === 1 ? 0.94 : 0.88;
    const opacityBase = i === 0 ? 1 : i === 1 ? 0.78 : 0.55;
    const yBase = i * 12;
    if (isFront) {
      return {
        transform: [
          { translateX: tx.value },
          { translateY: yBase },
          { scale: scaleBase },
          { rotateZ: `${interpolate(tx.value, [-200, 0, 200], [-6, 0, 6], Extrapolation.CLAMP)}deg` },
        ],
        opacity: opacityBase,
      };
    }
    return {
      transform: [
        { translateY: yBase + interpolate(Math.abs(tx.value), [0, 200], [0, -8], Extrapolation.CLAMP) },
        { scale: scaleBase + interpolate(Math.abs(tx.value), [0, 200], [0, 0.04], Extrapolation.CLAMP) },
      ],
      opacity: opacityBase + interpolate(Math.abs(tx.value), [0, 200], [0, 0.15], Extrapolation.CLAMP),
    };
  });

  const cover = resolveCover(trip.destinations, trip.split_category || "trip", trip.cover_key);
  const currency = trip.currency || "INR";
  const my = trip.my_net || 0;
  const owed = my > 0;
  const owe = my < 0;
  const even = Math.abs(my) < 0.5;
  const labelText = even ? "You are even" : owed ? "You are owed" : "You owe";
  const numColor = even ? "muted" : owed ? "green" : "red";

  const total = trip.total_spent || 0;
  const budget = trip.budget || null;
  const pct = budget && budget > 0 ? Math.min(1, total / budget) : 0.5;

  const cardContent = (
    <View
      style={[
        styles.card,
        {
          width: cardW,
          height: cardH,
          backgroundColor: surface,
          borderColor: isDark && isFront ? "rgba(124,92,255,0.35)" : borderColor,
        },
      ]}
    >
      <Image source={{ uri: cover }} style={[StyleSheet.absoluteFill as any, { borderRadius: 22, opacity: isDark ? 0.45 : 1 }]} />
      <View
        style={[
          StyleSheet.absoluteFill as any,
          {
            backgroundColor: isDark ? "rgba(13,13,13,0.40)" : "rgba(255,255,255,0.18)",
            borderRadius: 22,
          },
        ]}
      />
      <View style={{ flex: 1, padding: 20, justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: isDark ? "#FFF" : "#0A0A0A", fontSize: 22, fontWeight: "800", letterSpacing: -0.5 }}>
            {trip.name}
          </Text>
          <Text
            style={{
              color: isDark ? textSecondary : "rgba(10,10,10,0.7)",
              fontSize: 10,
              marginTop: 4,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              fontWeight: "700",
            }}
          >
            {labelText}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <SmartNum
              value={`${currencySymbol(currency)}${Math.abs(my).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
              size="xl"
              color={numColor}
            />
            {budget && (
              <Text style={{ color: isDark ? textSecondary : "rgba(10,10,10,0.7)", fontSize: 10, marginTop: 6 }}>
                {formatAmount(total, currency)} of {formatAmount(budget, currency)}
              </Text>
            )}
          </View>
          <ProgressRing
            pct={pct}
            size={50}
            stroke={3}
            colorOn={isDark ? indigo : "#0A0A0A"}
            colorOff={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)"}
          />
        </View>
      </View>
    </View>
  );

  // Use absolutely positioned wrapper inside the relative parent
  const wrapperStyle = {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
        <Pressable testID={`home-card-${trip.id}`} onPress={onPress}>{cardContent}</Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

function ProgressRing({ pct, size = 50, stroke = 3, colorOn, colorOff }: { pct: number; size?: number; stroke?: number; colorOn: string; colorOff: string }) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const total = 32;
  const filled = Math.max(0, Math.min(total, Math.round(pct * total)));

  const dots: any[] = [];
  for (let i = 0; i < total; i++) {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    dots.push(<Circle key={i} cx={x} cy={y} r={1.4} fill={i < filled ? colorOn : colorOff} />);
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>{dots}</Svg>
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colorOn, fontSize: 10, fontWeight: "800" }}>{Math.round(pct * 100)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    boxShadow: "0 12px 18px rgba(0,0,0,0.18)",
    elevation: 8,
  },
  empty: {
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
