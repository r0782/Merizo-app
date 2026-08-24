import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { useAuth } from "../src/lib/auth";
import { validateEmail as validateEmailAPI } from "../src/lib/externalApis";
import { ROUTES } from "../src/lib/routes";

export default function RegisterScreen() {
  const { c, isDark, toggle } = useTheme();
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onRegister = async () => {
    setError("");
    if (!name.trim()) return setError("Please enter your name");
    if (!email.trim()) return setError("Please enter your email");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    setLoading(true);
    try {
      const emailCheck = await validateEmailAPI(email.trim());
      if (!emailCheck.format) { setError("Please enter a valid email address."); setLoading(false); return; }
      if (!emailCheck.valid)  { setError(emailCheck.reason || "This email cannot receive messages. Please use a different one."); setLoading(false); return; }
      await register(email.trim(), password, name.trim());
      router.replace(ROUTES.CURRENCY_ONBOARDING);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Theme toggle */}
      <TouchableOpacity
        testID="theme-toggle-register"
        onPress={toggle}
        style={{ position: "absolute", top: Platform.OS === "ios" ? 60 : 40, right: 24, zIndex: 5, width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color={c.textPrimary} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 32, paddingTop: 100, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Wordmark */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 40 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.textPrimary, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: c.bg, fontSize: 18, fontWeight: "800" }}>M</Text>
          </View>
          <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: "700", letterSpacing: -0.5 }}>Merizo</Text>
        </View>

        <Text style={{ fontSize: 32, fontWeight: "700", color: c.textPrimary, letterSpacing: -1, marginBottom: 6 }}>
          Create account.
        </Text>
        <Text style={{ fontSize: 15, color: c.textSecondary, marginBottom: 40, lineHeight: 22 }}>
          Free forever. No credit card required.
        </Text>

        {/* Name */}
        <InputField icon="person-outline" c={c}>
          <TextInput
            testID="register-name"
            value={name} onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={c.textMuted}
            autoCorrect={false}
            style={{ flex: 1, fontSize: 15, color: c.textPrimary, paddingVertical: 16 } as any}
          />
        </InputField>

        {/* Email */}
        <InputField icon="mail-outline" c={c}>
          <TextInput
            testID="register-email"
            value={email} onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={c.textMuted}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            style={{ flex: 1, fontSize: 15, color: c.textPrimary, paddingVertical: 16 } as any}
          />
        </InputField>

        {/* Password */}
        <InputField icon="lock-closed-outline" c={c}>
          <TextInput
            testID="register-password"
            value={password} onChangeText={setPassword}
            placeholder="Password (min 8 chars)"
            placeholderTextColor={c.textMuted}
            secureTextEntry={!showPw}
            style={{ flex: 1, fontSize: 15, color: c.textPrimary, paddingVertical: 16 } as any}
          />
          <TouchableOpacity onPress={() => setShowPw(s => !s)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={16} color={c.textMuted} />
          </TouchableOpacity>
        </InputField>

        {!!error && (
          <Text testID="register-error" style={{ color: c.negative, marginBottom: 12, fontSize: 13 }}>
            {error}
          </Text>
        )}

        <TouchableOpacity
          testID="register-submit"
          disabled={loading}
          onPress={onRegister}
          activeOpacity={0.85}
          style={{ backgroundColor: c.textPrimary, borderRadius: 12, padding: 16, alignItems: "center", justifyContent: "center", opacity: loading ? 0.6 : 1, marginTop: 8 }}
        >
          {loading
            ? <ActivityIndicator color={c.bg} />
            : <Text style={{ color: c.bg, fontSize: 15, fontWeight: "600" }}>Create Account</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          testID="register-go-login"
          style={{ marginTop: 24, alignItems: "center" }}
          onPress={() => router.push(ROUTES.LOGIN)}
        >
          <Text style={{ color: c.textSecondary, fontSize: 14 }}>
            Already have an account?{" "}
            <Text style={{ color: c.textPrimary, fontWeight: "600" }}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
