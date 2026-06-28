'use strict';

// Local voiceprint store: name -> { emb:[...], count }. Stored in macOS userData (NEVER the
// repo — voiceprints are personal biometric data; .gitignore also excludes them). A voiceprint
// is the running mean of a person's utterance embeddings, refined each time you name them.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const voiceid = require('../shared/voiceid');

function file() {
  return path.join(app.getPath('userData'), 'voiceprints.json');
}
function load() {
  try {
    return JSON.parse(fs.readFileSync(file(), 'utf8'));
  } catch {
    return {};
  }
}
function save(obj) {
  try {
    fs.writeFileSync(file(), JSON.stringify(obj));
  } catch (e) {
    console.error('[voiceprints] persist failed:', e.message);
  }
}

// Fold one or more utterance embeddings into the named person's voiceprint.
function enroll(name, embeddings) {
  const nm = String(name || '').trim();
  if (!nm || /^(Me|Others)( \d+)?$/.test(nm) || !Array.isArray(embeddings)) return;
  const valid = embeddings.filter((e) => Array.isArray(e) && e.length);
  if (!valid.length) return;
  const prints = load();
  let cur = prints[nm] ? prints[nm].emb : null;
  let count = prints[nm] ? prints[nm].count : 0;
  valid.forEach((e) => { cur = voiceid.mergeEmbedding(cur, e, count); count++; });
  if (cur) {
    prints[nm] = { emb: cur, count };
    save(prints);
  }
}

function list() {
  const p = load();
  return Object.keys(p).map((n) => ({ name: n, count: p[n].count }));
}
function remove(name) {
  const p = load();
  delete p[name];
  save(p);
  return { ok: true };
}
function match(emb, threshold) {
  return voiceid.matchEmbedding(emb, load(), threshold);
}

module.exports = { enroll, list, remove, match, load };
