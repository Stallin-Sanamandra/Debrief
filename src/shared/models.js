// UMD: catalog of summary models. Shared by main (provider routing) and renderer (picker).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DebriefModels = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // requiresKey: which provider key must be set. disabled: shown but not selectable yet.
  const MODELS = [
    { id: 'claude-opus', label: 'Claude Opus', provider: 'anthropic', model: 'claude-opus-4-8', requiresKey: 'anthropic' },
    { id: 'claude-sonnet', label: 'Claude Sonnet', provider: 'anthropic', model: 'claude-sonnet-4-6', requiresKey: 'anthropic' },
    { id: 'claude-haiku', label: 'Claude Haiku', provider: 'anthropic', model: 'claude-haiku-4-5-20251001', requiresKey: 'anthropic' },
    { id: 'openai-gpt4o', label: 'OpenAI GPT-4o', provider: 'openai', model: 'gpt-4o', requiresKey: 'openai' },
    { id: 'openai-gpt4o-mini', label: 'OpenAI GPT-4o mini', provider: 'openai', model: 'gpt-4o-mini', requiresKey: 'openai' },
    { id: 'google-gemini-pro', label: 'Gemini 1.5 Pro', provider: 'google', model: 'gemini-1.5-pro', requiresKey: 'google' },
    { id: 'google-gemini-flash', label: 'Gemini 1.5 Flash', provider: 'google', model: 'gemini-1.5-flash', requiresKey: 'google' },
    { id: 'local', label: 'Local (offline, no key)', provider: 'local', disabled: true, note: 'coming in a later update' },
    { id: 'basic', label: 'Basic — keyword heuristic (no AI)', provider: 'basic' }
  ];

  const PROVIDERS = ['anthropic', 'openai', 'google'];

  function byId(id) {
    return MODELS.find((m) => m.id === id) || null;
  }

  return { MODELS, PROVIDERS, byId, DEFAULT: 'claude-sonnet' };
});
