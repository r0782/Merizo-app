import { Alert, Platform } from "react-native";

/**
 * Cross-platform confirmation dialog. RN Web's Alert.alert does not honour
 * onPress for multi-button alerts, so we fall back to window.confirm() on web.
 *
 * Returns a Promise<boolean> — true if the user confirmed.
 */
export function confirmAction(
  title: string,
  message?: string,
  confirmLabel: string = "OK",
  destructive: boolean = false
): Promise<boolean> {
  if (Platform.OS === "web") {
    const text = message ? `${title}\n\n${message}` : title;
    // eslint-disable-next-line no-alert
    const ok = typeof window !== "undefined" && window.confirm(text);
    return Promise.resolve(!!ok);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
