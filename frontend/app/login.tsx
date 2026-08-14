import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { validateEmail as validateEmailAPI } from "../src/lib/externalApis";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { useAuth } from "../src/lib/auth";
import { api } from "../src/lib/api";
import { supabase } from "../src/lib/supabase";

function InputField({ icon, children, c }: any) {
  return (
    <View style={{
      flexDirection: "row", alignItems: "center",
      backgroundColor: c.surface, borderRadius: 12,
      borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 16, gap: 12, marginBottom: 12,
    }}>
      <Ionicons name={icon} size={16} color={c.textMuted} style={{ flexShrink: 0 }} />
      {children}
    </View>
  );
}

type Screen = "main" | "email_otp" | "verify_email";

export default function LoginScreen() {
  const { c } = useTheme();
  const { loginWithToken } = useAuth();
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const goAfterLogin = () => router.replace((redirect as any) || "/(tabs)/home");

  const [screen, setScreen] = useState<Screen>("main");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const doForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Enter your email first", "Type your email above, then tap Forgot password.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      Alert.alert("Check your inbox", "If that email is registered you'll receive a reset link shortly.");
    } catch {
      Alert.alert("Check your inbox", "If that email is registered you'll receive a reset link shortly.");
    } finally { setLoading(false); }
  };

  const doLogin = async () => {
    if (!email.trim() || !password) { Alert.alert("Fill in all fields"); return; }
    const emailCheck = await validateEmailAPI(email.trim());
    if (!emailCheck.format) { Alert.alert("Invalid email", "Please enter a valid email address."); return; }
    setLoading(true);
    try {
      const r = await api.post("/auth/login", { email: email.trim().toLowerCase(), password });
      await loginWithToken(r.data.access_token, r.data.user);
      goAfterLogin();
    } catch (e: any) {
      Alert.alert("Login failed", e?.response?.data?.detail || "Check your credentials");
    } finally { setLoading(false); }
  };

  const sendEmailOtp = async () => {
    if (!email.trim()) { Alert.alert("Enter your email"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setScreen("verify_email");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not send code");
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (otp.length < 6) { Alert.alert("Enter the 6-digit code"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(), token: otp, type: "email",
      });
      if (error) throw error;
      const session = data.session;
      const r = await api.post("/auth/social-login", {
        supabase_token: session?.access_token,
        email: session?.user?.email || email,
        name: session?.user?.user_metadata?.full_name
          || session?.user?.email?.split("@")[0]
          || "User",
      });
      await loginWithToken(r.data.token, r.data.user);
      goAfterLogin();
    } catch (e: any) {
      Alert.alert("Invalid code", e?.message || "Try again");
    } finally { setLoading(false); }
  };

  const doGoogle = async () => {
    setLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: Platform.OS === "web" ? window.location.origin : "merizo://auth/callback" },
      });
    } catch (e: any) {
      Alert.alert("Google login failed", e?.message);
    } finally { setLoading(false); }
  };

  const PrimaryBtn = ({ onPress, label }: { onPress: () => void; label: string }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
      style={{
        backgroundColor: c.textPrimary, borderRadius: 12, padding: 16,
        alignItems: "center", justifyContent: "center", marginTop: 8,
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading
        ? <ActivityIndicator color={c.bg} />
        : <Text style={{ color: c.bg, fontSize: 15, fontWeight: "600", letterSpacing: 0.2 }}>{label}</Text>
      }
    </TouchableOpacity>
  );

  const BackBtn = ({ to }: { to: Screen }) => (
    <TouchableOpacity
      onPress={() => { setScreen(to); setOtp(""); }}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 40 }}
    >
      <Ionicons name="arrow-back" size={18} color={c.textSecondary} />
      <Text style={{ color: c.textSecondary, fontSize: 14 }}>Back</Text>
    </TouchableOpacity>
  );

  // ── OTP verify screen ──────────────────────────────────────────────────────
  if (screen === "verify_email") {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 32, paddingTop: Platform.OS === "ios" ? 64 : 48, justifyContent: "center" }} keyboardShouldPersistTaps="always">
          <BackBtn to="email_otp" />
          <Wordmark c={c} />
          <Text style={{ color: c.textPrimary, fontSize: 26, fontWeight: "700", marginTop: 32, marginBottom: 8, letterSpacing: -0.5 }}>
            Enter the code
          </Text>
          <Text style={{ color: c.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 40 }}>
            Sent to {email}
          </Text>
          <TextInput
            value={otp}
            onChangeText={v => setOtp(v.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={c.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            style={{
              backgroundColor: c.surface, borderRadius: 12,
              borderWidth: 1, borderColor: c.border,
              padding: 20, fontSize: 28, fontWeight: "700",
              color: c.textPrimary, textAlign: "center",
              letterSpacing: 12, marginBottom: 16,
            } as any}
          />
          <PrimaryBtn onPress={() => verifyOtp()} label="Verify" />
          <TouchableOpacity onPress={sendEmailOtp} style={{ alignItems: "center", paddingVertical: 20 }}>
            <Text style={{ color: c.textSecondary, fontSize: 14 }}>
              Didn't receive it?{" "}
              <Text style={{ color: c.textPrimary, fontWeight: "600" }}>Resend</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Email OTP screen ───────────────────────────────────────────────────────
  if (screen === "email_otp") {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 32, paddingTop: Platform.OS === "ios" ? 64 : 48, justifyContent: "center" }} keyboardShouldPersistTaps="always">
          <BackBtn to="main" />
          <Wordmark c={c} />
          <Text style={{ color: c.textPrimary, fontSize: 26, fontWeight: "700", marginTop: 32, marginBottom: 8, letterSpacing: -0.5 }}>
            Sign in with email
          </Text>
          <Text style={{ color: c.textSecondary, fontSize: 14, marginBottom: 40 }}>
            We'll send a 6-digit code — no password needed
          </Text>
          <InputField icon="mail-outline" c={c}>
            <TextInput
              value={email} onChangeText={setEmail}
              placeholder="you@example.com" placeholderTextColor={c.textMuted}
              keyboardType="email-address" autoCapitalize="none"
              style={{ flex: 1, fontSize: 15, color: c.textPrimary, paddingVertical: 16 } as any}
            />
          </InputField>
          <PrimaryBtn onPress={sendEmailOtp} label="Send code" />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Main login screen ──────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 32, paddingTop: Platform.OS === "ios" ? 80 : 60, paddingBottom: 40 }}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        <Wordmark c={c} />

        <Text style={{ color: c.textPrimary, fontSize: 32, fontWeight: "700", marginTop: 40, marginBottom: 6, letterSpacing: -1 }}>
          Welcome back.
        </Text>
        <Text style={{ color: c.textSecondary, fontSize: 15, marginBottom: 40, lineHeight: 22 }}>
          Split smarter. Settle faster.
        </Text>

        {/* Email */}
        <InputField icon="mail-outline" c={c}>
          <TextInput
            value={email} onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={c.textMuted}
            keyboardType="email-address" autoCapitalize="none"
            autoCorrect={false} autoComplete="email"
            style={{ flex: 1, fontSize: 15, color: c.textPrimary, paddingVertical: 16 } as any}
          />
        </InputField>

        {/* Password */}
        <InputField icon="lock-closed-outline" c={c}>
          <TextInput
            value={password} onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={c.textMuted}
            secureTextEntry={!showPw}
            autoComplete="password"
            style={{ flex: 1, fontSize: 15, color: c.textPrimary, paddingVertical: 16 } as any}
          />
          <TouchableOpacity onPress={() => setShowPw(s => !s)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={16} color={c.textMuted} />
          </TouchableOpacity>
        </InputField>

        <TouchableOpacity onPress={doForgotPassword} style={{ alignSelf: "flex-end", marginBottom: 24 }}>
          <Text style={{ color: c.textSecondary, fontSize: 13 }}>Forgot password?</Text>
        </TouchableOpacity>

        <PrimaryBtn onPress={doLogin} label="Sign in" />

        {/* Divider */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginVertical: 28 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
          <Text style={{ color: c.textMuted, fontSize: 12, letterSpacing: 0.5 }}>OR</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        </View>

        {/* Google */}
        <TouchableOpacity
          onPress={doGoogle}
          disabled={loading}
          activeOpacity={0.8}
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
            backgroundColor: c.surface, borderRadius: 12, padding: 15,
            borderWidth: 1, borderColor: c.border, marginBottom: 10,
          }}
        >
          <Text style={{ fontSize: 16 }}>G</Text>
          <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: "500" }}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/register")} style={{ alignItems: "center", marginTop: 22 }}>
          <Text style={{ color: c.textSecondary, fontSize: 14 }}>
            New here?{" "}
            <Text style={{ color: c.textPrimary, fontWeight: "600" }}>Create account</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Wordmark({ c }: { c: any }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: c.textPrimary,
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ color: c.bg, fontSize: 18, fontWeight: "800" }}>M</Text>
      </View>
      <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: "700", letterSpacing: -0.5 }}>
        Merizo
      </Text>
    </View>
  );
}
