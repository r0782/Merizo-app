import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { api } from "../src/lib/api";
import { ROUTES } from "../src/lib/routes";

export default function ResetPasswordScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onSubmit = async () => {
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirm) return setError("Passwords don't match");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
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

        {!token ? (
          <>
            <Text style={{ fontSize: 32, fontWeight: "700", color: c.textPrimary, letterSpacing: -1, marginBottom: 6 }}>
              Invalid link.
            </Text>
            <Text style={{ fontSize: 15, color: c.textSecondary, marginBottom: 32, lineHeight: 22 }}>
              This reset link is missing its code. Request a new one from the sign-in screen.
            </Text>
            <TouchableOpacity
              testID="reset-go-login"
              onPress={() => router.replace(ROUTES.LOGIN)}
              style={{ backgroundColor: c.textPrimary, borderRadius: 12, padding: 16, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: c.bg, fontSize: 15, fontWeight: "600" }}>Back to sign in</Text>
            </TouchableOpacity>
          </>
        ) : done ? (
          <>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.positive, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <Ionicons name="checkmark" size={28} color={c.bg} />
            </View>
            <Text style={{ fontSize: 32, fontWeight: "700", color: c.textPrimary, letterSpacing: -1, marginBottom: 6 }}>
              Password updated.
            </Text>
            <Text style={{ fontSize: 15, color: c.textSecondary, marginBottom: 32, lineHeight: 22 }}>
              Sign in with your new password.
            </Text>
            <TouchableOpacity
              testID="reset-done-login"
              onPress={() => router.replace(ROUTES.LOGIN)}
              style={{ backgroundColor: c.textPrimary, borderRadius: 12, padding: 16, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: c.bg, fontSize: 15, fontWeight: "600" }}>Sign in</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 32, fontWeight: "700", color: c.textPrimary, letterSpacing: -1, marginBottom: 6 }}>
              Set a new password.
            </Text>
            <Text style={{ fontSize: 15, color: c.textSecondary, marginBottom: 40, lineHeight: 22 }}>
              Choose a new password for your account.
            </Text>

            <InputField icon="lock-closed-outline" c={c}>
              <TextInput
                testID="reset-password"
                value={password} onChangeText={setPassword}
                placeholder="New password (min 8 chars)"
                placeholderTextColor={c.textMuted}
                secureTextEntry={!showPw}
                style={{ flex: 1, fontSize: 15, color: c.textPrimary, paddingVertical: 16 } as any}
              />
              <TouchableOpacity onPress={() => setShowPw(s => !s)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={16} color={c.textMuted} />
              </TouchableOpacity>
            </InputField>

            <InputField icon="lock-closed-outline" c={c}>
              <TextInput
                testID="reset-confirm"
                value={confirm} onChangeText={setConfirm}
                placeholder="Confirm new password"
                placeholderTextColor={c.textMuted}
                secureTextEntry={!showPw}
                style={{ flex: 1, fontSize: 15, color: c.textPrimary, paddingVertical: 16 } as any}
              />
            </InputField>

            {!!error && (
              <Text testID="reset-error" style={{ color: c.negative, marginBottom: 12, fontSize: 13 }}>
                {error}
              </Text>
            )}

            <TouchableOpacity
              testID="reset-submit"
              disabled={loading}
              onPress={onSubmit}
              activeOpacity={0.85}
              style={{ backgroundColor: c.textPrimary, borderRadius: 12, padding: 16, alignItems: "center", justifyContent: "center", opacity: loading ? 0.6 : 1, marginTop: 8 }}
            >
              {loading
                ? <ActivityIndicator color={c.bg} />
                : <Text style={{ color: c.bg, fontSize: 15, fontWeight: "600" }}>Update password</Text>
              }
            </TouchableOpacity>
          </>
        )}
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
