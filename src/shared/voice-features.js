// UMD module: lightweight per-segment voice feature (fundamental frequency / pitch).
// Used as a cheap, no-ML signal to best-effort split the "Others" (system) channel into
// up to two speakers. Autocorrelation-based F0 over the first ~1.5s of voiced audio.
// Returns 0 when pitch can't be confidently estimated (silence/unvoiced/noisy).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefVoiceFeatures = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Estimate F0 (Hz) of a mono Float32 buffer. minHz/maxHz bound a human-voice range.
  function estimateF0(buf, sampleRate, opts) {
    const o = Object.assign({ minHz: 75, maxHz: 320, maxSeconds: 1.5, minConfidence: 0.3 }, opts || {});
    if (!buf || !buf.length) return 0;
    const sr = sampleRate || 16000;
    const n = Math.min(buf.length, Math.floor(o.maxSeconds * sr));
    if (n < 512) return 0;

    // Remove DC offset.
    let mean = 0;
    for (let i = 0; i < n; i++) mean += buf[i];
    mean /= n;

    let energy = 0;
    for (let i = 0; i < n; i++) {
      const v = buf[i] - mean;
      energy += v * v;
    }
    if (energy <= 1e-6) return 0; // effectively silent

    const minLag = Math.floor(sr / o.maxHz);
    const maxLag = Math.floor(sr / o.minHz);
    let bestLag = -1;
    let bestCorr = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i + lag < n; i++) {
        corr += (buf[i] - mean) * (buf[i + lag] - mean);
      }
      const norm = corr / energy; // ~1 at perfect periodicity
      if (norm > bestCorr) {
        bestCorr = norm;
        bestLag = lag;
      }
    }
    if (bestLag < 0 || bestCorr < o.minConfidence) return 0;
    return sr / bestLag;
  }

  return { estimateF0 };
});
