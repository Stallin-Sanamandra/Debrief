// UMD module: per-session talk-time analytics from the speaker-labelled entries.
// Entries are [{ t, speaker: 'Me'|'Others', text, dur? }] where dur is the spoken seconds
// of that utterance (from the segmenter). When dur is present the ratio is true talk-TIME;
// otherwise it falls back to a word-count proxy so older sessions still show something.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefAnalytics = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function wordCount(s) {
    return (s || '').trim().split(/\s+/).filter(Boolean).length;
  }
  // Count question "bursts" (one or more '?' in a row = one question).
  function questionCount(s) {
    return ((s || '').match(/\?+/g) || []).length;
  }
  function key(sp) {
    return sp === 'Me' ? 'Me' : 'Others';
  }

  // Returns:
  // { me:{seconds,words,questions}, others:{...}, totalSeconds, totalWords,
  //   ratioMe (0..1), basis:'time'|'words', longestMonologue:{speaker,seconds}|null }
  function computeTalkTime(entries) {
    const me = { seconds: 0, words: 0, questions: 0 };
    const others = { seconds: 0, words: 0, questions: 0 };
    const list = Array.isArray(entries) ? entries.slice() : [];

    list.forEach((e) => {
      const bucket = key(e.speaker) === 'Me' ? me : others;
      bucket.seconds += Number(e.dur) > 0 ? Number(e.dur) : 0;
      bucket.words += wordCount(e.text);
      bucket.questions += questionCount(e.text);
    });

    const totalSeconds = me.seconds + others.seconds;
    const totalWords = me.words + others.words;
    const basis = totalSeconds > 0 ? 'time' : 'words';
    let ratioMe = 0;
    if (basis === 'time') ratioMe = totalSeconds ? me.seconds / totalSeconds : 0;
    else ratioMe = totalWords ? me.words / totalWords : 0;

    // Longest monologue: longest wall-clock stretch one speaker holds the floor
    // (a maximal run of consecutive same-speaker utterances). Time-based only.
    let longestMonologue = null;
    if (basis === 'time') {
      const sorted = list
        .filter((e) => typeof e.t === 'number')
        .sort((a, b) => a.t - b.t);
      let runSpeaker = null;
      let runStart = 0;
      let runEnd = 0;
      const consider = (sp, span) => {
        if (span > 0 && (!longestMonologue || span > longestMonologue.seconds)) {
          longestMonologue = { speaker: sp, seconds: span };
        }
      };
      sorted.forEach((e) => {
        const end = e.t + (Number(e.dur) > 0 ? Number(e.dur) : 0);
        if (key(e.speaker) === runSpeaker) {
          runEnd = Math.max(runEnd, end);
        } else {
          if (runSpeaker !== null) consider(runSpeaker, runEnd - runStart);
          runSpeaker = key(e.speaker);
          runStart = e.t;
          runEnd = end;
        }
      });
      if (runSpeaker !== null) consider(runSpeaker, runEnd - runStart);
    }

    return { me, others, totalSeconds, totalWords, ratioMe, basis, longestMonologue };
  }

  return { computeTalkTime, wordCount, questionCount };
});
