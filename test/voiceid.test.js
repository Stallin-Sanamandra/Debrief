'use strict';

const assert = require('assert');
const { embed } = require('../src/shared/embed');
const { cosine, matchEmbedding, mergeEmbedding } = require('../src/shared/voiceid');

const SR = 16000;
// A crude "voice" proxy: a fundamental + a couple of harmonics (formant-ish) at given f0, with noise.
function voice(f0, seconds, seed) {
  const n = Math.floor(seconds * SR);
  const a = new Float32Array(n);
  let s = seed || 1;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff - 0.5; };
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    a[i] = 0.5 * Math.sin(2 * Math.PI * f0 * t) +
           0.3 * Math.sin(2 * Math.PI * f0 * 2.4 * t) +
           0.2 * Math.sin(2 * Math.PI * f0 * 3.7 * t) +
           0.05 * rnd();
  }
  return a;
}

// ---- embed: determinism + dimensionality ----
const eA1 = embed(voice(120, 2, 1), SR);
const eA2 = embed(voice(120, 2, 1), SR);
assert.ok(eA1 && eA1.length === 52, 'embedding is 52-dim');
assert.ok(Math.abs(cosine(eA1, eA2) - 1) < 1e-9, 'same audio -> identical embedding');
assert.strictEqual(embed(new Float32Array(100), SR), null, 'too little audio -> null');

// ---- discrimination: same speaker (different utterances) closer than different speakers ----
const speakerA_utt1 = embed(voice(120, 2, 11), SR); // low-pitched voice, two takes
const speakerA_utt2 = embed(voice(122, 2, 22), SR);
const speakerB_utt1 = embed(voice(210, 2, 33), SR); // higher-pitched, different timbre
const simSame = cosine(speakerA_utt1, speakerA_utt2);
const simDiff = cosine(speakerA_utt1, speakerB_utt1);
assert.ok(simSame > simDiff, `same-voice sim (${simSame.toFixed(3)}) > diff-voice sim (${simDiff.toFixed(3)})`);

// ---- matchEmbedding: enroll A, then a new A-utterance matches A, a B-utterance does not ----
const prints = { Marcio: { emb: speakerA_utt1, count: 1 } };
const lowThr = Math.min(simSame, 0.5) - 0.05; // tolerant threshold for this synthetic proxy
const mA = matchEmbedding(speakerA_utt2, prints, lowThr);
assert.ok(mA && mA.name === 'Marcio', 'A-utterance matches enrolled Marcio');
const mB = matchEmbedding(speakerB_utt1, prints, simSame); // strict threshold rejects different voice
assert.ok(!mB, 'different voice does not match at a strict threshold');

// ---- mergeEmbedding: running mean ----
const merged = mergeEmbedding([0, 0], [2, 4], 1);
assert.deepStrictEqual(merged, [1, 2], 'running mean of two samples');
assert.deepStrictEqual(mergeEmbedding(null, [3, 5], 0), [3, 5], 'first sample seeds the print');

console.log('voiceid.test.js: all assertions passed');
