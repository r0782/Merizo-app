import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useTheme } from "../lib/theme";

// Big speedometer-style gauge (dark mode)
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
            <Line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={lit ? litColor : offColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
        {children}
      </View>
    </View>
  );
}

// Light-mode style donut ring with center value
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
        <Circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth={thickness}
          strokeDasharray={`${len} ${C}`}
          strokeDashoffset={-offset}
          strokeLinecap="butt"
          rotation={-90}
          origin={`${cx},${cy}`}
        />
      );
      offset += len;
      return node;
    });
  } else {
    const filled = ((percent ?? 0) / 100) * C;
    renderedSegments = (
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#0A0A0A"
        strokeWidth={thickness}
        strokeDasharray={`${filled} ${C}`}
        strokeLinecap="round"
        rotation={-90}
        origin={`${cx},${cy}`}
      />
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

// Hybrid solid + dotted bar used in Insights category list
export function HybridBar({ percent, accent, muted, width = 120, height = 6 }: { percent: number; accent: string; muted: string; width?: number; height?: number }) {
  const filled = (percent / 100) * width;
  const remaining = width - filled;
  const dotGap = 4;
  const dotCount = Math.max(0, Math.floor(remaining / dotGap));
  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={height / 2} x2={filled} y2={height / 2} stroke={accent} strokeWidth={height - 1} strokeLinecap="round" />
      {Array.from({ length: dotCount }).map((_, i) => (
        <Circle key={i} cx={filled + i * dotGap + dotGap / 2} cy={height / 2} r={1} fill={muted} />
      ))}
    </Svg>
  );
}
