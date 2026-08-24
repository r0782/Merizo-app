package com.raghu30.merizo.speech;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.ArrayList;

/**
 * Wraps Android's on-device android.speech.SpeechRecognizer for free, low-latency
 * speech-to-text — used as the Android voice-input path instead of recording audio
 * and uploading it to the backend's cloud STT endpoint.
 *
 * SpeechRecognizer must be created/driven from the main thread, so every call here
 * is dispatched onto mainHandler.
 */
public class SpeechRecognizerModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "AndroidSpeechRecognizer";
    private static final String EVENT_PARTIAL = "AndroidSpeech:partialResult";
    private static final String EVENT_FINAL = "AndroidSpeech:finalResult";
    private static final String EVENT_ERROR = "AndroidSpeech:error";
    private static final String EVENT_STATE = "AndroidSpeech:state";

    private final ReactApplicationContext reactContext;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    @Nullable private SpeechRecognizer recognizer;

    public SpeechRecognizerModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    private void emit(String eventName, @Nullable Object payload) {
        if (!reactContext.hasActiveReactInstance()) return;
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, payload);
    }

    @ReactMethod
    public void isAvailable(Promise promise) {
        try {
            promise.resolve(SpeechRecognizer.isRecognitionAvailable(reactContext));
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void start(String languageTag, Promise promise) {
        mainHandler.post(() -> {
            try {
                destroyInternal();

                recognizer = SpeechRecognizer.createSpeechRecognizer(reactContext);
                recognizer.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle params) { emit(EVENT_STATE, "ready"); }
                    @Override public void onBeginningOfSpeech() { emit(EVENT_STATE, "speechStart"); }
                    @Override public void onRmsChanged(float rmsdB) {}
                    @Override public void onBufferReceived(byte[] buffer) {}
                    @Override public void onEndOfSpeech() { emit(EVENT_STATE, "speechEnd"); }

                    @Override public void onError(int error) {
                        WritableMap map = Arguments.createMap();
                        map.putInt("code", error);
                        map.putString("message", describeError(error));
                        emit(EVENT_ERROR, map);
                    }

                    @Override public void onResults(Bundle results) { emitTranscript(results, EVENT_FINAL); }
                    @Override public void onPartialResults(Bundle partialResults) { emitTranscript(partialResults, EVENT_PARTIAL); }
                    @Override public void onEvent(int eventType, Bundle params) {}
                });

                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, reactContext.getPackageName());
                if (languageTag != null && !languageTag.isEmpty()) {
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag);
                }

                recognizer.startListening(intent);
                promise.resolve(true);
            } catch (Exception e) {
                promise.reject("speech_start_failed", e.getMessage(), e);
            }
        });
    }

    @ReactMethod
    public void stop(Promise promise) {
        mainHandler.post(() -> {
            try {
                if (recognizer != null) recognizer.stopListening();
                promise.resolve(true);
            } catch (Exception e) {
                promise.reject("speech_stop_failed", e.getMessage(), e);
            }
        });
    }

    @ReactMethod
    public void cancel(Promise promise) {
        mainHandler.post(() -> {
            destroyInternal();
            promise.resolve(true);
        });
    }

    // NativeEventEmitter on the JS side requires these to exist even though we
    // don't need to react to (un)subscription counts — events are only emitted
    // while a recognition session is active.
    @ReactMethod
    public void addListener(String eventName) {}

    @ReactMethod
    public void removeListeners(Integer count) {}

    private void destroyInternal() {
        if (recognizer != null) {
            try {
                recognizer.destroy();
            } catch (Exception ignored) {}
            recognizer = null;
        }
    }

    private void emitTranscript(Bundle bundle, String eventName) {
        ArrayList<String> matches = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        float[] scores = bundle.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
        WritableMap map = Arguments.createMap();
        if (matches != null && !matches.isEmpty()) {
            map.putString("text", matches.get(0));
            WritableArray alternatives = Arguments.createArray();
            for (String m : matches) alternatives.pushString(m);
            map.putArray("alternatives", alternatives);
        } else {
            map.putString("text", "");
        }
        if (scores != null && scores.length > 0) {
            map.putDouble("confidence", scores[0]);
        }
        emit(eventName, map);
    }

    private String describeError(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO: return "audio_error";
            case SpeechRecognizer.ERROR_CLIENT: return "client_error";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "insufficient_permissions";
            case SpeechRecognizer.ERROR_NETWORK: return "network_error";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "network_timeout";
            case SpeechRecognizer.ERROR_NO_MATCH: return "no_match";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "recognizer_busy";
            case SpeechRecognizer.ERROR_SERVER: return "server_error";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "speech_timeout";
            default: return "unknown_error";
        }
    }
}
