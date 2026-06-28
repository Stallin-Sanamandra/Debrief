// UMD module: suppress echo-bleed duplicate lines. On laptop speakers the remote voice plays
// out loud and is re-captured by the mic, so the same sentence appears on BOTH channels — once
// as "Others" (clean system audio) and once as "Me" (the bleed). This drops the "Me" copy when
// it closely matches a near-simultaneous "Others" line. Genuine "Me" speech (the user talking)
// has no Others twin, so it is never dropped.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefBleed = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function tokens(t) {
    return String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  }

  // Mutual containment: high when one line's words are mostly contained in the other.
  function similar(a, b) {
    const A = tokens(a);
    const B = tokens(b);
    if (A.length < 2 || B.length < 2) return 0;
    const setB = new Set(B);
    let hit = 0;
    A.forEach((w) => { if (setB.has(w)) hit++; });
    return hit / Math.min(A.length, B.length);
  }

  // Remove "Me" entries that duplicate a near-simultaneous "Others" entry (echo bleed).
  function dedupeCrossChannel(entries, opts) {
    opts = opts || {};
    const win = opts.windowSec != null ? opts.windowSec : 3.5;
    const thr = opts.threshold != null ? opts.threshold : 0.6;
    const list = (entries || []).slice().sort((a, b) => (a.t || 0) - (b.t || 0));
    const others = list.filter((e) => e.speaker === 'Others');
    return list.filter((e) => {
      if (e.speaker !== 'Me') return true;
      const bleed = others.some((o) => Math.abs((o.t || 0) - (e.t || 0)) <= win && similar(e.text, o.text) >= thr);
      return !bleed;
    });
  }

  return { dedupeCrossChannel, similar };
});
