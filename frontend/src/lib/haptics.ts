// frontend/src/lib/haptics.ts

import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Haptic feedback utility functions
 * Usage: haptics.success() / haptics.warning() / haptics.error()
 */

export const haptics = {
  /**
   * Light tap - used for general interactions
   */
  light: async () => {
    try {
      if (Platform.OS === "ios") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Light);
      } else if (Platform.OS === "android") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn("Haptics light failed:", e);
    }
  },

  /**
   * Medium tap - used for confirmations
   */
  medium: async () => {
    try {
      if (Platform.OS === "ios") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (Platform.OS === "android") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (e) {
      console.warn("Haptics medium failed:", e);
    }
  },

  /**
   * Heavy tap - used for warnings/errors
   */
  heavy: async () => {
    try {
      if (Platform.OS === "ios") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (Platform.OS === "android") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch (e) {
      console.warn("Haptics heavy failed:", e);
    }
  },

  /**
   * Success feedback
   */
  success: async () => {
    try {
      if (Platform.OS === "ios") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (e) {
      console.warn("Haptics success failed:", e);
    }
  },

  /**
   * Warning feedback
   */
  warning: async () => {
    try {
      if (Platform.OS === "ios") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch (e) {
      console.warn("Haptics warning failed:", e);
    }
  },

  /**
   * Error feedback
   */
  error: async () => {
    try {
      if (Platform.OS === "ios") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch (e) {
      console.warn("Haptics error failed:", e);
    }
  },

  /**
   * Selection feedback
   */
  selection: async () => {
    try {
      await Haptics.selectionAsync();
    } catch (e) {
      console.warn("Haptics selection failed:", e);
    }
  },
};

export default haptics;

// ============================================
// Animated Button Component
// frontend/src/components/AnimatedButton.tsx
// ============================================

import React, { useRef, useState } from "react";
import {
  TouchableOpacity,
  StyleSheet,
  Animated,
  ViewStyle,
  TextStyle,
} from "react-native";
import { haptics } from "../lib/haptics";

interface AnimatedButtonProps {
  onPress: () => void | Promise<void>;
  children: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  hapticFeedback?: "light" | "medium" | "heavy" | "success" | "error" | "none";
  testID?: string;
}

export function AnimatedButton({
  onPress,
  children,
  style,
  textStyle,
  disabled = false,
  hapticFeedback = "light",
  testID,
}: AnimatedButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (disabled || loading) return;

    // Scale animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Haptic feedback
    if (hapticFeedback !== "none") {
      await haptics[hapticFeedback]();
    }

    // Execute callback
    setLoading(true);
    try {
      await Promise.resolve(onPress());
    } catch (e) {
      console.error("Button press error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Animated.View
      style={[{ transform: [{ scale: scaleAnim }] }]}
      testID={testID}
    >
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={1}
        style={style}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================
// Swipe to Delete Component
// frontend/src/components/SwipeToDelete.tsx
// ============================================

import React, { useRef } from "react";
import {
  View,
  Text,
  Animated,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import { haptics } from "../lib/haptics";

interface SwipeToDeleteProps {
  onDelete: () => void | Promise<void>;
  children: React.ReactNode;
  testID?: string;
}

export function SwipeToDelete({
  onDelete,
  children,
  testID,
}: SwipeToDeleteProps) {
  const { c, isDark } = useTheme();
  const pan = useRef(new Animated.ValueXY()).current;
  const [isDeleting, setIsDeleting] = React.useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dx }) => Math.abs(dx) > 10,
      onPanResponderMove: (_, { dx }) => {
        if (dx < 0) {
          pan.x.setValue(Math.max(dx, -100));
        }
      },
      onPanResponderRelease: (_, { dx }) => {
        if (dx < -50) {
          // Swipe threshold
          Animated.spring(pan, {
            toValue: { x: -100, y: 0 },
            useNativeDriver: false,
          }).start();
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const handleDelete = async () => {
    setIsDeleting(true);
    await haptics.warning();
    await onDelete();
    setIsDeleting(false);
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  };

  return (
    <View style={styles.container} testID={testID}>
      {/* Delete background */}
      <View
        style={[
          styles.deleteBackground,
          { backgroundColor: "#EF4444" },
        ]}
      >
        <TouchableOpacity
          onPress={handleDelete}
          disabled={isDeleting}
          style={styles.deleteButton}
        >
          <Ionicons name="trash" size={24} color="#fff" />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable content */}
      <Animated.View
        style={[
          styles.content,
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            transform: [{ translateX: pan.x }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 8,
    marginBottom: 8,
  },
  deleteBackground: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 100,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  deleteButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    gap: 4,
  },
  deleteText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 2,
  },
});

// ============================================
// Toast Notification Component
// frontend/src/components/Toast.tsx
// ============================================

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, Text } from "react-native";
import { useTheme } from "../lib/theme";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  visible?: boolean;
  onHide?: () => void;
}

export function Toast({
  message,
  type = "info",
  duration = 3000,
  visible = true,
  onHide,
}: ToastProps) {
  const { c, isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const colors: Record<ToastType, { bg: string; text: string; icon: string }> = {
    success: {
      bg: isDark ? "rgba(16, 185, 129, 0.9)" : "#10B981",
      text: "#fff",
      icon: "✓",
    },
    error: {
      bg: isDark ? "rgba(239, 68, 68, 0.9)" : "#EF4444",
      text: "#fff",
      icon: "✕",
    },
    warning: {
      bg: isDark ? "rgba(245, 158, 11, 0.9)" : "#F59E0B",
      text: "#fff",
      icon: "⚠",
    },
    info: {
      bg: isDark ? "rgba(79, 70, 229, 0.9)" : "#4F46E5",
      text: "#fff",
      icon: "ℹ",
    },
  };

  const color = colors[type];

  useEffect(() => {
    if (!visible) {
      fadeAnim.setValue(0);
      return;
    }

    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(duration),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide?.();
    });
  }, [visible, duration, fadeAnim, onHide]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-50, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.toast, { backgroundColor: color.bg }]}>
        <Text style={[styles.icon, { color: color.text }]}>{color.icon}</Text>
        <Text style={[styles.message, { color: color.text }]}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 32,
    left: 20,
    right: 20,
    zIndex: 999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 12,
  },
  icon: {
    fontSize: 18,
    fontWeight: "600",
  },
  message: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
});

// ============================================
// Usage Examples
// ============================================

/*
// In your component:
import { AnimatedButton } from "../src/components/AnimatedButton";
import { SwipeToDelete } from "../src/components/SwipeToDelete";
import { haptics } from "../src/lib/haptics";

function MyScreen() {
  const handleAddExpense = async () => {
    await haptics.success();
    // Add expense logic
  };

  const handleDelete = async () => {
    await haptics.error();
    // Delete logic
  };

  return (
    <View>
      {/* Animated Button with haptic feedback */}
      <AnimatedButton
        onPress={handleAddExpense}
        hapticFeedback="success"
      >
        <Text>Add Expense</Text>
      </AnimatedButton>

      {/* Swipe to delete */}
      <SwipeToDelete onDelete={handleDelete}>
        <Text>Swipe to delete this expense</Text>
      </SwipeToDelete>
    </View>
  );
}
*/
