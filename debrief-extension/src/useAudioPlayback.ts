import { useRef, useCallback, useState, useEffect } from "react";

const NOVA_SONIC_SAMPLE_RATE = 24000;
const NOVA_SONIC_CHANNELS = 1;

function pcmToAudioBuffer(ctx: AudioContext, raw: ArrayBuffer): AudioBuffer {
  const int16 = new Int16Array(raw);
  const audioBuffer = ctx.createBuffer(NOVA_SONIC_CHANNELS, int16.length, NOVA_SONIC_SAMPLE_RATE);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < int16.length; i++) {
    channelData[i] = int16[i] / 32768;
  }
  return audioBuffer;
}

function computeRms(raw: ArrayBuffer): number {
  const int16 = new Int16Array(raw);
  let sum = 0;
  for (let i = 0; i < int16.length; i++) sum += (int16[i] / 32768) ** 2;
  return Math.sqrt(sum / int16.length);
}

export function useAudioPlayback() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const isAiSpeakingRef = useRef(false);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const mutedRef = useRef(false);
  const aiRmsRef = useRef(0);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext({ sampleRate: NOVA_SONIC_SAMPLE_RATE });
      nextStartTimeRef.current = 0;
    }
    return audioCtxRef.current;
  }, []);

  const resumeForPlayback = useCallback(async () => {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();
  }, [getAudioContext]);

  const enqueue = useCallback((chunk: ArrayBuffer) => {
    if (mutedRef.current) return;
    aiRmsRef.current = computeRms(chunk);
    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") ctx.resume();
      const audioBuffer = pcmToAudioBuffer(ctx, chunk);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      const startAt = Math.max(ctx.currentTime, nextStartTimeRef.current);
      source.start(startAt);
      nextStartTimeRef.current = startAt + audioBuffer.duration;
      activeSourcesRef.current.push(source);
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
        if (activeSourcesRef.current.length === 0) {
          isAiSpeakingRef.current = false;
          setIsAiSpeaking(false);
        }
      };
      isAiSpeakingRef.current = true;
      setIsAiSpeaking(true);
    } catch { /* malformed chunk */ }
  }, [getAudioContext]);

  const flush = useCallback(() => {
    const FADE_MS = 120;
    const ctx = audioCtxRef.current;
    mutedRef.current = true;
    setTimeout(() => { mutedRef.current = false; }, FADE_MS + 50);
    if (ctx && ctx.state !== "closed" && activeSourcesRef.current.length > 0) {
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_MS / 1000);
      for (const source of activeSourcesRef.current) {
        try { source.disconnect(); source.connect(gain); source.stop(ctx.currentTime + FADE_MS / 1000); }
        catch { /* already ended */ }
      }
    }
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    isAiSpeakingRef.current = false;
    aiRmsRef.current = 0;
    setIsAiSpeaking(false);
  }, []);

  return { isAiSpeaking, isAiSpeakingRef, aiRmsRef, enqueue, flush, resumeForPlayback };
}
