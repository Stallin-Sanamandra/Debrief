'use strict';

const assert = require('assert');
const { parseGlossary, correctText } = require('../src/shared/glossary');

// ---- parsing ----
const g = parseGlossary('ABM\nBDR = beedee are, b d r\nMEDDIC\nSalesforce\n\n  Acme Corp = acme corpse  ');
assert.strictEqual(g.length, 5, 'parses 5 entries, ignores blank lines');
assert.deepStrictEqual(g[1], { canonical: 'BDR', aliases: ['beedee are', 'b d r'] }, 'parses aliases');
assert.deepStrictEqual(g[3], { canonical: 'Salesforce', aliases: [] }, 'bare term has no aliases');
assert.deepStrictEqual(g[4], { canonical: 'Acme Corp', aliases: ['acme corpse'] }, 'trims around =');

// ---- explicit aliases (the wild-mishearing lever) ----
let out = correctText('So Adabare is our top motion this quarter.', parseGlossary('ABM = Adabare'));
assert.strictEqual(out, 'So ABM is our top motion this quarter.', 'alias fixes a wild mishearing');

out = correctText('We looped in Adobe air and a beam.', parseGlossary('ABM = Adobe air, a beam'));
assert.strictEqual(out, 'We looped in ABM and ABM.', 'multi-word + longest-first aliases');

// ---- acronym spaced / dotted forms ----
out = correctText('Talk to the b d r and BDR.', parseGlossary('BDR'));
assert.strictEqual(out, 'Talk to the BDR and BDR.', 'acronym separators collapse to canonical');
// A trailing abbreviation dot is intentionally preserved (can't be told apart from a
// sentence-ending period locally), so "B.D.R." -> "BDR.".
out = correctText('the B.D.R. team', parseGlossary('BDR'));
assert.strictEqual(out, 'the BDR. team', 'internal dots collapse; trailing dot preserved');

// ---- conservative fuzzy (spelling drift on longer names) ----
out = correctText('We demoed to Salezforce today.', parseGlossary('Salesforce'));
assert.strictEqual(out, 'We demoed to Salesforce today.', 'fuzzy fixes near-miss name');

// ---- no false positives on ordinary words / short terms ----
out = correctText('The acme of our acne research.', parseGlossary('Acme'));
assert.strictEqual(out, 'The acme of our acne research.', 'short term (len 4) does NOT fuzzy-clobber "acne"');

out = correctText('Nothing to change here at all.', parseGlossary('MEDDIC\nABM'));
assert.strictEqual(out, 'Nothing to change here at all.', 'unrelated text untouched');

// ---- empty glossary is a no-op ----
assert.strictEqual(correctText('leave me be', []), 'leave me be', 'empty glossary returns input');
assert.strictEqual(correctText('', parseGlossary('ABM')), '', 'empty text returns empty');

console.log('glossary.test.js: all assertions passed');
