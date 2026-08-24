/**
 * LedgerRow — a row that renders like a financial ledger entry.
 * "Dinner with friends ............... ₹840"
 *
 * The dots fill the space between label and amount like a real ledger.
 */
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../lib/theme";
import { type } from "../../lib/tokens";
import { getDeviceLocale } from "../../lib/currency";

interface LedgerRowProps {
  label:      string;
  sublabel?:  string;
  amount:     string;
  sign?:      "+" | "-" | "";   // prefix before amount
  onPress?:   () => void;
  dimmed?:    boolean;          // for settled/historical entries
  bold?:      boolean;          // for totals
  tag?:       string;           // small tag on left (category, time, etc.)
  annotation?: string;          // small handwriting-style note
  rightAnnotation?: string;     // e.g. "you paid"
}

export function LedgerRow({
  label, sublabel, amount, sign = "", onPress, dimmed = false,
  bold = false, tag, annotation, rightAnnotation,
}: LedgerRowProps) {
  const { c } = useTheme();

  const textOpacity    = dimmed ? 0.45 : 1;
  const labelFamily    = bold ? type.family.bold : type.family.medium;
  const amountFamily   = bold ? type.family.bold : type.family.semibold;
  const labelSize      = bold ? type.size.base : type.size.sm;

  const inner = (
    <View style={{ paddingVertical: 11, paddingHorizontal: 0 }}>
      {tag && (
        <Text style={{
          fontFamily: type.family.regular,
          fontSize: 10,
          color: c.textMuted,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 2,
          opacity: textOpacity,
        }}>
          {tag}
        </Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        {/* Label side */}
        <View style={{ flex: 1, minWidth: 0, marginRight: 4 }}>
          <Text
            style={{
              fontFamily: labelFamily,
              fontSize: labelSize,
              color: c.textPrimary,
              opacity: textOpacity,
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
          {sublabel && (
            <Text style={{
              fontFamily: type.family.regular,
              fontSize: 11,
              color: c.textMuted,
              marginTop: 1,
              opacity: textOpacity,
            }}>
              {sublabel}
            </Text>
          )}
          {annotation && (
            <Text style={{
              fontFamily: type.family.light,
              fontSize: 10,
              color: c.textMuted,
              marginTop: 1,
              fontStyle: "italic",
              opacity: 0.7,
            }}>
              ↳ {annotation}
            </Text>
          )}
        </View>

        {/* Ledger dots */}
        <DotFill />

        {/* Amount side */}
        <View style={{ alignItems: "flex-end", marginLeft: 4 }}>
          <Text style={{
            fontFamily: amountFamily,
            fontSize: labelSize,
            color: c.textPrimary,
            opacity: textOpacity,
            letterSpacing: -0.3,
          }}>
            {sign}{amount}
          </Text>
          {rightAnnotation && (
            <Text style={{
              fontFamily: type.family.regular,
              fontSize: 10,
              color: c.textMuted,
              marginTop: 1,
              fontStyle: "italic",
              opacity: 0.65,
            }}>
              {rightAnnotation}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

// The dotted fill — renders "..............." between label and amount
function DotFill() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 0, flexShrink: 0 }}>
      <Text style={{
        fontFamily: type.family.light,
        fontSize: 11,
        color: c.textMuted,
        letterSpacing: 2,
        opacity: 0.4,
        lineHeight: 18,
      }}>
        {"· · · · · · · · ·"}
      </Text>
    </View>
  );
}

// ── Section group: wraps a set of LedgerRows with a heading ──────────────────
export function LedgerSection({
  title, children, style,
}: {
  title?: string;
  children: React.ReactNode;
  style?: any;
}) {
  const { c } = useTheme();
  return (
    <View style={[{ paddingHorizontal: 20 }, style]}>
      {title && (
        <Text style={{
          fontFamily: type.family.medium,
          fontSize: 10,
          color: c.textMuted,
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 4,
          paddingBottom: 6,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

// ── Balance row — for "YOU OWE / YOU ARE OWED" display ───────────────────────
export function BalanceSplit({
  leftLabel, leftAmount,
  rightLabel, rightAmount,
  sym = "₹",
}: {
  leftLabel: string; leftAmount: number;
  rightLabel: string; rightAmount: number;
  sym?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 0 }}>
      {/* Left */}
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>
          {leftLabel}
        </Text>
        <Text style={{ fontFamily: type.family.bold, fontSize: type.size.xl, color: c.textPrimary, letterSpacing: -1 }}>
          -{sym}{Math.abs(leftAmount).toLocaleString(getDeviceLocale())}
        </Text>
      </View>
      {/* Vertical separator */}
      <View style={{ width: 1, backgroundColor: c.border, opacity: 0.2, marginVertical: 4 }} />
      {/* Right */}
      <View style={{ flex: 1, paddingLeft: 12 }}>
        <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>
          {rightLabel}
        </Text>
        <Text style={{ fontFamily: type.family.bold, fontSize: type.size.xl, color: c.textPrimary, letterSpacing: -1 }}>
          +{sym}{Math.abs(rightAmount).toLocaleString(getDeviceLocale())}
        </Text>
      </View>
    </View>
  );
}
