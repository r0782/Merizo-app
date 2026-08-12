/**
 * HandDrawnBorder — SVG border that looks like it was drawn with a pen.
 * Wraps any content with a slightly imperfect rectangle.
 */
import { useState } from "react";
import { View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../lib/theme";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  strokeWidth?: number;
  strokeColor?: string;
  padding?: number;
  filled?: boolean;
  fillColor?: string;
  jitter?: number; // how "sketchy" — 0 = perfect, 4 = very wobbly
}

// Generate a hand-drawn rectangle SVG path
function sketchRect(w: number, h: number, jitter: number): string {
  const j = jitter;
  // Each corner and midpoint gets a tiny random-feeling but deterministic offset
  const offsets = [
    [j * 0.3,  j * 0.5],   // top-left
    [j * -0.2, j * 0.4],   // top-mid
    [j * -0.5, j * 0.3],   // top-right corner
    [j * -0.4, j * 0.3],   // right-top
    [j * -0.3, j * -0.4],  // right-mid
    [j * -0.5, j * -0.5],  // bottom-right
    [j * 0.4,  j * -0.3],  // bottom-mid
    [j * 0.5,  j * -0.4],  // bottom-left
    [j * 0.4,  j * 0.3],   // left-mid
  ];

  const tl = offsets[0], tm = offsets[1], tr = offsets[2];
  const rm = offsets[4], br = offsets[5];
  const bm = offsets[6], bl = offsets[7];
  const lm = offsets[8];

  return [
    `M ${2 + tl[0]} ${2 + tl[1]}`,
    `Q ${w / 2 + tm[0]} ${1 + tm[1]} ${w - 2 + tr[0]} ${2 + tr[1]}`,
    `Q ${w - 1} ${h / 2 + rm[1]} ${w - 2 + br[0]} ${h - 2 + br[1]}`,
    `Q ${w / 2 + bm[0]} ${h - 1} ${2 + bl[0]} ${h - 2 + bl[1]}`,
    `Q ${1} ${h / 2 + lm[1]} ${2 + tl[0]} ${2 + tl[1]}`,
    `Z`,
  ].join(" ");
}

export function HandDrawnBorder({
  children, style, strokeWidth = 1.5, strokeColor, padding = 16,
  filled = true, fillColor, jitter = 2.5,
}: Props) {
  const { c } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });

  const ink    = strokeColor ?? c.border;
  const bgFill = fillColor   ?? c.surface;

  return (
    <View
      style={[{ position: "relative" }, style]}
      onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 && (
        <Svg
          width={size.w}
          height={size.h}
          style={{ position: "absolute", top: 0, left: 0 }}
          pointerEvents="none"
        >
          <Path
            d={sketchRect(size.w, size.h, jitter)}
            stroke={ink}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={filled ? bgFill : "none"}
          />
        </Svg>
      )}
      <View style={{ padding }}>{children}</View>
    </View>
  );
}

// Lightweight version for simple bordered views (no children padding management)
export function SketchBorder({
  width, height, strokeWidth = 1.5, strokeColor, fillColor, jitter = 2,
}: {
  width: number; height: number; strokeWidth?: number;
  strokeColor?: string; fillColor?: string; jitter?: number;
}) {
  const { c } = useTheme();
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Path
        d={sketchRect(width, height, jitter)}
        stroke={strokeColor ?? c.border}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={fillColor ?? "none"}
      />
    </Svg>
  );
}
