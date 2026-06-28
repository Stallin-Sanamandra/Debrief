// UMD module: a pure-JS voice embedding (no native deps, no model download, fully offline).
// Computes a log-mel spectral fingerprint of an utterance: frame -> Hann window -> FFT ->
// power -> mel filterbank (26 bands) -> log; then the per-utterance mean+std across frames,
// L2-normalised, gives a ~52-dim vector that is similar for the same voice/timbre and
// different across voices. This is v1 — a deep speaker-embedding model can replace embed()
// behind the same interface for higher accuracy later.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefEmbed = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const N_MELS = 26;

  // Iterative radix-2 FFT (in-place). re/im are Float64Array of length n (power of 2).
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wr = Math.cos(ang);
      const wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1;
        let ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ar = re[i + k];
          const ai = im[i + k];
          const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
          const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ar + br;
          im[i + k] = ai + bi;
          re[i + k + len / 2] = ar - br;
          im[i + k + len / 2] = ai - bi;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = ncr;
        }
      }
    }
  }

  function hzToMel(f) { return 2595 * Math.log10(1 + f / 700); }
  function melToHz(m) { return 700 * (Math.pow(10, m / 2595) - 1); }

  // Triangular mel filterbank: returns N_MELS filters over an (fftSize/2+1) power spectrum.
  function melBank(sr, fftSize, nMels) {
    const bins = fftSize / 2 + 1;
    const low = hzToMel(0);
    const high = hzToMel(sr / 2);
    const pts = [];
    for (let i = 0; i < nMels + 2; i++) pts.push(melToHz(low + ((high - low) * i) / (nMels + 1)));
    const binFor = (hz) => Math.floor(((fftSize + 1) * hz) / sr);
    const filters = [];
    for (let m = 1; m <= nMels; m++) {
      const f = new Float64Array(bins);
      const a = binFor(pts[m - 1]);
      const b = binFor(pts[m]);
      const c = binFor(pts[m + 1]);
      for (let k = a; k < b; k++) if (b > a) f[k] = (k - a) / (b - a);
      for (let k = b; k < c; k++) if (c > b) f[k] = (c - k) / (c - b);
      filters.push(f);
    }
    return filters;
  }

  function l2normalize(v) {
    let s = 0;
    for (let i = 0; i < v.length; i++) s += v[i] * v[i];
    const n = Math.sqrt(s) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= n;
    return v;
  }

  // Compute the embedding for a mono Float32 buffer. Returns number[] (length 2*N_MELS) or null
  // when there isn't enough audio.
  function embed(buf, sampleRate, opts) {
    const o = Object.assign({ frameMs: 25, hopMs: 10, fftSize: 512, nMels: N_MELS, maxSeconds: 8 }, opts || {});
    const sr = sampleRate || 16000;
    if (!buf || buf.length < o.fftSize) return null;
    const n = Math.min(buf.length, Math.floor(o.maxSeconds * sr));
    const frame = Math.floor((o.frameMs / 1000) * sr);
    const hop = Math.floor((o.hopMs / 1000) * sr);
    const fftSize = o.fftSize;
    const bank = melBank(sr, fftSize, o.nMels);
    const bins = fftSize / 2 + 1;

    const sum = new Float64Array(o.nMels);
    const sumSq = new Float64Array(o.nMels);
    let frames = 0;
    const re = new Float64Array(fftSize);
    const im = new Float64Array(fftSize);

    for (let start = 0; start + frame <= n; start += hop) {
      re.fill(0); im.fill(0);
      // Hann window + pre-emphasis-lite (first difference is overkill; plain window is fine here).
      for (let i = 0; i < frame; i++) {
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frame - 1));
        re[i] = buf[start + i] * w;
      }
      fft(re, im);
      // power spectrum -> mel -> log
      for (let m = 0; m < o.nMels; m++) {
        const f = bank[m];
        let e = 0;
        for (let k = 0; k < bins; k++) {
          const p = re[k] * re[k] + im[k] * im[k];
          e += p * f[k];
        }
        const le = Math.log(e + 1e-8);
        sum[m] += le;
        sumSq[m] += le * le;
      }
      frames++;
    }
    if (frames < 3) return null;

    const out = new Array(o.nMels * 2);
    for (let m = 0; m < o.nMels; m++) {
      const mean = sum[m] / frames;
      const varr = Math.max(0, sumSq[m] / frames - mean * mean);
      out[m] = mean;
      out[o.nMels + m] = Math.sqrt(varr);
    }
    // Standardize then L2-normalize so cosine similarity is meaningful.
    let mu = 0;
    for (const v of out) mu += v;
    mu /= out.length;
    for (let i = 0; i < out.length; i++) out[i] -= mu;
    return l2normalize(out);
  }

  return { embed, N_MELS };
});
