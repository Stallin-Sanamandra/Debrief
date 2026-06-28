// UMD module: speaker slot logic shared by renderer, main, and exports.
// A "slot" identifies a speaker: 'me' (the mic) or 'others<N>' (system-audio speaker N,
// N >= 1). Entries store speaker:'Me'|'Others' + sub:N (for Others). There is no fixed cap
// on N — speakers can be added manually beyond the best-effort Others 1/2 auto-split.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefSpeakers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function slotOf(entry) {
    if (!entry || entry.speaker === 'Me') return 'me';
    const n = Number(entry.sub) || 1;
    return 'others' + n;
  }

  function defaultName(slot) {
    if (slot === 'me') return 'Me';
    const m = /^others(\d+)$/.exec(slot);
    if (m) {
      const n = parseInt(m[1], 10);
      return n <= 1 ? 'Others' : 'Others ' + n;
    }
    return slot;
  }

  function nameFor(slot, names) {
    return (names && names[slot]) || defaultName(slot);
  }

  function labelFor(entry, names) {
    return nameFor(slotOf(entry), names);
  }

  function isValidSlot(slot) {
    return slot === 'me' || /^others\d+$/.test(slot);
  }

  // Mutate an entry to belong to a slot. Returns the entry.
  function applySlot(entry, slot) {
    if (slot === 'me') {
      entry.speaker = 'Me';
      delete entry.sub;
    } else {
      const m = /^others(\d+)$/.exec(slot);
      entry.speaker = 'Others';
      entry.sub = m ? parseInt(m[1], 10) : 1;
    }
    return entry;
  }

  // Next free others slot given the entries + any already-named slots.
  function nextOthersSlot(entries, namedSlots) {
    let max = 1;
    (entries || []).forEach((e) => {
      if (e && e.speaker === 'Others') max = Math.max(max, Number(e.sub) || 1);
    });
    (namedSlots || []).forEach((s) => {
      const m = /^others(\d+)$/.exec(s);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'others' + (max + 1);
  }

  return { slotOf, defaultName, nameFor, labelFor, isValidSlot, applySlot, nextOthersSlot };
});
