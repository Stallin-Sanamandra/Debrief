'use strict';

const assert = require('assert');
const { Segmenter } = require('../src/shared/segmenter');

const SR = 16000;

function tone(seconds, amp) {
  const n = Math.floor(seconds * SR);
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = amp * Math.sin((2 * Math.PI * 220 * i) / SR);
  return a;
}
function silence(seconds) {
  return new Float32Array(Math.floor(seconds * SR));
}
function cat(parts) {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const out = new Float32Array(n);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
// Feed a stream in realistic 0.1s blocks.
function feed(seg, stream) {
  const emitted = [];
  const B = Math.floor(0.1 * SR);
  for (let i = 0; i < stream.length; i += B) {
    emitted.push(...seg.push(stream.subarray(i, Math.min(i + B, stream.length))));
  }
  return emitted;
}
const secs = (a) => a.length / SR;

// 1) One utterance bounded by a pause -> exactly one segment, ~voiced length.
{
  const seg = new Segmenter();
  const out = feed(seg, cat([silence(0.3), tone(1.0, 0.2), silence(1.0)]));
  assert.strictEqual(out.length, 1, 'one utterance -> one segment');
  assert.strictEqual(out[0].continued, false, 'natural segment is not continued');
  assert.ok(secs(out[0].audio) > 0.8 && secs(out[0].audio) < 1.7, 'segment ~ voiced length, got ' + secs(out[0].audio).toFixed(2) + 's');
}

// 2) Two utterances split by a pause; second flushed on stop.
{
  const seg = new Segmenter();
  const out = feed(seg, cat([tone(1.0, 0.2), silence(1.0), tone(0.5, 0.2)]));
  assert.strictEqual(out.length, 1, 'first utterance emitted during the pause');
  const tail = seg.flush();
  assert.strictEqual(tail.length, 1, 'second utterance emitted on flush');
  assert.strictEqual(tail[0].continued, false, 'flushed natural utterance not continued');
}

// 3) Long monologue with no pause -> forced cut; continuation flagged.
{
  const seg = new Segmenter();
  const out = feed(seg, tone(12, 0.2)); // maxSegmentSec = 10
  assert.strictEqual(out.length, 1, 'forced cut emits one segment at the max length');
  assert.strictEqual(out[0].continued, false, 'first forced segment is the start');
  assert.ok(secs(out[0].audio) >= 9.5 && secs(out[0].audio) <= 10.5, 'forced segment ~10s');
  const tail = seg.flush();
  assert.strictEqual(tail.length, 1, 'remainder flushed');
  assert.strictEqual(tail[0].continued, true, 'continuation after a forced cut is flagged for dedup');
}

// 4) A sub-250ms blip is ignored (preroll padding must not count as speech).
{
  const seg = new Segmenter();
  const out = feed(seg, cat([silence(0.3), tone(0.1, 0.2), silence(1.0)]));
  assert.strictEqual(out.length + seg.flush().length, 0, 'blip below minSegment is dropped');
}

// 5) Hysteresis: once started, quiet (but voiced) speech stays in the segment.
{
  const seg = new Segmenter();
  // 0.3s clear onset, then 1.0s quiet voiced (rms ~0.007, above contFloor, below onsetFloor), then pause.
  const out = feed(seg, cat([tone(0.3, 0.2), tone(1.0, 0.01), silence(1.0)]));
  assert.strictEqual(out.length, 1, 'quiet tail kept in one segment');
  assert.ok(secs(out[0].audio) > 1.0, 'segment retains the quiet portion, got ' + secs(out[0].audio).toFixed(2) + 's');
}

console.log('segmenter.test.js: all assertions passed');
