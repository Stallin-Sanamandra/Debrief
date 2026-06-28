'use strict';

const assert = require('assert');
const { suggestTags, normalizeTag } = require('../src/shared/tags');

const summary = {
  notes: [
    'Discussed the APM list ownership with Acme Corp',
    'Sales Nurture campaign budget was approved for Q3',
    'Pricing for the enterprise tier needs revision'
  ],
  decisions: ['Acme Corp owns the APM list and refreshes it monthly'],
  actions: [{ text: 'Send pricing proposal to Acme Corp' }]
};
const tags = suggestTags(summary, 'Acme Corp APM and Pricing Review', { max: 6 });

assert.ok(Array.isArray(tags) && tags.length > 0 && tags.length <= 6, 'returns up to max tags');
// capitalized proper nouns surface as tags
assert.ok(tags.some((t) => /Acme Corp/i.test(t)), 'Acme Corp suggested');
assert.ok(tags.some((t) => /Sales Nurture/i.test(t)), 'Sales Nurture suggested');
// frequent significant word surfaces (pricing appears 3x)
assert.ok(tags.some((t) => /pricing/i.test(t)), 'frequent term "pricing" suggested');
// stopwords / section words not suggested
assert.ok(!tags.some((t) => /^(the|and|notes|decisions)$/i.test(t)), 'no stopwords/section words');

// dedupe (Acme Corp appears many times -> once)
assert.strictEqual(tags.filter((t) => /^acme corp$/i.test(t)).length <= 1, true, 'deduped');

// normalizeTag
assert.strictEqual(normalizeTag('  Q3   Planning  '), 'Q3 Planning', 'trims + collapses');
assert.strictEqual(normalizeTag(''), '', 'empty stays empty');

console.log('tags.test.js: all assertions passed');
