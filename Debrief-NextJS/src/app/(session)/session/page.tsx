"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getIdToken } from "@/lib/firebase-auth";
import { useAudioPlayback } from "@/lib/hooks/useAudioPlayback";
import { useAudioStream } from "@/lib/hooks/useAudioStream";

type Phase = "connecting" | "live" | "done" | "error";

export default function SessionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("id");

  const [phase, setPhase] = useState<Phase>("connecting");
  const [prosodyEvents, setProsodyEvents] = useState<{ wpm: number; pitch_hz: number }[]>([]);

  const { enqueue: enqueueAudio, flush: flushAudio, isAiSpeakingRef, resumeForPlayback } = useAudioPlayback();
  const wsRef = useRef<WebSocket | null>(null);
  const startedRef = useRef(false);
  const cancelledRef = useRef(false);
  const liveRef = useRef(false);
  // True once the mic has been started (after the AI's first turn ends)
  const micStartedRef = useRef(false);

  const sendChunk = useCallback((chunk: ArrayBuffer) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(chunk);
  }, []);

  const sendControl = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const { prepare: prepareMic, startRecording, stop: stopMic, resetInterruptFlag } = useAudioStream(
    sendChunk,
    flushAudio,
    isAiSpeakingRef,
    sendControl
  );

  const stop = useCallback(() => {
    stopMic();
    wsRef.current?.close();
    setPhase("done");
  }, [stopMic]);

  useEffect(() => {
    if (!sessionId) { setPhase("error"); return; }

    // Prevent React StrictMode from opening two WebSocket connections.
    // StrictMode mounts → unmounts → remounts in dev; the ref persists across
    // the remount so the second invocation is a no-op.
    // Always reset cancelled first — StrictMode cleanup sets it true on the
    // first unmount; the second mount must clear it before the early return
    // so the persistent WebSocket's onmessage handler sees cancelled=false.
    cancelledRef.current = false;

    if (startedRef.current) return;
    startedRef.current = true;

    async function start() {
      try {
        const token = await getIdToken();
        if (!token) { setPhase("error"); return; }

        const wsBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
          .replace(/^http/, "ws");
        const ws = new WebSocket(`${wsBase}/sessions/${sessionId}/stream?token=${token}`);
        wsRef.current = ws;
        ws.binaryType = "arraybuffer";

        ws.onopen = () => { /* wait for server "ready" message */ };

        ws.onmessage = async (e) => {
          if (typeof e.data === "string") {
            const msg = JSON.parse(e.data);

            if (msg.type === "ready") {
              if (cancelledRef.current) return;
              try {
                // Acquire mic permission and resume AudioContext while still in
                // the user-gesture chain from page navigation.
                // Recording starts only after the AI greeting ends (ai_turn_end).
                await prepareMic();
                await resumeForPlayback();
                liveRef.current = true;
                setPhase("live");
              } catch (err) {
                console.error("[session] setup failed:", err);
                setPhase("error");
              }
              return;
            }

            // AI finished its turn — now safe to start recording
            if (msg.type === "ai_turn_end" && !micStartedRef.current) {
              micStartedRef.current = true;
              startRecording();
              return;
            }

            if (msg.type === "prosody") {
              setProsodyEvents((prev) => [...prev.slice(-20), msg]);
            }

            if (msg.type === "barge_in") {
              resetInterruptFlag();
            }
          } else {
            // AI audio response — raw LPCM 16-bit signed 24kHz mono from Nova Sonic
            enqueueAudio(e.data as ArrayBuffer);
          }
        };

        ws.onerror = () => setPhase("error");
        ws.onclose = () => { if (!cancelledRef.current) setPhase("done"); };
      } catch {
        setPhase("error");
      }
    }

    start();
    return () => {
      cancelledRef.current = true;
      stopMic();
      if (liveRef.current) wsRef.current?.close();
    };
  }, [sessionId]);

  const lastProsody = prosodyEvents[prosodyEvents.length - 1];

  if (phase === "error") return (
    <div className="text-center p-8">
      <p className="text-brand-accent font-mono mb-4">Session error.</p>
      <button onClick={() => router.push("/home")} className="underline">Back to home</button>
    </div>
  );

  if (phase === "done") return (
    <div className="text-center p-8">
      <p className="text-2xl font-black uppercase mb-4">Session complete.</p>
      <button onClick={() => router.push("/home")} className="underline font-mono">Back to home</button>
    </div>
  );

  return (
    <div className="text-center w-full max-w-lg px-8">
      <h1 className="text-2xl font-bold uppercase tracking-widest mb-12 opacity-50">Debrief</h1>

      {phase === "connecting" && <p className="font-mono animate-pulse">Connecting...</p>}

      {phase === "live" && (
        <>
          {lastProsody && (
            <div className="font-mono text-sm mb-8 opacity-70 space-y-1">
              <p>WPM: {lastProsody.wpm.toFixed(0)}</p>
              <p>Pitch: {lastProsody.pitch_hz.toFixed(0)} Hz</p>
            </div>
          )}
          <button
            onClick={stop}
            className="w-48 h-48 rounded-full bg-brand-accent text-brand-black font-black text-xl uppercase border-4 border-brand-white shadow-brutal-lg hover:scale-95 transition-transform mx-auto block"
          >
            Stop
          </button>
          <p className="mt-8 font-mono text-sm opacity-50 animate-pulse">Listening...</p>
        </>
      )}
    </div>
  );
}
