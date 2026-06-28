'use strict';

const assert = require('assert');
const { matchAttendee, lookup } = require('../src/shared/briefs');

// newest-first
const sessions = [
  { id: 's3', title: 'Budget sync', createdAt: '2026-06-25T10:00:00Z', speakerNames: { me: 'Stallin' }, transcriptText: 'spend pacing', summary: { notes: ['Spend 5% ahead'], actions: [] } },
  { id: 's2', title: 'Acme demo', createdAt: '2026-06-24T10:00:00Z', speakerNames: { me: 'Stallin', others1: 'Marcio' }, transcriptText: 'Marcio walked through pricing', summary: { notes: ['Liked the pricing', 'Wants a POC'], actions: [{ text: 'Send POC plan', owner: 'Stallin' }] } },
  { id: 's1', title: 'Acme intro', createdAt: '2026-06-20T10:00:00Z', speakerNames: { me: 'Stallin', others1: 'Marcio' }, transcriptText: 'intro call with Marcio', summary: { notes: ['First contact'], actions: [] } }
];

// Most-recent match wins; count reflects all matches.
const b = matchAttendee(sessions, 'Marcio');
assert.strictEqual(b.sessionId, 's2', 'returns the most recent meeting with Marcio');
assert.strictEqual(b.count, 2, 'counts both meetings with Marcio');
assert.strictEqual(b.matchedBy, 'speaker', 'matched by remembered speaker name');
assert.deepStrictEqual(b.notes, ['Liked the pricing', 'Wants a POC'], 'top notes carried');
assert.strictEqual(b.actions[0].text, 'Send POC plan', 'action carried');

// excludeId skips the in-progress session.
assert.strictEqual(matchAttendee(sessions, 'Marcio', 's2').sessionId, 's1', 'exclude current -> prior meeting');

// No prior meeting -> null. Default/unknown names ignored.
assert.strictEqual(matchAttendee(sessions, 'Priya'), null, 'unknown attendee -> null');
assert.strictEqual(matchAttendee(sessions, 'M'), null, 'too-short name ignored');

// lookup dedupes and drops non-matches.
const briefs = lookup(sessions, ['Marcio', 'marcio', 'Priya', 'Stallin'], null);
assert.strictEqual(briefs.length, 2, 'Marcio (once) + Stallin matched; Priya dropped; dupe ignored');

console.log('briefs.test.js: all assertions passed');
