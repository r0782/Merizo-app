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
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { useAuth } from "../src/lib/auth";

export default function LoginScreen() {
  const { c, isDark, toggle } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("demo@merizo.app");
  const [password, setPassword] = useState("Demo@123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Login failed. Please try again.");
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
          testID="theme-toggle-login"
          onPress={toggle}
          style={[styles.themeBtn, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color={c.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginBottom: 36 }}>
          <Text style={[styles.brand, { color: c.textPrimary, fontFamily: "Syne_800ExtraBold" }]}>Merizo</Text>
          <Text style={[styles.tagline, { color: c.textSecondary }]}>Split smarter. Settle faster.</Text>
        </View>

        <View testID="login-form" style={styles.form}>
          <Field label="Email" value={email} setValue={setEmail} placeholder="you@email.com" testID="login-email" keyboardType="email-address" />
          <Field label="Password" value={password} setValue={setPassword} placeholder="••••••••" testID="login-password" secureTextEntry />

          {!!error && (
            <Text testID="login-error" style={{ color: c.negative, marginTop: 8, fontSize: 13 }}>
              {error}
            </Text>
          )}

          <TouchableOpacity
            testID="login-submit"
            disabled={loading}
            style={[styles.primaryBtn, { backgroundColor: isDark ? c.indigo : "#0A0A0A", opacity: loading ? 0.7 : 1 }]}
            onPress={onLogin}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            testID="login-go-register"
            style={{ marginTop: 16, alignItems: "center" }}
            onPress={() => router.push("/register")}
          >
            <Text style={{ color: c.textSecondary, fontSize: 14 }}>
              No account? <Text style={{ color: c.textPrimary, fontWeight: "700" }}>Create one</Text>
            </Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          <TouchableOpacity
            testID="login-google"
            style={[styles.ghostBtn, { borderColor: c.border, backgroundColor: c.surface }]}
            onPress={() => Alert.alert("Coming soon", "Google sign-in will be available shortly.")}
          >
            <Ionicons name="logo-google" size={18} color={c.textPrimary} />
            <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: "600", marginLeft: 8 }}>
              Continue with Google
            </Text>
          </TouchableOpacity>

          <View style={[styles.demoCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ color: c.textSecondary, fontSize: 11, letterSpacing: 1.2, fontWeight: "700" }}>DEMO ACCOUNT</Text>
            <Text style={{ color: c.textPrimary, fontSize: 13, marginTop: 4 }}>demo@merizo.app · Demo@123</Text>
          </View>
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
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  divider: { height: 1, marginVertical: 20 },
  themeBtnWrap: { position: "absolute", top: 60, right: 24, zIndex: 5 },
  themeBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  demoCard: {
    marginTop: 24,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
});
