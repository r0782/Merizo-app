import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { useAuth } from "../src/lib/auth";
import { api } from "../src/lib/api";

export default function LoginVerifyOTPScreen() {
  const { c, isDark, toggle } = useTheme();
  const { loginWithToken } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = params.phone as string;

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const otpInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!phone) {
      router.replace("/login-otp");
    }
  }, [phone, router]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const onVerifyOTP = async () => {
    setError("");

    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/verify-otp", {
        phone: phone,
        otp: otp,
      });

      const { access_token, user } = response.data;

      console.log("✅ OTP Verified, Token:", access_token ? "Found" : "Missing");

      if (!access_token) {
        setError("Failed to verify OTP. Please try again.");
        return;
      }

      try {
        await loginWithToken(access_token, user);
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log("✅ Token saved, redirecting...");
        router.replace("/(tabs)/home");
      } catch (err) {
        console.error("❌ Login error:", err);
        setError("Failed to save login info. Please try again.");
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message;
      setError(typeof detail === "string" ? detail : "Invalid OTP. Please try again.");
      console.error("OTP Verify Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const onResendOTP = async () => {
    setError("");
    try {
      await api.post("/auth/send-otp", { phone });
      setOtp("");
      setResendTimer(60);
      otpInputRef.current?.focus();
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message;
      setError(typeof detail === "string" ? detail : "Failed to resend OTP");
      console.error("Resend OTP Error:", e);
    }
  };

  if (!phone) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={c.indigo} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.themeBtnWrap]}>
        <TouchableOpacity
          testID="theme-toggle-verify"
          onPress={toggle}
          style={[styles.themeBtn, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color={c.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          testID="verify-back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
          <Text style={{ color: c.textPrimary, fontSize: 14, marginLeft: 4, fontWeight: "600" }}>
            Change number
          </Text>
        </TouchableOpacity>

        <View style={{ alignItems: "center", marginBottom: 32, marginTop: 20 }}>
          <Text style={[styles.title, { color: c.textPrimary }]}>Enter OTP</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            We sent a 6-digit code to{"\n"}
            <Text style={{ fontWeight: "700", color: c.textPrimary }}>+91 {phone}</Text>
          </Text>
        </View>

        <View testID="verify-form" style={styles.form}>
          <View style={{ marginBottom: 20 }}>
            <TextInput
              ref={otpInputRef}
              testID="verify-otp-input"
              value={otp}
              onChangeText={setOtp}
              placeholder="000000"
              placeholderTextColor={c.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus={true}
              style={[
                styles.otpInput,
                {
                  backgroundColor: c.surface,
                  borderColor: error ? "#EF4444" : c.border,
                  color: c.textPrimary,
                  outlineStyle: "none",
                },
              ]}
            />
            <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 6 }}>
              Enter the 6-digit code
            </Text>
          </View>

          {!!error && (
            <Text testID="verify-error" style={{ color: "#EF4444", marginBottom: 16, fontSize: 13 }}>
              {error}
            </Text>
          )}

          <TouchableOpacity
            testID="verify-submit"
            disabled={loading || otp.length !== 6}
            style={[
              styles.primaryBtn,
              {
                backgroundColor: isDark ? c.indigo : "#0A0A0A",
                opacity: loading || otp.length !== 6 ? 0.5 : 1,
              },
            ]}
            onPress={onVerifyOTP}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          <View style={{ marginTop: 20, alignItems: "center" }}>
            <Text style={{ color: c.textSecondary, fontSize: 13 }}>
              Didn't receive the code?{" "}
              <TouchableOpacity
                testID="verify-resend"
                disabled={resendTimer > 0}
                onPress={onResendOTP}
              >
                <Text
                  style={{
                    color: resendTimer > 0 ? c.textMuted : (isDark ? c.indigo : "#4F46E5"),
                    fontWeight: "700",
                  }}
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                </Text>
              </TouchableOpacity>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: 60, paddingBottom: 60 },
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 28, fontFamily: "Syne_700Bold", letterSpacing: -1 },
  subtitle: { fontSize: 14, marginTop: 8, lineHeight: 20, textAlign: "center" },
  form: { width: "100%", maxWidth: 420, alignSelf: "center" },
  otpInput: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 8,
    textAlign: "center",
    outlineStyle: "none",
  },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  themeBtnWrap: { position: "absolute", top: 60, right: 24, zIndex: 5 },
  themeBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});