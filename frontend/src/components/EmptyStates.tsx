import { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, Easing } from "react-native";
import {
  UsersThreeIcon, ReceiptIcon, CheckCircleIcon, ChartBarIcon,
  MagnifyingGlassIcon, WifiSlashIcon, PlusIcon, CameraIcon,
  CalculatorIcon, ArrowClockwiseIcon,
} from "phosphor-react-native";
import { useTheme } from "../lib/theme";
import { spacing, radius, type } from "../lib/tokens";

interface EmptyProps {
  onPrimary?:   () => void;
  onSecondary?: () => void;
}

// ── Hand-drawn style floating orb ─────────────────────────────────────────────
function FloatingOrb({ size = 80, icon }: { size?: number; icon?: React.ReactNode }) {
  const { c } = useTheme();
  const float = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(float, { toValue: -10, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0,   duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.04, duration: 2400, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1,    duration: 2400, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        transform: [{ translateY: float }, { scale }],
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: c.surfaceAlt,
        borderWidth: 1.5, borderColor: c.border,
        alignItems: "center", justifyContent: "center",
        marginBottom: spacing["6"],
        // subtle drop shadow
        shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
      }}
      accessibilityElementsHidden
    >
      {icon}
    </Animated.View>
  );
}

// ── Primary action button ─────────────────────────────────────────────────────
function PrimaryBtn({ label, icon, onPress, c }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }], alignSelf: "center" }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 5 }).start()}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          backgroundColor: c.textPrimary, borderRadius: radius.lg,
          paddingVertical: 14, paddingHorizontal: 28,
          flexDirection: "row", alignItems: "center", gap: 8,
        }}
      >
        {icon}
        <Text style={{ fontFamily: type.family.semibold, fontSize: type.size.base, color: c.bg }}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function SecondaryBtn({ label, icon, onPress, c }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}
    >
      {icon}
      <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textSecondary }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Empty States ───────────────────────────────────────────────────────────────

export function EmptyGroups({ onPrimary, onSecondary }: EmptyProps) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 24 }}>
      <FloatingOrb size={88} icon={<UsersThreeIcon size={36} color={c.textMuted} weight="thin" />} />
      <Text style={{ fontFamily: type.family.bold, fontSize: type.size.xl, color: c.textPrimary, textAlign: "center", marginBottom: 10, letterSpacing: type.tracking.tight }}>
        No groups yet
      </Text>
      <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 28 }}>
        Create a group for trips, roommates, or dinner — and we'll handle all the math.
      </Text>
      <PrimaryBtn
        label="Create a Group" c={c}
        onPress={onPrimary}
        icon={<PlusIcon size={18} color={c.bg} weight="bold" />}
      />
      {onSecondary && (
        <View style={{ marginTop: 12 }}>
          <SecondaryBtn
            label="or try Quick Split — no group needed" c={c}
            onPress={onSecondary}
            icon={<CalculatorIcon size={14} color={c.textMuted} />}
          />
        </View>
      )}
    </View>
  );
}

export function EmptyExpenses({ onPrimary, onSecondary }: EmptyProps) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 32 }}>
      <FloatingOrb size={88} icon={<ReceiptIcon size={36} color={c.textMuted} weight="thin" />} />
      <Text style={{ fontFamily: type.family.bold, fontSize: type.size.xl, color: c.textPrimary, textAlign: "center", marginBottom: 10, letterSpacing: type.tracking.tight }}>
        No expenses yet
      </Text>
      <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 28 }}>
        Add your first expense or scan a receipt — we'll extract the details automatically.
      </Text>
      <PrimaryBtn
        label="Add Expense" c={c}
        onPress={onPrimary}
        icon={<PlusIcon size={18} color={c.bg} weight="bold" />}
      />
      {onSecondary && (
        <View style={{ marginTop: 12 }}>
          <SecondaryBtn
            label="Scan a receipt instead" c={c}
            onPress={onSecondary}
            icon={<CameraIcon size={15} color={c.textMuted} />}
          />
        </View>
      )}
    </View>
  );
}

export function EmptySettled() {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 32 }}>
      <FloatingOrb size={80} icon={<CheckCircleIcon size={34} color={c.positive} weight="thin" />} />
      <Text style={{ fontFamily: type.family.bold, fontSize: type.size.xl, color: c.positive, textAlign: "center", marginBottom: 10, letterSpacing: type.tracking.tight }}>
        All settled!
      </Text>
      <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textSecondary, textAlign: "center", lineHeight: 22 }}>
        Everyone in this group is square. No pending payments.
      </Text>
    </View>
  );
}

export function EmptyInsights({ onPrimary }: EmptyProps) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 32 }}>
      <FloatingOrb size={88} icon={<ChartBarIcon size={36} color={c.textMuted} weight="thin" />} />
      <Text style={{ fontFamily: type.family.bold, fontSize: type.size.xl, color: c.textPrimary, textAlign: "center", marginBottom: 10, letterSpacing: type.tracking.tight }}>
        No insights yet
      </Text>
      <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 28 }}>
        Start adding expenses and we'll show you spending patterns, category breakdowns, and smart suggestions.
      </Text>
      <PrimaryBtn
        label="Add your first expense" c={c}
        onPress={onPrimary}
        icon={<PlusIcon size={18} color={c.bg} weight="bold" />}
      />
    </View>
  );
}

export function EmptySearch({ query }: { query: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 32 }}>
      <FloatingOrb size={80} icon={<MagnifyingGlassIcon size={32} color={c.textMuted} weight="thin" />} />
      <Text style={{ fontFamily: type.family.bold, fontSize: type.size.md, color: c.textPrimary, textAlign: "center", marginBottom: 8, letterSpacing: type.tracking.tight }}>
        Nothing found for "{query}"
      </Text>
      <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textSecondary, textAlign: "center", lineHeight: 22 }}>
        Try a different search term or check the spelling.
      </Text>
    </View>
  );
}

export function EmptyNetworkError({ onRetry }: { onRetry?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 32 }}>
      <FloatingOrb size={80} icon={<WifiSlashIcon size={32} color={c.textMuted} weight="thin" />} />
      <Text style={{ fontFamily: type.family.bold, fontSize: type.size.md, color: c.textPrimary, textAlign: "center", marginBottom: 8, letterSpacing: type.tracking.tight }}>
        Can't connect right now
      </Text>
      <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 24 }}>
        Check your internet connection and try again.
      </Text>
      {onRetry && (
        <PrimaryBtn
          label="Try again" c={c}
          onPress={onRetry}
          icon={<ArrowClockwiseIcon size={16} color={c.bg} weight="bold" />}
        />
      )}
    </View>
  );
}

// ── Generic error state ────────────────────────────────────────────────────────
export function EmptyError({ message = "Something went wrong", onRetry }: { message?: string; onRetry?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 32 }}>
      <FloatingOrb size={80} icon={<WifiSlashIcon size={32} color={c.negative} weight="thin" />} />
      <Text style={{ fontFamily: type.family.bold, fontSize: type.size.md, color: c.textPrimary, textAlign: "center", marginBottom: 8, letterSpacing: type.tracking.tight }}>
        {message}
      </Text>
      {onRetry && (
        <View style={{ marginTop: 16 }}>
          <PrimaryBtn
            label="Retry" c={c}
            onPress={onRetry}
            icon={<ArrowClockwiseIcon size={16} color={c.bg} weight="bold" />}
          />
        </View>
      )}
    </View>
  );
}
