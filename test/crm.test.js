'use strict';

const assert = require('assert');
const { parseCrm, formatCrm, basicDealNotes } = require('../src/main/ai-summary');

// parseCrm: fenced JSON, with alias keys (pain_points, next_step) normalized.
let f = parseCrm('```json\n{"company":"Acme","attendees":"Stallin (us); Marcio (Acme)","pain_points":"manual audits","budget":"$50k","timeline":"Q3","competitors":"Sprinto","next_step":"Send POC plan"}\n```');
assert.strictEqual(f.company, 'Acme');
assert.strictEqual(f.pain, 'manual audits', 'pain_points -> pain');
assert.strictEqual(f.nextStep, 'Send POC plan', 'next_step -> nextStep');

// formatCrm: labeled block, empty fields become em dash.
const text = formatCrm({ company: 'Acme', nextStep: 'Send POC' });
assert.ok(/^Company: Acme$/m.test(text), 'company line');
assert.ok(/Budget: —/.test(text), 'missing field is em dash');
assert.ok(/Next step: Send POC/.test(text), 'next step line');
assert.ok(/Competitors:/.test(text) && /Timeline:/.test(text), 'all 7 fields present');

// basicDealNotes: attendees from named speakers, next step from actions (no API key path).
const rec = {
  title: 'Acme Demo',
  speakerNames: { me: 'Stallin', others1: 'Marcio', others2: 'Others 2' },
  summary: { actions: [{ text: 'Send pricing', owner: 'Stallin' }] }
};
const b = basicDealNotes(rec);
assert.ok(/Stallin \(us\)/.test(b.attendees), 'me labeled as us');
assert.ok(/Marcio/.test(b.attendees), 'named other included');
assert.ok(!/Others 2/.test(b.attendees), 'unnamed default speaker excluded');
assert.ok(/Send pricing \(Stallin\)/.test(b.nextStep), 'next step from actions');

console.log('crm.test.js: all assertions passed');
