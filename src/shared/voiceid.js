// UMD module: voice-fingerprint matching. Pure vector math over embeddings produced by
// shared/embed.js — cosine similarity, best-match-above-threshold, and a running-mean update
// used to enrol/refine a person's voiceprint as they speak.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefVoiceId = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_THRESHOLD = 0.82;

  function cosine(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d ? dot / d : 0;
  }

  // prints: { name: { emb:[...], count } }. Returns { name, score } or null.
  function matchEmbedding(emb, prints, threshold) {
    const thr = threshold == null ? DEFAULT_THRESHOLD : threshold;
    let best = null;
    let bestScore = -1;
    Object.keys(prints || {}).forEach((name) => {
      const p = prints[name];
      if (!p || !p.emb) return;
      const s = cosine(emb, p.emb);
      if (s > bestScore) { bestScore = s; best = name; }
    });
    return best && bestScore >= thr ? { name: best, score: bestScore } : null;
  }

  // Running mean: fold a new sample into an existing voiceprint (or start one).
  function mergeEmbedding(prev, emb, prevCount) {
    if (!prev) return emb.slice();
    const c = prevCount || 1;
    const out = new Array(emb.length);
    for (let i = 0; i < emb.length; i++) out[i] = (prev[i] * c + emb[i]) / (c + 1);
    return out;
  }

  return { cosine, matchEmbedding, mergeEmbedding, DEFAULT_THRESHOLD };
});
