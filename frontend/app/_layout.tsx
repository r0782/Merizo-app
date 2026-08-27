import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { Text, TextInput } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import {
  useFonts,
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { I18nextProvider } from "react-i18next";
import { ThemeProvider, useTheme } from "../src/lib/theme";
import { CurrencyProvider } from "../src/lib/CurrencyContext";
import { AuthProvider } from "../src/lib/auth";
import { startKeepAlive, stopKeepAlive } from "../src/lib/api";
import i18n, { initI18n } from "../src/lib/i18n";
import { ToastContainer } from "../src/components/Toast";

SplashScreen.preventAutoHideAsync();

// Apply Manrope as the global default for every Text and TextInput
(Text as any).defaultProps = (Text as any).defaultProps ?? {};
(Text as any).defaultProps.style = [{ fontFamily: "Manrope_400Regular" }];
(TextInput as any).defaultProps = (TextInput as any).defaultProps ?? {};
(TextInput as any).defaultProps.style = [{ fontFamily: "Manrope_400Regular" }];

function RootStack() {
  const { isDark, c } = useTheme();

  // Without this, the native window background behind the OS edge-to-edge
  // gesture/nav bar stays its Android default (white) regardless of the
  // in-app theme, showing as a stray white strip below the tab bar.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c.bg]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
          animation: "fade",
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_300Light,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    startKeepAlive();
    initI18n().then(() => setI18nReady(true));
    return () => stopKeepAlive();
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && i18nReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, i18nReady]);

  if ((!fontsLoaded && !fontError) || !i18nReady) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <CurrencyProvider>
              <AuthProvider>
                <RootStack />
                <ToastContainer />
              </AuthProvider>
            </CurrencyProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </I18nextProvider>
  );
}
