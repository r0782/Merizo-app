import React, { useState, useRef } from "react";
import { TouchableOpacity, Animated, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { transcribeVoice } from "../../lib/ai";
import { useTheme } from "../../lib/theme";

export function VoiceButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const { c } = useTheme();
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  };

  const startRecording = async () => {
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recordingRef.current = recording;
    setRecording(true);
    startPulse();
  };

  const stopRecording = async () => {
    pulse.stopAnimation();
    pulse.setValue(1);
    setRecording(false);
    setLoading(true);
    
    await recordingRef.current?.stopAndUnloadAsync();
    const uri = recordingRef.current?.getURI();
    
    if (uri) {
      const result = await transcribeVoice(uri);
      onTranscript(result.transcript);
    }
    setLoading(false);
  };

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <TouchableOpacity
        onPressIn={startRecording}
        onPressOut={stopRecording}
        style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: recording ? "#FF4444" : c.surface,
          alignItems: "center", justifyContent: "center",
          borderWidth: 1, borderColor: recording ? "#FF4444" : c.border
        }}
      >
        <Ionicons 
          name={loading ? "hourglass" : "mic"} 
          size={18} 
          color={recording ? "#fff" : c.textPrimary} 
        />
      </TouchableOpacity>
    </Animated.View>
  );
}