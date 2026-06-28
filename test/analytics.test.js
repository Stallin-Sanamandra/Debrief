'use strict';

const assert = require('assert');
const { computeTalkTime, questionCount } = require('../src/shared/analytics');

// question bursts
assert.strictEqual(questionCount('Really? Are you sure?? Yes.'), 2, 'counts question bursts, not marks');
assert.strictEqual(questionCount('No questions here.'), 0, 'no questions');

// Time-based ratio + per-speaker tallies.
{
  const entries = [
    { t: 0, speaker: 'Me', text: 'Hello, how are you?', dur: 4 },
    { t: 5, speaker: 'Others', text: 'Good thanks. What is the plan?', dur: 6 },
    { t: 12, speaker: 'Me', text: 'We ship Friday.', dur: 2 }
  ];
  const a = computeTalkTime(entries);
  assert.strictEqual(a.basis, 'time', 'uses time when durations present');
  assert.strictEqual(a.me.seconds, 6, 'Me seconds summed');
  assert.strictEqual(a.others.seconds, 6, 'Others seconds summed');
  assert.ok(Math.abs(a.ratioMe - 0.5) < 1e-9, 'ratio is 50/50 by time');
  assert.strictEqual(a.me.questions, 1, 'Me asked 1');
  assert.strictEqual(a.others.questions, 1, 'Others asked 1');
}

// Longest monologue = longest consecutive same-speaker stretch (wall clock).
{
  const entries = [
    { t: 0, speaker: 'Others', text: 'a', dur: 2 },
    { t: 2, speaker: 'Me', text: 'b', dur: 3 },   // Me run starts
    { t: 6, speaker: 'Me', text: 'c', dur: 4 },   // ...continues to t=10
    { t: 11, speaker: 'Others', text: 'd', dur: 1 }
  ];
  const a = computeTalkTime(entries);
  assert.strictEqual(a.longestMonologue.speaker, 'Me', 'Me held the floor longest');
  assert.ok(Math.abs(a.longestMonologue.seconds - 8) < 1e-9, 'Me monologue spans t=2..10 = 8s, got ' + a.longestMonologue.seconds);
}

// Word fallback when no durations (older sessions).
{
  const entries = [
    { t: 0, speaker: 'Me', text: 'one two three four' },
    { t: 1, speaker: 'Others', text: 'five six' }
  ];
  const a = computeTalkTime(entries);
  assert.strictEqual(a.basis, 'words', 'falls back to words without durations');
  assert.ok(Math.abs(a.ratioMe - 4 / 6) < 1e-9, 'word-based ratio');
  assert.strictEqual(a.longestMonologue, null, 'no time-based monologue without durations');
}

// Empty input is safe.
{
  const a = computeTalkTime([]);
  assert.strictEqual(a.ratioMe, 0);
  assert.strictEqual(a.longestMonologue, null);
}

console.log('analytics.test.js: all assertions passed');
