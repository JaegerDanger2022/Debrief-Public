"use client";
import { useRef, useCallback, useState } from "react";

/**
 * Lightweight voice activity check on a WebM/Opus ArrayBuffer.
 * Opus encodes silence as very small packets (~3–10 bytes per frame).
 * A 250ms chunk of real speech is typically >500 bytes even at low bitrate.
 * This avoids decoding the audio — we just check the encoded size.
 */
function isSpeaking(buffer: ArrayBuffer): boolean {
  const SPEECH_BYTE_THRESHOLD = 500;
  return buffer.byteLength > SPEECH_BYTE_THRESHOLD;
}

/**
 * Captures microphone audio and streams chunks to the WebSocket.
 *
 * Feature 3 — User barge-in:
 *   When `isAiSpeakingRef` is true and user audio is detected, this hook:
 *     1. Calls `onInterrupt()` to flush the local AI audio playback queue
 *     2. Sends {"action": "interrupt"} over the WebSocket so the backend halts Nova Sonic
 *
 * onChunk         : called with each 250ms audio ArrayBuffer to send as binary WS frame
 * onInterrupt     : called when user barges in — should flush useAudioPlayback queue
 * isAiSpeakingRef : ref from useAudioPlayback — gates barge-in detection
 * sendControl     : sends a JSON control object as a text WebSocket frame
 */
export function useAudioStream(
  onChunk: (chunk: ArrayBuffer) => void,
  onInterrupt: () => void,
  isAiSpeakingRef: React.RefObject<boolean>,
  sendControl: (msg: object) => void
) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  // Prevent multiple interrupt signals per AI utterance
  const interruptSentRef = useRef(false);

  /**
   * Acquire mic permission and hold the MediaStream.
   * Must be called inside a user-gesture chain (page nav or click).
   * Does NOT start recording yet — call startRecording() when ready.
   */
  const prepare = useCallback(async () => {
    if (streamRef.current) return; // already prepared
    streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }, []);

  /**
   * Begin recording and streaming chunks. Call after prepare() once the AI
   * has finished its opening turn so mic audio doesn't race with the greeting.
   */
  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || mediaRecorderRef.current) return;

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });

    recorder.ondataavailable = async (e) => {
      if (e.data.size === 0) return;
      const buffer = await e.data.arrayBuffer();

      // Feature 3: user speaks while AI is playing → barge-in.
      // Gate on encoded size — Opus silence frames are tiny (<100 bytes),
      // real speech is >500 bytes even at low bitrate.
      if (isAiSpeakingRef.current && !interruptSentRef.current && isSpeaking(buffer)) {
        interruptSentRef.current = true;
        onInterrupt();
        sendControl({ action: "interrupt" });
      }

      onChunk(buffer);
    };

    recorder.start(250); // emit chunks every 250ms
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }, [onChunk, onInterrupt, isAiSpeakingRef, sendControl]);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    setIsRecording(false);
  }, []);

  // Reset interrupt flag when AI starts a new utterance so next barge-in works
  const resetInterruptFlag = useCallback(() => {
    interruptSentRef.current = false;
  }, []);

  return { isRecording, prepare, startRecording, stop, resetInterruptFlag };
}
