'use strict';

const assert = require('assert');
const { tokenize, scoreText, search, bestSnippet, relevantSections } = require('../src/shared/search');

// tokenize
assert.deepStrictEqual(tokenize("Acme's APM-list, decided!"), ['acme', 'apm-list', 'decided']);

// scoreText: more matches score higher; phrase bonus.
assert.ok(scoreText('apm list apm list', ['apm']) > scoreText('apm once', ['apm']));
assert.ok(scoreText('the apm list is ready', ['apm', 'list']) > scoreText('apm and separately list', ['apm', 'list']), 'phrase bonus');

// search: ranks the doc that actually discusses the topic first; returns snippet.
const docs = [
  { id: 'a', title: 'Acme APM list review', createdAt: '2026-06-20T10:00:00Z', durationSec: 600, text: 'We decided Acme owns the APM list and will refresh it monthly.' },
  { id: 'b', title: 'Weekly standup', createdAt: '2026-06-22T10:00:00Z', durationSec: 300, text: 'General updates, no decisions about lists.' },
  { id: 'c', title: 'Budget sync', createdAt: '2026-06-25T10:00:00Z', durationSec: 300, text: 'Talked about spend pacing.' }
];
const res = search(docs, 'Acme APM list', 10);
assert.strictEqual(res[0].id, 'a', 'most relevant meeting ranked first');
assert.ok(res.length >= 1 && res.every((r) => r.score > 0), 'only positive scores');
assert.ok(/APM list/i.test(res[0].snippet), 'snippet contains the match');
assert.strictEqual(search(docs, '   ', 10).length, 0, 'blank query -> no results');
assert.ok(!res.find((r) => r.id === 'c'), 'meeting with zero matching terms excluded');

// bestSnippet windows around the first match with ellipses.
const long = 'x'.repeat(400) + ' the APM list decision ' + 'y'.repeat(400);
const snip = bestSnippet(long, ['apm']);
assert.ok(snip.includes('APM list') && snip.startsWith('…') && snip.endsWith('…'), 'windowed snippet');

// relevantSections: returns the chunk that matches the query.
const entries = [];
for (let i = 0; i < 20; i++) entries.push({ t: i * 5, speaker: 'Me', text: 'filler talk about scheduling ' + i });
entries.push({ t: 200, speaker: 'Others', text: 'On the APM list, Acme will own it and refresh monthly.' });
const secs = relevantSections(entries, 'apm list acme', { limit: 2 });
assert.ok(secs.length >= 1, 'finds a relevant section');
assert.ok(/APM list/i.test(secs[0].text), 'top section is the matching one');

console.log('search.test.js: all assertions passed');
