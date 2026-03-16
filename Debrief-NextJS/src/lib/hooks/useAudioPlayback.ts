"use client";
import { useRef, useCallback, useState } from "react";

// Nova Sonic audio output format (must match audioOutputConfiguration in bedrock_service.py)
const NOVA_SONIC_SAMPLE_RATE = 24000;
const NOVA_SONIC_CHANNELS = 1;

/**
 * Convert a raw LPCM PCM ArrayBuffer (16-bit signed, little-endian) into a Web Audio AudioBuffer.
 * decodeAudioData() cannot be used here — it requires a container format (WAV/MP3/OGG).
 * Nova Sonic sends headerless raw PCM, so we convert manually via Int16Array → Float32Array.
 */
function pcmToAudioBuffer(ctx: AudioContext, raw: ArrayBuffer): AudioBuffer {
  const int16 = new Int16Array(raw);
  const audioBuffer = ctx.createBuffer(NOVA_SONIC_CHANNELS, int16.length, NOVA_SONIC_SAMPLE_RATE);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < int16.length; i++) {
    channelData[i] = int16[i] / 32768;
  }
  return audioBuffer;
}

/**
 * Feature 1: Gapless playback of raw LPCM PCM chunks from Nova Sonic.
 *
 * Nova Sonic streams many small audioOutput chunks in rapid succession. Playing them
 * via onended callbacks introduces inter-chunk gaps (scratchiness). Instead, each chunk
 * is scheduled on the AudioContext clock immediately after the previous one ends, giving
 * sample-accurate, gap-free playback regardless of network or processing jitter.
 *
 * Exposes:
 *   isAiSpeaking  : boolean — true while the AI audio queue is actively playing
 *   enqueue(chunk): schedule a new PCM ArrayBuffer for gapless playback
 *   flush()       : Feature 3 — instantly stop playback and reset (user barge-in)
 */
export function useAudioPlayback() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Wall-clock time (in AudioContext seconds) at which the next chunk should start
  const nextStartTimeRef = useRef<number>(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const isAiSpeakingRef = useRef(false);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  // True during the fade window — enqueue() drops incoming chunks so in-flight
  // WebSocket frames don't bypass the GainNode ramp and play at full volume.
  const mutedRef = useRef(false);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext({ sampleRate: NOVA_SONIC_SAMPLE_RATE });
      nextStartTimeRef.current = 0;
    }
    return audioCtxRef.current;
  }, []);

  /**
   * Must be called once inside a user-gesture handler (e.g. after mic permission
   * is granted). Creates the AudioContext and resumes it so the browser allows
   * audio playback when Nova Sonic frames arrive via WebSocket later.
   */
  const resumeForPlayback = useCallback(async () => {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  }, [getAudioContext]);

  const enqueue = useCallback(
    (chunk: ArrayBuffer) => {
      if (mutedRef.current) return;
      try {
        const ctx = getAudioContext();
        const audioBuffer = pcmToAudioBuffer(ctx, chunk);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        // Schedule this chunk to start exactly when the previous one ends.
        // ctx.currentTime is "now"; if we're behind (first chunk or after a gap),
        // clamp to now so playback starts immediately without silence.
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
      } catch {
        // Malformed chunk — skip
      }
    },
    [getAudioContext]
  );

  /**
   * Feature 3: Fade out AI audio then halt playback (user barge-in).
   * Ramps gain to 0 over FADE_MS ms before stopping sources, avoiding the
   * hard click/pop of an abrupt cut.
   */
  const flush = useCallback(() => {
    const FADE_MS = 120;
    const ctx = audioCtxRef.current;

    // Block in-flight WebSocket frames from playing through during the fade window.
    mutedRef.current = true;
    setTimeout(() => { mutedRef.current = false; }, FADE_MS + 50);

    if (ctx && ctx.state !== "closed" && activeSourcesRef.current.length > 0) {
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_MS / 1000);

      for (const source of activeSourcesRef.current) {
        try {
          source.disconnect();
          source.connect(gain);
          source.stop(ctx.currentTime + FADE_MS / 1000);
        } catch { /* already ended */ }
      }
    }
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    isAiSpeakingRef.current = false;
    setIsAiSpeaking(false);
  }, []);

  return { isAiSpeaking, isAiSpeakingRef, enqueue, flush, resumeForPlayback };
}
