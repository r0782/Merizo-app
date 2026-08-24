import React, { useState, useRef } from "react";
import { TouchableOpacity, Animated, Platform, Alert, PermissionsAndroid } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../lib/theme";
import { getCurrentLanguage, getLanguageMeta } from "../../lib/i18n";
import * as AndroidSpeech from "../../lib/androidSpeech";

// Errors that just mean "nothing useful was said" rather than a real failure —
// worth staying silent about rather than alarming the user with a dialog.
const SILENT_ANDROID_ERRORS = new Set(["no_match", "speech_timeout", "client_error"]);

export function VoiceButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const { c } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const recordingRef = useRef<any>(null);
  const isStartingRef = useRef(false);   // guard against double-press race
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef<any>(null);

  const startPulse = () => {
    pulseAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseAnim.current.start();
  };

  const stopPulse = () => {
    pulseAnim.current?.stop();
    pulse.setValue(1);
  };

  const finishAndroidTurn = (transcript?: string) => {
    stopPulse();
    setIsRecording(false);
    setIsLoading(false);
    if (transcript) onTranscript(transcript);
  };

  const startAndroidNative = async () => {
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
    const languageTag = getLanguageMeta(getCurrentLanguage()).region;
    await AndroidSpeech.start({
      languageTag,
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
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      startPulse();
    } catch (e) {
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
      setIsLoading(true);
      // Signals the recognizer to finalize; onFinal/onError (above) deliver the
      // result and clear isLoading/isRecording — stop() itself doesn't.
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

  const icon = isLoading ? "hourglass-outline" : isRecording ? "stop-circle" : "mic-outline";
  const bg = isRecording ? "#E84040" : c.surface;
  const iconColor = isRecording ? "#fff" : isLoading ? c.textMuted : c.textPrimary;

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={isLoading}
        style={{
          width: 42, height: 42, borderRadius: 21,
          backgroundColor: bg,
          alignItems: "center", justifyContent: "center",
          borderWidth: 1, borderColor: isRecording ? "#E84040" : c.border,
        }}
      >
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </TouchableOpacity>
    </Animated.View>
  );
}
