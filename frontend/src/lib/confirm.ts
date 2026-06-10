import { Alert, Platform } from "react-native";

export function confirmAction(
  title: string,
  message?: string,
  confirmLabel: string = "OK",
  destructive: boolean = false
): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(true);
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
