// UMD module: lightweight energy-based voice-activity detection.
// Decides whether a 16 kHz mono PCM window contains enough speech-like energy to be
// worth sending to Whisper. This stops the model from "hallucinating" words during
// silence or steady background noise (e.g. inventing text in pauses).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefVad = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function rms(buf, start, len) {
    let sum = 0;
    for (let i = 0; i < len; i++) {
      const v = buf[start + i];
      sum += v * v;
    }
    return Math.sqrt(sum / len);
  }

  // Defaults tuned for 16 kHz mic/system audio. All overridable via opts.
  const DEFAULTS = {
    sampleRate: 16000,
    frameMs: 30, // analysis frame length
    overallMin: 0.004, // whole-window RMS gate (below this = silence). Lowered so quiet
    //                    remote/system speakers aren't gated out entirely.
    frameFloor: 0.010, // per-frame energy floor to count a frame as "voiced"
    minVoicedRatio: 0.08 // fraction of voiced frames required. Lower = keeps shorter
    //                      utterances; still high enough to reject clicks/blips.
  };

  // Returns true if the window is likely speech worth transcribing.
  function hasSpeech(float32, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const frame = Math.max(1, Math.floor((o.frameMs / 1000) * o.sampleRate));
    if (!float32 || float32.length < frame) return false;

    // Quick whole-window gate.
    if (rms(float32, 0, float32.length) < o.overallMin) return false;

    // Voiced-frame ratio: how much of the window actually has energy.
    let voiced = 0;
    let total = 0;
    for (let i = 0; i + frame <= float32.length; i += frame) {
      total++;
      if (rms(float32, i, frame) > o.frameFloor) voiced++;
    }
    return total > 0 && voiced / total >= o.minVoicedRatio;
  }

  return { hasSpeech, rms, DEFAULTS };
});
