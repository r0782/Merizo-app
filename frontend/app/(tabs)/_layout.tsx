import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View } from "react-native";
import { useTheme } from "../../src/lib/theme";

function GroupsIcon({ color, focused }: any) {
  return (
    <View testID="tab-groups">
      <Ionicons name={focused ? "albums" : "albums-outline"} color={color} size={22} />
    </View>
  );
}
function InsightsIcon({ color, focused }: any) {
  return (
    <View testID="tab-insights">
      <Ionicons name={focused ? "stats-chart" : "stats-chart-outline"} color={color} size={22} />
    </View>
  );
}
function ProfileIcon({ color, focused }: any) {
  return (
    <View testID="tab-profile">
      <Ionicons name={focused ? "person" : "person-outline"} color={color} size={22} />
    </View>
  );
}

export default function TabsLayout() {
  const { c, isDark } = useTheme();
  const activeColor = isDark ? c.indigo : "#0A0A0A";
  const inactiveColor = c.textSecondary;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 68,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Groups", tabBarIcon: GroupsIcon }} />
      <Tabs.Screen name="insights" options={{ title: "Insights", tabBarIcon: InsightsIcon }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ProfileIcon }} />
    </Tabs>
  );
}
