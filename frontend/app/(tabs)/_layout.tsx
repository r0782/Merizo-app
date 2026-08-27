import { View, Text, TouchableOpacity } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { useTheme } from "../../src/lib/theme";
import { type } from "../../src/lib/tokens";

// ── Hand-drawn nav icons ──────────────────────────────────────────────────────
function NavHome({ active, color }: { active: boolean; color: string }) {
  const w = active ? 1.8 : 1.3;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M 3 12 L 12 4 L 21 12" stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M 5 10 L 5 20 L 10 20 L 10 15 L 14 15 L 14 20 L 19 20 L 19 10" stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function NavActivity({ active, color }: { active: boolean; color: string }) {
  const w = active ? 1.8 : 1.3;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M 4 6 L 12 6" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Path d="M 4 12 L 20 12" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Path d="M 4 18 L 16 18" stroke={color} strokeWidth={w} strokeLinecap="round" />
    </Svg>
  );
}

function NavChat({ active, color }: { active: boolean; color: string }) {
  const w = active ? 1.8 : 1.3;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M 4 5 Q 4 3 6 3 L 18 3 Q 20 3 20 5 L 20 14 Q 20 16 18 16 L 9 16 L 4 20 L 4 5 Z" stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={8} y1={8} x2={16} y2={8} stroke={color} strokeWidth={1} strokeLinecap="round" opacity={0.5} />
      <Line x1={8} y1={11} x2={14} y2={11} stroke={color} strokeWidth={1} strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}

function NavInsights({ active, color }: { active: boolean; color: string }) {
  const w = active ? 1.8 : 1.3;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M 3 20 L 21 20" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Path d="M 6 20 L 6 13" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Path d="M 10 20 L 10 9" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Path d="M 14 20 L 14 14" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Path d="M 18 20 L 18 6" stroke={color} strokeWidth={w} strokeLinecap="round" />
    </Svg>
  );
}

function NavProfile({ active, color }: { active: boolean; color: string }) {
  const w = active ? 1.8 : 1.3;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={w} fill="none" />
      <Path d="M 4 20 Q 4 15 12 15 Q 20 15 20 20" stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

// ── Tab press target — plain opacity feedback, no Android ripple ──────────────
// The default tab bar button uses Android's ripple, which isn't clipped to the
// tab bar's own bounds and visibly spills across the top border line on tap.
// Every other pressable in this app already uses TouchableOpacity instead of a
// ripple, so this just makes the tab bar consistent with that and removes the
// bleed at the same time.
function TabBarButton({ children, style, onPress, ...rest }: any) {
  return (
    <TouchableOpacity {...rest} onPress={onPress} activeOpacity={0.6} style={style}>
      {children}
    </TouchableOpacity>
  );
}

// ── Tab item with hand-drawn underline when active ────────────────────────────
function TabIcon({
  Icon, focused, color, label,
}: {
  Icon: React.ComponentType<{ active: boolean; color: string }>;
  focused: boolean;
  color: string;
  label: string;
}) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 6 }}>
      <Icon active={focused} color={color} />
      <Text style={{
        fontFamily: focused ? type.family.semibold : type.family.regular,
        fontSize: 9,
        color,
        letterSpacing: 0.5,
        textTransform: "uppercase",
      }}>
        {label}
      </Text>
      {/* Hand-drawn underline for active tab */}
      {focused && (
        <Svg width={20} height={4} viewBox="0 0 20 4">
          <Path
            d="M 1 3 Q 5 1 10 2.5 Q 15 4 19 2"
            stroke={color}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  const tabBarBg     = c.bg;
  const activeColor  = c.textPrimary;
  const inactiveColor = c.textMuted;

  // Hardcoded platform paddings (ios:26/android:8) guessed at the system
  // gesture-bar height instead of reading it — on Android especially this
  // varies by device, and edge-to-edge rendering leaves whatever gap is left
  // uncovered by the tab bar showing through as unstyled native chrome
  // rather than the app's theme. Real insets close that gap on every device.
  const tabBarPaddingBottom = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarButton: (props) => <TabBarButton {...props} />,
        tabBarStyle: {
          backgroundColor: tabBarBg,
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: 56 + tabBarPaddingBottom,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={NavHome} focused={focused} color={color} label="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={NavActivity} focused={focused} color={color} label="Activity" />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={NavChat} focused={focused} color={color} label="AI" />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={NavInsights} focused={focused} color={color} label="Stats" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={NavProfile} focused={focused} color={color} label="Profile" />
          ),
        }}
      />
    </Tabs>
  );
}
