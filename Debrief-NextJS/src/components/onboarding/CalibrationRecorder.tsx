"use client";
import { useRef, useState } from "react";

type State = "idle" | "recording" | "done";

export default function CalibrationRecorder({ onComplete }: { onComplete: (blob: Blob) => void }) {
  const [state, setState] = useState<State>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function start() {
    chunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setState("done");
      onComplete(blob);
    };

    recorder.start();
    setState("recording");
  }

  function stop() {
    mediaRecorderRef.current?.stop();
  }

  const label = state === "idle" ? "Start Recording" : state === "recording" ? "Stop Recording" : "Re-record";

  return (
    <button
      onClick={state === "recording" ? stop : start}
      className={`w-full py-4 font-bold uppercase border-2 transition-all ${
        state === "recording"
          ? "bg-brand-accent text-white border-brand-accent animate-pulse"
          : "border-brand-black hover:bg-brand-black hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
