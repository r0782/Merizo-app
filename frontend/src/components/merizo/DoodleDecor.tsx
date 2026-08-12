/**
 * DoodleDecor — small hand-drawn SVG decorations.
 * Used as contextual doodles on group cards, section headers, empty states.
 * All monochrome / ink-style.
 */
import Svg, { Path, Circle, Line, Rect, Ellipse } from "react-native-svg";
import { useTheme } from "../../lib/theme";

interface DoodleProps {
  size?: number;
  color?: string;
  opacity?: number;
}

// ── Small doodle icons (hand-drawn style SVG paths) ──────────────────────────

export function DoodleHouse({ size = 32, color, opacity = 0.6 }: DoodleProps) {
  const { c } = useTheme();
  const ink = color ?? c.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" pointerEvents="none">
      {/* Roof — slightly imperfect */}
      <Path d="M 4 16 Q 16 4 28 16" stroke={ink} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={opacity} />
      {/* Walls */}
      <Path d="M 7 16 L 7 27 L 25 27 L 25 16" stroke={ink} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
      {/* Door */}
      <Path d="M 13 27 L 13 21 Q 16 19 19 21 L 19 27" stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
    </Svg>
  );
}

export function DoodlePalmTree({ size = 32, color, opacity = 0.6 }: DoodleProps) {
  const { c } = useTheme();
  const ink = color ?? c.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" pointerEvents="none">
      {/* Trunk — slightly curved */}
      <Path d="M 16 28 Q 15 20 17 12" stroke={ink} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={opacity} />
      {/* Left frond */}
      <Path d="M 17 12 Q 8 8 6 4" stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={opacity} />
      {/* Right frond */}
      <Path d="M 17 12 Q 26 8 28 4" stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={opacity} />
      {/* Middle frond */}
      <Path d="M 17 12 Q 17 6 15 2" stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={opacity} />
    </Svg>
  );
}

export function DoodleGradCap({ size = 32, color, opacity = 0.6 }: DoodleProps) {
  const { c } = useTheme();
  const ink = color ?? c.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" pointerEvents="none">
      {/* Diamond top */}
      <Path d="M 4 14 L 16 8 L 28 14 L 16 20 Z" stroke={ink} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
      {/* Tassel */}
      <Path d="M 28 14 L 28 22" stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={opacity} />
      <Path d="M 25 22 L 31 22" stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={opacity} />
      {/* Board hanging */}
      <Path d="M 16 20 L 16 26 Q 10 28 8 24" stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={opacity} />
    </Svg>
  );
}

export function DoodlePlane({ size = 32, color, opacity = 0.6 }: DoodleProps) {
  const { c } = useTheme();
  const ink = color ?? c.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" pointerEvents="none">
      <Path d="M 2 18 L 22 10 L 26 14 L 12 20 Z" stroke={ink} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
      <Path d="M 8 16 L 6 26 L 14 20" stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
      <Path d="M 16 12 L 22 6 L 24 10" stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
    </Svg>
  );
}

export function DoodleFork({ size = 32, color, opacity = 0.6 }: DoodleProps) {
  const { c } = useTheme();
  const ink = color ?? c.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" pointerEvents="none">
      {/* Fork */}
      <Path d="M 10 4 L 10 14 Q 10 18 12 20 L 12 28" stroke={ink} strokeWidth={1.3} fill="none" strokeLinecap="round" opacity={opacity} />
      <Path d="M 8 4 L 8 10" stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={opacity} />
      <Path d="M 12 4 L 12 10" stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={opacity} />
      {/* Knife */}
      <Path d="M 20 4 Q 24 10 22 16 L 20 28" stroke={ink} strokeWidth={1.3} fill="none" strokeLinecap="round" opacity={opacity} />
    </Svg>
  );
}

export function DoodleShoppingBag({ size = 32, color, opacity = 0.6 }: DoodleProps) {
  const { c } = useTheme();
  const ink = color ?? c.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" pointerEvents="none">
      <Path d="M 6 12 L 4 28 L 28 28 L 26 12 Z" stroke={ink} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
      <Path d="M 11 12 Q 11 6 16 6 Q 21 6 21 12" stroke={ink} strokeWidth={1.3} fill="none" strokeLinecap="round" opacity={opacity} />
    </Svg>
  );
}

export function DoodleHeart({ size = 24, color, opacity = 0.5 }: DoodleProps) {
  const { c } = useTheme();
  const ink = color ?? c.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      <Path d="M 12 20 Q 4 14 4 8 Q 4 4 8 4 Q 10 4 12 7 Q 14 4 16 4 Q 20 4 20 8 Q 20 14 12 20 Z" stroke={ink} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
    </Svg>
  );
}

export function DoodleStar({ size = 24, color, opacity = 0.5 }: DoodleProps) {
  const { c } = useTheme();
  const ink = color ?? c.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      <Path d="M 12 3 L 14 9 L 21 9 L 15 13 L 17 20 L 12 16 L 7 20 L 9 13 L 3 9 L 10 9 Z" stroke={ink} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
    </Svg>
  );
}

// ── Notebook corner decoration ────────────────────────────────────────────────
export function NoteCorner({ size = 20, color, position = "tr" }: {
  size?: number; color?: string; position?: "tl" | "tr" | "bl" | "br";
}) {
  const { c } = useTheme();
  const ink = color ?? c.textMuted;
  const flip = {
    tl: { scaleX: 1,  scaleY: 1  },
    tr: { scaleX: -1, scaleY: 1  },
    bl: { scaleX: 1,  scaleY: -1 },
    br: { scaleX: -1, scaleY: -1 },
  }[position];
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" pointerEvents="none"
      style={{ transform: [{ scaleX: flip.scaleX }, { scaleY: flip.scaleY }] }}>
      <Path d="M 2 2 L 2 18" stroke={ink} strokeWidth={1} opacity={0.25} strokeLinecap="round" />
      <Path d="M 2 2 L 18 2" stroke={ink} strokeWidth={1} opacity={0.25} strokeLinecap="round" />
    </Svg>
  );
}

// ── Arrow doodle annotation ───────────────────────────────────────────────────
export function DoodleArrow({ size = 32, color, direction = "right", opacity = 0.5 }: {
  size?: number; color?: string; direction?: "right" | "down" | "left";  opacity?: number;
}) {
  const { c } = useTheme();
  const ink = color ?? c.textMuted;
  const paths: Record<string, string> = {
    right: "M 4 16 Q 12 14 24 16 M 20 12 L 26 16 L 20 20",
    down:  "M 16 4 Q 14 12 16 24 M 12 20 L 16 26 L 20 20",
    left:  "M 28 16 Q 20 14 8 16 M 12 12 L 6 16 L 12 20",
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" pointerEvents="none">
      <Path d={paths[direction]} stroke={ink} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
    </Svg>
  );
}

// Category → doodle map
export const categoryDoodle: Record<string, React.ComponentType<DoodleProps>> = {
  food:          DoodleFork,
  travel:        DoodlePlane,
  trip:          DoodlePalmTree,
  entertainment: DoodleStar,
  shopping:      DoodleShoppingBag,
  health:        DoodleHeart,
  accommodation: DoodleHouse,
  utilities:     DoodleHeart,
  other:         DoodleStar,
};
