import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { Text, TextInput, View, Platform, useWindowDimensions } from "react-native";
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

// Above this viewport width on web (tablet browser windows and desktop/PC),
// the app's mobile-first screens would otherwise stretch edge-to-edge and
// look broken (form fields and buttons spanning a widescreen monitor). Below
// it — phones, and narrow tablet/desktop browser windows — nothing changes.
const WEB_WIDE_BREAKPOINT = 700;
const WEB_MAX_CONTENT_WIDTH = 480;

function RootStack() {
  const { isDark, c } = useTheme();
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === "web" && width >= WEB_WIDE_BREAKPOINT;

  // Without this, the native window background behind the OS edge-to-edge
  // gesture/nav bar stays its Android default (white) regardless of the
  // in-app theme, showing as a stray white strip below the tab bar.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c.bg]);

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        animation: "fade",
      }}
    />
  );

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      {isWideWeb ? (
        <View style={{ flex: 1, backgroundColor: c.surfaceAlt, alignItems: "center" }}>
          <View
            style={{
              flex: 1,
              width: "100%",
              maxWidth: WEB_MAX_CONTENT_WIDTH,
              backgroundColor: c.bg,
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderColor: c.border,
            }}
          >
            {stack}
          </View>
        </View>
      ) : (
        stack
      )}
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
