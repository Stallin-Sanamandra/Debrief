// UMD module: best-effort split of the "Others" (system) channel into up to two speakers,
// using each utterance's F0 (pitch) — no ML, no embeddings. Conservative by design: it only
// splits when the two pitch clusters are clearly separated AND both hold a meaningful share
// of talk time. Otherwise everything stays as one speaker. Manual re-labeling cleans up the
// rest. Mutates each Others entry's `sub` (1 or 2); Me entries are left untouched.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefDiarize = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MIN_SEP_HZ = 25;       // cluster centres must differ by at least this
  const MIN_SHARE = 0.15;      // each cluster must hold >= this fraction of Others talk time
  const MIN_TOTAL_SEC = 12;    // don't bother splitting very short conversations

  // 1-D weighted 2-means (k=2). Returns [c1, c2] with c1 <= c2.
  function twoMeans(points) {
    let c1 = points[0].v;
    let c2 = points[points.length - 1].v;
    for (let iter = 0; iter < 25; iter++) {
      let s1 = 0, w1 = 0, s2 = 0, w2 = 0;
      for (const p of points) {
        if (Math.abs(p.v - c1) <= Math.abs(p.v - c2)) { s1 += p.v * p.w; w1 += p.w; }
        else { s2 += p.v * p.w; w2 += p.w; }
      }
      const n1 = w1 ? s1 / w1 : c1;
      const n2 = w2 ? s2 / w2 : c2;
      if (n1 === c1 && n2 === c2) break;
      c1 = n1; c2 = n2;
    }
    return c1 <= c2 ? [c1, c2] : [c2, c1];
  }

  function splitOthers(entries) {
    const list = Array.isArray(entries) ? entries : [];
    const others = list.filter((e) => e && e.speaker === 'Others');
    others.forEach((e) => { e.sub = 1; }); // default: one speaker

    const pts = others
      .filter((e) => Number(e.f0) > 0 && Number(e.dur) > 0)
      .map((e) => ({ v: Number(e.f0), w: Number(e.dur), e }));
    const totalSec = pts.reduce((s, p) => s + p.w, 0);
    if (pts.length < 2 || totalSec < MIN_TOTAL_SEC) return { split: false, entries: list };

    const [c1, c2] = twoMeans(pts);
    if (c2 - c1 < MIN_SEP_HZ) return { split: false, entries: list };

    let w1 = 0, w2 = 0;
    pts.forEach((p) => {
      if (Math.abs(p.v - c1) <= Math.abs(p.v - c2)) w1 += p.w; else w2 += p.w;
    });
    const share = Math.min(w1, w2) / (w1 + w2);
    if (share < MIN_SHARE) return { split: false, entries: list };

    // Assign every Others entry (including pitch-less ones, by nearest center fallback to 1).
    others.forEach((e) => {
      const f = Number(e.f0);
      if (f > 0) e.sub = Math.abs(f - c1) <= Math.abs(f - c2) ? 1 : 2;
      else e.sub = 1;
    });
    return { split: true, centers: [c1, c2], entries: list };
  }

  return { splitOthers, twoMeans };
});
