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
      if (Platform.OS === "ios" || Platform.OS === "android") {
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
