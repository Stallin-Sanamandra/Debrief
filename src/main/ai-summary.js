'use strict';

// AI summary: routes to Anthropic / OpenAI / Google based on the selected model, using
// keys from secure storage. Only the cleaned text transcript + the user's notes are sent.
// No usable key (or model 'basic'/'local') falls back to the local heuristic summarizer.
const keys = require('./keys');
const { byId } = require('../shared/models');
const { getTemplate } = require('../shared/templates');
const heuristic = require('../shared/summary');

const NONSPEECH = /\b(inaudible|crosstalk|music|background noise|noise|silence|wind|beep|applause|laughter|clicks?|clanking|typing|coughs?|speaking foreign language|foreign language|no audio)\b/i;

// Strip Whisper non-speech annotations and empty/label-only lines before sending.
function cleanTranscript(text) {
  return String(text || '')
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/\[[^\]]*\]/g, (m) => (NONSPEECH.test(m) ? '' : m))
        .replace(/\([^)]*\)/g, (m) => (NONSPEECH.test(m) ? '' : m))
        .replace(/\s{2,}/g, ' ')
        .trim()
    )
    .filter((line) => line && !/^\*?\*?(Me|Others)\*?\*?\s*\[[0-9:]+\]\s*:?\s*$/i.test(line))
    .join('\n')
    .trim();
}

// Heuristic title: first substantial sentence, trimmed to a few words.
function autoTitle(text) {
  const s = String(text || '')
    .replace(/\*?\*?(Me|Others)\*?\*?\s*\[[0-9:]+\]:\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  const first = (s.split(/(?<=[.!?])\s/)[0] || s).split(/\s+/).slice(0, 8).join(' ');
  return first.replace(/[.,;:]+$/, '');
}

function buildPrompt(transcript, notes, templateId, customPrompt, glossaryTerms, speakerNames) {
  const tpl = getTemplate(templateId);
  const glossary = Array.isArray(glossaryTerms) ? glossaryTerms.filter(Boolean) : [];
  const meName = speakerNames && speakerNames.me && speakerNames.me !== 'Me' ? speakerNames.me : '';
  const system =
    'You are an expert meeting-notes assistant for a B2B SaaS team. Write a concise, accurate summary using ONLY what appears in the transcript and the user\'s notes — never invent facts, names, or numbers. ' +
    tpl.guidance +
    (glossary.length
      ? ' Use these exact spellings for domain terms, products, and names, and silently correct obvious mis-transcriptions of them: ' + glossary.join(', ') + '.'
      : '') +
    (customPrompt ? ' Additional instruction for THIS meeting (overrides the template if in conflict): ' + customPrompt : '') +
    ' Respond with ONLY a JSON object, no prose, of the form: ' +
    '{"title": string (<= 8 words, no surrounding quotes), "notes": string[] (concise bullet points), "decisions": string[], "action_items": [{"text": string, "owner": string|null}]}. ' +
    'Set owner to the responsible person if clearly stated, otherwise null. Keep arrays empty if nothing applies.';
  const speakerKey = meName
    ? 'Me = ' + meName + ' (the user / author); Others = the other participant(s)'
    : 'Me = the user / microphone; Others = everyone else / system audio';
  const user =
    'Meeting type: ' + tpl.label + '\n\n' +
    "My notes (the user's own jotted notes):\n" + (notes && notes.trim() ? notes.trim() : '(none)') + '\n\n' +
    'Transcript (' + speakerKey + '):\n' + transcript;
  return { system, user };
}

async function callAnthropic(model, key, system, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 1500, system, messages: [{ role: 'user', content: user }] })
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.content || []).map((c) => c.text || '').join('');
}

async function callOpenAI(model, key, system, user, json) {
  const body = {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
  };
  if (json !== false) body.response_format = { type: 'json_object' };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
}

async function callGoogle(model, key, system, user, json) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: json !== false ? { responseMimeType: 'application/json' } : {}
    })
  });
  if (!res.ok) throw new Error(`Google ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const cand = data.candidates && data.candidates[0];
  return cand && cand.content ? (cand.content.parts || []).map((p) => p.text || '').join('') : '';
}

function parseSummary(raw) {
  let text = String(raw || '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const brace = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (brace >= 0 && end > brace) text = text.slice(brace, end + 1);
  let obj = {};
  try {
    obj = JSON.parse(text);
  } catch {
    obj = {};
  }
  const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
  const actions = arr(obj.action_items || obj.actions)
    .map((a) => (typeof a === 'string' ? { text: a, owner: null } : { text: String(a.text || ''), owner: a.owner || null }))
    .filter((a) => a.text);
  return {
    title: typeof obj.title === 'string' ? obj.title.replace(/^["']|["']$/g, '').trim() : '',
    notes: arr(obj.notes).map(String),
    decisions: arr(obj.decisions).map(String),
    actions
  };
}

function heuristicResult(cleaned, notes) {
  // Strip "Me [00:00]:" / "Others [01:23]:" labels so basic-summary bullets read as plain speech.
  const plain = String(cleaned || '')
    .replace(/\*?\*?(Me|Others)\*?\*?\s*\[[0-9:]+\]:\s*/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const h = heuristic.summarize([plain, notes].filter((x) => x && x.trim()).join('. '));
  return {
    title: autoTitle(cleaned) || 'Meeting',
    notes: h.notes,
    decisions: h.decisions,
    actions: (h.actions || []).map((t) => ({ text: t, owner: null }))
  };
}

// Turn a raw provider error into a short, friendly one-liner for the UI.
function friendlyError(provider, raw) {
  const name = provider === 'anthropic' ? 'Anthropic'
    : provider === 'openai' ? 'OpenAI'
    : provider === 'google' ? 'Google' : 'The model';
  const m = String(raw || '').toLowerCase();
  if (/credit balance|billing|insufficient[_ ]quota|exceeded your current quota|\bquota\b|plan and billing|payment/.test(m)) {
    return `Add ${name} API credits to enable AI notes.`;
  }
  if (/\b401\b|invalid x-api-key|api key not valid|incorrect api key|api_key_invalid|authentication|unauthorized|permission_denied/.test(m)) {
    return `Check your ${name} API key in Settings.`;
  }
  if (/\b429\b|rate.?limit|overloaded/.test(m)) {
    return `${name} is rate-limited right now. Try again shortly.`;
  }
  return `${name} could not generate the summary.`;
}

// opts: { transcript, notes, templateId, customPrompt, modelId }
async function summarize(opts) {
  const cleaned = cleanTranscript(opts.transcript || '');
  const model = byId(opts.modelId);
  const key = model && model.requiresKey ? keys.getKey(model.requiresKey) : null;
  const usable = model && !model.disabled && model.provider !== 'basic' && model.provider !== 'local' && key;

  if (!usable) {
    return Object.assign({ engine: 'basic' }, heuristicResult(cleaned, opts.notes));
  }

  const { system, user } = buildPrompt(cleaned, opts.notes, opts.templateId, opts.customPrompt, opts.glossaryTerms, opts.speakerNames);
  try {
    let raw = '';
    if (model.provider === 'anthropic') raw = await callAnthropic(model.model, key, system, user);
    else if (model.provider === 'openai') raw = await callOpenAI(model.model, key, system, user);
    else if (model.provider === 'google') raw = await callGoogle(model.model, key, system, user);
    const p = parseSummary(raw);
    return {
      engine: model.id,
      title: p.title || autoTitle(cleaned) || 'Meeting',
      notes: p.notes,
      decisions: p.decisions,
      actions: p.actions
    };
  } catch (err) {
    console.error('[ai-summary] provider error:', err.message);
    return Object.assign(
      { engine: 'error', error: friendlyError(model.provider, err.message) },
      heuristicResult(cleaned, opts.notes)
    );
  }
}

// ---------- follow-up email draft ----------

function buildEmailPrompt(rec, glossaryTerms) {
  const s = rec.summary || {};
  const parts = ['Meeting: ' + (rec.title || 'Meeting')];
  if (s.notes && s.notes.length) parts.push('Key points:\n' + s.notes.map((n) => '- ' + n).join('\n'));
  if (s.decisions && s.decisions.length) parts.push('Decisions:\n' + s.decisions.map((d) => '- ' + d).join('\n'));
  if (s.actions && s.actions.length) {
    parts.push('Action items:\n' + s.actions.map((a) => '- ' + a.text + (a.owner ? ' (owner: ' + a.owner + ')' : '')).join('\n'));
  }
  if (rec.myNotes && rec.myNotes.trim()) parts.push("Author's own notes:\n" + rec.myNotes.trim());
  const glossary = (glossaryTerms || []).filter(Boolean);
  const system =
    'You write concise, professional follow-up emails after business meetings for a B2B SaaS team. ' +
    'Warm but efficient tone. Structure: a short greeting, a one-paragraph recap, then a "Next steps" list with owners where stated. ' +
    'Use ONLY the facts provided — do not invent names, numbers, or commitments. Keep it tight (under ~200 words). Sign off as "Best,".' +
    (glossary.length ? ' Use these exact spellings for names/terms: ' + glossary.join(', ') + '.' : '') +
    ' Respond with ONLY a JSON object: {"subject": string, "body": string}. The body is plain text with line breaks, ready to paste into an email client.';
  return { system, user: parts.join('\n\n') };
}

function parseEmail(raw) {
  let text = String(raw || '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const b = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (b >= 0 && e > b) text = text.slice(b, e + 1);
  try {
    const o = JSON.parse(text);
    return {
      subject: typeof o.subject === 'string' ? o.subject.trim() : '',
      body: typeof o.body === 'string' ? o.body.trim() : ''
    };
  } catch {
    return { subject: '', body: String(raw || '').trim() };
  }
}

// Dependency-free email built from the stored summary (used when no API key is set).
function basicEmail(rec) {
  const s = rec.summary || {};
  const out = ['Hi team,', '', 'Thanks for the time today. Quick recap of ' + (rec.title || 'our discussion') + ':'];
  (s.notes || []).slice(0, 6).forEach((n) => out.push('- ' + n));
  if (s.decisions && s.decisions.length) {
    out.push('', 'Decisions:');
    s.decisions.forEach((d) => out.push('- ' + d));
  }
  out.push('', 'Next steps:');
  if (s.actions && s.actions.length) s.actions.forEach((a) => out.push('- ' + a.text + (a.owner ? ' (' + a.owner + ')' : '')));
  else out.push('- (none captured)');
  out.push('', 'Best,');
  return { subject: 'Follow-up: ' + (rec.title || 'Meeting'), body: out.join('\n') };
}

// opts: { record, modelId, glossaryTerms }
async function draftEmail(opts) {
  const rec = (opts && opts.record) || {};
  const model = byId(opts && opts.modelId);
  const key = model && model.requiresKey ? keys.getKey(model.requiresKey) : null;
  const usable = model && !model.disabled && model.provider !== 'basic' && model.provider !== 'local' && key;
  if (!usable) return Object.assign({ engine: 'basic' }, basicEmail(rec));

  const { system, user } = buildEmailPrompt(rec, opts.glossaryTerms);
  try {
    let raw = '';
    if (model.provider === 'anthropic') raw = await callAnthropic(model.model, key, system, user);
    else if (model.provider === 'openai') raw = await callOpenAI(model.model, key, system, user);
    else if (model.provider === 'google') raw = await callGoogle(model.model, key, system, user);
    const p = parseEmail(raw);
    const fallback = basicEmail(rec);
    return {
      engine: model.id,
      subject: p.subject || fallback.subject,
      body: p.body || fallback.body
    };
  } catch (err) {
    console.error('[ai-summary] email error:', err.message);
    return Object.assign({ engine: 'error', error: friendlyError(model.provider, err.message) }, basicEmail(rec));
  }
}

// ---------- CRM / HubSpot deal notes ----------

function formatCrm(f) {
  f = f || {};
  const v = (x) => (x && String(x).trim() ? String(x).trim() : '—');
  return [
    'Company: ' + v(f.company),
    'Attendees: ' + v(f.attendees),
    'Pain points: ' + v(f.pain),
    'Budget: ' + v(f.budget),
    'Timeline: ' + v(f.timeline),
    'Competitors: ' + v(f.competitors),
    'Next step: ' + v(f.nextStep)
  ].join('\n');
}

function parseCrm(raw) {
  let text = String(raw || '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const b = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (b >= 0 && e > b) text = text.slice(b, e + 1);
  let o = {};
  try { o = JSON.parse(text); } catch { o = {}; }
  const s = (x) => (typeof x === 'string' ? x.trim() : x == null ? '' : String(x));
  return {
    company: s(o.company),
    attendees: s(o.attendees),
    pain: s(o.pain || o.pain_points),
    budget: s(o.budget),
    timeline: s(o.timeline),
    competitors: s(o.competitors),
    nextStep: s(o.next_step || o.nextStep)
  };
}

// Dependency-free deal notes from the stored summary + speaker names (no API key).
function basicDealNotes(rec) {
  const names = rec.speakerNames || {};
  const named = Object.keys(names)
    .filter((k) => k !== 'me' && names[k] && !/^Others( \d+)?$/.test(names[k]))
    .map((k) => names[k]);
  const meName = names.me && names.me !== 'Me' ? names.me : 'Me';
  const attendees = named.length ? `${meName} (us); ${named.join(', ')}` : '';
  const acts = (rec.summary && rec.summary.actions) || [];
  const nextStep = acts.length ? acts.map((a) => a.text + (a.owner ? ' (' + a.owner + ')' : '')).join('; ') : '';
  return { company: '', attendees, pain: '', budget: '', timeline: '', competitors: '', nextStep };
}

function buildCrmPrompt(rec, glossaryTerms) {
  const s = rec.summary || {};
  const parts = ['Meeting: ' + (rec.title || 'Meeting')];
  if (s.notes && s.notes.length) parts.push('Summary points:\n' + s.notes.map((n) => '- ' + n).join('\n'));
  parts.push('Transcript:\n' + (rec.transcriptText || ''));
  const glossary = (glossaryTerms || []).filter(Boolean);
  const system =
    'You extract CRM deal notes from a B2B SaaS sales meeting for pasting into HubSpot. Use ONLY facts stated in the transcript/summary; if a field was not discussed, return an empty string (never guess). ' +
    (glossary.length ? 'Use these exact spellings for names/terms: ' + glossary.join(', ') + '. ' : '') +
    'Respond with ONLY JSON: {"company": string, "attendees": string, "pain": string, "budget": string, "timeline": string, "competitors": string, "next_step": string}. attendees = who was on the call and which side (us vs the prospect).';
  return { system, user: parts.join('\n\n') };
}

// opts: { record, modelId, glossaryTerms }
async function draftDealNotes(opts) {
  const rec = (opts && opts.record) || {};
  const model = byId(opts && opts.modelId);
  const key = model && model.requiresKey ? keys.getKey(model.requiresKey) : null;
  const usable = model && !model.disabled && model.provider !== 'basic' && model.provider !== 'local' && key;
  if (!usable) {
    const f = basicDealNotes(rec);
    return { engine: 'basic', fields: f, text: formatCrm(f) };
  }
  const { system, user } = buildCrmPrompt(rec, opts.glossaryTerms);
  try {
    let raw = '';
    if (model.provider === 'anthropic') raw = await callAnthropic(model.model, key, system, user);
    else if (model.provider === 'openai') raw = await callOpenAI(model.model, key, system, user);
    else if (model.provider === 'google') raw = await callGoogle(model.model, key, system, user);
    const f = parseCrm(raw);
    // Always fill attendees from named speakers if the model left it blank (they're known facts).
    if (!f.attendees) f.attendees = basicDealNotes(rec).attendees;
    return { engine: model.id, fields: f, text: formatCrm(f) };
  } catch (err) {
    console.error('[ai-summary] crm error:', err.message);
    const f = basicDealNotes(rec);
    return { engine: 'error', error: friendlyError(model.provider, err.message), fields: f, text: formatCrm(f) };
  }
}

// ---------- cross-meeting Ask ----------

function buildAskPrompt(question, context) {
  const blocks = (context || []).map((c) => {
    const d = c.meeting && c.meeting.createdAt ? new Date(c.meeting.createdAt).toLocaleDateString() : '';
    const title = (c.meeting && c.meeting.title) || 'Meeting';
    return `[${title}${d ? ' — ' + d : ''}]\n` + (c.excerpts || []).join('\n');
  }).join('\n\n');
  const system =
    'You answer questions about the user\'s past meetings using ONLY the provided excerpts. ' +
    'Cite the meeting title and date in parentheses for each fact, e.g. (Acme Demo — 6/24/2026). ' +
    'If the excerpts do not contain the answer, say you could not find it in the meetings — do not guess. ' +
    'Be concise and plain-language.';
  const user = 'Question: ' + question + '\n\nMeeting excerpts:\n' + blocks;
  return { system, user };
}

// opts: { question, context:[{meeting:{id,title,createdAt}, excerpts:[string]}], modelId }
async function answerQuestion(opts) {
  const context = (opts && opts.context) || [];
  const model = byId(opts && opts.modelId);
  const sources = context.map((c) => c.meeting);
  if (!context.length) return { engine: model ? model.id : 'basic', answer: '', sources: [], noContext: true };

  const key = model && model.requiresKey ? keys.getKey(model.requiresKey) : null;
  const usable = model && !model.disabled && model.provider !== 'basic' && model.provider !== 'local' && key;
  if (!usable) return { engine: 'basic', answer: '', sources, noKey: true };

  const { system, user } = buildAskPrompt(opts.question, context);
  try {
    let raw = '';
    if (model.provider === 'anthropic') raw = await callAnthropic(model.model, key, system, user);
    else if (model.provider === 'openai') raw = await callOpenAI(model.model, key, system, user, false);
    else if (model.provider === 'google') raw = await callGoogle(model.model, key, system, user, false);
    return { engine: model.id, answer: String(raw || '').trim(), sources };
  } catch (err) {
    console.error('[ai-summary] ask error:', err.message);
    return { engine: 'error', error: friendlyError(model.provider, err.message), answer: '', sources };
  }
}

module.exports = {
  summarize, cleanTranscript, autoTitle, buildPrompt, friendlyError,
  draftEmail, basicEmail, parseEmail,
  draftDealNotes, basicDealNotes, parseCrm, formatCrm,
  answerQuestion, buildAskPrompt
};
