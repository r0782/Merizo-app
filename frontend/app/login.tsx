import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { validateEmail as validateEmailAPI } from "../src/lib/externalApis";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { useAuth } from "../src/lib/auth";
import { api } from "../src/lib/api";
import { supabase } from "../src/lib/supabase";
import { ROUTES } from "../src/lib/routes";

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
  const { t } = useTranslation();
  const { loginWithToken } = useAuth();
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const goAfterLogin = () => router.replace((redirect as any) || ROUTES.HOME);

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
      const detail = e?.response?.data?.detail;
      if (detail && typeof detail === "object" && detail.code === "EMAIL_NOT_VERIFIED") {
        const unverifiedEmail = detail.email || email.trim().toLowerCase();
        try { await api.post("/auth/resend-register-otp", { email: unverifiedEmail }); } catch {}
        router.push({ pathname: ROUTES.REGISTER_VERIFY, params: { email: unverifiedEmail } });
        return;
      }
      if (!e?.response) {
        // No response at all — the request never reached the server (wrong
        // API URL, backend down, or "localhost" pointing at the device itself
        // instead of the dev machine when running outside a web browser).
        Alert.alert(
          "Can't reach the server",
          "Check your internet connection and that the backend URL (EXPO_PUBLIC_BACKEND_URL) is reachable from this device."
        );
        return;
      }
      Alert.alert("Login failed", typeof detail === "string" ? detail : "Check your credentials");
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
      <Text style={{ color: c.textSecondary, fontSize: 14 }}>{t("common.back")}</Text>
    </TouchableOpacity>
  );

  // ── OTP verify screen ──────────────────────────────────────────────────────
  if (screen === "verify_email") {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 32, paddingTop: Platform.OS === "ios" ? 64 : 48, justifyContent: "center" }} keyboardShouldPersistTaps="always">
          <BackBtn to="email_otp" />
          <Wordmark c={c} />
          <Text style={{ color: c.textPrimary, fontSize: 26, fontWeight: "700", marginTop: 32, marginBottom: 8, letterSpacing: -0.5 }}>
            {t("auth.enterTheCode")}
          </Text>
          <Text style={{ color: c.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 40 }}>
            {t("auth.sentTo", { email })}
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
          <PrimaryBtn onPress={() => verifyOtp()} label={t("auth.verify")} />
          <TouchableOpacity onPress={sendEmailOtp} style={{ alignItems: "center", paddingVertical: 20 }}>
            <Text style={{ color: c.textSecondary, fontSize: 14 }}>
              {t("auth.didntReceiveIt")}{" "}
              <Text style={{ color: c.textPrimary, fontWeight: "600" }}>{t("auth.resend")}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Email OTP screen ───────────────────────────────────────────────────────
  if (screen === "email_otp") {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 32, paddingTop: Platform.OS === "ios" ? 64 : 48, justifyContent: "center" }} keyboardShouldPersistTaps="always">
          <BackBtn to="main" />
          <Wordmark c={c} />
          <Text style={{ color: c.textPrimary, fontSize: 26, fontWeight: "700", marginTop: 32, marginBottom: 8, letterSpacing: -0.5 }}>
            {t("auth.signInWithEmail")}
          </Text>
          <Text style={{ color: c.textSecondary, fontSize: 14, marginBottom: 40 }}>
            {t("auth.emailOtpTagline")}
          </Text>
          <InputField icon="mail-outline" c={c}>
            <TextInput
              value={email} onChangeText={setEmail}
              placeholder={t("auth.emailPlaceholderExample")} placeholderTextColor={c.textMuted}
              keyboardType="email-address" autoCapitalize="none"
              style={{ flex: 1, fontSize: 15, color: c.textPrimary, paddingVertical: 16 } as any}
            />
          </InputField>
          <PrimaryBtn onPress={sendEmailOtp} label={t("auth.sendCode")} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Main login screen ──────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 32, paddingTop: Platform.OS === "ios" ? 80 : 60, paddingBottom: 40 }}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        <Wordmark c={c} />

        <Text style={{ color: c.textPrimary, fontSize: 32, fontWeight: "700", marginTop: 48, marginBottom: 8, letterSpacing: -1 }}>
          {t("auth.welcomeBack")}
        </Text>
        <Text style={{ color: c.textSecondary, fontSize: 15, marginBottom: 48, lineHeight: 22 }}>
          {t("auth.taglineSplit")}
        </Text>

        {/* Google */}
        <TouchableOpacity
          onPress={doGoogle}
          disabled={loading}
          activeOpacity={0.8}
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
            backgroundColor: c.surface, borderRadius: 12, padding: 15,
            borderWidth: 1, borderColor: c.border, marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 16 }}>G</Text>
          <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: "500" }}>{t("auth.continueWithGoogle")}</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginVertical: 28 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
          <Text style={{ color: c.textMuted, fontSize: 12, letterSpacing: 0.5 }}>{t("common.or")}</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        </View>

        {/* Email */}
        <InputField icon="mail-outline" c={c}>
          <TextInput
            value={email} onChangeText={setEmail}
            placeholder={t("auth.emailPlaceholder")}
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
            placeholder={t("auth.passwordPlaceholder")}
            placeholderTextColor={c.textMuted}
            secureTextEntry={!showPw}
            autoComplete="password"
            style={{ flex: 1, fontSize: 15, color: c.textPrimary, paddingVertical: 16 } as any}
          />
          <TouchableOpacity onPress={() => setShowPw(s => !s)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={16} color={c.textMuted} />
          </TouchableOpacity>
        </InputField>

        <TouchableOpacity onPress={doForgotPassword} style={{ alignSelf: "flex-end", marginBottom: 32 }}>
          <Text style={{ color: c.textSecondary, fontSize: 13 }}>{t("auth.forgotPassword")}</Text>
        </TouchableOpacity>

        <PrimaryBtn onPress={doLogin} label={t("auth.signIn")} />

        <TouchableOpacity onPress={() => router.push(ROUTES.REGISTER)} style={{ alignItems: "center", marginTop: 28 }}>
          <Text style={{ color: c.textSecondary, fontSize: 14 }}>
            {t("auth.newHere")}{" "}
            <Text style={{ color: c.textPrimary, fontWeight: "600" }}>{t("auth.createAccount")}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Wordmark({ c }: { c: any }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Image
        source={require("../assets/images/logo-icon.png")}
        style={{ width: 36, height: 36 }}
        resizeMode="contain"
      />
      <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: "700", letterSpacing: -0.5 }}>
        Merizo
      </Text>
    </View>
  );
}
