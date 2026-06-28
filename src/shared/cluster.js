// UMD module: greedy online clustering of voice embeddings into distinct speakers — no
// enrollment, no ML library. Walks utterances in order; each joins the nearest existing
// cluster if cosine similarity clears the threshold, else starts a new cluster (capped).
// This separates e.g. a male and a female voice on the same channel into Others 1 / Others 2.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefCluster = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function cosine(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d ? dot / d : 0;
  }
  function merge(prev, e, count) {
    const out = new Array(e.length);
    for (let i = 0; i < e.length; i++) out[i] = (prev[i] * count + e[i]) / (count + 1);
    return out;
  }

  // embs: array of number[] (or null). Returns { assign:int[], centroids:[{emb,count}] }.
  function clusterEmbeddings(embs, opts) {
    opts = opts || {};
    const thr = opts.threshold == null ? 0.8 : opts.threshold;
    const maxClusters = opts.maxClusters || 6;
    const centroids = [];
    const assign = [];
    (embs || []).forEach((e) => {
      if (!Array.isArray(e) || !e.length) { assign.push(-1); return; }
      let best = -1;
      let bestS = -1;
      for (let i = 0; i < centroids.length; i++) {
        const s = cosine(e, centroids[i].emb);
        if (s > bestS) { bestS = s; best = i; }
      }
      if (best >= 0 && bestS >= thr) {
        const c = centroids[best];
        c.emb = merge(c.emb, e, c.count);
        c.count++;
        assign.push(best);
      } else if (centroids.length < maxClusters) {
        centroids.push({ emb: e.slice(), count: 1 });
        assign.push(centroids.length - 1);
      } else {
        assign.push(best >= 0 ? best : 0); // at cap: nearest existing
      }
    });
    return { assign, centroids };
  }

  return { clusterEmbeddings, cosine };
});
