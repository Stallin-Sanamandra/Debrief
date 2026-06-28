'use strict';

const assert = require('assert');
const { summarize, toMarkdown } = require('../src/shared/summary');

const transcript = [
  'Thanks everyone for joining.',
  'We reviewed the Q3 pipeline and revenue is up twelve percent.',
  'We decided to go with the enterprise tier for the launch.',
  "I'll send the updated deck by Friday.",
  'We need to follow up with the design team about the new logo.',
  'Um, yeah, okay.'
].join(' ');

const s = summarize(transcript);

// Decision captured.
assert.ok(s.decisions.some((d) => /enterprise tier/.test(d)), 'captures decision');

// Both action items captured.
assert.ok(s.actions.some((a) => /send the updated deck/.test(a)), 'captures action 1');
assert.ok(s.actions.some((a) => /follow up with the design team/.test(a)), 'captures action 2');

// Notes hold substantive, non-action content; filler is excluded.
assert.ok(s.notes.length >= 1, 'has notes');
assert.ok(s.notes.some((n) => /pipeline|revenue/.test(n)), 'notes include substance');
assert.ok(!s.notes.some((n) => /^Um/i.test(n)), 'filler excluded from notes');

// Markdown rendering.
const md = toMarkdown(s);
assert.ok(md.includes('## Summary'), 'summary header');
assert.ok(md.includes('### Action items'), 'action items section');
assert.ok(md.includes('- [ ] '), 'action items render as checkboxes');

// Empty transcript yields empty buckets.
assert.deepStrictEqual(summarize(''), { notes: [], decisions: [], actions: [] }, 'empty -> empty');

console.log('summary.test.js: all assertions passed');
