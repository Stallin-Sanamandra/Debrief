'use strict';

const assert = require('assert');
const { parseEmail, basicEmail } = require('../src/main/ai-summary');

// parseEmail extracts a fenced JSON object.
let p = parseEmail('```json\n{"subject":"Follow-up: Demo","body":"Hi team,\\n\\nThanks.\\n\\nBest,"}\n```');
assert.strictEqual(p.subject, 'Follow-up: Demo', 'subject parsed');
assert.ok(/Thanks/.test(p.body), 'body parsed');

// parseEmail falls back to raw text when not JSON.
p = parseEmail('not json at all');
assert.strictEqual(p.subject, '', 'no subject on non-JSON');
assert.strictEqual(p.body, 'not json at all', 'raw text becomes body');

// basicEmail builds a usable draft from the stored summary (no API key path).
const rec = {
  title: 'Acme Discovery',
  summary: {
    notes: ['Discussed compliance pain', 'Budget approved for Q3'],
    decisions: ['Move to a paid POC'],
    actions: [{ text: 'Send MSA', owner: 'Sam' }, { text: 'Schedule security review', owner: null }]
  }
};
const e = basicEmail(rec);
assert.ok(/Acme Discovery/.test(e.subject), 'subject includes title');
assert.ok(/Next steps:/.test(e.body), 'has next steps section');
assert.ok(/Send MSA \(Sam\)/.test(e.body), 'action with owner rendered');
assert.ok(/Best,/.test(e.body), 'signs off');

console.log('email.test.js: all assertions passed');
