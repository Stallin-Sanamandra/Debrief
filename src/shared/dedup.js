// UMD module: merges overlapping transcription chunks into a running transcript.
// Because each audio window re-sends ~1.5s of the previous window, consecutive
// chunks share leading words. We find the largest word overlap between the tail
// of the running transcript and the head of the new chunk, and append only the remainder.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefDedup = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_OVERLAP_WORDS = 30;

  function tokenize(s) {
    return (s || '').trim().split(/\s+/).filter(Boolean);
  }

  // Normalize a word for comparison: lowercase, strip surrounding punctuation.
  function norm(w) {
    return w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  }

  function wordsEqual(a, b) {
    return norm(a) === norm(b);
  }

  // Returns { delta, merged } where delta is the new text to append (may be empty).
  function mergeTranscript(running, chunk) {
    const chunkWords = tokenize(chunk);
    if (!chunkWords.length) return { delta: '', merged: running || '' };

    const runWords = tokenize(running);
    if (!runWords.length) {
      const merged = chunkWords.join(' ');
      return { delta: merged, merged };
    }

    const maxK = Math.min(MAX_OVERLAP_WORDS, runWords.length, chunkWords.length);
    let bestK = 0;
    for (let k = maxK; k >= 1; k--) {
      let match = true;
      for (let i = 0; i < k; i++) {
        if (!wordsEqual(runWords[runWords.length - k + i], chunkWords[i])) {
          match = false;
          break;
        }
      }
      if (match) {
        bestK = k;
        break;
      }
    }

    const newWords = chunkWords.slice(bestK);
    const delta = newWords.join(' ');
    const merged = delta ? runWords.concat(newWords).join(' ') : runWords.join(' ');
    return { delta, merged };
  }

  return { mergeTranscript, tokenize, norm };
});
