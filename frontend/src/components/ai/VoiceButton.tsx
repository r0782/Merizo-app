import React, { useEffect, useRef, useState } from "react";
import { TouchableOpacity, Platform, Alert, PermissionsAndroid, View } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence,
  cancelAnimation, interpolate, Extrapolation, Easing, type SharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useTheme } from "../../lib/theme";
import { getCurrentLanguage, getLanguageMeta } from "../../lib/i18n";
import * as AndroidSpeech from "../../lib/androidSpeech";

// Errors that just mean "nothing useful was said" rather than a real failure —
// worth staying silent about rather than alarming the user with a dialog.
const SILENT_ANDROID_ERRORS = new Set(["no_match", "speech_timeout", "client_error"]);

const BUTTON_SIZE = 42;
// Center-peaked so the middle bar reacts most, like a real equalizer.
const BAR_WEIGHTS = [0.4, 0.75, 1, 0.75, 0.4];

// android.speech.SpeechRecognizer's RMS isn't true dBFS — it's a small
// relative range that empirically tops out around 8-10 during normal speech.
function normalizeAndroidRms(rmsdB: number) {
  "worklet";
  return Math.max(0, Math.min(1, rmsdB / 9));
}
// expo-av metering is dBFS: silence near -160, typical speech around -30..-10.
function normalizeIosMetering(db: number) {
  "worklet";
  return Math.max(0, Math.min(1, (db + 50) / 50));
}

// ── Waveform bar — height reacts to live volume, with a gentle idle wobble
// so the equalizer doesn't look dead the instant the speaker pauses ────────────
function Bar({ weight, volume, idle, color }: {
  weight: number; volume: SharedValue<number>; idle: SharedValue<number>; color: string;
}) {
  const style = useAnimatedStyle(() => {
    const idleWobble = interpolate(idle.value, [0, 1], [0.12, 0.3]);
    const level = Math.max(volume.value * weight, idleWobble * weight);
    const height = 5 + level * 16;
    return { height };
  });
  return <Animated.View style={[{ width: 3, borderRadius: 1.5, backgroundColor: color }, style]} />;
}

function Waveform({ volume, idle, color }: {
  volume: SharedValue<number>; idle: SharedValue<number>; color: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 20 }}>
      {BAR_WEIGHTS.map((w, i) => <Bar key={i} weight={w} volume={volume} idle={idle} color={color} />)}
    </View>
  );
}

// ── Ripple — expands and fades outward with volume, like a sound wave ──────────
function Ripple({ volume, idle, color }: {
  volume: SharedValue<number>; idle: SharedValue<number>; color: string;
}) {
  const style = useAnimatedStyle(() => {
    const level = Math.max(volume.value, idle.value * 0.5);
    const scale = interpolate(level, [0, 1], [1, 1.7], Extrapolation.CLAMP);
    const opacity = interpolate(level, [0, 1], [0.22, 0.04], Extrapolation.CLAMP);
    return { transform: [{ scale }], opacity };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{
        position: "absolute", width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: BUTTON_SIZE / 2,
        backgroundColor: color,
      }, style]}
    />
  );
}

// ── Glow ring — soft breathing outline while listening ──────────────────────
function GlowRing({ idle, color }: { idle: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(idle.value, [0, 1], [0.25, 0.8]),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{
        position: "absolute", width: BUTTON_SIZE + 8, height: BUTTON_SIZE + 8, borderRadius: (BUTTON_SIZE + 8) / 2,
        borderWidth: 1.5, borderColor: color,
      }, style]}
    />
  );
}

export function VoiceButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const { c } = useTheme();
  const isFocused = useIsFocused();
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const recordingRef = useRef<any>(null);
  const isStartingRef = useRef(false);   // guard against double-press race
  const isRecordingRef = useRef(false);  // mirrors isRecording for use in effects/cleanup

  // Live mic volume, 0..1, smoothed on the UI thread by each update's withTiming.
  const volume = useSharedValue(0);
  // Slow idle "breathing" loop so the ring/waveform stay alive between words.
  const idle = useSharedValue(0);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const startIdleBreath = () => {
    idle.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  };
  const stopIdleBreath = () => {
    cancelAnimation(idle);
    idle.value = withTiming(0, { duration: 200 });
  };
  const pushVolume = (v: number) => {
    volume.value = withTiming(v, { duration: 90, easing: Easing.out(Easing.ease) });
  };
  const resetVolume = () => {
    cancelAnimation(volume);
    volume.value = withTiming(0, { duration: 150 });
  };

  const startPulse = () => startIdleBreath();
  const stopPulse = () => { stopIdleBreath(); resetVolume(); };

  const finishAndroidTurn = (transcript?: string) => {
    stopPulse();
    setIsRecording(false);
    setIsLoading(false);
    if (transcript) onTranscript(transcript);
  };

  const startAndroidNative = async () => {
    // check() is a cheap local read; request() always does extra work to decide
    // whether a rationale/dialog is needed even when already granted — skipping
    // it on the already-granted hot path removes a chunk of the tap-to-listening delay.
    const alreadyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (!alreadyGranted) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "Microphone permission",
          message: "Merizo needs microphone access for voice input.",
          buttonPositive: "Allow",
        }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error("permission_denied");
      }
    }
    const languageTag = getLanguageMeta(getCurrentLanguage()).region;
    await AndroidSpeech.start({
      languageTag,
      onVolume: (rmsdB) => pushVolume(normalizeAndroidRms(rmsdB)),
      onFinal: (event) => {
        finishAndroidTurn(event.text || undefined);
        if (!event.text) Alert.alert("Didn't catch that", "No speech detected — please try again.");
      },
      onError: (event) => {
        finishAndroidTurn();
        if (!SILENT_ANDROID_ERRORS.has(event.message)) {
          Alert.alert("Voice input failed", "Please try again or type instead.");
        }
      },
    });
  };

  const safeUnload = async () => {
    if (recordingRef.current) {
      try {
        const status = await recordingRef.current.getStatusAsync();
        if (status?.isRecording) {
          await recordingRef.current.stopAndUnloadAsync();
        } else if (!status?.isDoneRecording) {
          await recordingRef.current.stopAndUnloadAsync();
        }
      } catch {}
      recordingRef.current = null;
    }
  };

  // Stops the native recognizer/recording without touching React state —
  // safe to call after this component has already unmounted.
  const cancelNativeListening = () => {
    if (AndroidSpeech.isAndroidSpeechSupported) {
      AndroidSpeech.cancel().catch(() => {});
    } else {
      safeUnload();
    }
    stopPulse();
  };

  // Navigating away (e.g. tapping "Scan" or another tab) while the mic is
  // listening should cancel it immediately, same as Google Assistant/Gboard
  // do — otherwise the recognizer keeps the mic open in the background and
  // the waveform animation is left frozen mid-pulse for whoever returns.
  useEffect(() => {
    if (!isFocused && isRecordingRef.current) {
      cancelNativeListening();
      setIsRecording(false);
      setIsLoading(false);
    }
  }, [isFocused]);

  useEffect(() => {
    return () => {
      if (isRecordingRef.current) cancelNativeListening();
    };
  }, []);

  const startRecording = async () => {
    if (isStartingRef.current || isRecording || isLoading) return;
    if (Platform.OS === "web") {
      Alert.alert("Voice Input", "Voice input is available on the mobile app.");
      return;
    }
    isStartingRef.current = true;
    try {
      if (AndroidSpeech.isAndroidSpeechSupported) {
        // On-device recognition: no network round trip, no backend transcription cost.
        setIsRecording(true);
        startPulse();
        try {
          await startAndroidNative();
        } catch (e: any) {
          stopPulse();
          setIsRecording(false);
          if (e?.message === "permission_denied") {
            Alert.alert("Permission needed", "Microphone permission is required for voice input.");
          }
        }
        return;
      }

      // iOS / dev-client-less Android fallback: record audio, upload for cloud STT.
      await safeUnload();
      const { Audio } = await import("expo-av");
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Microphone permission is required for voice input.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      recordingRef.current = recording;
      recording.setProgressUpdateInterval(80);
      recording.setOnRecordingStatusUpdate((rs) => {
        if (typeof rs.metering === "number") pushVolume(normalizeIosMetering(rs.metering));
      });
      setIsRecording(true);
      startPulse();
    } catch {
      setIsRecording(false);
      recordingRef.current = null;
      stopPulse();
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopRecording = async () => {
    if (AndroidSpeech.isAndroidSpeechSupported) {
      if (!isRecording) return;
      // Collapse the waveform/ripple the instant the user taps, rather than
      // waiting on the recognizer's final result — tapping to stop should feel
      // as immediate as tapping to start, the same way Google's mic does.
      stopPulse();
      setIsRecording(false);
      setIsLoading(true);
      // Signals the recognizer to finalize; onFinal/onError (above) deliver the
      // result and clear isLoading — stop() itself doesn't.
      try {
        await AndroidSpeech.stop();
      } catch {
        finishAndroidTurn();
      }
      return;
    }

    if (!isRecording && !recordingRef.current) return;
    stopPulse();
    setIsRecording(false);
    setIsLoading(true);
    try {
      const uri = recordingRef.current?.getURI?.() ?? null;
      await safeUnload();
      if (uri) {
        try {
          const { transcribeVoice } = await import("../../lib/ai");
          const result = await transcribeVoice(uri, getCurrentLanguage());
          if (result?.transcript) onTranscript(result.transcript);
        } catch {
          Alert.alert("Transcription failed", "Could not process audio. Please type instead.");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePress = () => {
    if (isLoading) return;
    if (isRecording) stopRecording();
    else startRecording();
  };

  const icon = isLoading ? "hourglass-outline" : "mic-outline";
  const bg = isRecording ? "#E84040" : c.surface;
  const iconColor = isRecording ? "#fff" : isLoading ? c.textMuted : c.textPrimary;
  const ringColor = isRecording ? "#E84040" : c.border;

  return (
    <View style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, alignItems: "center", justifyContent: "center" }}>
      {isRecording && <Ripple volume={volume} idle={idle} color="#E84040" />}
      {isRecording && <GlowRing idle={idle} color="#E84040" />}
      <TouchableOpacity
        onPress={handlePress}
        disabled={isLoading}
        style={{
          width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: BUTTON_SIZE / 2,
          backgroundColor: bg,
          alignItems: "center", justifyContent: "center",
          borderWidth: 1, borderColor: ringColor,
        }}
      >
        {isRecording
          ? <Waveform volume={volume} idle={idle} color="#fff" />
          : <Ionicons name={icon as any} size={18} color={iconColor} />
        }
      </TouchableOpacity>
    </View>
  );
}
