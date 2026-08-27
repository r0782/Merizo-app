/**
 * Thin wrapper around the native AndroidSpeechRecognizer module
 * (android.speech.SpeechRecognizer, see plugins/android-speech-native/).
 *
 * Android-only, on-device, free — no audio upload round trip. iOS/web callers
 * should fall back to the existing expo-av + backend /ai/voice/transcribe path.
 */
import { NativeEventEmitter, NativeModules, Platform } from "react-native";

interface TranscriptEvent {
  text: string;
  alternatives?: string[];
  confidence?: number;
}

interface SpeechErrorEvent {
  code: number;
  message: string;
}

type SpeechState = "ready" | "speechStart" | "speechEnd";

interface StartOptions {
  languageTag?: string;
  onPartial?: (event: TranscriptEvent) => void;
  onFinal?: (event: TranscriptEvent) => void;
  onError?: (event: SpeechErrorEvent) => void;
  onState?: (state: SpeechState) => void;
  /** Raw RMS dB from SpeechRecognizer.onRmsChanged — roughly 0 (silence) to 10+ (loud speech). */
  onVolume?: (rmsdB: number) => void;
}

const NativeSpeech = NativeModules.AndroidSpeechRecognizer;

export const isAndroidSpeechSupported = Platform.OS === "android" && !!NativeSpeech;

let emitter: NativeEventEmitter | null = null;
let subscriptions: { remove: () => void }[] = [];

function getEmitter(): NativeEventEmitter {
  if (!emitter) emitter = new NativeEventEmitter(NativeSpeech);
  return emitter;
}

function clearSubscriptions() {
  subscriptions.forEach((s) => s.remove());
  subscriptions = [];
}

export async function isAvailable(): Promise<boolean> {
  if (!isAndroidSpeechSupported) return false;
  try {
    return await NativeSpeech.isAvailable();
  } catch {
    return false;
  }
}

export async function start(options: StartOptions = {}): Promise<void> {
  if (!isAndroidSpeechSupported) {
    throw new Error("AndroidSpeechRecognizer is only available on Android with the custom dev client.");
  }
  clearSubscriptions();
  const em = getEmitter();

  if (options.onPartial) {
    subscriptions.push(em.addListener("AndroidSpeech:partialResult", options.onPartial));
  }
  if (options.onFinal) {
    subscriptions.push(em.addListener("AndroidSpeech:finalResult", options.onFinal));
  }
  if (options.onError) {
    subscriptions.push(em.addListener("AndroidSpeech:error", options.onError));
  }
  if (options.onState) {
    subscriptions.push(em.addListener("AndroidSpeech:state", options.onState));
  }
  if (options.onVolume) {
    subscriptions.push(em.addListener("AndroidSpeech:volume", options.onVolume));
  }

  await NativeSpeech.start(options.languageTag ?? "");
}

export async function stop(): Promise<void> {
  if (!isAndroidSpeechSupported) return;
  try {
    await NativeSpeech.stop();
  } finally {
    clearSubscriptions();
  }
}

export async function cancel(): Promise<void> {
  if (!isAndroidSpeechSupported) return;
  try {
    await NativeSpeech.cancel();
  } finally {
    clearSubscriptions();
  }
}
