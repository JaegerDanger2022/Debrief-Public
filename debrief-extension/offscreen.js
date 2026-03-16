/**
 * offscreen.js — Audio Engine (Offscreen Document)
 *
 * Runs in the offscreen document which has access to getUserMedia.
 * Captures the microphone at 16kHz mono, converts Float32 PCM to Int16LE,
 * and sends each chunk to background.js via AUDIO_DATA messages.
 *
 * The backend's /sessions/{id}/stream-ext endpoint accepts these raw PCM bytes
 * directly — no ffmpeg transcoding is needed on the server side.
 */

const SAMPLE_RATE  = 16000;
const BUFFER_SIZE  = 4096;  // samples per ScriptProcessor callback (~256ms at 16kHz)

let audioContext = null;
let processor    = null;
let stream       = null;
let isRecording  = false;

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request) => {
  console.log("[offscreen] received:", request.action, "isRecording:", isRecording);
  if (request.action === "START_RECORDING" && !isRecording) {
    startRecording();
    return;
  }
  if (request.action === "STOP_RECORDING") {
    stopRecording();
    return;
  }
});

// ── Recording ─────────────────────────────────────────────────────────────────

async function startRecording() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioContext.createMediaStreamSource(stream);

    // ScriptProcessorNode is deprecated but still the only option in offscreen
    // documents where AudioWorklet is not available.
    processor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (event) => {
      const float32 = event.inputBuffer.getChannelData(0);
      const int16   = float32ToInt16(float32);
      // Compute RMS amplitude for waveform visualization
      let sum = 0;
      for (let i = 0; i < float32.length; i++) sum += float32[i] * float32[i];
      const rms = Math.sqrt(sum / float32.length);
      // Transfer the underlying buffer to avoid a copy
      const pcm = Array.from(new Uint8Array(int16.buffer));
      console.log("[offscreen] sending AUDIO_DATA pcm length:", pcm.length, "rms:", rms.toFixed(4));
      chrome.runtime.sendMessage({ action: "AUDIO_DATA", pcm, rms });
    };

    isRecording = true;
  } catch (err) {
    chrome.runtime.sendMessage({ action: "OFFSCREEN_ERROR", message: err.message });
  }
}

function stopRecording() {
  if (processor) {
    processor.disconnect();
    processor = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  isRecording = false;
}

// ── PCM conversion ────────────────────────────────────────────────────────────

function float32ToInt16(float32) {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    // Clamp to [-1, 1] then scale to Int16 range
    int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32767));
  }
  return int16;
}
