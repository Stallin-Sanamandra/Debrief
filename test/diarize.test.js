'use strict';

const assert = require('assert');
const { estimateF0 } = require('../src/shared/voice-features');
const { splitOthers } = require('../src/shared/diarize');

const SR = 16000;
function tone(hz, seconds, amp) {
  const n = Math.floor(seconds * SR);
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = (amp || 0.3) * Math.sin((2 * Math.PI * hz * i) / SR);
  return a;
}

// ---- F0 estimation ----
assert.ok(Math.abs(estimateF0(tone(120, 1.0), SR) - 120) < 6, 'F0 ~120Hz, got ' + estimateF0(tone(120, 1.0), SR).toFixed(1));
assert.ok(Math.abs(estimateF0(tone(220, 1.0), SR) - 220) < 8, 'F0 ~220Hz, got ' + estimateF0(tone(220, 1.0), SR).toFixed(1));
assert.strictEqual(estimateF0(new Float32Array(SR), SR), 0, 'silence -> 0 (no pitch)');

// ---- conservative split: two clearly different pitches, balanced time -> split ----
{
  const entries = [
    { speaker: 'Me', text: 'hi', dur: 5, f0: 0 },
    { speaker: 'Others', text: 'a', dur: 6, f0: 115 },
    { speaker: 'Others', text: 'b', dur: 6, f0: 118 },
    { speaker: 'Others', text: 'c', dur: 6, f0: 225 },
    { speaker: 'Others', text: 'd', dur: 6, f0: 230 }
  ];
  const r = splitOthers(entries);
  assert.strictEqual(r.split, true, 'splits two well-separated pitch groups');
  const lows = entries.filter((e) => e.speaker === 'Others' && e.f0 < 150);
  const highs = entries.filter((e) => e.speaker === 'Others' && e.f0 > 200);
  assert.ok(lows.every((e) => e.sub === lows[0].sub), 'all low-pitch get the same sub');
  assert.ok(highs.every((e) => e.sub === highs[0].sub), 'all high-pitch get the same sub');
  assert.notStrictEqual(lows[0].sub, highs[0].sub, 'low vs high are different speakers');
}

// ---- conservative: similar pitches -> do NOT split ----
{
  const entries = [
    { speaker: 'Others', text: 'a', dur: 8, f0: 140 },
    { speaker: 'Others', text: 'b', dur: 8, f0: 145 }
  ];
  const r = splitOthers(entries);
  assert.strictEqual(r.split, false, 'similar pitch stays one speaker');
  assert.ok(entries.every((e) => e.sub === 1), 'all default to sub 1');
}

// ---- conservative: too little total time -> do NOT split ----
{
  const entries = [
    { speaker: 'Others', text: 'a', dur: 2, f0: 110 },
    { speaker: 'Others', text: 'b', dur: 2, f0: 240 }
  ];
  assert.strictEqual(splitOthers(entries).split, false, 'short conversation not split');
}

console.log('diarize.test.js: all assertions passed');
