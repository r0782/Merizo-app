/**
 * MERIZO Bill Scanner — B&W notebook UI
 * Corner-bracket viewfinder frame, sweeping scan line, ledger-style result.
 */
import { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Image,
  Alert, TextInput, Platform, Animated, Easing,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Svg, { Path, Line, Rect } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../src/lib/theme";
import { api } from "../src/lib/api";
import { categoryMeta, currencySymbol, type } from "../src/lib/tokens";

// ── Back arrow SVG ────────────────────────────────────────────────────────────
function BackArrow({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M 13 4 L 7 10 L 13 16" stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Receipt SVG doodle ────────────────────────────────────────────────────────
function ReceiptDoodle({ color }: { color: string }) {
  return (
    <Svg width={48} height={56} viewBox="0 0 48 56">
      {/* Paper */}
      <Path d="M 6 4 L 42 4 L 42 46 L 36 52 L 6 52 Z" stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Fold corner */}
      <Path d="M 36 46 L 36 52 L 42 46 Z" stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Lines on receipt */}
      <Line x1={12} y1={16} x2={30} y2={16} stroke={color} strokeWidth={1.1} strokeLinecap="round" />
      <Line x1={12} y1={23} x2={36} y2={23} stroke={color} strokeWidth={1.1} strokeLinecap="round" />
      <Line x1={12} y1={30} x2={36} y2={30} stroke={color} strokeWidth={1.1} strokeLinecap="round" />
      <Line x1={12} y1={37} x2={24} y2={37} stroke={color} strokeWidth={1.1} strokeLinecap="round" />
      <Line x1={28} y1={37} x2={36} y2={37} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}

// ── Corner-bracket viewfinder frame ──────────────────────────────────────────
function ViewfinderFrame({ width, height, color, active }: {
  width: number; height: number; color: string; active?: boolean;
}) {
  const L = 24;
  const sw = active ? 2 : 1.5;
  const op = active ? 1 : 0.4;
  return (
    <Svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
      {/* Top-left */}
      <Path d={`M ${L} 4 L 4 4 L 4 ${L}`} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" opacity={op} />
      {/* Top-right */}
      <Path d={`M ${width - L} 4 L ${width - 4} 4 L ${width - 4} ${L}`} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" opacity={op} />
      {/* Bottom-left */}
      <Path d={`M 4 ${height - L} L 4 ${height - 4} L ${L} ${height - 4}`} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" opacity={op} />
      {/* Bottom-right */}
      <Path d={`M ${width - L} ${height - 4} L ${width - 4} ${height - 4} L ${width - 4} ${height - L}`} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" opacity={op} />
    </Svg>
  );
}

// ── Scanning sweep line ───────────────────────────────────────────────────────
function ScanLine({ width, height, active }: { width: number; height: number; active: boolean }) {
  const { c } = useTheme();
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const loop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (active) {
      sweepAnim.setValue(0);
      loop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(sweepAnim, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.timing(sweepAnim, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        ])
      );
      loop.current.start();
    } else {
      loop.current?.stop();
    }
    return () => loop.current?.stop();
  }, [active]);

  const top = sweepAnim.interpolate({ inputRange: [0, 1], outputRange: [8, height - 8] });

  if (!active) return null;
  return (
    <Animated.View style={{ position: "absolute", left: 8, right: 8, top, height: 1 }}>
      <Svg width={width - 16} height={2}>
        <Path
          d={`M 0 1 Q ${(width - 16) / 2} 0 ${width - 16} 1`}
          stroke={c.ink}
          strokeWidth={1}
          fill="none"
          strokeLinecap="round"
          opacity={0.7}
        />
      </Svg>
    </Animated.View>
  );
}

// ── Ink button (animates to solid black on press) ─────────────────────────────
function InkButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
  solid,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  solid?: boolean;
}) {
  const { c } = useTheme();
  const inkAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.timing(inkAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  };
  const handlePressOut = () => {
    Animated.timing(inkAnim, { toValue: 0, duration: 240, useNativeDriver: false }).start();
  };

  const bg = solid
    ? c.ink
    : inkAnim.interpolate({ inputRange: [0, 1], outputRange: ["transparent", c.ink] });
  const txtColor = solid
    ? c.bg
    : inkAnim.interpolate({ inputRange: [0, 1], outputRange: [c.textPrimary, c.bg] });

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={1}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Animated.View style={{
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: c.border,
        paddingVertical: 14,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
      }}>
        {loading ? (
          <LoadingDots color={c.textMuted} />
        ) : (
          <>
            {icon}
            <Animated.Text style={{ fontFamily: type.family.semibold, fontSize: type.size.sm, color: txtColor, letterSpacing: 0.5 }}>
              {label}
            </Animated.Text>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// Simple loading dots
function LoadingDots({ color }: { color: string }) {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  useEffect(() => {
    dots.forEach((d, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 280, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);
  return (
    <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: color, opacity: d }} />
      ))}
    </View>
  );
}

// ── Camera / gallery SVGs ─────────────────────────────────────────────────────
function CameraIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path d="M 1 5 Q 1 3 3 3 L 5 3 L 6 1.5 L 12 1.5 L 13 3 L 15 3 Q 17 3 17 5 L 17 14 Q 17 16 15 16 L 3 16 Q 1 16 1 14 Z"
        stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M 9 6 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0" stroke={color} strokeWidth={1.2} fill="none" />
    </Svg>
  );
}
function GalleryIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Rect x={2} y={2} width={14} height={14} stroke={color} strokeWidth={1.2} fill="none" />
      <Path d="M 2 12 L 6 8 L 9 11 L 12 8 L 16 12" stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M 5 6 m -1 0 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0" stroke={color} strokeWidth={1.1} fill="none" />
    </Svg>
  );
}
function SparkleIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path d="M 9 2 L 10.2 7.8 L 16 9 L 10.2 10.2 L 9 16 L 7.8 10.2 L 2 9 L 7.8 7.8 Z" stroke={color} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function AddIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path d="M 9 3 L 9 15 M 3 9 L 15 9" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
const PREVIEW_H = 220;

export default function ScanBillScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ trip_id?: string }>();
  const tripId = params.trip_id as string | undefined;

  const [imageUri,       setImageUri]       = useState<string | null>(null);
  const [imageBase64,    setImageBase64]    = useState<string | null>(null);
  const [scanning,       setScanning]       = useState(false);
  const [result,         setResult]         = useState<any>(null);
  const [trips,          setTrips]          = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | undefined>(tripId);
  const [adding,         setAdding]         = useState(false);
  const [editAmount,     setEditAmount]     = useState("");
  const [editName,       setEditName]       = useState("");

  useEffect(() => {
    api.get("/trips").then((r) => {
      setTrips(r.data || []);
      if (!selectedTripId && r.data?.[0]) setSelectedTripId(r.data[0].id);
    }).catch(() => {});
  }, []);

  const pickFromGallery = async () => {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission needed", "Please allow photo access to pick a bill."); return; }
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
      base64: true,
    });
    if (!res.canceled && res.assets?.[0]) {
      setImageUri(res.assets[0].uri);
      setImageBase64(res.assets[0].base64 || null);
      setResult(null);
    }
  };

  const captureFromCamera = async () => {
    if (Platform.OS === "web") { pickFromGallery(); return; }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Please allow camera access to scan a bill."); return; }
    const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.6, base64: true });
    if (!res.canceled && res.assets?.[0]) {
      setImageUri(res.assets[0].uri);
      setImageBase64(res.assets[0].base64 || null);
      setResult(null);
    }
  };

  const onScan = async () => {
    if (!imageBase64) { Alert.alert("Pick an image", "Please capture or pick a bill image first."); return; }
    setScanning(true);
    try {
      const r = await api.post("/scan-bill", { image_base64: imageBase64 });
      setResult(r.data);
      setEditAmount(String(r.data.amount || ""));
      setEditName(r.data.suggested_name || r.data.vendor || "Bill");
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert("Could not scan", typeof detail === "string" ? detail : "Try a clearer photo.");
    } finally {
      setScanning(false);
    }
  };

  const onAddToSplit = async () => {
    const amt = parseFloat(editAmount);
    if (!result || isNaN(amt) || amt <= 0) { Alert.alert("Invalid", "Amount must be a positive number."); return; }
    if (!selectedTripId) { Alert.alert("Pick a split", "Choose which split to add this expense to."); return; }
    const trip = trips.find((t) => t.id === selectedTripId);
    if (!trip) return;
    const meta = categoryMeta[result.category] || categoryMeta.other;
    setAdding(true);
    try {
      await api.post(`/trips/${selectedTripId}/expenses`, {
        name: editName || result.suggested_name || "Bill",
        amount: amt,
        currency: result.currency || trip.currency || "INR",
        category: result.category || "other",
        emoji: meta.emoji,
        paid_by: trip.members[0].id,
        split_among: trip.members.map((m: any) => m.id),
      });
      router.replace({ pathname: "/split/[id]", params: { id: selectedTripId } });
    } catch {
      Alert.alert("Error", "Could not add expense");
    } finally {
      setAdding(false);
    }
  };

  const sym = currencySymbol(result?.currency || "INR");
  const resultMeta = result ? (categoryMeta[result.category] || categoryMeta.other) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 40, paddingBottom: 60, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <TouchableOpacity
            testID="scan-back"
            onPress={() => router.back()}
            style={{ width: 36, height: 36, borderWidth: 1, borderColor: `${c.border}40`, alignItems: "center", justifyContent: "center" }}
          >
            <BackArrow color={c.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={{ fontFamily: type.family.light, fontSize: 10, color: c.textMuted, letterSpacing: 3, textTransform: "uppercase", textAlign: "center" }}>
              Receipt
            </Text>
            <Text style={{ fontFamily: type.family.bold, fontSize: 22, color: c.textPrimary, letterSpacing: -0.5, textAlign: "center" }}>
              Scan Bill
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <Text style={{ fontFamily: type.family.light, fontSize: type.size.sm, color: c.textMuted, marginBottom: 18 }}>
          AI reads the receipt and pre-fills your expense details.
        </Text>

        {/* ── Image preview with viewfinder ── */}
        <View
          testID="scan-preview"
          style={{
            height: PREVIEW_H,
            borderWidth: 1,
            borderColor: `${c.border}40`,
            backgroundColor: c.surface,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            marginBottom: 14,
          }}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : (
            <View style={{ alignItems: "center", gap: 12 }}>
              <ReceiptDoodle color={c.textMuted} />
              <Text style={{ fontFamily: type.family.light, fontSize: 11, color: c.textMuted, letterSpacing: 1.5, textTransform: "uppercase" }}>
                No image yet
              </Text>
            </View>
          )}
          {/* Corner brackets */}
          <ViewfinderFrame width={300} height={PREVIEW_H} color={c.ink} active={scanning || !!imageUri} />
          {/* Sweep line */}
          <ScanLine width={300} height={PREVIEW_H} active={scanning} />
        </View>

        {/* ── Camera / Gallery buttons ── */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <InkButton
              label="Camera"
              onPress={captureFromCamera}
              icon={<CameraIcon color={c.textPrimary} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <InkButton
              label="Gallery"
              onPress={pickFromGallery}
              icon={<GalleryIcon color={c.textPrimary} />}
            />
          </View>
        </View>

        {/* ── Scan CTA ── */}
        <InkButton
          label="Scan with AI"
          onPress={onScan}
          disabled={!imageBase64 || scanning}
          loading={scanning}
          icon={<SparkleIcon color={c.bg} />}
          solid
        />

        {/* ── Scanned result ── */}
        {result && (
          <View testID="scan-result" style={{ marginTop: 24 }}>
            {/* Section heading */}
            <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 10 }}>
              Scanned
            </Text>

            {/* Vendor + amount ledger row */}
            <View style={{ borderTopWidth: 1, borderTopColor: `${c.border}30` }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: `${c.border}15` }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: type.family.semibold, fontSize: type.size.sm, color: c.textPrimary }}>
                    {result.vendor || "Unknown vendor"}
                  </Text>
                  <Text style={{ fontFamily: type.family.regular, fontSize: 11, color: c.textMuted, marginTop: 2 }}>
                    {resultMeta?.label}  ·  {result.date || "—"}
                  </Text>
                </View>
                <Text style={{ fontFamily: type.family.bold, fontSize: 18, color: c.textPrimary, letterSpacing: -0.5 }}>
                  {sym}{Math.round(parseFloat(editAmount) || 0).toLocaleString("en-IN")}
                </Text>
              </View>

              {/* Edit name */}
              <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: `${c.border}15` }}>
                <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
                  Expense name
                </Text>
                <TextInput
                  testID="scan-edit-name"
                  value={editName}
                  onChangeText={setEditName}
                  style={{
                    borderWidth: 1,
                    borderColor: `${c.border}40`,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: c.textPrimary,
                    fontSize: type.size.sm,
                    fontFamily: type.family.regular,
                  } as any}
                />
              </View>

              {/* Edit amount */}
              <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: `${c.border}15` }}>
                <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
                  Amount ({result.currency || "INR"})
                </Text>
                <TextInput
                  testID="scan-edit-amount"
                  value={editAmount}
                  onChangeText={(t) => setEditAmount(t.replace(/[^0-9.]/g, ""))}
                  keyboardType="decimal-pad"
                  style={{
                    borderWidth: 1,
                    borderColor: `${c.border}40`,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: c.textPrimary,
                    fontSize: type.size.sm,
                    fontFamily: type.family.regular,
                  } as any}
                />
              </View>
            </View>

            {/* Trip picker — ledger rows */}
            <Text style={{ fontFamily: type.family.regular, fontSize: 10, color: c.textMuted, letterSpacing: 2.5, textTransform: "uppercase", marginTop: 18, marginBottom: 8 }}>
              Add to split
            </Text>
            <View style={{ borderTopWidth: 1, borderTopColor: `${c.border}30` }}>
              {trips.map((t) => {
                const active = selectedTripId === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    testID={`scan-trip-${t.id}`}
                    onPress={() => setSelectedTripId(t.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: `${c.border}15`,
                    }}
                  >
                    {/* Selection indicator */}
                    <View style={{
                      width: 14, height: 14,
                      borderWidth: 1,
                      borderColor: active ? c.ink : `${c.border}60`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      {active && <View style={{ width: 6, height: 6, backgroundColor: c.ink }} />}
                    </View>
                    <Text style={{ fontFamily: active ? type.family.medium : type.family.regular, fontSize: type.size.sm, color: active ? c.textPrimary : c.textSecondary }}>
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Add to split CTA */}
            <View style={{ marginTop: 20 }}>
              <InkButton
                label="Add to split"
                onPress={onAddToSplit}
                disabled={adding}
                loading={adding}
                icon={<AddIcon color={c.bg} />}
                solid
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
