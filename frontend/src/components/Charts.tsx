/**
 * MERIZO Charts — B&W hand-drawn style chart primitives.
 * All charts are monochrome ink on white paper.
 * - SketchAreaChart: draws itself left-to-right via animated clip
 * - SketchBudgetBar: wobbly ink fill bar, no color accent
 * - SketchDonutLegend: grayscale donut segments
 * - AIInsightCard: ledger row style insight
 */
import { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";
import Svg, { Circle, Line, Path, Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useTheme } from "../lib/theme";
import { type } from "../lib/tokens";

// ─────────────────────────────────────────────────────────────────────────────
// GaugeDial — tick ring (unchanged)
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
          const litColor = "#0A0A0A";
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
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={c.borderLight} strokeWidth={thickness} />
        {renderedSegments}
      </Svg>
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
        {children}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HybridBar (unchanged)
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
// SketchBudgetBar — B&W ink fill, wobbly track, no color accent
// ─────────────────────────────────────────────────────────────────────────────
export function SketchBudgetBar({
  spent,
  budget,
  accent: _accent,  // kept for API compat; not used visually
  width,
  height = 10,
}: {
  spent: number;
  budget: number;
  accent: string;
  width: number;
  height?: number;
}) {
  const { c } = useTheme();
  const pct = Math.min(1, budget > 0 ? spent / budget : 0);
  const isOver = pct >= 1;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
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
  const trackColor = "rgba(0,0,0,0.08)";
  const inkColor = c.ink;

  return (
    <View style={{ width, height: height + 6, justifyContent: "center" }}>
      {/* Track — wobbly grey path */}
      <Svg width={width} height={height + 4} style={{ position: "absolute" }}>
        <Path
          d={`M 4,${cy + 1} Q ${cx},${cy - 1} ${width - 4},${cy + 1}`}
          stroke={trackColor}
          strokeWidth={height}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      {/* Ink fill — animated */}
      <Animated.View style={{ position: "absolute", left: 0, top: 2, overflow: "hidden", width: fillW }}>
        <Svg width={width} height={height + 2}>
          <Path
            d={`M 4,${cy} Q ${cx},${cy - 1.5} ${width - 4},${cy}`}
            stroke={inkColor}
            strokeWidth={height}
            strokeLinecap="round"
            fill="none"
            opacity={isOver ? 1 : 0.85}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SketchAreaChart — B&W ink line that draws itself left-to-right
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
  const { c } = useTheme();
  const lineColor = color || c.ink;
  const clipW = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    clipW.setValue(0);
    Animated.timing(clipW, {
      toValue: chartWidth,
      duration: 1400,
      delay: 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [data, chartWidth]);

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

  const linePath = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cpX = (prev.x + pt.x) / 2;
    return `${acc} C ${cpX.toFixed(1)},${prev.y.toFixed(1)} ${cpX.toFixed(1)},${pt.y.toFixed(1)} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
  }, "");

  const baselineY = padY + chartH;
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)},${baselineY} L ${pts[0].x.toFixed(1)},${baselineY} Z`;

  const guides = [0.25, 0.5, 0.75];

  return (
    <View>
      <Animated.View style={{ width: clipW, overflow: "hidden", height }}>
        <Svg width={chartWidth} height={height}>
          {/* Grid guides — very faint, inherit line color */}
          {guides.map((f, i) => (
            <Line key={i}
              x1={padX} y1={padY + chartH * (1 - f)}
              x2={chartWidth - padX} y2={padY + chartH * (1 - f)}
              stroke={lineColor}
              strokeOpacity={0.12}
              strokeWidth={1}
              strokeDasharray="3,6"
            />
          ))}
          {/* Area fill — very subtle */}
          <Path d={areaPath} fill={lineColor} fillOpacity={0.05} />
          {/* Line */}
          <Path d={linePath} stroke={lineColor} strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Data point dots */}
          {pts.map((pt, i) => (
            <Circle key={i} cx={pt.x} cy={pt.y} r={3} fill={lineColor} />
          ))}
          {/* Tick marks at baseline */}
          {pts.map((pt, i) => (
            <Line key={`t${i}`}
              x1={pt.x} y1={baselineY}
              x2={pt.x} y2={baselineY + 3}
              stroke={lineColor}
              strokeOpacity={0.25}
              strokeWidth={1}
            />
          ))}
        </Svg>
      </Animated.View>
      {labels && (
        <View style={{ flexDirection: "row", paddingHorizontal: padX - 4, marginTop: -2 }}>
          {labels.map((lbl, i) => (
            <Text key={i} style={{
              flex: 1,
              textAlign: "center",
              fontSize: 9,
              fontFamily: type.family.light,
              color: c.textMuted,
              letterSpacing: 0.5,
            }} numberOfLines={1}>
              {lbl}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SketchDonutLegend — grayscale segments + ledger legend
// ─────────────────────────────────────────────────────────────────────────────
const GRAY_SHADES_LIGHT = ["#0A0A0A", "#3A3A38", "#6A6A67", "#9A9A97", "#C5C5C2"];
const GRAY_SHADES_DARK  = ["#F5F4F1", "#C5C5C2", "#9A9A97", "#6A6A67", "#3A3A38"];

const CAT_LABELS: Record<string, string> = {
  food: "Food & Drinks", travel: "Travel", entertainment: "Entertainment",
  utilities: "Bills & Utilities", shopping: "Shopping", health: "Health",
  accommodation: "Accommodation", trip: "Trip", other: "Other",
};
const CAT_SHORT: Record<string, string> = {
  food: "Food", travel: "Travel", entertainment: "Fun",
  utilities: "Bills", shopping: "Shopping", health: "Health",
  accommodation: "Stay", trip: "Trip", other: "Other",
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
  const SHADES = isDark ? GRAY_SHADES_DARK : GRAY_SHADES_LIGHT;
  const top5 = categories.slice(0, 5);

  const segments = top5.map((cc, i) => ({
    color: SHADES[i] || SHADES[SHADES.length - 1],
    value: cc.amount,
  }));

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
      {/* Grayscale donut */}
      <DonutRing size={120} thickness={20} segments={segments}>
        <Text style={{ fontFamily: type.family.light, fontSize: 9, color: c.textMuted, textAlign: "center" }}>
          TOTAL
        </Text>
        <Text style={{ fontFamily: type.family.bold, fontSize: 11, color: c.textPrimary, textAlign: "center", marginTop: 1 }}>
          {sym}{Math.round(total / 1000) > 0 ? `${Math.round(total / 1000)}k` : Math.round(total)}
        </Text>
      </DonutRing>

      {/* Ledger legend */}
      <View style={{ flex: 1, gap: 0 }}>
        {top5.map((cc, i) => {
          const shade = SHADES[i] || SHADES[SHADES.length - 1];
          return (
            <View key={cc.category} style={{
              flexDirection: "row", alignItems: "center", gap: 8,
              paddingVertical: 5,
              borderBottomWidth: i < top5.length - 1 ? 1 : 0,
              borderBottomColor: `${c.border}12`,
            }}>
              <View style={{ width: 6, height: 6, backgroundColor: shade, flexShrink: 0 }} />
              <Text style={{ flex: 1, fontFamily: type.family.regular, fontSize: 11, color: c.textSecondary }} numberOfLines={1}>
                {CAT_SHORT[cc.category] || cc.category}
              </Text>
              <Text style={{ fontFamily: type.family.semibold, fontSize: 11, color: c.textPrimary, width: 30, textAlign: "right" }}>
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
// AIInsightCard — ledger row style, no colored backgrounds
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
  const { c } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 360, delay: 60 + index * 80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(slideX, { toValue: 0, duration: 340, delay: 60 + index * 80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  const arrow = trendDir === "up" ? "↑" : trendDir === "down" ? "↓" : "→";

  return (
    <Animated.View style={{
      opacity: fade,
      transform: [{ translateX: slideX }],
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: `${c.border}18`,
    }}>
      {/* Trend arrow */}
      <Text style={{ fontFamily: type.family.light, fontSize: 14, color: c.textMuted, width: 16, marginTop: 1 }}>
        {arrow}
      </Text>
      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: type.family.medium, fontSize: type.size.sm, color: c.textPrimary, lineHeight: 20 }}>
          {title}
        </Text>
        {sub && (
          <Text style={{ fontFamily: type.family.regular, fontSize: 11, color: c.textMuted, marginTop: 2 }}>
            {sub}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}
