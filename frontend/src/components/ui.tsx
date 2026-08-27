/**
 * Merizo UI — Design System Primitives
 * Phosphor Icons aesthetic: whitespace · monochrome · editorial · minimal
 */
import { useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, TextInput, ActivityIndicator,
  Animated, ViewStyle, TextStyle,
} from "react-native";
import { getDeviceLocale } from "../lib/currency";
import { useTheme } from "../lib/theme";
import { spacing, radius, type, shadow } from "../lib/tokens";

// ─────────────────────────────────────────────────────────────────────────────
// PressScale — spring micro-interaction wrapper for any touchable
// ─────────────────────────────────────────────────────────────────────────────
export function PressScale({
  children, onPress, scale: scaleTarget = 0.96,
  style, disabled, accessibilityLabel, accessibilityHint, accessibilityRole,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  scale?: number;
  style?: ViewStyle;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: scaleTarget, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,           useNativeDriver: true, speed: 40, bounciness: 5 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        activeOpacity={1}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityRole={accessibilityRole ?? "button"}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────────────────────────────────────
interface BtnProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Btn({
  label, onPress, variant = "primary", size = "md",
  loading = false, disabled = false, icon, fullWidth = true,
  accessibilityLabel, accessibilityHint,
}: BtnProps) {
  const { c } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 50, bounciness: 4 }).start();

  const pad = { sm: { v: 10, h: 16 }, md: { v: 14, h: 20 }, lg: { v: 17, h: 24 } }[size];
  const fs  = { sm: type.size.sm, md: type.size.base, lg: type.size.md }[size];

  const styles: Record<string, { bg: string; text: string; border?: string }> = {
    primary:   { bg: c.textPrimary,  text: c.bg },
    secondary: { bg: c.surface,      text: c.textPrimary, border: c.border },
    ghost:     { bg: "transparent",  text: c.textSecondary },
    danger:    { bg: c.negative,     text: "#fff" },
  };
  const s = styles[variant];

  return (
    <Animated.View style={{ transform: [{ scale }], alignSelf: fullWidth ? "stretch" : "center" }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        style={{
          backgroundColor: s.bg,
          borderRadius: radius.lg,
          paddingVertical: pad.v,
          paddingHorizontal: pad.h,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing["2"],
          borderWidth: s.border ? 1 : 0,
          borderColor: s.border,
          opacity: disabled ? 0.45 : 1,
        }}
      >
        {loading
          ? <ActivityIndicator size="small" color={s.text} />
          : <>
              {icon}
              <Text style={{ fontFamily: type.family.semibold, fontSize: fs, color: s.text, letterSpacing: type.tracking.tight }}>
                {label}
              </Text>
            </>
        }
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
}

export function Card({ children, style, onPress, padded = true, elevated = false }: CardProps) {
  const { c } = useTheme();
  const base: ViewStyle = {
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.border,
    ...(padded ? { padding: spacing["4"] } : {}),
    ...(elevated ? shadow.sm : {}),
  };

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[base, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────────────────────
interface InputProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  label?: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: any;
  multiline?: boolean;
  numberOfLines?: number;
  returnKeyType?: any;
  onSubmitEditing?: () => void;
  testID?: string;
  editable?: boolean;
  maxLength?: number;
}

export function Input({
  value, onChangeText, placeholder, label, hint, error,
  icon, suffix, secureTextEntry, keyboardType, autoCapitalize = "none",
  autoComplete, multiline, numberOfLines, returnKeyType, onSubmitEditing,
  testID, editable = true, maxLength,
}: InputProps) {
  const { c } = useTheme();

  return (
    <View style={{ gap: spacing["1"] }}>
      {label && (
        <Text style={{
          fontFamily: type.family.medium,
          fontSize: type.size.xs,
          color: c.textSecondary,
          letterSpacing: type.tracking.widest,
          textTransform: "uppercase",
        }}>
          {label}
        </Text>
      )}
      <View style={{
        flexDirection: "row", alignItems: "center",
        backgroundColor: c.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: error ? c.negative : c.border,
        paddingHorizontal: spacing["4"],
        gap: spacing["2"],
        minHeight: 52,
      }}>
        {icon && <View style={{ flexShrink: 0 }}>{icon}</View>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          multiline={multiline}
          numberOfLines={numberOfLines}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          testID={testID}
          editable={editable}
          maxLength={maxLength}
          style={{
            flex: 1,
            fontFamily: type.family.regular,
            fontSize: type.size.base,
            color: c.textPrimary,
            paddingVertical: spacing["3"],
          } as any}
        />
        {suffix && <View style={{ flexShrink: 0 }}>{suffix}</View>}
      </View>
      {error && (
        <Text style={{ fontFamily: type.family.regular, fontSize: type.size.xs, color: c.negative }}>
          {error}
        </Text>
      )}
      {hint && !error && (
        <Text style={{ fontFamily: type.family.regular, fontSize: type.size.xs, color: c.textMuted }}>
          {hint}
        </Text>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Label / Text primitives
// ─────────────────────────────────────────────────────────────────────────────
type WeightKey = keyof typeof type.family;

export function Label({
  children, size = "base", weight = "regular", color, style,
  numberOfLines, letterSpacing,
}: {
  children: React.ReactNode;
  size?: keyof typeof type.size;
  weight?: WeightKey;
  color?: string;
  style?: TextStyle;
  numberOfLines?: number;
  letterSpacing?: number;
}) {
  const { c } = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{
        fontFamily: type.family[weight],
        fontSize: type.size[size],
        color: color ?? c.textPrimary,
        letterSpacing: letterSpacing ?? 0,
      }, style]}
    >
      {children}
    </Text>
  );
}

export function Caption({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { c } = useTheme();
  return (
    <Text style={[{
      fontFamily: type.family.medium,
      fontSize: type.size.xs,
      color: c.textSecondary,
      letterSpacing: type.tracking.widest,
      textTransform: "uppercase",
    }, style]}>
      {children}
    </Text>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────
export function SectionHeader({
  title, action, actionLabel,
}: {
  title: string;
  action?: () => void;
  actionLabel?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing["3"] }}>
      <Caption>{title}</Caption>
      {action && actionLabel && (
        <TouchableOpacity onPress={action}>
          <Text style={{ fontFamily: type.family.medium, fontSize: type.size.sm, color: c.textSecondary }}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Divider
// ─────────────────────────────────────────────────────────────────────────────
export function Divider({ indent = 0 }: { indent?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ height: 1, backgroundColor: c.border, marginLeft: indent }} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row — settings / list item
// ─────────────────────────────────────────────────────────────────────────────
export function Row({
  icon, label, description, onPress, right, danger = false,
}: {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  const { c } = useTheme();
  const textColor = danger ? c.negative : c.textPrimary;

  const inner = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing["3"], paddingVertical: 14, paddingHorizontal: spacing["4"] }}>
      {icon && (
        <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: danger ? "rgba(214,69,69,0.08)" : c.surfaceAlt, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: type.family.medium, fontSize: type.size.base, color: textColor }}>{label}</Text>
        {description && (
          <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textSecondary, marginTop: 1 }}>{description}</Text>
        )}
      </View>
      {right ?? <ChevronIcon c={c} />}
    </View>
  );

  if (onPress) return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
      {inner}
    </TouchableOpacity>
  );
  return inner;
}

function ChevronIcon({ c }: { c: any }) {
  return (
    <View style={{ width: 16, height: 16, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 6, height: 6, borderRightWidth: 1.5, borderTopWidth: 1.5, borderColor: c.textMuted, transform: [{ rotate: "45deg" }] }} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────────────────────────────────────
export function Badge({ label, variant = "default" }: {
  label: string;
  variant?: "default" | "success" | "error" | "pro";
}) {
  const { c } = useTheme();
  const map = {
    default: { bg: c.surfaceAlt,    text: c.textSecondary },
    success: { bg: "rgba(31,138,80,0.1)", text: c.positive },
    error:   { bg: "rgba(214,69,69,0.1)", text: c.negative },
    pro:     { bg: c.textPrimary,   text: c.bg },
  };
  const s = map[variant];
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontFamily: type.family.bold, fontSize: 9, color: s.text, letterSpacing: type.tracking.widest, textTransform: "uppercase" }}>
        {label}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page header
// ─────────────────────────────────────────────────────────────────────────────
export function PageHeader({
  title, subtitle, right, onBack,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing["5"], marginBottom: spacing["5"] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing["3"], flex: 1 }}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" }}
          >
            <View style={{ width: 8, height: 8, borderLeftWidth: 1.5, borderTopWidth: 1.5, borderColor: c.textPrimary, transform: [{ rotate: "-45deg" }] }} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: type.family.bold, fontSize: type.size.xl, color: c.textPrimary, letterSpacing: type.tracking.tight }}>{title}</Text>
          {subtitle && (
            <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textSecondary, marginTop: 2 }}>{subtitle}</Text>
          )}
        </View>
      </View>
      {right}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────────────────────────────────────
export function Skeleton({ width, height, radius: r = 12, style }: {
  width?: number | string;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] });

  return (
    <Animated.View
      style={[{
        width: width as any ?? "100%",
        height,
        borderRadius: r,
        backgroundColor: c.surfaceAlt,
        opacity,
      }, style]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pill tab selector
// ─────────────────────────────────────────────────────────────────────────────
export function PillTabs<T extends string>({
  options, value, onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: c.surfaceAlt, borderRadius: radius.lg, padding: 3, borderWidth: 1, borderColor: c.border }}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.key}
          onPress={() => onChange(opt.key)}
          style={{ flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: radius.md, backgroundColor: value === opt.key ? c.surface : "transparent" }}
        >
          <Text style={{ fontFamily: value === opt.key ? type.family.semibold : type.family.regular, fontSize: type.size.sm, color: value === opt.key ? c.textPrimary : c.textSecondary }}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Amount display — editorial large number
// ─────────────────────────────────────────────────────────────────────────────
export function AmountDisplay({
  symbol, amount, color, size = "3xl",
}: {
  symbol: string;
  amount: number;
  color?: string;
  size?: keyof typeof type.size;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 2 }}>
      <Text style={{ fontFamily: type.family.medium, fontSize: type.size.md, color: color ?? c.textPrimary, marginTop: 6 }}>{symbol}</Text>
      <Text style={{ fontFamily: type.family.bold, fontSize: type.size[size], color: color ?? c.textPrimary, letterSpacing: type.tracking.tight }}>
        {Math.abs(amount).toLocaleString(getDeviceLocale())}
      </Text>
    </View>
  );
}
