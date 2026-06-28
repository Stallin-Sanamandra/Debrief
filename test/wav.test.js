'use strict';

const assert = require('assert');
const { encodeWav, rms } = require('../src/shared/wav');

function str(view, off, len) {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(off + i));
  return s;
}

// --- header + size ---
const samples = Float32Array.from([0, 1, -1, 0.5, -0.5]);
const buf = encodeWav(samples, 16000);
const view = new DataView(buf);

assert.strictEqual(buf.byteLength, 44 + samples.length * 2, 'byte length');
assert.strictEqual(str(view, 0, 4), 'RIFF', 'RIFF tag');
assert.strictEqual(str(view, 8, 4), 'WAVE', 'WAVE tag');
assert.strictEqual(str(view, 12, 4), 'fmt ', 'fmt tag');
assert.strictEqual(str(view, 36, 4), 'data', 'data tag');
assert.strictEqual(view.getUint16(20, true), 1, 'PCM format');
assert.strictEqual(view.getUint16(22, true), 1, 'mono');
assert.strictEqual(view.getUint32(24, true), 16000, 'sample rate');
assert.strictEqual(view.getUint16(34, true), 16, 'bits per sample');

// --- sample encoding (full-scale clamps) ---
assert.strictEqual(view.getInt16(44 + 0 * 2, true), 0, 'zero sample');
assert.strictEqual(view.getInt16(44 + 1 * 2, true), 32767, '+1.0 -> max');
assert.strictEqual(view.getInt16(44 + 2 * 2, true), -32768, '-1.0 -> min');
assert.ok(Math.abs(view.getInt16(44 + 3 * 2, true) - 16383) <= 1, '+0.5 approx');

// --- rms ---
assert.strictEqual(rms(Float32Array.from([0, 0, 0])), 0, 'silence rms 0');
assert.ok(Math.abs(rms(Float32Array.from([1, 1, 1])) - 1) < 1e-6, 'full rms 1');

console.log('wav.test.js: all assertions passed');
