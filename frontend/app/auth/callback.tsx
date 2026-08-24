import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";
import { useTheme } from "../../src/lib/theme";
import { ROUTES } from "../../src/lib/routes";

export default function AuthCallback() {
  const router = useRouter();
  const { loginWithToken } = useAuth();
  const { c } = useTheme();

  useEffect(() => {
    const handle = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const session = data.session;
        if (!session) { router.replace(ROUTES.LOGIN); return; }

        const r = await api.post("/auth/social-login", {
          supabase_token: session.access_token,
          email: session.user?.email || "",
          name: session.user?.user_metadata?.full_name || session.user?.email?.split("@")[0] || "User",
        });
        await loginWithToken(r.data.token, r.data.user);
        router.replace(ROUTES.HOME);
      } catch (e: any) {
        console.error("Auth callback error:", e);
        router.replace(ROUTES.LOGIN);
      }
    };
    handle();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
      <ActivityIndicator size="large" color={c.indigo} />
      <Text style={{ color: c.textMuted, marginTop: 16, fontSize: 14 }}>Signing you in…</Text>
    </View>
  );
}