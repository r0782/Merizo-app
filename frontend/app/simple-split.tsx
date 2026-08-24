/**
 * Quick Split — landing page in B&W notebook style.
 * Routes to the app's AI chat, scan, or voice features.
 */
import { useEffect, useState } from "react";
import { Platform, View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import { useTheme } from "../src/lib/theme";
import { currencySymbol, type } from "../src/lib/tokens";
import { ROUTES } from "../src/lib/routes";
import { getDefaultCurrency } from "../src/lib/currency";

function IcoBack({ color, size = 18 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M5 12L12 19M5 12L12 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}
function IcoWrite({ color, size = 22 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}
function IcoCamera({ color, size = 22 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/><Circle cx="12" cy="13" r="4" stroke={color} strokeWidth={1.8}/></Svg>;
}
function IcoMic({ color, size = 22 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke={color} strokeWidth={1.8} strokeLinecap="round"/><Path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke={color} strokeWidth={1.8} strokeLinecap="round"/></Svg>;
}
function IcoChevron({ color, size = 16 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}

function examplesFor(sym: string) {
  return [
    `Hotel ${sym}6000 split 4 ways`,
    `Birthday dinner ${sym}4200 for 6 people`,
    `Cab ${sym}850 split with Ramu and Priya`,
  ];
}

export default function SimpleSplit() {
  const { c } = useTheme();
  const router = useRouter();
  const [sym, setSym] = useState(currencySymbol("INR"));

  useEffect(() => {
    getDefaultCurrency().then((cur) => setSym(currencySymbol(cur))).catch(() => {});
  }, []);

  const examples = examplesFor(sym);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 40, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginHorizontal: 20, marginBottom: 28, width: 36, height: 36, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}
        >
          <IcoBack color={c.textPrimary} size={16} />
        </TouchableOpacity>

        {/* Header */}
        <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
          <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 6 }}>
            Quick Split
          </Text>
          <Text style={{ fontFamily: type.family.bold, fontSize: 30, color: c.textPrimary, letterSpacing: -1, lineHeight: 36 }}>
            Add an expense
          </Text>
          <Text style={{ fontFamily: type.family.regular, fontSize: 13, color: c.textMuted, marginTop: 6, lineHeight: 20 }}>
            Describe your expense, scan a receipt, or speak it — no calculators needed.
          </Text>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: c.border, opacity: 0.25, marginHorizontal: 20, marginBottom: 24 }} />

        {/* Example hints */}
        <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
          <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
            Try saying
          </Text>
          {examples.map((ex, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => router.push(ROUTES.CHAT)}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 11, borderTopWidth: i === 0 ? 1 : 0, borderBottomWidth: 1, borderColor: `${c.border}40` }}
            >
              <Text style={{ fontFamily: type.family.light, fontSize: 12, color: c.textMuted, marginRight: 8 }}>→</Text>
              <Text style={{ fontFamily: type.family.regular, fontSize: 13, color: c.textSecondary, flex: 1 }}>{ex}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Action rows */}
        <View style={{ paddingHorizontal: 20, gap: 0, borderTopWidth: 1, borderColor: c.border, opacity: 1 }}>

          {/* Type expense — primary, inverted */}
          <TouchableOpacity
            onPress={() => router.push(ROUTES.CHAT)}
            style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 18, paddingHorizontal: 16, backgroundColor: c.textPrimary, marginBottom: 10 }}
          >
            <View style={{ width: 38, height: 38, borderWidth: 1, borderColor: `${c.bg}30`, alignItems: "center", justifyContent: "center" }}>
              <IcoWrite color={c.bg} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: type.family.bold, fontSize: 15, color: c.bg }}>Type an expense</Text>
              <Text style={{ fontFamily: type.family.regular, fontSize: 12, color: `${c.bg}80`, marginTop: 2 }}>
                Natural language · AI parses instantly
              </Text>
            </View>
            <IcoChevron color={`${c.bg}60`} size={16} />
          </TouchableOpacity>

          {/* Scan receipt */}
          <TouchableOpacity
            onPress={() => router.push(ROUTES.SCAN)}
            style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 18, paddingHorizontal: 16, borderWidth: 1, borderColor: c.border, marginBottom: 10 }}
          >
            <View style={{ width: 38, height: 38, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
              <IcoCamera color={c.textPrimary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: type.family.bold, fontSize: 15, color: c.textPrimary }}>Scan Receipt</Text>
              <Text style={{ fontFamily: type.family.regular, fontSize: 12, color: c.textMuted, marginTop: 2 }}>
                Camera · AI reads and splits by items
              </Text>
            </View>
            <IcoChevron color={c.textMuted} size={16} />
          </TouchableOpacity>

          {/* Say it */}
          <TouchableOpacity
            onPress={() => router.push(ROUTES.SCAN)}
            style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 18, paddingHorizontal: 16, borderWidth: 1, borderColor: c.border }}
          >
            <View style={{ width: 38, height: 38, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
              <IcoMic color={c.textPrimary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: type.family.bold, fontSize: 15, color: c.textPrimary }}>Say it</Text>
              <Text style={{ fontFamily: type.family.regular, fontSize: 12, color: c.textMuted, marginTop: 2 }}>
                Speak the expense aloud · voice-to-split
              </Text>
            </View>
            <IcoChevron color={c.textMuted} size={16} />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted, letterSpacing: 1.5, textAlign: "center", opacity: 0.5, textTransform: "uppercase", marginTop: 28 }}>
          Merizo · Powered by AI
        </Text>
      </ScrollView>
    </View>
  );
}
