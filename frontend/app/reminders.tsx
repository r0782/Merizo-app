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
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useTheme } from "../src/lib/theme";
import { api } from "../src/lib/api";
import { SmartNum } from "../src/components/DotNum";
import { currencySymbol } from "../src/lib/tokens";
import { setNotifId, popNotifId } from "../src/lib/settings";
import { confirmAction } from "../src/lib/confirm";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RemindersScreen() {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [permission, setPermission] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        const { status } = await Notifications.getPermissionsAsync();
        setPermission(status === "granted");
      }
    })();
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/reminders");
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

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const enableNotifications = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Notifications", "Push notifications work on iOS and Android. On web, reminders are saved but not pushed.");
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    setPermission(status === "granted");
    if (status !== "granted") {
      Alert.alert("Permission denied", "Enable notifications in system settings to get reminders.");
    }
  };

  const scheduleReminder = async (rem: any) => {
    if (Platform.OS === "web") return;
    if (!permission) return;
    if (!rem.due_date) return;
    try {
      const date = new Date(rem.due_date + "T09:00:00");
      if (date.getTime() <= Date.now()) return;
      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Merizo reminder",
          body: rem.amount
            ? `${rem.title} · ${currencySymbol("INR")}${rem.amount}`
            : rem.title,
          data: { reminder_id: rem.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
      await setNotifId(rem.id, notifId);
    } catch {
      // best effort
    }
  };

  const cancelScheduledFor = async (reminderId: string) => {
    try {
      // Always clean up the AsyncStorage entry, even on web (for parity if a stray entry exists).
      const nid = await popNotifId(reminderId);
      if (Platform.OS === "web") return;
      if (nid) {
        await Notifications.cancelScheduledNotificationAsync(nid);
      }
    } catch {
      // best effort
    }
  };

  const onComplete = async (id: string) => {
    try {
      await api.patch(`/reminders/${id}/complete`);
      await cancelScheduledFor(id);
      setItems((arr) => arr.filter((x) => x.id !== id));
    } catch {
      Alert.alert("Error", "Could not update");
    }
  };

  const onDelete = async (id: string) => {
    const ok = await confirmAction("Delete reminder?", "", "Delete", true);
    if (!ok) return;
    try {
      await api.delete(`/reminders/${id}`);
      await cancelScheduledFor(id);
      setItems((arr) => arr.filter((x) => x.id !== id));
    } catch {
      Alert.alert("Error", "Could not delete");
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
            testID="reminders-back"
            onPress={() => router.back()}
            style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Ionicons name="arrow-back" size={20} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: c.textPrimary, fontSize: 22, fontFamily: "Syne_700Bold" }}>Reminders</Text>
          <TouchableOpacity
            testID="reminders-add"
            onPress={() => setShowAdd(true)}
            style={[styles.iconBtn, { backgroundColor: isDark ? c.indigo : "#0A0A0A", borderColor: "transparent" }]}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {Platform.OS !== "web" && permission === false && (
          <TouchableOpacity
            testID="reminders-enable-push"
            onPress={enableNotifications}
            style={[styles.banner, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Ionicons name="notifications-outline" size={18} color={c.indigo} />
            <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: "600", marginLeft: 10, flex: 1 }}>
              Enable push notifications to get alerts
            </Text>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </TouchableOpacity>
        )}

        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.6, marginTop: 22 }}>
          UPCOMING
        </Text>

        {loading ? (
          <ActivityIndicator color={c.indigo} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Ionicons name="checkmark-circle-outline" size={48} color={c.positive} />
            <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: "800", marginTop: 12 }}>All caught up</Text>
            <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 6, textAlign: "center" }}>
              Tap + to add a payment reminder.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            {items.map((r) => (
              <ReminderRow
                key={r.id}
                reminder={r}
                onComplete={() => onComplete(r.id)}
                onDelete={() => onDelete(r.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <AddReminderSheet
          onClose={() => setShowAdd(false)}
          onAdded={async (newRem: any) => {
            setShowAdd(false);
            setItems((arr) => [newRem, ...arr]);
            await scheduleReminder(newRem);
          }}
        />
      </Modal>
    </View>
  );
}

function ReminderRow({ reminder, onComplete, onDelete }: any) {
  const { c, isDark } = useTheme();
  const due = reminder.due_date;
  const dueDate = due ? new Date(due) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let daysAway: number | null = null;
  let isOverdue = false;
  if (dueDate) {
    const diff = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    daysAway = diff;
    isOverdue = diff < 0;
  }
  const dueLabel = daysAway === null
    ? "No due date"
    : isOverdue
      ? `Overdue by ${Math.abs(daysAway)}d`
      : daysAway === 0
        ? "Due today"
        : daysAway === 1
          ? "Due tomorrow"
          : `Due in ${daysAway}d`;

  return (
    <View style={[styles.reminderRow, { backgroundColor: c.surface, borderColor: c.border }]}>
      <TouchableOpacity
        testID={`rem-complete-${reminder.id}`}
        onPress={onComplete}
        style={[styles.checkbox, { borderColor: c.border }]}
      >
        <View style={{ width: 16, height: 16, borderRadius: 999, borderWidth: 2, borderColor: c.textMuted }} />
      </TouchableOpacity>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700" }}>{reminder.title}</Text>
        <Text style={{ color: isOverdue ? c.negative : c.textSecondary, fontSize: 11, marginTop: 4, fontWeight: "600" }}>
          {dueLabel}
        </Text>
      </View>
      {!!reminder.amount && (
        <SmartNum
          value={`${currencySymbol("INR")}${Math.round(reminder.amount).toLocaleString("en-IN")}`}
          size="sm"
          color={isDark ? "indigo" : "black"}
        />
      )}
      <TouchableOpacity
        testID={`rem-delete-${reminder.id}`}
        onPress={onDelete}
        style={{ marginLeft: 10, padding: 6 }}
      >
        <Ionicons name="trash-outline" size={18} color={c.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

function AddReminderSheet({ onClose, onAdded }: any) {
  const { c, isDark } = useTheme();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("3");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Add a title", "What is this reminder for?");
      return;
    }
    setSubmitting(true);
    try {
      const d = new Date();
      const daysVal = parseInt(days || "0", 10) || 0;
      d.setDate(d.getDate() + daysVal);
      const r = await api.post("/reminders", {
        title: title.trim(),
        amount: amount ? parseFloat(amount) : null,
        due_date: d.toISOString().slice(0, 10),
      });
      onAdded(r.data);
    } catch {
      Alert.alert("Error", "Could not add reminder");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.bg, borderColor: c.border }]}>
        <View style={styles.sheetHandle}>
          <View style={[styles.handleBar, { backgroundColor: c.textMuted }]} />
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: c.textPrimary, fontSize: 22, fontFamily: "Syne_700Bold" }}>New reminder</Text>

          <Text style={[styles.sheetLabel, { color: c.textSecondary }]}>WHAT</Text>
          <TextInput
            testID="rem-title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Pay Aman for flights"
            placeholderTextColor={c.textMuted}
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary }]}
          />

          <Text style={[styles.sheetLabel, { color: c.textSecondary }]}>AMOUNT (OPTIONAL)</Text>
          <TextInput
            testID="rem-amount"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={c.textMuted}
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary }]}
          />

          <Text style={[styles.sheetLabel, { color: c.textSecondary }]}>WHEN</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[
              { d: "0", label: "Today" },
              { d: "1", label: "Tomorrow" },
              { d: "3", label: "3 days" },
              { d: "7", label: "1 week" },
            ].map((p) => {
              const active = days === p.d;
              return (
                <TouchableOpacity
                  key={p.d}
                  testID={`rem-when-${p.d}`}
                  onPress={() => setDays(p.d)}
                  style={[
                    styles.whenChip,
                    {
                      backgroundColor: active ? (isDark ? c.indigo : "#0A0A0A") : c.surface,
                      borderColor: active ? "transparent" : c.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? "#fff" : c.textPrimary, fontSize: 12, fontWeight: "700" }}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            testID="rem-submit"
            onPress={onSubmit}
            disabled={submitting}
            style={[styles.primaryBtn, { backgroundColor: isDark ? c.indigo : "#0A0A0A", marginTop: 22 }]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Add reminder</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
  banner: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
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
    marginTop: 14,
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
  },
  whenChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
