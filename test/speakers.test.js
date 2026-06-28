'use strict';

const assert = require('assert');
const S = require('../src/shared/speakers');

// slotOf
assert.strictEqual(S.slotOf({ speaker: 'Me' }), 'me');
assert.strictEqual(S.slotOf({ speaker: 'Others' }), 'others1', 'Others with no sub -> others1');
assert.strictEqual(S.slotOf({ speaker: 'Others', sub: 3 }), 'others3');

// defaultName / nameFor
assert.strictEqual(S.defaultName('me'), 'Me');
assert.strictEqual(S.defaultName('others1'), 'Others');
assert.strictEqual(S.defaultName('others4'), 'Others 4');
assert.strictEqual(S.nameFor('others2', { others2: 'Kirti' }), 'Kirti', 'custom name wins');
assert.strictEqual(S.nameFor('others5', {}), 'Others 5', 'falls back to default for any N');

// labelFor
assert.strictEqual(S.labelFor({ speaker: 'Others', sub: 2 }, { others2: 'Marcio' }), 'Marcio');

// isValidSlot
assert.ok(S.isValidSlot('me') && S.isValidSlot('others1') && S.isValidSlot('others12'));
assert.ok(!S.isValidSlot('others') && !S.isValidSlot('bogus'));

// applySlot
const e = {};
S.applySlot(e, 'others3');
assert.deepStrictEqual(e, { speaker: 'Others', sub: 3 });
S.applySlot(e, 'me');
assert.strictEqual(e.speaker, 'Me');
assert.strictEqual(e.sub, undefined, 'me clears sub');

// nextOthersSlot — beyond what exists / is named
assert.strictEqual(S.nextOthersSlot([{ speaker: 'Others', sub: 1 }, { speaker: 'Others', sub: 2 }], []), 'others3');
assert.strictEqual(S.nextOthersSlot([{ speaker: 'Me' }], ['others2', 'others4']), 'others5', 'respects named slots');
assert.strictEqual(S.nextOthersSlot([], []), 'others2', 'empty -> others2 (others1 is the default first)');

console.log('speakers.test.js: all assertions passed');
