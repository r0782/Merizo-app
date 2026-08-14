/**
 * MERIZO QR Scanner — B&W notebook UI
 * Corner-bracket viewfinder, matches app/scan.tsx's visual language.
 * Scans a Merizo invite QR, validates it, and routes to the join screen.
 */
import { useRef, useState } from "react";
import { View, Text, TouchableOpacity, Platform, Linking, SafeAreaView } from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../src/lib/theme";
import { type as t } from "../src/lib/tokens";
import { parseMerizoLink, navigateToMerizoLink } from "../src/lib/merizoLinks";

function IcoBack({ color = "", size = 20 }: any) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M5 12L12 19M5 12L12 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

function ViewfinderFrame({ width, height, color }: { width: number; height: number; color: string }) {
  const L = 28;
  return (
    <Svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
      <Path d={`M ${L} 4 L 4 4 L 4 ${L}`} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path d={`M ${width - L} 4 L ${width - 4} 4 L ${width - 4} ${L}`} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path d={`M 4 ${height - L} L 4 ${height - 4} L ${L} ${height - 4}`} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path d={`M ${width - L} ${height - 4} L ${width - 4} ${height - 4} L ${width - 4} ${height - L}`} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export default function ScanQrScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanError, setScanError] = useState("");
  const lockedRef = useRef(false);

  const onScanned = (result: BarcodeScanningResult) => {
    if (lockedRef.current) return;
    const link = parseMerizoLink(result.data);
    if (!link) {
      lockedRef.current = true;
      setScanError("That's not a Merizo invite code.");
      setTimeout(() => { lockedRef.current = false; setScanError(""); }, 1800);
      return;
    }
    lockedRef.current = true;
    setScanError("");
    navigateToMerizoLink(router, link);
  };

  const frameSize = 260;

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 }}>
          <Text style={{ color: c.textPrimary, fontSize: 20, fontFamily: t.family.bold, textAlign: "center" }}>
            Camera access needed
          </Text>
          <Text style={{ color: c.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
            Merizo needs your camera to scan invite QR codes.
          </Text>
          {permission.canAskAgain ? (
            <TouchableOpacity onPress={requestPermission} style={{ backgroundColor: c.textPrimary, paddingHorizontal: 28, paddingVertical: 14, marginTop: 8 }}>
              <Text style={{ color: c.bg, fontSize: 14, fontFamily: t.family.semibold }}>Allow Camera</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => Linking.openSettings()} style={{ backgroundColor: c.textPrimary, paddingHorizontal: 28, paddingVertical: 14, marginTop: 8 }}>
              <Text style={{ color: c.bg, fontSize: 14, fontFamily: t.family.semibold }}>Open Settings</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 4 }}>
            <Text style={{ color: c.textMuted, fontSize: 13 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={lockedRef.current ? undefined : onScanned}
      />

      {/* Header */}
      <SafeAreaView style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 8 : 20 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
            <IcoBack color="#fff" size={20} />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 15, fontFamily: t.family.semibold }}>Scan Invite QR</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {/* Viewfinder */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} pointerEvents="none">
        <View style={{ width: frameSize, height: frameSize }}>
          <ViewfinderFrame width={frameSize} height={frameSize} color="#fff" />
        </View>
      </View>

      {/* Footer message */}
      <SafeAreaView style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <View style={{ alignItems: "center", paddingBottom: 40, paddingHorizontal: 32 }}>
          <Text style={{ color: scanError ? "#FF6B6B" : "rgba(255,255,255,0.85)", fontSize: 14, textAlign: "center", fontFamily: t.family.medium }}>
            {scanError || "Point your camera at a Merizo invite QR code"}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
