import { useRef, useCallback, useState } from "react";

function isSpeaking(buffer: ArrayBuffer): boolean {
  return buffer.byteLength > 500;
}

export function useAudioStream(
  onChunk: (chunk: ArrayBuffer) => void,
  onInterrupt: () => void,
  isAiSpeakingRef: React.RefObject<boolean>,
  sendControl: (msg: object) => void
) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const interruptSentRef = useRef(false);

  const prepare = useCallback(async () => {
    if (streamRef.current) return;
    streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }, []);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || mediaRecorderRef.current) return;
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    recorder.ondataavailable = async (e) => {
      if (e.data.size === 0) return;
      const buffer = await e.data.arrayBuffer();
      if (isAiSpeakingRef.current && !interruptSentRef.current && isSpeaking(buffer)) {
        interruptSentRef.current = true;
        onInterrupt();
        sendControl({ action: "interrupt" });
      }
      onChunk(buffer);
    };
    recorder.start(250);
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

  const resetInterruptFlag = useCallback(() => {
    interruptSentRef.current = false;
  }, []);

  return { isRecording, prepare, startRecording, stop, resetInterruptFlag };
}
