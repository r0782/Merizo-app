/**
 * SketchAvatar — hand-drawn AI assistant character.
 * A tiny doodle robot that lives in the financial notebook.
 * Features: blinking eyes, subtle antenna bob.
 */
import { useEffect } from "react";
import Svg, { Path, Circle, Ellipse, Rect, Line } from "react-native-svg";
import Animated2, {
  useSharedValue, withRepeat, withSequence, withTiming,
  useAnimatedProps, withDelay, Easing,
} from "react-native-reanimated";
import { useTheme } from "../../lib/theme";

const AnimatedEllipse = Animated2.createAnimatedComponent(Ellipse);

interface Props {
  size?: number;
  color?: string;
  speaking?: boolean;
}

export function SketchAIAvatar({ size = 40, color, speaking = false }: Props) {
  const { c } = useTheme();
  const ink = color ?? c.ink;

  // Blink animation — eyes close (radius shrinks to 0)
  const eyeL = useSharedValue(2.5);
  const eyeR = useSharedValue(2.5);
  // Antenna bob
  const antennaBob = useSharedValue(0);

  useEffect(() => {
    // Blink every 3 seconds
    const blink = () => {
      eyeL.value = withSequence(
        withTiming(0.2, { duration: 80 }),
        withTiming(2.5, { duration: 80 }),
      );
      eyeR.value = withSequence(
        withDelay(20, withTiming(0.2, { duration: 80 })),
        withTiming(2.5, { duration: 80 }),
      );
      setTimeout(blink, 3000 + Math.random() * 2000);
    };
    const t = setTimeout(blink, 1500);

    // Antenna subtle bob
    antennaBob.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0,  { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    return () => clearTimeout(t);
  }, []);

  const leftEyeProps = useAnimatedProps(() => ({ ry: eyeL.value }));
  const rightEyeProps = useAnimatedProps(() => ({ ry: eyeR.value }));

  // Speaking animation — mouth opens/closes
  const mouthOpen = useSharedValue(0);
  useEffect(() => {
    if (speaking) {
      mouthOpen.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 200 }),
          withTiming(0, { duration: 200 }),
        ),
        -1,
        true,
      );
    } else {
      mouthOpen.value = withTiming(0, { duration: 150 });
    }
  }, [speaking]);

  const scale = size / 40; // normalize to 40px

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {/* ── Body — slightly rounded rectangle ── */}
      <Rect x={9} y={17} width={22} height={18} rx={3}
        stroke={ink} strokeWidth={1.5} fill="none" />

      {/* ── Head ── */}
      <Rect x={11} y={8} width={18} height={14} rx={3}
        stroke={ink} strokeWidth={1.5} fill="none" />

      {/* ── Antenna ── */}
      <Line x1={20} y1={8} x2={20} y2={4} stroke={ink} strokeWidth={1.3} strokeLinecap="round" />
      <Circle cx={20} cy={3} r={1.5} stroke={ink} strokeWidth={1.2} fill="none" />

      {/* ── Eyes (animated blink) ── */}
      <AnimatedEllipse cx={15.5} cy={14} rx={2} stroke={ink} strokeWidth={1.2} fill="none"
        animatedProps={leftEyeProps} />
      <AnimatedEllipse cx={24.5} cy={14} rx={2} stroke={ink} strokeWidth={1.2} fill="none"
        animatedProps={rightEyeProps} />

      {/* ── Mouth — fixed gentle arc ── */}
      <Path d="M 16 19 Q 20 21 24 19" stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" />

      {/* ── Body details — tiny buttons ── */}
      <Circle cx={15} cy={26} r={1.5} stroke={ink} strokeWidth={1} fill="none" />
      <Circle cx={20} cy={26} r={1.5} stroke={ink} strokeWidth={1} fill="none" />
      <Circle cx={25} cy={26} r={1.5} stroke={ink} strokeWidth={1} fill="none" />

      {/* ── Arms ── */}
      <Path d="M 9 22 Q 5 24 4 28" stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Path d="M 31 22 Q 35 24 36 28" stroke={ink} strokeWidth={1.2} fill="none" strokeLinecap="round" />

      {/* ── Legs ── */}
      <Line x1={15} y1={35} x2={13} y2={39} stroke={ink} strokeWidth={1.2} strokeLinecap="round" />
      <Line x1={25} y1={35} x2={27} y2={39} stroke={ink} strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}

// ── Smaller inline version for chat bubbles ───────────────────────────────────
export function InlineAIBadge({ size = 28, color }: { size?: number; color?: string }) {
  const { c } = useTheme();
  const ink = color ?? c.ink;

  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Rect x={5} y={4} width={18} height={14} rx={3}
        stroke={ink} strokeWidth={1.5} fill="none" />
      <Line x1={14} y1={4} x2={14} y2={2} stroke={ink} strokeWidth={1.2} strokeLinecap="round" />
      <Circle cx={14} cy={1.5} r={1.2} stroke={ink} strokeWidth={1} fill="none" />
      <Circle cx={10} cy={10} r={1.5} stroke={ink} strokeWidth={1} fill="none" />
      <Circle cx={18} cy={10} r={1.5} stroke={ink} strokeWidth={1} fill="none" />
      <Path d="M 10 14 Q 14 16 18 14" stroke={ink} strokeWidth={1} fill="none" strokeLinecap="round" />
      <Rect x={7} y={18} width={14} height={8} rx={2}
        stroke={ink} strokeWidth={1.2} fill="none" />
      <Line x1={10} y1={22} x2={18} y2={22} stroke={ink} strokeWidth={1} strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}
