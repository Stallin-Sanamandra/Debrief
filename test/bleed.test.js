'use strict';

const assert = require('assert');
const { dedupeCrossChannel, similar } = require('../src/shared/bleed');

assert.ok(similar('And these are the most important ones', 'And these are the most important ones.') > 0.9, 'identical lines very similar');
assert.ok(similar('hello there friend', 'completely different words entirely') < 0.3, 'unrelated lines dissimilar');

// Echo bleed: remote line on Others, re-captured near-simultaneously on Me -> Me copy dropped.
const entries = [
  { t: 0, speaker: 'Others', text: 'And these are the most important ones.' },
  { t: 0.5, speaker: 'Me', text: 'And these are the most important ones.' }, // bleed (drop)
  { t: 5, speaker: 'Me', text: 'Yes I agree, let us proceed with that plan.' }, // genuine Me (keep)
  { t: 8, speaker: 'Others', text: 'Great, I will send the document over.' } // genuine Others (keep)
];
const out = dedupeCrossChannel(entries);
assert.strictEqual(out.length, 3, 'one bleed line dropped');
assert.ok(!out.find((e) => e.speaker === 'Me' && /most important/.test(e.text)), 'bleed Me line removed');
assert.ok(out.find((e) => /Yes I agree/.test(e.text)), 'genuine Me speech kept (no Others twin)');
assert.ok(out.find((e) => /send the document/.test(e.text)), 'genuine Others kept');

// A Me line far in time from the similar Others line is NOT treated as bleed.
const far = dedupeCrossChannel([
  { t: 0, speaker: 'Others', text: 'we should refresh the account list monthly' },
  { t: 60, speaker: 'Me', text: 'we should refresh the account list monthly' }
]);
assert.strictEqual(far.length, 2, 'outside the time window -> not bleed');

console.log('bleed.test.js: all assertions passed');
