/**
 * Merizo QR Code Generator — reusable, monochrome, notebook-styled.
 * Wraps react-native-qrcode-svg. Default is always black-on-white regardless
 * of theme mode: QR codes need maximum contrast to stay reliably scannable,
 * so unlike the rest of the app it does not invert in dark mode.
 */
import { View, Text } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "../lib/theme";
import { spacing, radius, type } from "../lib/tokens";

interface QRCodeGeneratorProps {
  value: string;
  size?: number;
  foregroundColor?: string;
  backgroundColor?: string;
  /** Show the small "M" wordmark badge in the center (matches the login screen mark). */
  showLogo?: boolean;
  caption?: string;
}

export function QRCodeGenerator({
  value,
  size = 220,
  foregroundColor = "#0A0A0A",
  backgroundColor = "#FFFFFF",
  showLogo = true,
  caption,
}: QRCodeGeneratorProps) {
  const { c } = useTheme();
  const logoSize = Math.round(size * 0.22);

  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          padding: spacing["5"],
          borderRadius: radius["2xl"],
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor,
        }}
      >
        <View style={{ width: size, height: size }}>
          <QRCode
            value={value}
            size={size}
            color={foregroundColor}
            backgroundColor={backgroundColor}
            // "H" = ~30% error correction, needed so the center logo cutout
            // doesn't break scannability.
            ecl={showLogo ? "H" : "M"}
          />
          {showLogo && (
            <View
              pointerEvents="none"
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
            >
              <View
                style={{
                  width: logoSize, height: logoSize,
                  borderRadius: radius.md,
                  backgroundColor: foregroundColor,
                  borderWidth: 3, borderColor: backgroundColor,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ color: backgroundColor, fontSize: logoSize * 0.5, fontFamily: type.family.extrabold }}>
                  M
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
      {caption ? (
        <Text style={{ marginTop: spacing["3"], fontSize: type.size.sm, color: c.textSecondary, textAlign: "center" }}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
