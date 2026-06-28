// UMD module: returning-attendee brief lookup. Given the saved sessions (newest-first) and
// an attendee name, find the most recent past meeting with that person and a few key notes /
// action items, plus how many past meetings mentioned them. Matches first on the meeting's
// remembered speaker names (strong signal), then falls back to a transcript mention.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefBriefs = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // sessions must be newest-first (so the first match is the most recent meeting).
  function matchAttendee(sessions, name, excludeId) {
    const target = String(name || '').trim().toLowerCase();
    if (target.length < 2) return null;
    let count = 0;
    let best = null;
    (sessions || []).forEach((s) => {
      if (!s || (excludeId && s.id === excludeId)) return;
      const names = Object.values(s.speakerNames || {}).map((x) => String(x).toLowerCase());
      const inNames = names.includes(target);
      const inText = !inNames && target.length >= 3 && String(s.transcriptText || '').toLowerCase().includes(target);
      if (!inNames && !inText) return;
      count++;
      if (!best) {
        const sum = s.summary || {};
        best = {
          sessionId: s.id,
          title: s.title || 'Meeting',
          createdAt: s.createdAt,
          notes: (sum.notes || []).slice(0, 2),
          actions: (sum.actions || []).slice(0, 3),
          matchedBy: inNames ? 'speaker' : 'mention'
        };
      }
    });
    if (!best) return null;
    return Object.assign({ name: name, count: count }, best);
  }

  function lookup(sessions, names, excludeId) {
    const seen = new Set();
    const out = [];
    (names || []).forEach((n) => {
      const key = String(n || '').trim().toLowerCase();
      if (key.length < 2 || seen.has(key)) return;
      seen.add(key);
      const b = matchAttendee(sessions, n, excludeId);
      if (b) out.push(b);
    });
    return out;
  }

  return { matchAttendee, lookup };
});
