// UMD module: a fully-local, dependency-free heuristic summarizer.
// It turns a meeting transcript into Notes, Decisions, and Action items using
// sentence scoring and cue phrases — no API key and no model download. A local-LLM
// backend can be swapped in later behind the same summarize() signature.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefSummary = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ACTION_RE = /\b(i['’]?ll|we['’]?ll|i will|we will|need(?:s)? to|have to|let['’]?s|going to|gonna|follow ?up|action item|to-?do|assign(?:ed)?|make sure|send (?:the|a|over|me|you)|set up|schedule|circle back|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|eod|end of day|end of week|cob))\b/i;
  const DECISION_RE = /\b(we (?:decided|agreed|chose)|decision|agreed to|we['’]?ll go with|let['’]?s go with|going with|final(?:ized|ised)?|approved|sign(?:ed)? off|the plan is)\b/i;
  const FILLER_RE = /^(um+|uh+|hmm+|okay|ok|yeah|yep|yes|no|right|so|well|like|you know|thanks|thank you|hello|hi|hey)[.!?,]?$/i;
  const FILLER_WORDS = new Set(
    'um uh hmm okay ok yeah yep yes no nope right so well like thanks thank hello hi hey'.split(' ')
  );

  // True when a sentence is almost entirely conversational filler.
  function isMostlyFiller(w) {
    const tokens = w.map((x) => x.toLowerCase().replace(/[^a-z']/g, '')).filter(Boolean);
    if (!tokens.length) return true;
    const filler = tokens.filter((x) => FILLER_WORDS.has(x)).length;
    return filler / tokens.length >= 0.8;
  }

  function splitSentences(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function words(s) {
    return s.split(/\s+/).filter(Boolean);
  }

  function dedupe(list) {
    const seen = new Set();
    const out = [];
    for (const s of list) {
      const key = s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(s);
      }
    }
    return out;
  }

  // Light salience score: favor medium-length, information-dense sentences.
  function scoreSentence(s) {
    const len = words(s).length;
    const lenScore = len < 4 ? 0 : len > 40 ? 0.3 : 1 - Math.abs(14 - len) / 28;
    const hasNumber = /\d/.test(s) ? 0.3 : 0;
    const hasProper = /\b[A-Z][a-z]{2,}\b/.test(s) ? 0.2 : 0;
    return lenScore + hasNumber + hasProper;
  }

  function summarize(text) {
    const sentences = splitSentences(text).filter((s) => {
      const w = words(s);
      return w.length >= 3 && !FILLER_RE.test(s) && !isMostlyFiller(w);
    });

    const actions = [];
    const decisions = [];
    const rest = [];
    for (const s of sentences) {
      if (DECISION_RE.test(s)) decisions.push(s);
      else if (ACTION_RE.test(s)) actions.push(s);
      else rest.push(s);
    }

    // Notes: highest-scoring remaining sentences, returned in original order.
    const notes = rest
      .map((s, i) => ({ s, i, score: scoreSentence(s) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .sort((a, b) => a.i - b.i)
      .map((x) => x.s);

    return {
      notes: dedupe(notes),
      decisions: dedupe(decisions).slice(0, 10),
      actions: dedupe(actions).slice(0, 10)
    };
  }

  function toMarkdown(summary) {
    const section = (title, items, checkbox) => {
      const body = items.length
        ? items.map((i) => (checkbox ? `- [ ] ${i}` : `- ${i}`)).join('\n')
        : '_None detected._';
      return `### ${title}\n${body}`;
    };
    return [
      '## Summary',
      section('Notes', summary.notes, false),
      section('Decisions', summary.decisions, false),
      section('Action items', summary.actions, true)
    ].join('\n\n');
  }

  return { summarize, toMarkdown, splitSentences };
});
