import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { useAuth } from "../src/lib/auth";
import { ROUTES } from "../src/lib/routes";

export default function RegisterVerifyScreen() {
  const { c, isDark, toggle } = useTheme();
  const { verifyRegistrationOtp, resendRegistrationOtp } = useAuth();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const otpRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!email) router.replace(ROUTES.REGISTER);
  }, [email, router]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const onVerify = async () => {
    setError("");
    if (otp.length !== 6) { setError("Enter the 6-digit code"); return; }
    setLoading(true);
    try {
      await verifyRegistrationOtp(String(email), otp);
      router.replace(ROUTES.CURRENCY_ONBOARDING);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setError("");
    try {
      await resendRegistrationOtp(String(email));
      setOtp("");
      setResendTimer(60);
      otpRef.current?.focus();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not resend code");
    }
  };

  if (!email) return null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <TouchableOpacity
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
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 32 }}
        >
          <Ionicons name="arrow-back" size={18} color={c.textSecondary} />
          <Text style={{ color: c.textSecondary, fontSize: 14 }}>Back</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.textPrimary, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: c.bg, fontSize: 18, fontWeight: "800" }}>M</Text>
          </View>
          <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: "700", letterSpacing: -0.5 }}>Merizo</Text>
        </View>

        <Text style={{ fontSize: 32, fontWeight: "700", color: c.textPrimary, letterSpacing: -1, marginBottom: 6 }}>
          Verify your email.
        </Text>
        <Text style={{ fontSize: 15, color: c.textSecondary, marginBottom: 32, lineHeight: 22 }}>
          We sent a 6-digit code to{"\n"}
          <Text style={{ fontWeight: "700", color: c.textPrimary }}>{email}</Text>
        </Text>

        <View style={{
          flexDirection: "row", alignItems: "center",
          backgroundColor: c.surface, borderRadius: 12,
          borderWidth: 1, borderColor: error ? c.negative : c.border,
          paddingHorizontal: 16, marginBottom: 12,
        }}>
          <TextInput
            testID="register-verify-otp"
            ref={otpRef}
            value={otp}
            onChangeText={v => setOtp(v.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={c.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            style={{ flex: 1, fontSize: 24, fontWeight: "700", color: c.textPrimary, paddingVertical: 18, textAlign: "center", letterSpacing: 10 } as any}
          />
        </View>

        {!!error && (
          <Text testID="register-verify-error" style={{ color: c.negative, marginBottom: 12, fontSize: 13 }}>
            {error}
          </Text>
        )}

        <TouchableOpacity
          testID="register-verify-submit"
          disabled={loading || otp.length !== 6}
          onPress={onVerify}
          activeOpacity={0.85}
          style={{ backgroundColor: c.textPrimary, borderRadius: 12, padding: 16, alignItems: "center", justifyContent: "center", opacity: loading || otp.length !== 6 ? 0.6 : 1, marginTop: 8 }}
        >
          {loading
            ? <ActivityIndicator color={c.bg} />
            : <Text style={{ color: c.bg, fontSize: 15, fontWeight: "600" }}>Verify & continue</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          testID="register-verify-resend"
          disabled={resendTimer > 0}
          onPress={onResend}
          style={{ marginTop: 24, alignItems: "center" }}
        >
          <Text style={{ color: c.textSecondary, fontSize: 14 }}>
            Didn&apos;t get the code?{" "}
            <Text style={{ color: resendTimer > 0 ? c.textMuted : c.textPrimary, fontWeight: "600" }}>
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend"}
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
