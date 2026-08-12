import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { ContactPickerButton } from "../src/components/ContactPicker";
import { api } from "../src/lib/api";
import {
  categoryMeta,
  coverOptions,
  currencyOptions,
  resolveCover,
} from "../src/lib/tokens";

export default function CreateSplitScreen() {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const category = (params.category as string) || "trip";
  const meta = categoryMeta[category] || categoryMeta.other;

  const [step, setStep] = useState(0); // 0,1,2
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [destInput, setDestInput] = useState("");
  const [destinations, setDestinations] = useState<string[]>([]);

  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState<string[]>([]);

  const [currency, setCurrency] = useState("INR");
  const [coverOverride, setCoverOverride] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const cover = useMemo(
    () => resolveCover(destinations, category, coverOverride || undefined),
    [destinations, category, coverOverride]
  );

  const addDest = () => {
    const v = destInput.trim();
    if (v && !destinations.includes(v)) setDestinations((d) => [...d, v]);
    setDestInput("");
  };
  const removeDest = (d: string) => setDestinations((arr) => arr.filter((x) => x !== d));

  const addMember = () => {
    const v = memberInput.trim();
    if (v && !members.includes(v)) setMembers((d) => [...d, v]);
    setMemberInput("");
  };
  const removeMember = (m: string) => setMembers((arr) => arr.filter((x) => x !== m));

  const onNext = () => {
    if (step === 0) {
      if (!name.trim()) {
        Alert.alert("Add a name", "Give this split a name to continue.");
        return;
      }
      // auto-include unsubmitted destination text
      let dests = [...destinations];
      const pending = destInput.trim();
      if (pending && !dests.includes(pending)) {
        dests = [...dests, pending];
        setDestinations(dests);
        setDestInput("");
      }
      setStep(1);
    } else if (step === 1) {
      // auto-include unsubmitted member text on Next
      const pending = memberInput.trim();
      if (pending && !members.includes(pending)) {
        setMembers((arr) => [...arr, pending]);
        setMemberInput("");
      }
      setStep(2);
    }
  };

  const onCreate = async () => {
    // CRITICAL RULE: auto-include unsubmitted member text even if Add not pressed
    const finalMembers = [...members];
    const pendingMember = memberInput.trim();
    if (pendingMember && !finalMembers.includes(pendingMember)) {
      finalMembers.push(pendingMember);
    }
    const finalDests = [...destinations];
    const pendingDest = destInput.trim();
    if (pendingDest && !finalDests.includes(pendingDest)) {
      finalDests.push(pendingDest);
    }

    setSubmitting(true);
    try {
      const res = await api.post("/trips", {
        name: name.trim(),
        split_category: category,
        cover_key: coverOverride || (finalDests[0] || category),
        destinations: finalDests,
        members: finalMembers,
        currency,
        start_date: start || null,
        end_date: end || null,
      });
      // For non-trip categories, the "Start" field is repurposed as a Due Date Reminder.
      if (category !== "trip" && start) {
        try {
          await api.post("/reminders", {
            title: `Settle: ${name.trim()}`,
            due_date: start,
            trip_id: res.data.id,
          });
        } catch {}
      }
      router.replace({ pathname: "/split/[id]", params: { id: res.data.id } });
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert("Could not create split", typeof detail === "string" ? detail : "Please try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: 60, paddingBottom: 40, paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <TouchableOpacity
            testID="create-back"
            onPress={() => (step === 0 ? router.back() : setStep(step - 1))}
            style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Ionicons name="arrow-back" size={20} color={c.textPrimary} />
          </TouchableOpacity>
          <View style={[styles.catChip, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ fontSize: 14 }}>{meta.emoji}</Text>
            <Text style={{ color: c.textPrimary, fontSize: 12, fontWeight: "700", marginLeft: 6 }}>
              {meta.label}
            </Text>
          </View>
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow} testID="step-indicator">
          {[0, 1, 2].map((s) => (
            <View key={s} style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                testID={`step-dot-${s}`}
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: s <= step ? (isDark ? c.indigo : "#0A0A0A") : "transparent",
                    borderColor: s <= step ? "transparent" : c.border,
                  },
                ]}
              >
                <Text style={{ color: s <= step ? "#fff" : c.textSecondary, fontSize: 12, fontWeight: "800" }}>{s + 1}</Text>
              </View>
              {s < 2 && <View style={[styles.stepLine, { backgroundColor: s < step ? (isDark ? c.indigo : "#0A0A0A") : c.border }]} />}
            </View>
          ))}
        </View>

        {/* Step 0 */}
        {step === 0 && (
          <View>
            <Heading>Name & dates</Heading>
            <Field label="Split name" value={name} setValue={setName} placeholder="e.g. Goa Trip" testID="create-name" />

            {category === "trip" ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <DateField label="Start date" value={start} setValue={setStart} testID="create-start" />
                </View>
                <View style={{ flex: 1 }}>
                  <DateField label="End date" value={end} setValue={setEnd} testID="create-end" />
                </View>
              </View>
            ) : (
              <View>
                <DateField
                  label="Due date reminder"
                  value={start}
                  setValue={setStart}
                  testID="create-duedate"
                />
                <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 6 }}>
                  We&apos;ll remind you to settle this split on the due date.
                </Text>
              </View>
            )}

            <ChipInput
              label="Destinations"
              value={destInput}
              onChange={setDestInput}
              onAdd={addDest}
              chips={destinations}
              onRemoveChip={removeDest}
              placeholder="e.g. Goa"
              testID="create-dest"
            />
          </View>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <View>
            <Heading>Members</Heading>
            <ChipInput
              label="Add by name"
              value={memberInput}
              onChange={setMemberInput}
              onAdd={addMember}
              chips={members}
              onRemoveChip={removeMember}
              placeholder="e.g. Aman"
              testID="create-member"
            />

            {/* Divider */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 16 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: "600" }}>OR</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            </View>

            {/* Add from contacts */}
            <ContactPickerButton
              onSelectContacts={(contacts) => {
                setMembers((prev) => {
                  const next = new Set(prev);
                  contacts.forEach((contact) => {
                    const value = contact.trim();
                    if (value) next.add(value);
                  });
                  return Array.from(next);
                });
              }}
            />

            <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 12 }}>
              You{"'"}ll be added automatically. Tip: typed text is auto-included on Next.
            </Text>
          </View>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <View>
            <Heading>Currency & cover</Heading>
            <Text style={{ color: c.textSecondary, fontSize: 12, marginBottom: 10, fontWeight: "600", letterSpacing: 0.4 }}>
              CURRENCY
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {currencyOptions.map((cur) => {
                const active = currency === cur.code;
                return (
                  <TouchableOpacity
                    key={cur.code}
                    testID={`cur-${cur.code}`}
                    onPress={() => setCurrency(cur.code)}
                    style={[
                      styles.curPill,
                      {
                        backgroundColor: active ? (isDark ? c.indigo : "#0A0A0A") : c.surface,
                        borderColor: active ? "transparent" : c.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? "#fff" : c.textPrimary, fontWeight: "700", fontSize: 13 }}>{cur.code} {cur.symbol}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 22, marginBottom: 10, fontWeight: "600", letterSpacing: 0.4 }}>
              COVER IMAGE
            </Text>
            <View style={[styles.coverPreview, { borderColor: c.border }]}>
              <Image source={{ uri: cover }} style={{ width: "100%", height: 160 }} />
            </View>
            <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 6 }}>
              Auto-resolved from destination + category. Tap a thumbnail to override.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
              {coverOptions.map((opt) => {
                const active = coverOverride === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    testID={`cover-${opt.key}`}
                    onPress={() => setCoverOverride(active ? null : opt.key)}
                    style={[styles.coverThumbWrap, { borderColor: active ? c.indigo : c.border, borderWidth: active ? 2 : 1 }]}
                  >
                    <Image source={{ uri: opt.url }} style={{ width: 80, height: 60 }} />
                    <Text style={{ position: "absolute", bottom: 4, left: 6, color: "#fff", fontSize: 10, fontWeight: "700" }}>{opt.category}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Bottom action */}
        <TouchableOpacity
          testID="create-action"
          disabled={submitting}
          onPress={step === 2 ? onCreate : onNext}
          style={[styles.primaryBtn, { backgroundColor: isDark ? c.indigo : "#0A0A0A", marginTop: 28, opacity: submitting ? 0.7 : 1 }]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
              {step === 2 ? "Create split" : "Next"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Text
      style={{
        color: c.textPrimary,
        fontSize: 26,
        fontFamily: "Manrope_700Bold",
        letterSpacing: -0.5,
        marginTop: 28,
        marginBottom: 22,
      }}
    >
      {children}
    </Text>
  );
}

function DateField({
  label,
  value,
  setValue,
  testID,
}: {
  label: string;
  value: string;
  setValue: (s: string) => void;
  testID?: string;
}) {
  const { c, isDark } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Local edit state inside the modal
  const [py, setPy] = useState("");
  const [pm, setPm] = useState("");
  const [pd, setPd] = useState("");

  const openPicker = () => {
    if (value) {
      const [y, m, d] = value.split("-");
      setPy(y || ""); setPm(m || ""); setPd(d || "");
    } else {
      const now = new Date();
      setPy(String(now.getFullYear()));
      setPm(String(now.getMonth() + 1).padStart(2, "0"));
      setPd(String(now.getDate()).padStart(2, "0"));
    }
    setPickerOpen(true);
  };

  const confirmPicker = () => {
    const y = py.trim().padStart(4, "0");
    const m = pm.trim().padStart(2, "0");
    const d = pd.trim().padStart(2, "0");
    const month = Math.min(12, Math.max(1, parseInt(m) || 1));
    const day   = Math.min(31, Math.max(1, parseInt(d) || 1));
    setValue(`${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    setPickerOpen(false);
  };

  const presets = [
    { label: "Today", days: 0 },
    { label: "+1 wk", days: 7 },
    { label: "+1 mo", days: 30 },
  ];

  const setPreset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setValue(d.toISOString().slice(0, 10));
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: c.textSecondary, fontSize: 12, marginBottom: 8, fontWeight: "600", letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </Text>
      <View
        style={[
          styles.input,
          {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.surface,
            borderColor: c.border,
            paddingVertical: 0,
            paddingHorizontal: 0,
          },
        ]}
      >
        <TextInput
          testID={testID}
          value={value}
          onChangeText={setValue}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={c.textMuted}
          style={{ flex: 1, color: c.textPrimary, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 }}
          keyboardType="numeric"
        />
        <TouchableOpacity
          testID={`${testID}-pick`}
          onPress={openPicker}
          style={{ paddingHorizontal: 12, paddingVertical: 12 }}
        >
          <Ionicons name="calendar-outline" size={18} color="#6D5DFC" />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
        {presets.map((p) => (
          <TouchableOpacity
            key={p.label}
            testID={`${testID}-preset-${p.days}`}
            onPress={() => setPreset(p.days)}
            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }}
          >
            <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: "700" }}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date Picker Modal — pure RN, works on web + native */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: c.textPrimary, marginBottom: 20 }}>Select {label}</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
              {[
                { label: "YYYY", val: py, set: setPy, max: 4, hint: "Year" },
                { label: "MM",   val: pm, set: setPm, max: 2, hint: "Month" },
                { label: "DD",   val: pd, set: setPd, max: 2, hint: "Day" },
              ].map((f) => (
                <View key={f.label} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: c.textSecondary, letterSpacing: 1, marginBottom: 6 }}>{f.hint}</Text>
                  <TextInput
                    value={f.val}
                    onChangeText={f.set}
                    placeholder={f.label}
                    placeholderTextColor={c.textMuted}
                    keyboardType="numeric"
                    maxLength={f.max}
                    style={{ backgroundColor: isDark ? "#2C2C2E" : "#F0EDE8", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: "700", color: c.textPrimary, textAlign: "center" }}
                  />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              {presets.map((p) => (
                <TouchableOpacity key={p.label} onPress={() => { setPreset(p.days); setPickerOpen(false); }} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: isDark ? "#2C2C2E" : "#F0EDE8", alignItems: "center" }}>
                  <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: "600" }}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={confirmPicker} style={{ backgroundColor: "#6D5DFC", borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 10 }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPickerOpen(false)} style={{ alignItems: "center", padding: 8 }}>
              <Text style={{ color: c.textSecondary, fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({
  label,
  value,
  setValue,
  placeholder,
  testID,
}: {
  label: string;
  value: string;
  setValue: (s: string) => void;
  placeholder?: string;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: c.textSecondary, fontSize: 12, marginBottom: 8, fontWeight: "600", letterSpacing: 0.4 }}>{label.toUpperCase()}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary }]}
      />
    </View>
  );
}

function ChipInput({
  label,
  value,
  onChange,
  onAdd,
  chips,
  onRemoveChip,
  placeholder,
  testID,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  onAdd: () => void;
  chips: string[];
  onRemoveChip: (chip: string) => void;
  placeholder?: string;
  testID?: string;
}) {
  const { c, isDark } = useTheme();
  return (
    <View style={{ marginTop: 4 }}>
      <Text style={{ color: c.textSecondary, fontSize: 12, marginBottom: 8, fontWeight: "600", letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          testID={`${testID}-input`}
          value={value}
          onChangeText={onChange}
          onSubmitEditing={onAdd}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          style={[styles.input, { flex: 1, backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary }]}
        />
        <TouchableOpacity
          testID={`${testID}-add`}
          onPress={onAdd}
          style={[styles.addBtn, { backgroundColor: isDark ? c.indigo : "#0A0A0A" }]}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {chips.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {chips.map((chip) => (
            <TouchableOpacity
              key={chip}
              testID={`${testID}-chip-${chip}`}
              onPress={() => onRemoveChip(chip)}
              style={[styles.chip, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: "600" }}>{chip}</Text>
              <Ionicons name="close" size={14} color={c.textSecondary} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  stepRow: { flexDirection: "row", alignItems: "center", marginTop: 28 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  stepLine: { width: 36, height: 2, marginHorizontal: 6 },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  curPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  coverPreview: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  coverThumbWrap: {
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
