import React, { useState, useRef } from "react";
import { TouchableOpacity, Animated, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../lib/theme";

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
      // Clean up any leftover recording first
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
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopRecording = async () => {
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
          const result = await transcribeVoice(uri);
          if (result?.transcript) onTranscript(result.transcript);
        } catch {
          Alert.alert("Transcription failed", "Could not process audio. Please type instead.");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const icon = isLoading ? "hourglass-outline" : isRecording ? "stop-circle" : "mic-outline";
  const bg = isRecording ? "#E84040" : c.surface;
  const iconColor = isRecording ? "#fff" : isLoading ? c.textMuted : c.textPrimary;

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <TouchableOpacity
        onPressIn={startRecording}
        onPressOut={stopRecording}
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
