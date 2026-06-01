import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";

export default function AuthCallback() {
  const router = useRouter();
  const { login } = useAuth();

  useEffect(() => {
    const handle = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const session = data.session;
        if (!session) { router.replace("/login"); return; }

        const r = await api.post("/auth/social-login", {
          supabase_token: session.access_token,
          email: session.user?.email || "",
          name: session.user?.user_metadata?.full_name || session.user?.email?.split("@")[0] || "User",
        });
        await login(r.data.token, r.data.user);
        router.replace("/(tabs)/home");
      } catch (e: any) {
        console.error("Auth callback error:", e);
        router.replace("/login");
      }
    };
    handle();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0F0D0A" }}>
      <ActivityIndicator size="large" color="#F4E6D0" />
      <Text style={{ color: "#9A7B5E", marginTop: 16, fontSize: 14 }}>Signing you in…</Text>
    </View>
  );
}
