// AudioWorklet: receives the mic/system signal and posts ~0.1s Float32 blocks back to the
// renderer thread. Runs on the audio thread, so it stays glitch-free. Small blocks let the
// utterance segmenter detect pauses promptly (low-latency endpointing).
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Float32Array(1600); // ~0.1s at 16 kHz
    this._len = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0]; // mono — both sources are summed upstream into channel 0
    for (let i = 0; i < ch.length; i++) {
      this._buf[this._len++] = ch[i];
      if (this._len === this._buf.length) {
        this.port.postMessage(this._buf.slice(0, this._len));
        this._len = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
