/**
 * Merizo Profile-QR Scanner — reusable camera modal.
 * Scans another user's profile QR (a "user" Merizo link keyed by their
 * email) and hands the email back via onScanned. Used both from the
 * Friends screen and inline wherever a split's member list can be edited.
 */
import { useRef, useState } from "react";
import { View, Text, TouchableOpacity, Modal, SafeAreaView } from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import { type as t } from "../lib/tokens";
import { parseMerizoLink } from "../lib/merizoLinks";

export function UserQrScanner({
  visible,
  onClose,
  onScanned,
}: {
  visible: boolean;
  onClose: () => void;
  onScanned: (email: string) => void;
}) {
  const { c } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanError, setScanError] = useState("");
  const lockedRef = useRef(false);

  const handleScanned = (result: BarcodeScanningResult) => {
    if (lockedRef.current) return;
    const link = parseMerizoLink(result.data);
    if (!link || link.type !== "user") {
      lockedRef.current = true;
      setScanError("Scan a Merizo profile QR code.");
      setTimeout(() => { lockedRef.current = false; setScanError(""); }, 1800);
      return;
    }
    lockedRef.current = true;
    onScanned(link.token);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {!permission || !permission.granted ? (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 }}>
          <Text style={{ color: c.textPrimary, fontSize: 18, fontFamily: t.family.bold, textAlign: "center" }}>
            Camera access needed
          </Text>
          <Text style={{ color: c.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
            Merizo needs your camera to scan a profile QR code.
          </Text>
          <TouchableOpacity onPress={requestPermission} style={{ backgroundColor: c.textPrimary, paddingHorizontal: 28, paddingVertical: 14, marginTop: 8 }}>
            <Text style={{ color: c.bg, fontSize: 14, fontFamily: t.family.semibold }}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ marginTop: 4 }}>
            <Text style={{ color: c.textMuted, fontSize: 13 }}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      ) : (
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={lockedRef.current ? undefined : handleScanned}
          />
          <SafeAreaView style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20 }}>
              <TouchableOpacity onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: "#fff", fontSize: 15, fontFamily: t.family.semibold }}>Scan Profile QR</Text>
              <View style={{ width: 40 }} />
            </View>
          </SafeAreaView>
          <SafeAreaView style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
            <View style={{ alignItems: "center", paddingBottom: 40, paddingHorizontal: 32 }}>
              <Text style={{ color: scanError ? "#FF6B6B" : "rgba(255,255,255,0.85)", fontSize: 14, textAlign: "center", fontFamily: t.family.medium }}>
                {scanError || "Point your camera at a friend's profile QR code"}
              </Text>
            </View>
          </SafeAreaView>
        </View>
      )}
    </Modal>
  );
}
