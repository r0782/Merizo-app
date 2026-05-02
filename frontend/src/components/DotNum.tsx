import React, { useMemo } from "react";
import Svg, { Circle } from "react-native-svg";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../lib/theme";
import { palette } from "../lib/tokens";

// 5x7 dot-matrix glyphs. 1 = filled, 0 = empty.
// Each glyph is 7 rows of 5 cols.
const G: Record<string, string[]> = {
  "0": [
    "01110",
    "10001",
    "10011",
    "10101",
    "11001",
    "10001",
    "01110",
  ],
  "1": [
    "00100",
    "01100",
    "00100",
    "00100",
    "00100",
    "00100",
    "01110",
  ],
  "2": [
    "01110",
    "10001",
    "00001",
    "00010",
    "00100",
    "01000",
    "11111",
  ],
  "3": [
    "11110",
    "00001",
    "00001",
    "01110",
    "00001",
    "00001",
    "11110",
  ],
  "4": [
    "00010",
    "00110",
    "01010",
    "10010",
    "11111",
    "00010",
    "00010",
  ],
  "5": [
    "11111",
    "10000",
    "11110",
    "00001",
    "00001",
    "10001",
    "01110",
  ],
  "6": [
    "00110",
    "01000",
    "10000",
    "11110",
    "10001",
    "10001",
    "01110",
  ],
  "7": [
    "11111",
    "00001",
    "00010",
    "00100",
    "01000",
    "01000",
    "01000",
  ],
  "8": [
    "01110",
    "10001",
    "10001",
    "01110",
    "10001",
    "10001",
    "01110",
  ],
  "9": [
    "01110",
    "10001",
    "10001",
    "01111",
    "00001",
    "00010",
    "01100",
  ],
  ".": [
    "00000",
    "00000",
    "00000",
    "00000",
    "00000",
    "01100",
    "01100",
  ],
  ",": [
    "00000",
    "00000",
    "00000",
    "00000",
    "00000",
    "01100",
    "01100",
  ],
  "-": [
    "00000",
    "00000",
    "00000",
    "01110",
    "00000",
    "00000",
    "00000",
  ],
  "+": [
    "00000",
    "00100",
    "00100",
    "11111",
    "00100",
    "00100",
    "00000",
  ],
  "%": [
    "11000",
    "11001",
    "00010",
    "00100",
    "01000",
    "10011",
    "00011",
  ],
  ":": [
    "00000",
    "01100",
    "01100",
    "00000",
    "01100",
    "01100",
    "00000",
  ],
  "/": [
    "00001",
    "00010",
    "00010",
    "00100",
    "01000",
    "01000",
    "10000",
  ],
  "₹": [
    "11110",
    "10001",
    "11110",
    "10001",
    "11110",
    "00100",
    "01000",
  ],
  "$": [
    "00100",
    "01111",
    "10100",
    "01110",
    "00101",
    "11110",
    "00100",
  ],
  "€": [
    "00111",
    "01000",
    "11110",
    "01000",
    "11110",
    "01000",
    "00111",
  ],
  "£": [
    "00110",
    "01001",
    "01000",
    "11100",
    "01000",
    "01001",
    "10110",
  ],
  "¥": [
    "10001",
    "10001",
    "01010",
    "11111",
    "00100",
    "11111",
    "00100",
  ],
  " ": [
    "00000",
    "00000",
    "00000",
    "00000",
    "00000",
    "00000",
    "00000",
  ],
};

function getGlyph(ch: string): string[] {
  return G[ch] || G[" "];
}

export type DotNumColor = "indigo" | "white" | "black" | "green" | "red" | "muted" | "gold";
export type DotNumSize = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

const SIZE_PX: Record<DotNumSize, { dot: number; gap: number }> = {
  xs: { dot: 1.6, gap: 0.6 },
  sm: { dot: 2.2, gap: 0.8 },
  md: { dot: 3, gap: 1 },
  lg: { dot: 4, gap: 1.2 },
  xl: { dot: 5.5, gap: 1.5 },
  xxl: { dot: 7.5, gap: 1.8 },
};

function colorFor(color: DotNumColor, isDark: boolean): { on: string; off: string } {
  const dark = palette.dark;
  const light = palette.light;
  const c = isDark ? dark : light;
  switch (color) {
    case "indigo":
      return { on: c.indigo, off: isDark ? "rgba(124,92,255,0.10)" : "rgba(124,92,255,0.10)" };
    case "white":
      return { on: c.textPrimary, off: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" };
    case "black":
      return { on: "#0A0A0A", off: "rgba(0,0,0,0.07)" };
    case "green":
      return { on: c.positive, off: isDark ? "rgba(74,222,128,0.10)" : "rgba(22,163,74,0.10)" };
    case "red":
      return { on: c.negative, off: isDark ? "rgba(248,113,113,0.10)" : "rgba(220,38,38,0.10)" };
    case "muted":
      return { on: c.textSecondary, off: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" };
    case "gold":
      return { on: "#F5C842", off: isDark ? "rgba(245,200,66,0.10)" : "rgba(245,200,66,0.12)" };
  }
}

export type DotNumProps = {
  value: string | number;
  size?: DotNumSize;
  color?: DotNumColor;
  showOff?: boolean; // show unlit dots
  testID?: string;
};

const CHAR_W = 5;
const CHAR_H = 7;
const CHAR_GAP = 1; // in dot units, between characters

export function DotNum({ value, size = "md", color = "indigo", showOff = true, testID }: DotNumProps) {
  const { isDark } = useTheme();
  const { dot, gap } = SIZE_PX[size];
  const txt = String(value);

  const { width, height, dots } = useMemo(() => {
    const dotsArr: { cx: number; cy: number; lit: boolean }[] = [];
    let xOffset = 0;
    for (const ch of txt) {
      const glyph = getGlyph(ch);
      for (let row = 0; row < CHAR_H; row++) {
        for (let col = 0; col < CHAR_W; col++) {
          const lit = glyph[row][col] === "1";
          const cx = xOffset + col * (dot + gap) + dot / 2;
          const cy = row * (dot + gap) + dot / 2;
          dotsArr.push({ cx, cy, lit });
        }
      }
      xOffset += CHAR_W * (dot + gap) + CHAR_GAP * (dot + gap);
    }
    const w = xOffset - CHAR_GAP * (dot + gap);
    const h = CHAR_H * (dot + gap) - gap;
    return { width: Math.max(w, 1), height: Math.max(h, 1), dots: dotsArr };
  }, [txt, dot, gap]);

  const { on, off } = colorFor(color, isDark);

  return (
    <View testID={testID} style={styles.row}>
      <Svg width={width} height={height}>
        {dots.map((d, i) => {
          if (!d.lit && !showOff) return null;
          return (
            <Circle
              key={i}
              cx={d.cx}
              cy={d.cy}
              r={dot / 2}
              fill={d.lit ? on : off}
            />
          );
        })}
      </Svg>
    </View>
  );
}

// Auto-switch SmartNum: always renders DotNum, but maps "indigo"/"white" colors to
// "black" in light mode so dot-matrix is dark on the off-white background.
export function SmartNum({
  value,
  size = "md",
  color = "indigo",
  // lightStyle kept for backwards-compat callers that may still pass it (ignored now)
  lightStyle: _lightStyle,
  testID,
}: {
  value: string | number;
  size?: DotNumSize;
  color?: DotNumColor;
  lightStyle?: any;
  testID?: string;
}) {
  const { isDark } = useTheme();
  let resolved: DotNumColor = color;
  if (!isDark) {
    if (color === "indigo" || color === "white") resolved = "black";
    if (color === "muted") resolved = "muted";
  }
  return <DotNum value={value} size={size} color={resolved} testID={testID} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});
