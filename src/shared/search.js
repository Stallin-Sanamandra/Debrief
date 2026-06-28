// UMD module: lightweight local full-text search + section retrieval over saved meetings.
// No dependencies, no server — scores documents by term frequency (title-weighted) with a
// phrase bonus, and can pull the most relevant transcript chunks from a session to feed the
// "Ask" feature. Fast enough to scan all sessions per query for typical libraries.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefSearch = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function tokenize(s) {
    return (String(s || '').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [])
      .map((w) => w.replace(/'s$/, '').replace(/^['-]+|['-]+$/g, '')) // drop possessive + edge punctuation
      .filter(Boolean);
  }

  function countOccurrences(haystack, needle) {
    let idx = 0;
    let c = 0;
    while ((idx = haystack.indexOf(needle, idx)) !== -1) { c++; idx += needle.length; }
    return c;
  }

  // TF score with diminishing returns; phrase match adds a bonus.
  function scoreText(text, terms) {
    if (!terms.length) return 0;
    const t = String(text || '').toLowerCase();
    if (!t) return 0;
    let score = 0;
    for (const term of terms) {
      const c = countOccurrences(t, term);
      if (c) score += 1 + Math.log(c);
    }
    if (terms.length > 1 && t.indexOf(terms.join(' ')) !== -1) score += 5;
    return score;
  }

  function bestSnippet(text, terms, len) {
    const t = String(text || '');
    const w = len || 150;
    if (!t) return '';
    const lower = t.toLowerCase();
    let pos = -1;
    for (const term of terms) {
      const i = lower.indexOf(term);
      if (i !== -1 && (pos === -1 || i < pos)) pos = i;
    }
    if (pos === -1) return t.slice(0, w).trim().replace(/\s+/g, ' ');
    const start = Math.max(0, pos - Math.floor(w / 3));
    let snip = t.slice(start, start + w).trim().replace(/\s+/g, ' ');
    if (start > 0) snip = '… ' + snip;
    if (start + w < t.length) snip += ' …';
    return snip;
  }

  // docs: [{ id, title, createdAt, durationSec, text }]
  function search(docs, query, limit) {
    const terms = Array.from(new Set(tokenize(query)));
    if (!terms.length) return [];
    const out = [];
    (docs || []).forEach((d) => {
      const score = scoreText(d.title, terms) * 3 + scoreText(d.text, terms);
      if (score > 0) {
        out.push({
          id: d.id,
          title: d.title,
          createdAt: d.createdAt,
          durationSec: d.durationSec,
          score,
          snippet: bestSnippet(d.text, terms)
        });
      }
    });
    out.sort((a, b) => b.score - a.score || String(b.createdAt).localeCompare(String(a.createdAt)));
    return out.slice(0, limit || 25);
  }

  // Split a session's entries into ~chunkChars windows, score, return the top few — used to
  // build a small, relevant context for the AI to answer over (instead of the whole transcript).
  function relevantSections(entries, query, opts) {
    opts = opts || {};
    const terms = Array.isArray(query) ? query : Array.from(new Set(tokenize(query)));
    const chunkChars = opts.chunkChars || 600;
    const list = (entries || []).slice().sort((a, b) => a.t - b.t);
    const chunks = [];
    let buf = [];
    let len = 0;
    let startT = null;
    for (const e of list) {
      if (startT === null) startT = e.t;
      buf.push(e.text || '');
      len += (e.text || '').length;
      if (len >= chunkChars) { chunks.push({ t: startT, text: buf.join(' ') }); buf = []; len = 0; startT = null; }
    }
    if (buf.length) chunks.push({ t: startT || 0, text: buf.join(' ') });
    const scored = chunks
      .map((c) => ({ t: c.t, text: c.text, score: scoreText(c.text, terms) }))
      .filter((c) => c.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, opts.limit || 3);
  }

  return { tokenize, scoreText, search, bestSnippet, relevantSections };
});
