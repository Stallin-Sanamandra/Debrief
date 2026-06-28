'use strict';

const assert = require('assert');
const { aggregate, openCount } = require('../src/shared/actions');

const sessions = [
  {
    id: 's1', title: 'Discovery — Acme', createdAt: '2026-06-20T10:00:00.000Z',
    summary: { actions: [{ text: 'Send MSA', owner: 'Sam' }, { text: 'Book security review', owner: null }] }
  },
  {
    id: 's2', title: 'Demo — Globex', createdAt: '2026-06-24T10:00:00.000Z',
    summary: { actions: [{ text: 'Share pricing', owner: 'You' }] }
  },
  { id: 's3', title: 'Solo notes', createdAt: '2026-06-25T10:00:00.000Z', summary: { actions: [] } }
];

// State: one item done.
const state = { 's1#0': true };

const items = aggregate(sessions, state);
assert.strictEqual(items.length, 3, 'collects all action items across sessions');
assert.strictEqual(openCount(items), 2, 'two still open');

// Open items come first; among open, newest meeting first.
assert.strictEqual(items[0].sessionId, 's2', 'newest open item first (Globex 06-24)');
assert.strictEqual(items[1].sessionId, 's1', 'then older open item (Acme review)');
assert.strictEqual(items[2].done, true, 'done item sorts last');
assert.strictEqual(items[2].key, 's1#0', 'stable key is sessionId#index');
assert.strictEqual(items[1].text, 'Book security review', 'open Acme item is the second action');
assert.strictEqual(items[0].owner, 'You', 'owner carried through');

// Robust to missing/empty.
assert.deepStrictEqual(aggregate(null, null), [], 'no sessions -> empty');
assert.strictEqual(aggregate([{ id: 'x', summary: { actions: [{ text: '' }] } }], {}).length, 0, 'blank action text skipped');

console.log('actions.test.js: all assertions passed');
