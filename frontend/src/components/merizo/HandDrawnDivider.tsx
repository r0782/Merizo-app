/**
 * HandDrawnDivider — a slightly wobbly SVG line separator.
 * Replaces generic <View height={1}> dividers.
 */
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../lib/theme";

interface Props {
  width?: number;       // defaults to full width via onLayout
  strokeColor?: string;
  strokeWidth?: number;
  jitter?: number;      // vertical wobble amount in px
  style?: any;
}

function wavyLine(w: number, h: number, jitter: number): string {
  const mid = h / 2;
  const j = jitter;
  // Two control points create a subtle S-curve that looks hand-drawn
  return `M 0 ${mid + j * 0.4} Q ${w * 0.25} ${mid - j} ${w * 0.5} ${mid + j * 0.3} Q ${w * 0.75} ${mid + j} ${w} ${mid - j * 0.4}`;
}

export function HandDrawnDivider({ width = 320, strokeColor, strokeWidth = 1.2, jitter = 1.5, style }: Props) {
  const { c } = useTheme();
  const h = Math.max(jitter * 2 + 2, 8);

  return (
    <Svg width={width} height={h} style={[{ alignSelf: "stretch" }, style]} pointerEvents="none">
      <Path
        d={wavyLine(width, h, jitter)}
        stroke={strokeColor ?? c.border}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        opacity={0.35}
      />
    </Svg>
  );
}

// Full-width version using flex layout — auto-sizes to parent
export function FullWidthDivider({ strokeColor, strokeWidth = 1.2, jitter = 1, marginVertical = 0 }: {
  strokeColor?: string; strokeWidth?: number; jitter?: number; marginVertical?: number;
}) {
  const { c } = useTheme();
  const h = 8;
  // Use a simple deterministic path at 1000px — scales visually in flex context
  return (
    <Svg
      width="100%"
      height={h}
      viewBox={`0 0 320 ${h}`}
      preserveAspectRatio="none"
      style={{ marginVertical }}
      pointerEvents="none"
    >
      <Path
        d={wavyLine(320, h, jitter)}
        stroke={strokeColor ?? c.border}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        opacity={0.3}
      />
    </Svg>
  );
}
