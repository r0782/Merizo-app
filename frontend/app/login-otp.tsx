import React, { useState } from "react";
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { api } from "../src/lib/api";

export default function LoginOTPScreen() {
  const { c, isDark, toggle } = useTheme();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSendOTP = async () => {
    setError("");
    
    if (!phone || phone.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      await api.post("/auth/send-otp", { phone: cleanPhone });

      router.push({
        pathname: "/login-verify",
        params: { phone: cleanPhone },
      });
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message;
      setError(typeof detail === "string" ? detail : "Failed to send OTP. Try again.");
      console.error("OTP Send Error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.themeBtnWrap]}>
        <TouchableOpacity
          testID="theme-toggle-login-otp"
          onPress={toggle}
          style={[styles.themeBtn, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color={c.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          testID="otp-back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
          <Text style={{ color: c.textPrimary, fontSize: 14, marginLeft: 4, fontWeight: "600" }}>
            Back
          </Text>
        </TouchableOpacity>

        <View style={{ alignItems: "center", marginBottom: 32, marginTop: 20 }}>
          <Text style={[styles.title, { color: c.textPrimary }]}>Sign In with OTP</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            Enter your phone number to receive a one-time password
          </Text>
        </View>

        <View testID="otp-form" style={styles.form}>
          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: c.textSecondary, fontSize: 12, marginBottom: 8, fontWeight: "600", letterSpacing: 0.4 }}>
              PHONE NUMBER
            </Text>
            <View style={[styles.phoneInput, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: "500" }}>+91</Text>
              <TextInput
                testID="otp-phone-input"
                value={phone}
                onChangeText={setPhone}
                placeholder="9876543210"
                placeholderTextColor={c.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
                style={[
                  styles.input,
                  {
                    color: c.textPrimary,
                    flex: 1,
                    outlineStyle: "none",
                  },
                ]}
              />
            </View>
            <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 6 }}>
              We'll send you a 6-digit code via SMS
            </Text>
          </View>

          {!!error && (
            <Text testID="otp-error" style={{ color: "#EF4444", marginBottom: 16, fontSize: 13 }}>
              {error}
            </Text>
          )}

          <TouchableOpacity
            testID="otp-send-btn"
            disabled={loading || phone.length < 10}
            style={[
              styles.primaryBtn,
              {
                backgroundColor: isDark ? c.indigo : "#0A0A0A",
                opacity: loading || phone.length < 10 ? 0.5 : 1,
              },
            ]}
            onPress={onSendOTP}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Send OTP</Text>
            )}
          </TouchableOpacity>

          <View style={[styles.infoBox, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Ionicons name="information-circle-outline" size={16} color={isDark ? c.indigo : "#4F46E5"} />
            <Text style={{ color: c.textSecondary, fontSize: 11, marginLeft: 8, flex: 1 }}>
              Standard SMS rates may apply. You can also sign in with email above.
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
  subtitle: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  form: { width: "100%", maxWidth: 420, alignSelf: "center" },
  phoneInput: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  input: { fontSize: 15, outlineStyle: "none" },
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
  infoBox: {
    marginTop: 20,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
});