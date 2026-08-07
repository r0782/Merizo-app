import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";
import Svg, { Circle, Line, Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { useTheme } from "../lib/theme";

// ─────────────────────────────────────────────────────────────────────────────
// GaugeDial — speedometer tick ring (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export function GaugeDial({
  percent,
  size = 240,
  children,
  testID,
}: {
  percent: number;
  size?: number;
  children?: React.ReactNode;
  testID?: string;
}) {
  const { c, isDark } = useTheme();
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 12;
  const TOTAL = 60;
  const filled = Math.max(0, Math.min(TOTAL, Math.round((percent / 100) * TOTAL)));

  return (
    <View testID={testID} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        {Array.from({ length: TOTAL }).map((_, i) => {
          const angle = (i / TOTAL) * Math.PI * 2 - Math.PI / 2;
          const x1 = cx + (r - 6) * Math.cos(angle);
          const y1 = cy + (r - 6) * Math.sin(angle);
          const x2 = cx + r * Math.cos(angle);
          const y2 = cy + r * Math.sin(angle);
          const lit = i < filled;
          const litColor = isDark ? c.indigo : "#0A0A0A";
          const offColor = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
          return (
            <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={lit ? litColor : offColor} strokeWidth={2} strokeLinecap="round" />
          );
        })}
      </Svg>
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
        {children}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DonutRing — segmented donut (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export function DonutRing({
  percent,
  size = 200,
  thickness = 18,
  children,
  segments,
  testID,
}: {
  percent?: number;
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
  segments?: { color: string; value: number }[];
  testID?: string;
}) {
  const { c } = useTheme();
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;

  let renderedSegments;
  if (segments && segments.length > 0) {
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    let offset = 0;
    renderedSegments = segments.map((seg, i) => {
      const len = (seg.value / total) * C;
      const node = (
        <Circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={seg.color} strokeWidth={thickness}
          strokeDasharray={`${len} ${C}`} strokeDashoffset={-offset}
          strokeLinecap="butt" rotation={-90} origin={`${cx},${cy}`} />
      );
      offset += len;
      return node;
    });
  } else {
    const filled = ((percent ?? 0) / 100) * C;
    renderedSegments = (
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#0A0A0A"
        strokeWidth={thickness} strokeDasharray={`${filled} ${C}`}
        strokeLinecap="round" rotation={-90} origin={`${cx},${cy}`} />
    );
  }

  return (
    <View testID={testID} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={c.border} strokeWidth={thickness} />
        {renderedSegments}
      </Svg>
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
        {children}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HybridBar — dotted hybrid bar (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export function HybridBar({ percent, accent, muted, width = 120, height = 6 }: {
  percent: number; accent: string; muted: string; width?: number; height?: number;
}) {
  const filled = (percent / 100) * width;
  const remaining = width - filled;
  const dotGap = 4;
  const dotCount = Math.max(0, Math.floor(remaining / dotGap));
  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={height / 2} x2={filled} y2={height / 2}
        stroke={accent} strokeWidth={height - 1} strokeLinecap="round" />
      {Array.from({ length: dotCount }).map((_, i) => (
        <Circle key={i} cx={filled + i * dotGap + dotGap / 2} cy={height / 2} r={1} fill={muted} />
      ))}
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SketchBudgetBar — hand-drawn progress bar with animated fill + sketch curve
// ─────────────────────────────────────────────────────────────────────────────
export function SketchBudgetBar({
  spent,
  budget,
  accent,
  width,
  height = 10,
}: {
  spent: number;
  budget: number;
  accent: string;
  width: number;
  height?: number;
}) {
  const { isDark } = useTheme();
  const pct = Math.min(1, budget > 0 ? spent / budget : 0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 900,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const fillW = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width - 8],
  });

  const cx = (width - 8) / 2;
  const cy = height / 2;
  const trackColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";

  return (
    <View style={{ width, height: height + 6, justifyContent: "center" }}>
      {/* Track */}
      <Svg width={width} height={height + 4} style={{ position: "absolute" }}>
        <Path
          d={`M 4,${cy + 1} Q ${cx},${cy - 1} ${width - 4},${cy + 1}`}
          stroke={trackColor}
          strokeWidth={height}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      {/* Animated fill */}
      <Animated.View style={{ position: "absolute", left: 0, top: 2, overflow: "hidden", width: fillW }}>
        <Svg width={width} height={height + 2}>
          <Defs>
            <LinearGradient id="fillGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={accent} stopOpacity={0.85} />
              <Stop offset="100%" stopColor={accent} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Path
            d={`M 4,${cy} Q ${cx},${cy - 1.5} ${width - 4},${cy}`}
            stroke="url(#fillGrad)"
            strokeWidth={height}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SketchAreaChart — smooth bezier area chart with faint grid + animated opacity
// ─────────────────────────────────────────────────────────────────────────────
export function SketchAreaChart({
  data,
  chartWidth,
  height = 110,
  color,
  labels,
}: {
  data: number[];
  chartWidth: number;
  height?: number;
  color?: string;
  labels?: string[];
}) {
  const { c, isDark } = useTheme();
  const lineColor = color || (isDark ? "#A78BFA" : "#6D5DFC");
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1, duration: 700, delay: 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, []);

  if (!data.length) return null;

  const padX = 10;
  const padY = 14;
  const labelH = labels ? 22 : 0;
  const chartH = height - padY * 2 - labelH;
  const max = Math.max(...data, 1);

  const pts = data.map((v, i) => ({
    x: padX + (i / Math.max(data.length - 1, 1)) * (chartWidth - padX * 2),
    y: padY + chartH - (v / max) * chartH,
  }));

  // Smooth bezier curve through points (Catmull-Rom style via cubic beziers)
  const linePath = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cpX = (prev.x + pt.x) / 2;
    return `${acc} C ${cpX.toFixed(1)},${prev.y.toFixed(1)} ${cpX.toFixed(1)},${pt.y.toFixed(1)} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
  }, "");

  const baselineY = padY + chartH;
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)},${baselineY} L ${pts[0].x.toFixed(1)},${baselineY} Z`;

  // Faint horizontal guide lines at 25%, 50%, 75%
  const guides = [0.25, 0.5, 0.75];

  return (
    <Animated.View style={{ opacity: fadeIn }}>
      <Svg width={chartWidth} height={height}>
        {/* Grid guides */}
        {guides.map((f, i) => (
          <Line key={i}
            x1={padX} y1={padY + chartH * (1 - f)}
            x2={chartWidth - padX} y2={padY + chartH * (1 - f)}
            stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
            strokeWidth={1}
            strokeDasharray="3,5"
          />
        ))}
        {/* Area fill — very subtle */}
        <Path d={areaPath} fill={lineColor} fillOpacity={0.07} />
        {/* Line — slightly wobbly feel from bezier curves */}
        <Path d={linePath} stroke={lineColor} strokeWidth={2.5}
          strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Data-point dots */}
        {pts.map((pt, i) => (
          <Circle key={i} cx={pt.x} cy={pt.y} r={3.5} fill={lineColor} />
        ))}
        {/* Vertical tick at each data point, faint */}
        {pts.map((pt, i) => (
          <Line key={`t${i}`}
            x1={pt.x} y1={baselineY}
            x2={pt.x} y2={baselineY + 3}
            stroke={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}
            strokeWidth={1}
          />
        ))}
      </Svg>
      {/* Labels row */}
      {labels && (
        <View style={{ flexDirection: "row", paddingHorizontal: padX - 4, marginTop: -4 }}>
          {labels.map((lbl, i) => (
            <Text key={i} style={{
              flex: 1, textAlign: "center", fontSize: 10,
              color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
            }} numberOfLines={1}>
              {lbl}
            </Text>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SketchDonutLegend — DonutRing + colour-coded legend in one card
// ─────────────────────────────────────────────────────────────────────────────
const SKETCH_COLORS: Record<string, string> = {
  food: "#FF8B7B", travel: "#60A5FA", entertainment: "#A78BFA",
  utilities: "#FBBF24", shopping: "#F472B6", health: "#34D399",
  accommodation: "#E8B04E", trip: "#9D7BFF", other: "#9CA3AF",
};
const SKETCH_LABELS: Record<string, string> = {
  food: "Food", travel: "Travel", entertainment: "Fun",
  utilities: "Bills", shopping: "Shopping", health: "Health",
  accommodation: "Stay", trip: "Trip", other: "Other",
};
const SKETCH_EMOJI: Record<string, string> = {
  food: "🍽️", travel: "✈️", entertainment: "🎬",
  utilities: "⚡", shopping: "🛍️", health: "💊",
  accommodation: "🏨", trip: "🗺️", other: "📦",
};

export function SketchDonutLegend({
  categories,
  total,
  sym,
}: {
  categories: { category: string; amount: number; percent: number }[];
  total: number;
  sym: string;
}) {
  const { c, isDark } = useTheme();
  const top5 = categories.slice(0, 5);
  const topCat = top5[0];

  const segments = top5.map(cc => ({
    color: SKETCH_COLORS[cc.category] || "#9CA3AF",
    value: cc.amount,
  }));

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
      {/* Donut */}
      <DonutRing size={134} thickness={24} segments={segments}>
        <Text style={{ fontSize: 10, color: c.textMuted, textAlign: "center" }}>
          {SKETCH_EMOJI[topCat?.category] || "💸"}
        </Text>
        <Text style={{ fontSize: 9, color: c.textMuted, textAlign: "center", marginTop: 1 }}>
          {sym}{Math.round(total).toLocaleString("en-IN")}
        </Text>
      </DonutRing>

      {/* Legend */}
      <View style={{ flex: 1, gap: 6 }}>
        {top5.map((cc) => {
          const color = SKETCH_COLORS[cc.category] || "#9CA3AF";
          return (
            <View key={cc.category} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <View style={{
                width: 8, height: 8, borderRadius: 2,
                backgroundColor: color, flexShrink: 0,
              }} />
              <Text style={{ flex: 1, fontSize: 12, color: c.textSecondary }} numberOfLines={1}>
                {SKETCH_EMOJI[cc.category]} {SKETCH_LABELS[cc.category] || cc.category}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: "600", color: c.textPrimary }}>
                {Math.round(cc.percent)}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AIInsightCard — single animated AI insight row
// ─────────────────────────────────────────────────────────────────────────────
export function AIInsightCard({
  emoji,
  title,
  sub,
  trendDir,
  index = 0,
}: {
  emoji: string;
  title: string;
  sub?: string;
  trendDir?: "up" | "down" | "neutral";
  index?: number;
}) {
  const { c, isDark } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1, duration: 400,
        delay: 80 + index * 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(slideY, {
        toValue: 0, duration: 380,
        delay: 80 + index * 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  const trendBg = trendDir === "down"
    ? (isDark ? "rgba(0,196,140,0.12)" : "rgba(0,196,140,0.10)")
    : trendDir === "up"
    ? (isDark ? "rgba(255,67,58,0.12)" : "rgba(255,67,58,0.10)")
    : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)");

  const trendSymbol = trendDir === "down" ? "↓" : trendDir === "up" ? "↑" : "→";
  const trendColor = trendDir === "down" ? "#00C48C" : trendDir === "up" ? "#FF453A" : c.textMuted;

  return (
    <Animated.View style={{
      opacity: fade,
      transform: [{ translateY: slideY }],
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: c.surface, borderRadius: 16, padding: 14,
      borderWidth: 1, borderColor: c.border,
    }}>
      {/* Emoji icon badge */}
      <View style={{
        width: 42, height: 42, borderRadius: 12,
        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F5F3EF",
        alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: c.textPrimary, lineHeight: 19 }}>
          {title}
        </Text>
        {sub && (
          <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>{sub}</Text>
        )}
      </View>

      {/* Trend chip */}
      {trendDir && (
        <View style={{
          width: 28, height: 28, borderRadius: 8,
          backgroundColor: trendBg,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: trendColor }}>{trendSymbol}</Text>
        </View>
      )}
    </Animated.View>
  );
}
