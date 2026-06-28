'use strict';

const assert = require('assert');
const { mergeTranscript } = require('../src/shared/dedup');

// Empty running transcript -> whole chunk is new.
let r = mergeTranscript('', 'hello world');
assert.strictEqual(r.delta, 'hello world');
assert.strictEqual(r.merged, 'hello world');

// Leading overlap is removed.
r = mergeTranscript('hello world', 'world this is');
assert.strictEqual(r.delta, 'this is');
assert.strictEqual(r.merged, 'hello world this is');

// Multi-word overlap.
r = mergeTranscript('the quick brown fox', 'brown fox jumps over');
assert.strictEqual(r.delta, 'jumps over');
assert.strictEqual(r.merged, 'the quick brown fox jumps over');

// No overlap -> append everything.
r = mergeTranscript('a b c', 'd e f');
assert.strictEqual(r.delta, 'd e f');
assert.strictEqual(r.merged, 'a b c d e f');

// Case + punctuation insensitive overlap.
r = mergeTranscript('I said hello.', 'Hello there friend');
assert.strictEqual(r.delta, 'there friend');

// Fully duplicated chunk -> no delta.
r = mergeTranscript('one two three', 'two three');
assert.strictEqual(r.delta, '');
assert.strictEqual(r.merged, 'one two three');

console.log('dedup.test.js: all assertions passed');
