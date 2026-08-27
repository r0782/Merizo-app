import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { api } from "../src/lib/api";
import { confirmAction } from "../src/lib/confirm";
import { UserQrScanner } from "../src/components/UserQrScanner";

export default function FriendsScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ addEmail?: string }>();
  const { width } = useWindowDimensions();
  // Scanning isn't a desktop/PC workflow (no consistent camera access across
  // browsers) — hide the scan entry there, keep manual add-by-email everywhere.
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [prefillEmail, setPrefillEmail] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api.get("/friends");
      setItems(r.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  // Arrived here from scanning a profile QR (see navigateToMerizoLink) —
  // open the add sheet prefilled with the scanned email.
  useEffect(() => {
    if (params.addEmail) {
      setPrefillEmail(params.addEmail);
      setShowAdd(true);
    }
  }, [params.addEmail]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onDelete = async (id: string) => {
    const ok = await confirmAction("Remove friend?", "", "Remove", true);
    if (!ok) return;
    try {
      await api.delete(`/friends/${id}`);
      setItems((arr) => arr.filter((x) => x.id !== id));
    } catch {
      Alert.alert("Error", "Could not remove friend");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 60, paddingBottom: 100, paddingHorizontal: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            testID="friends-back"
            onPress={() => router.back()}
            style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Ionicons name="arrow-back" size={20} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: c.textPrimary, fontSize: 22, fontFamily: "Manrope_700Bold" }}>Friends</Text>
          <TouchableOpacity
            testID="friends-add"
            onPress={() => { setPrefillEmail(""); setShowAdd(true); }}
            style={[styles.iconBtn, { backgroundColor: c.indigo, borderColor: "transparent" }]}
          >
            <Ionicons name="add" size={20} color={c.bg} />
          </TouchableOpacity>
        </View>

        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.6, marginTop: 22 }}>
          YOUR FRIENDS
        </Text>

        {loading ? (
          <ActivityIndicator color={c.indigo} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Ionicons name="people-outline" size={48} color={c.textMuted} />
            <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: "800", marginTop: 12 }}>No friends yet</Text>
            <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 6, textAlign: "center" }}>
              {isDesktopWeb
                ? "Tap + to add a friend by email."
                : "Tap + to scan a profile QR or add by email."}
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            {items.map((f) => (
              <FriendRow key={f.id} friend={f} onDelete={() => onDelete(f.id)} />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <AddFriendSheet
          prefillEmail={prefillEmail}
          isDesktopWeb={isDesktopWeb}
          onClose={() => setShowAdd(false)}
          onAdded={(newFriend: any) => {
            setShowAdd(false);
            setItems((arr) => {
              if (arr.some((x) => x.id === newFriend.id)) return arr;
              return [newFriend, ...arr];
            });
          }}
        />
      </Modal>
    </View>
  );
}

function FriendRow({ friend, onDelete }: any) {
  const { c } = useTheme();
  const initial = (friend.friend_name || friend.friend_email || "?").charAt(0).toUpperCase();
  return (
    <View style={[styles.friendRow, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[styles.avatar, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: c.textPrimary }}>{initial}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>{friend.friend_name || friend.friend_email}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 2 }}>{friend.friend_email}</Text>
      </View>
      <TouchableOpacity
        testID={`friend-remove-${friend.id}`}
        onPress={onDelete}
        style={{ marginLeft: 10, padding: 6 }}
      >
        <Ionicons name="trash-outline" size={18} color={c.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

function AddFriendSheet({ onClose, onAdded, prefillEmail, isDesktopWeb }: any) {
  const { c } = useTheme();
  const [email, setEmail] = useState(prefillEmail || "");
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => { setEmail(prefillEmail || ""); }, [prefillEmail]);

  const submit = async (emailToAdd: string) => {
    const value = emailToAdd.trim();
    if (!value) {
      Alert.alert("Add an email", "Enter a friend's email to continue.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.post("/friends", { email: value });
      onAdded(r.data);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert("Could not add friend", typeof detail === "string" ? detail : "Please try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.bg, borderColor: c.border }]}>
        <View style={styles.sheetHandle}>
          <View style={[styles.handleBar, { backgroundColor: c.textMuted }]} />
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: c.textPrimary, fontSize: 22, fontFamily: "Manrope_700Bold" }}>Add a friend</Text>

          {!isDesktopWeb && (
            <TouchableOpacity
              testID="friend-scan"
              onPress={() => setScannerOpen(true)}
              style={[styles.scanBtn, { borderColor: c.border, backgroundColor: c.surface }]}
            >
              <Ionicons name="qr-code-outline" size={18} color={c.textPrimary} />
              <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "600", marginLeft: 10 }}>
                Scan their profile QR
              </Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.sheetLabel, { color: c.textSecondary }]}>OR ADD BY EMAIL</Text>
          <TextInput
            testID="friend-email"
            value={email}
            onChangeText={setEmail}
            placeholder="e.g. friend@email.com"
            placeholderTextColor={c.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary }]}
          />

          <TouchableOpacity
            testID="friend-submit"
            onPress={() => submit(email)}
            disabled={submitting}
            style={[styles.primaryBtn, { backgroundColor: c.indigo, marginTop: 22 }]}
          >
            {submitting ? (
              <ActivityIndicator color={c.bg} />
            ) : (
              <Text style={{ color: c.bg, fontSize: 15, fontWeight: "700" }}>Add friend</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <UserQrScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={(scannedEmail) => {
          setScannerOpen(false);
          setEmail(scannedEmail);
          submit(scannedEmail);
        }}
      />
    </KeyboardAvoidingView>
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
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    paddingBottom: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: "90%",
  },
  sheetHandle: { alignItems: "center", paddingVertical: 12 },
  handleBar: { width: 36, height: 4, borderRadius: 999 },
  sheetLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 8,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 18,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
