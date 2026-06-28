// UMD module: suggest topic tags from a meeting's summary (no AI call — local heuristic).
// Pulls capitalized phrases (likely proper nouns / topics) and the most frequent significant
// words from the title + notes + decisions + action items.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefTags = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STOP = new Set(('the a an and or of to in for on with at by from as is are was were be been being this that ' +
    'these those it its we you they he she i me my our your their them us so but if then than also will would can ' +
    'could should may might do does did have has had not no yes about into over under out up down just like get got ' +
    'make made go going need needs want wants see saw look looks new next last first second third one two three some ' +
    'more most much many very really still each per via plus etc what when where who how why which while because').split(/\s+/));

  function tokenize(s) {
    return (String(s || '').toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) || []);
  }
  function capitalizedPhrases(s) {
    return String(s || '').match(/\b[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2}\b/g) || [];
  }

  // summary: { notes[], decisions[], actions:[{text}] }. Returns up to `max` candidate tags.
  function suggestTags(summary, title, opts) {
    opts = opts || {};
    const max = opts.max || 6;
    const s = summary || {};
    const texts = [title || ''].concat(s.notes || [], s.decisions || [], (s.actions || []).map((a) => (a && a.text) || ''));
    const blob = texts.join('. ');

    const freq = {};
    tokenize(blob).forEach((w) => { if (w.length >= 4 && !STOP.has(w)) freq[w] = (freq[w] || 0) + 1; });
    const words = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);

    const phrases = Array.from(new Set(capitalizedPhrases(blob)))
      .filter((p) => p.length > 2 && !/^(The|And|This|That|Notes?|Decisions?|Action|Items?|Next|Meeting)$/i.test(p));

    const out = [];
    const has = (t) => out.some((x) => x.toLowerCase() === t.toLowerCase());
    phrases.forEach((p) => { if (out.length < max && !has(p)) out.push(p); });
    words.forEach((w) => { if (out.length < max && !has(w)) out.push(w); });
    return out.slice(0, max);
  }

  // Normalize a user-typed tag (trim, collapse spaces). Empty -> ''.
  function normalizeTag(t) {
    return String(t || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  }

  return { suggestTags, normalizeTag, tokenize };
});
