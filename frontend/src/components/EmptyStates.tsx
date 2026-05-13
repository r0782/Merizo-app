import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";

export function EmptyState({
  icon,
  title,
  description,
  actionText = "Get Started",
  onAction,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const { c, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]} testID={testID}>
      <View style={styles.content}>
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor: isDark ? "rgba(129, 140, 248, 0.1)" : "rgba(79, 70, 229, 0.08)",
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={48}
            color={isDark ? c.indigo : "#4F46E5"}
            testID={`${testID}-icon`}
          />
        </View>

        <Text style={[styles.title, { color: c.textPrimary, fontFamily: "Syne_700Bold" }]} testID={`${testID}-title`}>
  {title}
</Text>

        <Text style={[styles.description, { color: c.textSecondary }]} testID={`${testID}-desc`}>
          {description}
        </Text>
      </View>

      {onAction && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: isDark ? c.indigo : "#4F46E5" }]}
          onPress={onAction}
          testID={`${testID}-action`}
        >
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.buttonText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function SkeletonCard({
  testID,
}: {
  testID?: string;
}) {
  const { c, isDark } = useTheme();
  const bgColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  return (
    <View
      style={[
        styles.skeletonCard,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
        },
      ]}
      testID={testID}
    >
      <View style={styles.skeletonCardHeader}>
        <View
          style={[
            styles.skeletonAvatar,
            { backgroundColor: bgColor },
          ]}
        />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={[styles.skeletonText, { width: "70%", backgroundColor: bgColor }]} />
          <View style={[styles.skeletonText, { width: "50%", backgroundColor: bgColor }]} />
        </View>
      </View>

      <View style={[styles.skeletonAmount, { backgroundColor: bgColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
    minHeight: 400,
  },
  content: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
    fontFamily: "Syne_800ExtraBold",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 280,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    width: "100%",
    maxWidth: 280,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  skeletonCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  skeletonCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  skeletonText: {
    height: 10,
    borderRadius: 5,
  },
  skeletonAmount: {
    height: 20,
    borderRadius: 10,
    width: "100%",
  },
});

export default {
  EmptyState,
  SkeletonCard,
};