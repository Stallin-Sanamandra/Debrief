// UMD module: streaming utterance segmenter (endpointing).
// Instead of slicing audio into fixed windows, this accumulates a speaker's audio and
// emits a segment when a natural pause is detected (or a max length is hit). Segmenting on
// silence means whisper receives complete utterances cut between words, not through them —
// which lowers latency (a short sentence is transcribed ~0.7s after you stop, not after a
// full window fills) and reduces dropped edge words.
//
// Hysteresis: a segment STARTS only on clearly-voiced frames (onsetFloor), but once started
// it stays alive through quieter voiced audio (contFloor), so quiet speakers aren't clipped.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefSegmenter = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULTS = {
    sampleRate: 16000,
    frameMs: 30,
    onsetFloor: 0.009, // per-frame RMS needed to START a segment
    contFloor: 0.005, // lower floor that keeps an in-progress segment alive (hysteresis)
    onsetFrames: 2, // consecutive onset frames required to start (rejects single noise spikes)
    silenceHangSec: 0.7, // trailing silence that ends an utterance
    minSegmentSec: 0.25, // ignore shorter blips
    maxSegmentSec: 10, // force-flush a long monologue
    prerollSec: 0.25, // audio kept before onset so the first phoneme isn't clipped
    trailPadSec: 0.15, // trailing silence kept on the emitted segment
    forcedOverlapSec: 0.3 // overlap carried into the next segment after a forced cut
  };

  function rms(buf, start, len) {
    let s = 0;
    for (let i = 0; i < len; i++) {
      const v = buf[start + i];
      s += v * v;
    }
    return Math.sqrt(s / len);
  }

  function concat(a, b) {
    const out = new Float32Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }

  class Segmenter {
    constructor(opts) {
      this.o = Object.assign({}, DEFAULTS, opts || {});
      const sr = this.o.sampleRate;
      this.F = Math.max(1, Math.floor((this.o.frameMs / 1000) * sr));
      this.silenceHang = Math.floor(this.o.silenceHangSec * sr);
      this.minSeg = Math.floor(this.o.minSegmentSec * sr);
      this.maxSeg = Math.floor(this.o.maxSegmentSec * sr);
      this.preroll = Math.floor(this.o.prerollSec * sr);
      this.trailPad = Math.floor(this.o.trailPadSec * sr);
      this.forcedOverlap = Math.floor(this.o.forcedOverlapSec * sr);
      this.reset();
    }

    reset() {
      this.residual = new Float32Array(0);
      this.pre = new Float32Array(0); // recent pre-speech audio ring
      this.seg = [];                  // Float32Array frames in the current segment
      this.segLen = 0;
      this.inSpeech = false;
      this.trailing = 0;              // trailing silence samples
      this.voicedRun = 0;             // consecutive onset frames while idle
      this.basePos = 0;               // absolute sample index of residual/data[0]
      this.segStart = 0;              // absolute sample index of the current segment's audio
      this.segPre = 0;                // preroll samples in the current segment (excluded from min-length)
      this.nextContinued = false;     // next emit overlaps the previous (forced cut)
    }

    // Voiced (non-preroll, non-trailing) length of the current segment, in samples.
    _speechLen() {
      return this.segLen - this.segPre - this.trailing;
    }

    _flatten() {
      const audio = new Float32Array(this.segLen);
      let off = 0;
      for (const f of this.seg) { audio.set(f, off); off += f.length; }
      return audio;
    }

    _emit(out, trimTrailing) {
      const audio = this._flatten();
      let end = audio.length;
      if (trimTrailing && this.trailing > this.trailPad) {
        end = Math.max(this.minSeg, audio.length - (this.trailing - this.trailPad));
      }
      const finalAudio = end < audio.length ? audio.slice(0, end) : audio;
      out.push({ audio: finalAudio, tStart: this.segStart / this.o.sampleRate, continued: this.nextContinued });
      this.nextContinued = false;
    }

    _pushPre(frame) {
      const merged = this.pre.length ? concat(this.pre, frame) : frame.slice();
      this.pre = merged.length > this.preroll ? merged.slice(merged.length - this.preroll) : merged;
    }

    // Feed a block of mono Float32 PCM. Returns an array of emitted segments (usually 0 or 1).
    push(block) {
      const out = [];
      const data = this.residual.length ? concat(this.residual, block) : block;
      const F = this.F;
      let i = 0;
      for (; i + F <= data.length; i += F) {
        const e = rms(data, i, F);
        const frame = data.subarray(i, i + F);
        const absEnd = this.basePos + i + F;
        if (!this.inSpeech) {
          this._pushPre(frame);
          this.voicedRun = e > this.o.onsetFloor ? this.voicedRun + 1 : 0;
          if (this.voicedRun >= this.o.onsetFrames) {
            this.inSpeech = true;
            this.trailing = 0;
            this.voicedRun = 0;
            this.seg = [this.pre.slice()];
            this.segLen = this.pre.length;
            this.segPre = this.pre.length;
            this.segStart = absEnd - this.pre.length;
            this.pre = new Float32Array(0);
          }
        } else {
          this.seg.push(frame.slice());
          this.segLen += F;
          if (e > this.o.contFloor) this.trailing = 0;
          else this.trailing += F;

          if (this.trailing >= this.silenceHang) {
            if (this._speechLen() >= this.minSeg) this._emit(out, true);
            this.inSpeech = false;
            this.seg = [];
            this.segLen = 0;
            this.trailing = 0;
            this.segPre = 0;
            this.pre = new Float32Array(0);
          } else if (this.segLen >= this.maxSeg) {
            this._emit(out, false);
            const flat = this._flatten();
            const tail = this.forcedOverlap > 0 ? flat.slice(Math.max(0, flat.length - this.forcedOverlap)) : new Float32Array(0);
            this.seg = tail.length ? [tail] : [];
            this.segLen = tail.length;
            this.segPre = 0; // the overlap tail is speech, not preroll
            this.segStart = absEnd - tail.length;
            this.trailing = 0;
            this.nextContinued = true;
          }
        }
      }
      this.residual = data.subarray(i).slice();
      this.basePos += i;
      return out;
    }

    // Emit any buffered speech (call on stop).
    flush() {
      const out = [];
      if (this.inSpeech && this._speechLen() >= this.minSeg) this._emit(out, true);
      this.inSpeech = false;
      this.seg = [];
      this.segLen = 0;
      this.trailing = 0;
      return out;
    }
  }

  return { Segmenter, DEFAULTS, rms };
});
