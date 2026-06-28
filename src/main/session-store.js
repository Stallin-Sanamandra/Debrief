'use strict';

// Structured session persistence + history. Each session is one JSON file under
// userData/sessions/. On save we also drop a readable .md into the user's
// "Debrief Sessions" folder for convenience.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const config = require('./config');
const actionsAgg = require('../shared/actions');
const speakers = require('../shared/speakers');

function dir() {
  const d = path.join(app.getPath('userData'), 'sessions');
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function fileFor(id) {
  return path.join(dir(), `${id}.json`);
}
function newId() {
  return new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(36).slice(2, 7);
}
function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function sanitizeName(name) {
  return String(name || 'meeting').replace(/[^\p{L}\p{N}\- ]+/gu, '').trim().slice(0, 70) || 'meeting';
}

function get(id) {
  try {
    return JSON.parse(fs.readFileSync(fileFor(id), 'utf8'));
  } catch {
    return null;
  }
}

function list() {
  let files = [];
  try {
    files = fs.readdirSync(dir()).filter((f) => f.endsWith('.json'));
  } catch {
    files = [];
  }
  const items = files
    .map((f) => {
      try {
        const s = JSON.parse(fs.readFileSync(path.join(dir(), f), 'utf8'));
        return {
          id: s.id,
          title: s.title || 'Untitled meeting',
          createdAt: s.createdAt,
          durationSec: s.durationSec || 0,
          source: s.source || 'manual',
          template: s.template || 'general',
          tags: Array.isArray(s.tags) ? s.tags : [],
          folder: s.folder || ''
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return items;
}

function rename(id, title) {
  const s = get(id);
  if (!s) return null;
  s.title = String(title || '').trim() || s.title;
  save(s);
  return { id: s.id, title: s.title };
}

function remove(id) {
  try {
    fs.unlinkSync(fileFor(id));
    return true;
  } catch {
    return false;
  }
}

// ---- tags / folder ----
function setTags(id, tags) {
  const s = get(id);
  if (!s) return null;
  s.tags = (Array.isArray(tags) ? tags : []).map((t) => String(t).trim()).filter(Boolean).slice(0, 20);
  save(s);
  return s.tags;
}
function setFolder(id, folder) {
  const s = get(id);
  if (!s) return null;
  s.folder = String(folder || '').trim().slice(0, 60);
  save(s);
  return s.folder;
}

// ---- rendering / export ----
function speakerLabel(e, s) {
  return speakers.labelFor(e, (s && s.speakerNames) || {});
}
function transcriptMd(s) {
  const rows = (s.entries || []).map((e) => `**${speakerLabel(e, s)}** [${fmtClock(e.t)}]: ${e.text}`);
  return rows.length ? rows.join('\n\n') : '_No transcript._';
}
function transcriptTxt(s) {
  return (s.entries || []).map((e) => `${speakerLabel(e, s)} (${fmtClock(e.t)}): ${e.text}`).join('\n');
}
function summaryMd(sm) {
  sm = sm || {};
  const bullets = (a) => (a && a.length ? a.map((x) => `- ${x}`).join('\n') : '_None_');
  const acts = sm.actions && sm.actions.length
    ? sm.actions.map((a) => `- [ ] ${a.text}${a.owner ? ` — **${a.owner}**` : ''}`).join('\n')
    : '_None_';
  return ['### Notes', bullets(sm.notes), '### Decisions', bullets(sm.decisions), '### Action items', acts].join('\n\n');
}
function summaryTxt(sm) {
  sm = sm || {};
  const out = [];
  out.push('NOTES');
  (sm.notes || []).forEach((n) => out.push('- ' + n));
  if (!(sm.notes || []).length) out.push('- none');
  out.push('', 'DECISIONS');
  (sm.decisions || []).forEach((d) => out.push('- ' + d));
  if (!(sm.decisions || []).length) out.push('- none');
  out.push('', 'ACTION ITEMS');
  (sm.actions || []).forEach((a) => out.push('- [ ] ' + a.text + (a.owner ? ' (' + a.owner + ')' : '')));
  if (!(sm.actions || []).length) out.push('- none');
  return out.join('\n');
}

function analyticsLine(a) {
  if (!a || (!a.totalSeconds && !a.totalWords)) return '';
  const pctMe = Math.round((a.ratioMe || 0) * 100);
  const parts = [`Talk time — You ${pctMe}% / Others ${100 - pctMe}%`];
  if (a.longestMonologue) {
    parts.push(`Longest monologue ${fmtClock(a.longestMonologue.seconds)} (${a.longestMonologue.speaker === 'Me' ? 'You' : 'Others'})`);
  }
  parts.push(`Questions — you ${a.me ? a.me.questions : 0}, others ${a.others ? a.others.questions : 0}`);
  return parts.join(' · ');
}

// what: 'transcript' | 'summary' | 'both'; format: 'md' | 'txt'
function exportText(id, what, format) {
  const s = get(id);
  if (!s) return '';
  const md = format !== 'txt';
  const title = s.title || 'Meeting';
  const meta = `${new Date(s.createdAt).toLocaleString()} · ${fmtClock(s.durationSec)}`;
  const stats = analyticsLine(s.analytics);
  const metaBlock = stats ? `${meta}\n${md ? '- ' : ''}${stats}` : meta;
  const header = md ? `# ${title}\n\n- ${metaBlock}\n` : `${title}\n${metaBlock}\n`;
  const parts = [header];
  if (what === 'summary' || what === 'both') {
    parts.push(md ? '## Summary\n' + summaryMd(s.summary) : 'SUMMARY\n' + summaryTxt(s.summary));
  }
  if (what === 'transcript' || what === 'both') {
    parts.push(md ? '## Transcript\n' + transcriptMd(s) : 'TRANSCRIPT\n' + transcriptTxt(s));
  }
  return parts.join('\n\n');
}

// Export a session to a real file (Markdown or plain text) in the output folder.
// what: 'transcript' | 'summary' | 'both'; format: 'md' | 'txt'. Returns { path } or { error }.
function writeExportFile(id, what, format) {
  const s = get(id);
  if (!s) return { error: 'not found' };
  try {
    fs.mkdirSync(config.outputDir, { recursive: true });
    const ext = format === 'txt' ? 'txt' : 'md';
    const stamp = new Date(s.createdAt).toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const suffix = what === 'both' ? '' : ' ' + what;
    const file = path.join(config.outputDir, `${stamp} ${sanitizeName(s.title)}${suffix}.${ext}`);
    fs.writeFileSync(file, exportText(id, what, format));
    return { path: file };
  } catch (err) {
    return { error: err.message };
  }
}

// Write a follow-up email draft (possibly edited by the user) to the output folder.
function writeEmailFile(id, subject, body) {
  const s = get(id);
  const title = (s && s.title) || 'Meeting';
  const createdAt = (s && s.createdAt) || new Date().toISOString();
  try {
    fs.mkdirSync(config.outputDir, { recursive: true });
    const stamp = new Date(createdAt).toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const file = path.join(config.outputDir, `${stamp} ${sanitizeName(title)} follow-up.txt`);
    fs.writeFileSync(file, `Subject: ${subject || ''}\n\n${body || ''}\n`);
    return { path: file };
  } catch (err) {
    return { error: err.message };
  }
}

// Write CRM deal notes (possibly edited) to the output folder.
function writeCrmFile(id, text) {
  const s = get(id);
  const title = (s && s.title) || 'Meeting';
  const createdAt = (s && s.createdAt) || new Date().toISOString();
  try {
    fs.mkdirSync(config.outputDir, { recursive: true });
    const stamp = new Date(createdAt).toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const file = path.join(config.outputDir, `${stamp} ${sanitizeName(title)} deal-notes.txt`);
    fs.writeFileSync(file, String(text || ''));
    return { path: file };
  } catch (err) {
    return { error: err.message };
  }
}

// Drop a readable .md into ~/Documents/Debrief Sessions for convenience.
function writeMarkdownFile(s) {
  try {
    fs.mkdirSync(config.outputDir, { recursive: true });
    const stamp = new Date(s.createdAt).toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const file = path.join(config.outputDir, `${stamp} ${sanitizeName(s.title)}.md`);
    fs.writeFileSync(file, exportText(s.id, 'both', 'md'));
    return file;
  } catch (err) {
    console.error('[session-store] markdown export failed:', err.message);
    return null;
  }
}

function save(session) {
  fs.writeFileSync(fileFor(session.id), JSON.stringify(session, null, 2));
  return session;
}

// ---- cross-meeting action items (done state persisted separately so session files stay immutable) ----
function actionStateFile() {
  return path.join(app.getPath('userData'), 'action-state.json');
}
function loadActionState() {
  try {
    return JSON.parse(fs.readFileSync(actionStateFile(), 'utf8'));
  } catch {
    return {};
  }
}
function setActionDone(key, done) {
  const st = loadActionState();
  if (done) st[key] = true;
  else delete st[key];
  try {
    fs.writeFileSync(actionStateFile(), JSON.stringify(st));
  } catch (e) {
    console.error('[session-store] action-state persist failed:', e.message);
  }
  return { ok: true };
}
function listActionItems() {
  const st = loadActionState();
  const sessions = list().map((m) => get(m.id)).filter(Boolean);
  return actionsAgg.aggregate(sessions, st);
}

module.exports = {
  newId, save, get, list, rename, remove,
  exportText, writeExportFile, writeEmailFile, writeCrmFile, writeMarkdownFile, fmtClock,
  listActionItems, setActionDone, setTags, setFolder
};
