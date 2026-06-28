// UMD module: aggregate action items across sessions into one cross-meeting list.
// Each item gets a stable key (sessionId#index) used to persist its done state, plus its
// source meeting so the UI can show provenance and link back. Open items sort first, then
// newest meeting first.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefActions = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function aggregate(sessions, stateMap) {
    const st = stateMap || {};
    const out = [];
    (sessions || []).forEach((s) => {
      if (!s || !s.summary || !Array.isArray(s.summary.actions)) return;
      s.summary.actions.forEach((a, i) => {
        const text = a && a.text ? String(a.text) : '';
        if (!text) return;
        const k = s.id + '#' + i;
        out.push({
          key: k,
          text: text,
          owner: (a && a.owner) || null,
          sessionId: s.id,
          sessionTitle: s.title || 'Meeting',
          createdAt: s.createdAt || '',
          done: !!st[k]
        });
      });
    });
    out.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1; // open first
      return String(b.createdAt).localeCompare(String(a.createdAt)); // newest meeting first
    });
    return out;
  }

  function openCount(items) {
    return (items || []).filter((i) => !i.done).length;
  }

  return { aggregate, openCount };
});
