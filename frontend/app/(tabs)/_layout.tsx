import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useTheme } from "../../src/lib/theme";

function GroupsIcon({ color, focused }: any) {
  return <Ionicons name={focused ? "albums" : "albums-outline"} color={color} size={22} />;
}
function InsightsIcon({ color, focused }: any) {
  return <Ionicons name={focused ? "stats-chart" : "stats-chart-outline"} color={color} size={22} />;
}
function ChatIcon({ color, focused }: any) {
  return <Ionicons name={focused ? "sparkles" : "sparkles-outline"} color={color} size={22} />;
}
function ChatIcon({ color, focused }: any) {
  return <Ionicons name={focused ? "sparkles" : "sparkles-outline"} color={color} size={22} />;
}
function ProfileIcon({ color, focused }: any) {
  return <Ionicons name={focused ? "person" : "person-outline"} color={color} size={22} />;
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
      <Tabs.Screen name="chat" options={{ title: "AI", tabBarIcon: ChatIcon }} />
      <Tabs.Screen name="chat" options={{ title: "AI Chat", tabBarIcon: ChatIcon }} />
      <Tabs.Screen name="insights" options={{ title: "Insights", tabBarIcon: InsightsIcon }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ProfileIcon }} />
    </Tabs>
  );
}
