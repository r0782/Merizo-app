import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Polygon, Line, Circle } from "react-native-svg";
import { useTheme } from "../lib/theme";
import { SmartNum } from "./DotNum";
import { getOverbudgetAlerts } from "../lib/settings";

export function SmartLimitWidget({
  percent = 74,
  spent,
  budget,
  currency = "INR",
  hasHistory = true,
  testID,
}: {
  percent?: number;
  spent?: number;
  budget?: number;
  currency?: string;
  hasHistory?: boolean;
  testID?: string;
}) {
  const { c, isDark } = useTheme();
  const [alertsOn, setAlertsOn] = useState(true);

  useEffect(() => {
    let mounted = true;
    getOverbudgetAlerts().then((v) => {
      if (mounted) setAlertsOn(v);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const display = Math.max(0, Math.min(150, Math.round(percent)));
  const left = Math.max(0, display - 1);
  const right = Math.min(149, display + 1);
  const pctClamped = Math.min(100, display);
  const overBudget = display > 100 && alertsOn;

  return (
    <View
      testID={testID}
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={styles.header}>
        <Text style={[styles.label, { color: c.textSecondary }]}>Smart Limit</Text>
        <Text style={[styles.subLabel, { color: c.textMuted }]}>{hasHistory ? "Weekly" : "AI Default"}</Text>
      </View>

      <View style={styles.center}>
        <View style={styles.percRow}>
          <Text style={{ fontFamily: "RobotoMono_700Bold", fontSize: 13, color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)", fontVariant: ["tabular-nums"] as any }}>{String(left)}</Text>
          <View style={{ width: 8 }} />
          <SmartNum value={`${display}%`} size="lg" color={overBudget ? "red" : "indigo"} />
          <View style={{ width: 8 }} />
          <Text style={{ fontFamily: "RobotoMono_700Bold", fontSize: 13, color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)", fontVariant: ["tabular-nums"] as any }}>{String(right)}</Text>
        </View>
      </View>

      <View style={{ marginTop: 14 }}>
        <ProgressBar
          percent={pctClamped}
          isDark={isDark}
          accent={overBudget ? c.negative : c.indigo}
          muted={isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.18)"}
        />
        <View style={styles.range}>
          <Text style={[styles.rangeTxt, { color: c.textMuted }]}>Min</Text>
          <Text style={[styles.rangeTxt, { color: c.textMuted }]}>Max</Text>
        </View>
      </View>
    </View>
  );
}

function ProgressBar({ percent, isDark, accent, muted }: { percent: number; isDark: boolean; accent: string; muted: string }) {
  const TRACK_W = 140;
  const filled = (percent / 100) * TRACK_W;
  const remaining = TRACK_W - filled;

  // dotted track segments
  const dotSize = 1.4;
  const dotGap = 4;
  const dotCount = Math.floor(remaining / dotGap);

  return (
    <View style={{ height: 22, justifyContent: "center" }}>
      <Svg width="100%" height="22" viewBox={`0 0 ${TRACK_W} 22`}>
        {/* Solid filled segment */}
        <Line x1={0} y1={11} x2={filled} y2={11} stroke={accent} strokeWidth={2.2} strokeLinecap="round" />
        {/* Dotted remaining */}
        {Array.from({ length: dotCount }).map((_, i) => (
          <Circle key={i} cx={filled + i * dotGap + dotGap / 2} cy={11} r={dotSize / 2} fill={muted} />
        ))}
        {/* Triangle pointer */}
        <Polygon
          points={`${filled - 4},${4} ${filled + 4},${4} ${filled},${10}`}
          fill={accent}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    minHeight: 150,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  subLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  center: { alignItems: "center", marginTop: 6 },
  percRow: { flexDirection: "row", alignItems: "center" },
  range: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  rangeTxt: { fontSize: 9, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
});