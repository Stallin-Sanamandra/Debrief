'use strict';

const assert = require('assert');
const ai = require('../src/main/ai-summary');

// buildAskPrompt embeds the question, the excerpts (with meeting title), and a citation instruction.
const ctx = [{ meeting: { id: '1', title: 'Acme Demo', createdAt: '2026-06-24T10:00:00Z' }, excerpts: ['We decided Acme owns the APM list.'] }];
const { system, user } = ai.buildAskPrompt('who owns the apm list?', ctx);
assert.ok(/cite/i.test(system), 'system prompt requests citations');
assert.ok(/only/i.test(system), 'system prompt constrains to provided excerpts');
assert.ok(/Acme Demo/.test(user) && /APM list/.test(user), 'excerpts embedded with meeting title');
assert.ok(/Question: who owns the apm list\?/.test(user), 'question embedded');

(async () => {
  // No matching context -> graceful noContext.
  const r1 = await ai.answerQuestion({ question: 'x', context: [], modelId: 'claude-sonnet' });
  assert.strictEqual(r1.noContext, true, 'empty context flagged');

  // Context present but no API key in this env -> graceful noKey, with sources for fallback.
  const r2 = await ai.answerQuestion({ question: 'who owns the list', context: ctx, modelId: 'claude-sonnet' });
  assert.strictEqual(r2.noKey, true, 'missing key handled gracefully (no throw)');
  assert.strictEqual(r2.sources.length, 1, 'fallback returns the relevant meetings');
  assert.strictEqual(r2.sources[0].title, 'Acme Demo');

  console.log('ask.test.js: all assertions passed');
})();
