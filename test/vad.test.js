'use strict';

const assert = require('assert');
const { hasSpeech } = require('../src/shared/vad');

const SR = 16000;

// Pure silence -> not speech.
assert.strictEqual(hasSpeech(new Float32Array(SR), { sampleRate: SR }), false, 'silence');

// Low steady noise below the gate -> not speech.
const noise = new Float32Array(SR).fill(0.003);
assert.strictEqual(hasSpeech(noise, { sampleRate: SR }), false, 'low noise');

// Sustained tone across the window -> speech.
const speech = new Float32Array(SR);
for (let i = 0; i < speech.length; i++) speech[i] = 0.2 * Math.sin((2 * Math.PI * 220 * i) / SR);
assert.strictEqual(hasSpeech(speech, { sampleRate: SR }), true, 'sustained tone');

// A brief blip (energy in <10% of frames) -> not speech.
const blip = new Float32Array(SR);
for (let i = 8000; i < 8600; i++) blip[i] = 0.2;
assert.strictEqual(hasSpeech(blip, { sampleRate: SR }), false, 'brief blip below voiced ratio');

// Too-short buffer -> not speech.
assert.strictEqual(hasSpeech(new Float32Array(100), { sampleRate: SR }), false, 'too short');

console.log('vad.test.js: all assertions passed');
