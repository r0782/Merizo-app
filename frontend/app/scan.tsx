import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../src/lib/theme";
import { api } from "../src/lib/api";
import { categoryMeta, currencySymbol } from "../src/lib/tokens";
import { SmartNum } from "../src/components/DotNum";

export default function ScanBillScreen() {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ trip_id?: string }>();
  const tripId = params.trip_id as string | undefined;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | undefined>(tripId);
  const [adding, setAdding] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const [editName, setEditName] = useState("");

  React.useEffect(() => {
    api.get("/trips").then((r) => {
      setTrips(r.data || []);
      if (!selectedTripId && r.data?.[0]) setSelectedTripId(r.data[0].id);
    }).catch(() => {});
  }, []);

  const pickFromGallery = async () => {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow photo access to pick a bill.");
        return;
      }
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
    if (Platform.OS === "web") {
      // On web, fall back to gallery
      pickFromGallery();
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow camera access to scan a bill.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
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

  const onScan = async () => {
    if (!imageBase64) {
      Alert.alert("Pick an image", "Please capture or pick a bill image first.");
      return;
    }
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
    if (!result || isNaN(amt) || amt <= 0) {
      Alert.alert("Invalid", "Amount must be a positive number.");
      return;
    }
    if (!selectedTripId) {
      Alert.alert("Pick a split", "Choose which split to add this expense to.");
      return;
    }
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
    } catch (e: any) {
      Alert.alert("Error", "Could not add expense");
    } finally {
      setAdding(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: 60, paddingBottom: 40, paddingHorizontal: 24 }}>
        <View style={styles.topBar}>
          <TouchableOpacity
            testID="scan-back"
            onPress={() => router.back()}
            style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Ionicons name="arrow-back" size={20} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: c.textPrimary, fontSize: 22, fontFamily: "Syne_700Bold" }}>Scan Bill</Text>
          <View style={{ width: 38 }} />
        </View>

        <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 18 }}>
          AI reads the receipt and pre-fills your expense.
        </Text>

        {/* Image preview */}
        <View
          testID="scan-preview"
          style={[
            styles.previewBox,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={{ alignItems: "center" }}>
              <Ionicons name="receipt-outline" size={48} color={c.textMuted} />
              <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 8 }}>
                No image yet
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <TouchableOpacity
            testID="scan-camera-btn"
            onPress={captureFromCamera}
            style={[styles.actionBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Ionicons name="camera-outline" size={18} color={c.textPrimary} />
            <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700", marginLeft: 8 }}>
              Camera
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="scan-gallery-btn"
            onPress={pickFromGallery}
            style={[styles.actionBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Ionicons name="images-outline" size={18} color={c.textPrimary} />
            <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700", marginLeft: 8 }}>
              Gallery
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          testID="scan-submit-btn"
          onPress={onScan}
          disabled={!imageBase64 || scanning}
          style={[
            styles.primaryBtn,
            {
              backgroundColor: isDark ? c.indigo : "#0A0A0A",
              opacity: !imageBase64 || scanning ? 0.5 : 1,
              marginTop: 14,
            },
          ]}
        >
          {scanning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="sparkles-outline" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700", marginLeft: 8 }}>
                Scan with AI
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Result */}
        {result && (
          <View
            testID="scan-result"
            style={[styles.resultCard, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 }}>
              SCANNED
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14 }}>
              <View
                style={[
                  styles.resEmoji,
                  { backgroundColor: (categoryMeta[result.category] || categoryMeta.other).tint + "22" },
                ]}
              >
                <Text style={{ fontSize: 22 }}>
                  {(categoryMeta[result.category] || categoryMeta.other).emoji}
                </Text>
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: "700" }}>
                  {result.vendor || "Unknown vendor"}
                </Text>
                <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 2 }}>
                  {(categoryMeta[result.category] || categoryMeta.other).label} · {result.date}
                </Text>
              </View>
              <SmartNum
                value={`${currencySymbol(result.currency || "INR")}${Math.round(parseFloat(editAmount) || 0).toLocaleString("en-IN")}`}
                size="md"
                color={isDark ? "indigo" : "black"}
              />
            </View>

            <View style={{ marginTop: 18 }}>
              <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>NAME</Text>
              <TextInput
                testID="scan-edit-name"
                value={editName}
                onChangeText={setEditName}
                style={[styles.input, { backgroundColor: c.bg, borderColor: c.border, color: c.textPrimary }]}
              />
            </View>
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>AMOUNT ({result.currency || "INR"})</Text>
              <TextInput
                testID="scan-edit-amount"
                value={editAmount}
                onChangeText={(t) => setEditAmount(t.replace(/[^0-9.]/g, ""))}
                keyboardType="decimal-pad"
                style={[styles.input, { backgroundColor: c.bg, borderColor: c.border, color: c.textPrimary }]}
              />
            </View>

            {/* Trip picker */}
            <Text style={[styles.fieldLabel, { color: c.textSecondary, marginTop: 16 }]}>ADD TO SPLIT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 4 }}>
              {trips.map((t) => {
                const active = selectedTripId === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    testID={`scan-trip-${t.id}`}
                    onPress={() => setSelectedTripId(t.id)}
                    style={[
                      styles.tripChip,
                      {
                        backgroundColor: active ? (isDark ? c.indigo : "#0A0A0A") : c.bg,
                        borderColor: active ? "transparent" : c.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? "#fff" : c.textPrimary, fontSize: 12, fontWeight: "700" }}>
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              testID="scan-add-btn"
              onPress={onAddToSplit}
              disabled={adding}
              style={[
                styles.primaryBtn,
                { backgroundColor: isDark ? c.indigo : "#0A0A0A", marginTop: 18, opacity: adding ? 0.7 : 1 },
              ]}
            >
              {adding ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                  Add to split
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  previewBox: {
    marginTop: 18,
    height: 220,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewImage: { width: "100%", height: "100%" },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  resultCard: {
    marginTop: 22,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
  },
  resEmoji: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
  },
  tripChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
});
