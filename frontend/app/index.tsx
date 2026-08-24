import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/lib/auth";
import { useTheme } from "../src/lib/theme";
import { ROUTES } from "../src/lib/routes";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { c } = useTheme();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(ROUTES.HOME);
    } else {
      router.replace(ROUTES.LOGIN);
    }
  }, [user, loading, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
      <ActivityIndicator color={c.indigo} size="large" />
    </View>
  );
}
