// UMD module: domain glossary correction. Fixes proper nouns / acronyms / names that
// the local Whisper model mis-transcribes (e.g. "ABM" heard as "Adabare").
//
// Glossary entries (one per line) come in two forms:
//   1. A bare term:                ABM
//   2. A term with explicit aliases (the reliable lever for wild mishearings):
//                                  ABM = Adabare, Adobe air, a beam
//
// correctText() applies, in order:
//   (a) explicit alias replacement (longest alias first),
//   (b) acronym spaced/dotted forms ("a b m", "A.B.M." -> "ABM"),
//   (c) a conservative single-token fuzzy pass for longer terms (spelling drift in names).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefGlossary = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Parse raw textarea content into [{ canonical, aliases[] }].
  function parseGlossary(raw) {
    const entries = [];
    String(raw || '').split(/\r?\n/).forEach((line) => {
      const t = line.trim();
      if (!t) return;
      let canonical = t;
      let aliases = [];
      const eq = t.indexOf('=');
      if (eq > 0) {
        canonical = t.slice(0, eq).trim();
        aliases = t.slice(eq + 1).split(',').map((a) => a.trim()).filter(Boolean);
      }
      if (canonical) entries.push({ canonical, aliases });
    });
    return entries;
  }

  function levenshtein(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[n];
  }

  function isAcronym(s) {
    return /^[A-Z0-9]{2,6}$/.test(s);
  }

  // ABM -> /\bA[\s.\-]*B[\s.\-]*M\b/gi : matches "ABM", "abm", "a b m", "A.B.M.", "a-b-m".
  function acronymRegex(acr) {
    const parts = acr.split('').map(escapeRegex).join('[\\s.\\-]*');
    return new RegExp('\\b' + parts + '\\b', 'gi');
  }

  // Emit the canonical term, mirroring the casing of the matched word where it helps.
  function matchCase(word, canonical) {
    if (word === word.toUpperCase()) return canonical.toUpperCase();
    if (word[0] === word[0].toUpperCase()) return canonical.charAt(0).toUpperCase() + canonical.slice(1);
    return canonical;
  }

  function correctText(text, entries) {
    if (!text || !entries || !entries.length) return text || '';
    let out = String(text);

    // (a) Explicit aliases — longest first so multi-word aliases win over their parts.
    const pairs = [];
    entries.forEach((e) => e.aliases.forEach((a) => pairs.push({ alias: a, canonical: e.canonical })));
    pairs.sort((x, y) => y.alias.length - x.alias.length);
    pairs.forEach(({ alias, canonical }) => {
      const re = new RegExp('\\b' + escapeRegex(alias).replace(/\s+/g, '\\s+') + '\\b', 'gi');
      out = out.replace(re, canonical);
    });

    // (b) Acronyms spelled with separators.
    entries.forEach((e) => {
      if (isAcronym(e.canonical)) out = out.replace(acronymRegex(e.canonical), e.canonical);
    });

    // (c) Conservative fuzzy for longer single-token terms (account/product names with
    //     spelling drift). Min length 6, edit distance 1 (2 for >= 9 chars), to avoid
    //     clobbering ordinary words. Short terms/acronyms rely on (a)/(b) instead.
    const fuzzy = entries.filter((e) => !isAcronym(e.canonical) && /^[\p{L}][\p{L}\-']{5,}$/u.test(e.canonical));
    if (fuzzy.length) {
      out = out.replace(/[\p{L}][\p{L}\-']*/gu, (word) => {
        for (const e of fuzzy) {
          if (word.toLowerCase() === e.canonical.toLowerCase()) return word; // already correct
        }
        for (const e of fuzzy) {
          const c = e.canonical;
          if (Math.abs(word.length - c.length) > 2) continue;
          const thresh = c.length >= 9 ? 2 : 1;
          const d = levenshtein(word, c);
          if (d > 0 && d <= thresh) return matchCase(word, c);
        }
        return word;
      });
    }
    return out;
  }

  return { parseGlossary, correctText, levenshtein };
});
