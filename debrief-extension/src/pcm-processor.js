// AudioWorklet processor — runs in the audio rendering thread.
// Receives raw mic float32 frames, converts to Int16 PCM, and posts
// both the PCM bytes and an RMS energy value to the main thread.
class PcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const float32 = input[0];

    // RMS energy
    let sum = 0;
    for (let i = 0; i < float32.length; i++) sum += float32[i] * float32[i];
    const rms = Math.sqrt(sum / float32.length);

    // Float32 → Int16 PCM
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32767));
    }

    // Transfer the underlying buffer (zero-copy) plus RMS scalar
    this.port.postMessage({ pcm: int16.buffer, rms }, [int16.buffer]);
    return true;
  }
}

registerProcessor("pcm-processor", PcmProcessor);
