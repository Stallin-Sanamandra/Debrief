// UMD: meeting templates. Each shapes the AI summary structure via `guidance`.
// Shared by main (prompt building) and renderer (per-meeting picker).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DebriefTemplates = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TEMPLATES = [
    {
      id: 'general',
      label: 'General',
      hint: 'Balanced notes, decisions, action items.',
      guidance: 'Summarize the meeting in a balanced way: key discussion points as notes, decisions made, and concrete action items with owners.'
    },
    {
      id: 'discovery',
      label: 'Discovery call',
      hint: 'Pain, stakeholders, budget/timeline, next step.',
      guidance: 'This is a sales discovery call. Emphasize the prospect\'s pain points and goals, current state/tools, stakeholders and decision process, budget and timeline signals, objections, and the agreed next step. Capture MEDDIC-style qualification where present (metrics, economic buyer, decision criteria, decision process, pain, champion).'
    },
    {
      id: 'demo',
      label: 'Demo',
      hint: 'Reactions, questions, objections, follow-ups.',
      guidance: 'This is a product demo. Emphasize which features resonated, the prospect\'s reactions and questions, objections or concerns, feature requests/gaps, competitor mentions, and committed follow-ups.'
    },
    {
      id: 'one_on_one',
      label: '1:1',
      hint: 'Updates, blockers, feedback, follow-ups.',
      guidance: 'This is a manager/report 1:1. Emphasize status updates, blockers, feedback exchanged in both directions, growth topics, and follow-ups with owners. Keep it concise and people-focused.'
    },
    {
      id: 'bdr_coaching',
      label: 'BDR coaching',
      hint: 'What went well, gaps, coaching actions.',
      guidance: 'This is a BDR (sales development) coaching session. Emphasize what the rep did well, skill gaps, specific coaching feedback, talk-track/objection-handling improvements, and concrete practice/action items for the rep.'
    },
    {
      id: 'webinar_debrief',
      label: 'Webinar debrief',
      hint: 'Attendance, content, leads, next actions.',
      guidance: 'This is a webinar debrief. Emphasize how it went (attendance, engagement), strongest/weakest content, audience questions and themes, lead/pipeline implications, and follow-up actions for marketing and sales.'
    },
    {
      id: 'leadership_sync',
      label: 'Leadership sync',
      hint: 'Priorities, decisions, risks, owners.',
      guidance: 'This is a leadership/strategy sync. Emphasize top priorities, decisions, risks/blockers, cross-functional dependencies, and clearly-owned action items with deadlines.'
    }
  ];

  function getTemplate(id) {
    return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
  }

  return { TEMPLATES, getTemplate, DEFAULT: 'general' };
});
