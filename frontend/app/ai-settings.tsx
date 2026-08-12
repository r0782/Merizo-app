import { useState, useEffect } from "react";
import {
  View, Text, Switch, TouchableOpacity, ScrollView, Alert, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SparkleIcon, MicrophoneIcon, SpeakerHighIcon, GaugeIcon,
  ArrowLeftIcon, TrashIcon, CheckIcon, ArrowRightIcon,
} from "phosphor-react-native";
import { useTheme } from "../src/lib/theme";
import { spacing, radius, type } from "../src/lib/tokens";

const KEYS = {
  enableAi:     "merizo_ai_enabled",
  enableVoice:  "merizo_voice_enabled",
  voiceOutput:  "merizo_tts_enabled",
  voiceSpeed:   "merizo_voice_speed",
  provider:     "merizo_ai_provider",
};

const PROVIDERS = ["sarvam", "gemini", "groq"] as const;
type Provider = (typeof PROVIDERS)[number];

const SPEEDS = ["slow", "normal", "fast"] as const;
type Speed = (typeof SPEEDS)[number];

const PROVIDER_META: Record<Provider, { name: string; desc: string }> = {
  sarvam: { name: "Sarvam AI",        desc: "Indian languages · voice · on-device" },
  gemini: { name: "Gemini 2.5 Flash", desc: "Google · fast · multimodal" },
  groq:   { name: "Groq llama-3.3",   desc: "Ultra-fast inference · 70B" },
};

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children, c }: any) {
  return (
    <View style={{ marginHorizontal: spacing["5"], marginBottom: spacing["5"] }}>
      <Text style={{
        fontFamily: type.family.medium, fontSize: type.size.xs,
        color: c.textMuted, letterSpacing: type.tracking.widest,
        textTransform: "uppercase", marginBottom: spacing["2"], paddingHorizontal: 2,
      }}>
        {title}
      </Text>
      <View style={{
        backgroundColor: c.surface, borderRadius: radius.xl,
        overflow: "hidden", borderWidth: 1, borderColor: c.border,
      }}>
        {children}
      </View>
    </View>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────
function ToggleRow({ icon, label, desc, value, onChange, c }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing["3"], paddingVertical: 14, paddingHorizontal: spacing["4"] }}>
      <View style={{
        width: 34, height: 34, borderRadius: radius.md,
        backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center",
      }}>
        {icon({ size: 17, color: c.textSecondary })}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: type.family.medium, fontSize: type.size.sm, color: c.textPrimary }}>{label}</Text>
        <Text style={{ fontFamily: type.family.regular, fontSize: type.size.xs, color: c.textSecondary, marginTop: 1 }}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: c.border, true: c.textPrimary }}
        thumbColor="#fff"
      />
    </View>
  );
}

function RowDivider({ c }: any) {
  return <View style={{ height: 1, backgroundColor: c.border, marginLeft: 56 }} />;
}

export default function AISettings() {
  const { c } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [enableAi,    setEnableAi]    = useState(true);
  const [enableVoice, setEnableVoice] = useState(true);
  const [voiceOutput, setVoiceOutput] = useState(false);
  const [voiceSpeed,  setVoiceSpeed]  = useState<Speed>("normal");
  const [provider,    setProvider]    = useState<Provider>("sarvam");
  const [loaded,      setLoaded]      = useState(false);

  useEffect(() => {
    (async () => {
      const [ai, voice, tts, speed, prov] = await Promise.all([
        AsyncStorage.getItem(KEYS.enableAi),
        AsyncStorage.getItem(KEYS.enableVoice),
        AsyncStorage.getItem(KEYS.voiceOutput),
        AsyncStorage.getItem(KEYS.voiceSpeed),
        AsyncStorage.getItem(KEYS.provider),
      ]);
      if (ai    !== null) setEnableAi(ai === "true");
      if (voice !== null) setEnableVoice(voice === "true");
      if (tts   !== null) setVoiceOutput(tts === "true");
      if (speed && SPEEDS.includes(speed as Speed))       setVoiceSpeed(speed as Speed);
      if (prov  && PROVIDERS.includes(prov  as Provider)) setProvider(prov as Provider);
      setLoaded(true);
    })();
  }, []);

  const save = async (key: string, val: string) => AsyncStorage.setItem(key, val).catch(() => {});

  const onResetConversation = () => {
    Alert.alert("Reset conversation", "This clears the AI chat history. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset", style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("merizo_chat_history").catch(() => {});
          Alert.alert("", "Conversation cleared.");
        },
      },
    ]);
  };

  if (!loaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 44, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: spacing["3"],
          paddingHorizontal: spacing["5"], marginBottom: spacing["6"],
        }}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            style={{
              width: 36, height: 36, borderRadius: radius.full,
              backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <ArrowLeftIcon size={17} color={c.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={{ fontFamily: type.family.bold, fontSize: type.size.xl, color: c.textPrimary, letterSpacing: type.tracking.tight }}>
              AI Settings
            </Text>
            <Text style={{ fontFamily: type.family.regular, fontSize: type.size.xs, color: c.textMuted, marginTop: 1 }}>
              Sarvam AI · voice · language
            </Text>
          </View>
        </View>

        {/* ── General ── */}
        <Section title="General" c={c}>
          <ToggleRow
            icon={(p: any) => <SparkleIcon {...p} />}
            label="Enable AI"
            desc="AI expense parsing and suggestions"
            value={enableAi}
            onChange={(v: boolean) => { setEnableAi(v); save(KEYS.enableAi, String(v)); }}
            c={c}
          />
          <RowDivider c={c} />
          <ToggleRow
            icon={(p: any) => <MicrophoneIcon {...p} />}
            label="Voice Input"
            desc="Speak expenses instead of typing"
            value={enableVoice}
            onChange={(v: boolean) => { setEnableVoice(v); save(KEYS.enableVoice, String(v)); }}
            c={c}
          />
          <RowDivider c={c} />
          <ToggleRow
            icon={(p: any) => <SpeakerHighIcon {...p} />}
            label="Voice Output (TTS)"
            desc="AI replies spoken aloud"
            value={voiceOutput}
            onChange={(v: boolean) => { setVoiceOutput(v); save(KEYS.voiceOutput, String(v)); }}
            c={c}
          />
        </Section>

        {/* ── Voice speed ── */}
        {voiceOutput && (
          <Section title="Voice Speed" c={c}>
            <View style={{ flexDirection: "row", padding: spacing["3"], gap: spacing["2"] }}>
              {SPEEDS.map(sp => (
                <TouchableOpacity
                  key={sp}
                  onPress={() => { setVoiceSpeed(sp); save(KEYS.voiceSpeed, sp); }}
                  accessibilityRole="radio"
                  accessibilityLabel={`Speed: ${sp}`}
                  accessibilityState={{ selected: voiceSpeed === sp }}
                  style={{
                    flex: 1, paddingVertical: 11, alignItems: "center",
                    borderRadius: radius.md,
                    backgroundColor: voiceSpeed === sp ? c.textPrimary : c.surfaceAlt,
                    borderWidth: 1,
                    borderColor: voiceSpeed === sp ? c.textPrimary : c.border,
                    flexDirection: "row", justifyContent: "center", gap: 5,
                  }}
                >
                  {voiceSpeed === sp && <GaugeIcon size={13} color={c.bg} />}
                  <Text style={{
                    fontFamily: voiceSpeed === sp ? type.family.semibold : type.family.regular,
                    fontSize: type.size.sm,
                    color: voiceSpeed === sp ? c.bg : c.textSecondary,
                    textTransform: "capitalize",
                  }}>
                    {sp}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>
        )}

        {/* ── AI Provider ── */}
        <Section title="AI Provider" c={c}>
          {PROVIDERS.map((p, i) => (
            <View key={p}>
              {i > 0 && <RowDivider c={c} />}
              <TouchableOpacity
                onPress={() => { setProvider(p); save(KEYS.provider, p); }}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityLabel={PROVIDER_META[p].name}
                accessibilityState={{ selected: provider === p }}
                style={{
                  flexDirection: "row", alignItems: "center", gap: spacing["3"],
                  paddingVertical: 14, paddingHorizontal: spacing["4"],
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: type.family.semibold, fontSize: type.size.sm, color: c.textPrimary }}>
                    {PROVIDER_META[p].name}
                  </Text>
                  <Text style={{ fontFamily: type.family.regular, fontSize: type.size.xs, color: c.textSecondary, marginTop: 2 }}>
                    {PROVIDER_META[p].desc}
                  </Text>
                </View>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: 1.5,
                  borderColor: provider === p ? c.textPrimary : c.border,
                  backgroundColor: provider === p ? c.textPrimary : "transparent",
                  alignItems: "center", justifyContent: "center",
                }}>
                  {provider === p && <CheckIcon size={12} color={c.bg} weight="bold" />}
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </Section>

        {/* ── Data ── */}
        <Section title="Data" c={c}>
          <TouchableOpacity
            onPress={onResetConversation}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Reset conversation history"
            style={{
              flexDirection: "row", alignItems: "center", gap: spacing["3"],
              paddingVertical: 14, paddingHorizontal: spacing["4"],
            }}
          >
            <View style={{
              width: 34, height: 34, borderRadius: radius.md,
              backgroundColor: "rgba(214,69,69,0.08)", alignItems: "center", justifyContent: "center",
            }}>
              <TrashIcon size={17} color={c.negative} />
            </View>
            <Text style={{ flex: 1, fontFamily: type.family.medium, fontSize: type.size.sm, color: c.negative }}>
              Reset Conversation
            </Text>
            <ArrowRightIcon size={15} color={c.textMuted} />
          </TouchableOpacity>
        </Section>
      </ScrollView>
    </View>
  );
}
