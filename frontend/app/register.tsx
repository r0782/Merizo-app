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
import { detectUserLocation, validateEmail as validateEmailAPI } from "../src/lib/externalApis";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { useAuth } from "../src/lib/auth";

export default function RegisterScreen() {
  const { c, isDark, toggle } = useTheme();
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onRegister = async () => {
    setError("");
    if (!name.trim()) return setError("Please enter your name");
    if (!email.trim()) return setError("Please enter your email");
    if (password.length < 4) return setError("Password must be at least 4 characters");
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      router.replace("/currency-onboarding");
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not create account");
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
          testID="theme-toggle-register"
          onPress={toggle}
          style={[styles.themeBtn, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color={c.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginBottom: 36 }}>
          <Text style={[styles.brand, { color: c.textPrimary, fontFamily: "Syne_800ExtraBold" }]}>Merizo</Text>
          <Text style={[styles.tagline, { color: c.textSecondary }]}>Create your free account</Text>
        </View>

        <View style={styles.form}>
          <Field label="Name" value={name} setValue={setName} placeholder="Your name" testID="register-name" />
          <Field label="Email" value={email} setValue={setEmail} placeholder="you@email.com" testID="register-email" keyboardType="email-address" />
          <Field label="Password" value={password} setValue={setPassword} placeholder="••••••••" testID="register-password" secureTextEntry />

          {!!error && (
            <Text testID="register-error" style={{ color: c.negative, marginTop: 8, fontSize: 13 }}>
              {error}
            </Text>
          )}

          <TouchableOpacity
            testID="register-submit"
            disabled={loading}
            style={[styles.primaryBtn, { backgroundColor: isDark ? c.indigo : "#0A0A0A", opacity: loading ? 0.7 : 1 }]}
            onPress={onRegister}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            testID="register-go-login"
            style={{ marginTop: 16, alignItems: "center" }}
            onPress={() => router.push("/login")}
          >
            <Text style={{ color: c.textSecondary, fontSize: 14 }}>
              Already have an account? <Text style={{ color: c.textPrimary, fontWeight: "700" }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  setValue,
  placeholder,
  testID,
  secureTextEntry,
  keyboardType,
}: {
  label: string;
  value: string;
  setValue: (s: string) => void;
  placeholder?: string;
  testID?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
}) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: c.textSecondary, fontSize: 12, marginBottom: 8, fontWeight: "600", letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        style={[
          styles.input,
          { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: 80, paddingBottom: 60 },
  brand: { fontSize: 56, letterSpacing: -2 },
  tagline: { fontSize: 15, marginTop: 6 },
  form: { width: "100%", maxWidth: 420, alignSelf: "center" },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
  },
  primaryBtn: {
    marginTop: 16,
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
