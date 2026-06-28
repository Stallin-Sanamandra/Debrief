'use strict';

const { app, BrowserWindow, session, desktopCapturer, ipcMain, Notification } = require('electron');
const path = require('path');

const config = require('./config');
const settings = require('./settings');
const permissions = require('./permissions');
const whisper = require('./whisper');
const detector = require('./meeting-detector');
const keys = require('./keys');
const aiSummary = require('./ai-summary');
const store = require('./session-store');
const glossary = require('../shared/glossary');
const talkTime = require('../shared/analytics');
const diarize = require('../shared/diarize');
const speakers = require('../shared/speakers');
const fts = require('../shared/search');
const briefs = require('../shared/briefs');
const bleed = require('../shared/bleed');
const voiceprints = require('./voiceprints');
const cluster = require('../shared/cluster');
const voiceid = require('../shared/voiceid');

// Cosine threshold for voice clustering + enrolled-voice matching (tunable; lower = more lenient).
const VOICE_THR = 0.78;
const { MODELS } = require('../shared/models');
const { TEMPLATES } = require('../shared/templates');

// Force the macOS ScreenCaptureKit loopback path for system-audio capture.
app.commandLine.appendSwitch(
  'enable-features',
  'MacLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride'
);

process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason && reason.message ? reason.message : reason);
});

let mainWindow = null;
let capturing = false;
let current = null; // live session in progress

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 720,
    minWidth: 420,
    minHeight: 560,
    title: 'Debrief',
    backgroundColor: '#0F1115',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

function installDisplayMediaHandler() {
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (!sources || !sources.length) return callback({});
      callback({ video: sources[0], audio: 'loopback' });
    }).catch(() => callback({}));
  });
}

// A searchable document for one saved session: title + transcript + summary + speaker names + notes.
function sessionDoc(s) {
  const sum = s.summary || {};
  const sumText = []
    .concat(sum.notes || [], sum.decisions || [], (sum.actions || []).map((a) => a.text + (a.owner ? ' ' + a.owner : '')))
    .join(' ');
  const names = Object.values(s.speakerNames || {}).join(' ');
  const text = [s.title || '', s.transcriptText || '', sumText, names, s.myNotes || ''].join('\n');
  return { id: s.id, title: s.title || 'Meeting', createdAt: s.createdAt, durationSec: s.durationSec || 0, text };
}

function buildTranscriptText(entries, names) {
  return (entries || [])
    .slice()
    .sort((a, b) => a.t - b.t)
    .map((e) => `${speakers.labelFor(e, names)} [${store.fmtClock(e.t)}]: ${e.text}`)
    .join('\n');
}

function registerIpc() {
  ipcMain.handle('permissions:snapshot', () => permissions.snapshot());
  ipcMain.handle('permissions:ensureMic', () => permissions.ensureMicrophone());
  ipcMain.handle('permissions:openScreen', () => permissions.openScreenRecordingSettings());
  ipcMain.handle('permissions:openMic', () => permissions.openMicrophoneSettings());

  ipcMain.handle('settings:get', () => settings.load());
  ipcMain.handle('settings:set', (_e, key, value) => settings.set(key, value));

  // Catalogs for the renderer pickers.
  ipcMain.handle('catalog:get', () => ({ models: MODELS, templates: TEMPLATES }));

  // Secure API keys (renderer only ever sees booleans).
  ipcMain.handle('keys:status', () => keys.status());
  ipcMain.handle('keys:set', (_e, provider, value) => keys.setKey(provider, value));

  ipcMain.handle('whisper:status', () => ({ installed: whisper.installed(), ready: whisper.ready }));
  ipcMain.handle('engine:ensure', async () => {
    if (!whisper.installed()) return { installed: false, ready: false };
    if (!whisper.ready) {
      try {
        await whisper.start();
      } catch (err) {
        return { installed: true, ready: false, error: err.message };
      }
    }
    return { installed: true, ready: whisper.ready };
  });

  // Transcription model picker (small.en bundled; base.en/medium.en download on demand).
  ipcMain.handle('whisper:models', () => whisper.modelStatus());
  ipcMain.handle('whisper:setModel', async (_e, name) => {
    try {
      return await whisper.setModel(name);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ---- live session ----
  ipcMain.handle('session:start', (_e, meta) => {
    capturing = true;
    current = {
      id: store.newId(),
      createdAt: new Date().toISOString(),
      startedAt: Date.now(),
      source: (meta && meta.source) || 'manual',
      template: (meta && meta.template) || settings.get('defaultTemplate') || 'general',
      entries: [],
      myNotes: '',
      speakerNames: {} // live renames during this capture
    };
    whisper.resetTranscripts();
    return { id: current.id };
  });

  ipcMain.handle('notes:update', (_e, text) => {
    if (current) current.myNotes = String(text || '');
    return { ok: true };
  });

  ipcMain.handle('whisper:chunk', async (_e, arrayBuffer, meta) => {
    try {
      const speaker = meta && meta.speaker === 'Me' ? 'Me' : 'Others';
      const t = meta && typeof meta.t === 'number' ? meta.t : 0;
      const continued = !!(meta && meta.continued);
      const dur = meta && typeof meta.dur === 'number' ? meta.dur : 0;
      const f0 = meta && typeof meta.f0 === 'number' ? meta.f0 : 0;
      const emb = meta && Array.isArray(meta.emb) ? meta.emb : null; // voice embedding (when voiceId on)
      const { delta } = await whisper.transcribeChunk(Buffer.from(arrayBuffer), speaker, continued);
      if (delta && current) {
        const entry = { t, speaker, text: delta, dur, f0 };
        if (emb) entry.emb = emb;
        current.entries.push(entry);
      }
      return { delta, speaker, t };
    } catch (err) {
      return { delta: '', error: err.message };
    }
  });

  // Stop: run the AI summary, persist the structured session, return it.
  ipcMain.handle('session:stop', async (_e, customPrompt) => {
    capturing = false;
    if (!current) return { error: 'no active session' };

    // Glossary correction pass: fix mis-transcribed domain terms / names on the saved
    // transcript, then summarize from the corrected text (and pass the terms to the model).
    const gEntries = glossary.parseGlossary(settings.get('glossary') || '');
    let entries = current.entries.map((e) => ({ ...e, text: glossary.correctText(e.text, gEntries) }));
    const glossaryTerms = gEntries.map((e) => e.canonical);
    // Drop echo-bleed duplicate lines (same remote speech captured on both channels).
    entries = bleed.dedupeCrossChannel(entries);
    // Optional best-effort pitch split (off by default — it over-splits one voice).
    if (settings.get('splitSpeakers')) diarize.splitOthers(entries);
    // Honest names: only what was explicitly renamed THIS session (remembered names are
    // suggestions in the rename dialog, never auto-applied here).
    const speakerNames = Object.assign({ me: 'Me', others1: 'Others', others2: 'Others 2' }, current.speakerNames || {});

    // Voice fingerprinting: cluster the remote (Others) lines into distinct voices, then name
    // any cluster whose voice matches an enrolled person. Lines you explicitly named are kept.
    if (settings.get('voiceId')) {
      const isNamed = (slot) => speakerNames[slot] && !/^(Me|Others)( \d+)?$/.test(speakerNames[slot]);
      const others = entries.filter((e) => e.speaker === 'Others' && Array.isArray(e.emb) && !isNamed(speakers.slotOf(e)));
      if (others.length) {
        const { assign, centroids } = cluster.clusterEmbeddings(others.map((e) => e.emb), { threshold: VOICE_THR });
        const namedSubs = Object.keys(speakerNames)
          .filter((s) => /^others\d+$/.test(s) && isNamed(s))
          .map((s) => parseInt(s.match(/\d+/)[0], 10));
        const base = namedSubs.length ? Math.max.apply(null, namedSubs) : 0;
        const prints = voiceprints.load();
        const clusterSlot = centroids.map((c, cid) => {
          const m = voiceid.matchEmbedding(c.emb, prints, VOICE_THR);
          if (m) {
            const existing = Object.keys(speakerNames).find((s) => speakerNames[s] === m.name);
            if (existing) return existing;
            const slot = 'others' + (base + cid + 1);
            speakerNames[slot] = m.name;
            return slot;
          }
          return 'others' + (base + cid + 1);
        });
        others.forEach((e, i) => { if (assign[i] >= 0) speakers.applySlot(e, clusterSlot[assign[i]]); });
      }
    }
    const transcriptText = buildTranscriptText(entries, speakerNames);
    const summary = await aiSummary.summarize({
      transcript: transcriptText,
      notes: current.myNotes,
      templateId: current.template,
      modelId: settings.get('summaryModel'),
      glossaryTerms,
      speakerNames,
      customPrompt: customPrompt || ''
    });
    const analytics = talkTime.computeTalkTime(entries);
    const sessionRecord = {
      id: current.id,
      title: summary.title || aiSummary.autoTitle(transcriptText) || 'Meeting',
      createdAt: current.createdAt,
      durationSec: Math.round((Date.now() - current.startedAt) / 1000),
      source: current.source,
      template: current.template,
      customPrompt: customPrompt || '',
      speakerNames,
      entries,
      myNotes: current.myNotes,
      transcriptText,
      analytics,
      summary: {
        engine: summary.engine,
        error: summary.error || null,
        notes: summary.notes || [],
        decisions: summary.decisions || [],
        actions: summary.actions || []
      }
    };
    store.save(sessionRecord);
    const mdPath = store.writeMarkdownFile(sessionRecord);
    current = null;
    return { id: sessionRecord.id, title: sessionRecord.title, summary: sessionRecord.summary, analytics, entries, path: mdPath };
  });

  // Re-run the summary on a saved session with a one-off custom instruction (overrides template).
  ipcMain.handle('summary:regenerate', async (_e, id, customPrompt) => {
    const rec = store.get(id);
    if (!rec) return { error: 'Session not found.' };
    const gTerms = glossary.parseGlossary(settings.get('glossary') || '').map((x) => x.canonical);
    const out = await aiSummary.summarize({
      transcript: rec.transcriptText || '',
      notes: rec.myNotes,
      templateId: rec.template,
      modelId: settings.get('summaryModel'),
      glossaryTerms: gTerms,
      speakerNames: rec.speakerNames || {},
      customPrompt: customPrompt || ''
    });
    rec.summary = {
      engine: out.engine,
      error: out.error || null,
      notes: out.notes || [],
      decisions: out.decisions || [],
      actions: out.actions || []
    };
    rec.customPrompt = customPrompt || '';
    store.save(rec);
    return { summary: rec.summary, engine: out.engine };
  });

  // ---- follow-up email ----
  ipcMain.handle('email:draft', async (_e, id) => {
    const rec = store.get(id);
    if (!rec) return { engine: 'error', error: 'Session not found.' };
    const gTerms = glossary.parseGlossary(settings.get('glossary') || '').map((x) => x.canonical);
    return aiSummary.draftEmail({ record: rec, modelId: settings.get('summaryModel'), glossaryTerms: gTerms });
  });
  ipcMain.handle('email:export', (_e, id, subject, body) => store.writeEmailFile(id, subject, body));

  // ---- CRM / HubSpot deal notes ----
  ipcMain.handle('crm:draft', async (_e, id) => {
    const rec = store.get(id);
    if (!rec) return { engine: 'error', error: 'Session not found.', text: '' };
    const gTerms = glossary.parseGlossary(settings.get('glossary') || '').map((x) => x.canonical);
    return aiSummary.draftDealNotes({ record: rec, modelId: settings.get('summaryModel'), glossaryTerms: gTerms });
  });
  ipcMain.handle('crm:export', (_e, id, text) => store.writeCrmFile(id, text));

  // ---- speakers: rename a slot (applies across the transcript + remembered) / reassign a line ----
  ipcMain.handle('speaker:rename', (_e, id, slot, name) => {
    const rec = store.get(id);
    if (!rec) return { ok: false };
    const nm = String(name || '').trim();
    if (!speakers.isValidSlot(slot) || !nm) return { ok: false };
    rec.speakerNames = Object.assign({}, rec.speakerNames || {});
    rec.speakerNames[slot] = nm;
    store.save(rec);
    // Remember as the global default for future sessions.
    const global = Object.assign({}, settings.get('speakerNames') || {});
    global[slot] = nm;
    settings.set('speakerNames', global);
    // Enrol this speaker's voice (their lines' embeddings) under the name.
    voiceprints.enroll(nm, (rec.entries || []).filter((e) => speakers.slotOf(e) === slot && Array.isArray(e.emb)).map((e) => e.emb));
    return { ok: true, speakerNames: rec.speakerNames };
  });
  // Rename a speaker DURING capture: store on the live session + remember globally.
  ipcMain.handle('speaker:renameLive', (_e, slot, name) => {
    const nm = String(name || '').trim();
    if (!speakers.isValidSlot(slot) || !nm) return { ok: false };
    if (current) {
      current.speakerNames = current.speakerNames || {};
      current.speakerNames[slot] = nm;
      voiceprints.enroll(nm, (current.entries || []).filter((e) => speakers.slotOf(e) === slot && Array.isArray(e.emb)).map((e) => e.emb));
    }
    const global = Object.assign({}, settings.get('speakerNames') || {});
    global[slot] = nm;
    settings.set('speakerNames', global);
    return { ok: true };
  });
  ipcMain.handle('voiceprints:list', () => voiceprints.list());
  ipcMain.handle('voiceprints:remove', (_e, name) => voiceprints.remove(name));
  ipcMain.handle('speaker:reassign', (_e, id, index, slot) => {
    const rec = store.get(id);
    if (!rec || !Array.isArray(rec.entries) || !rec.entries[index] || !speakers.isValidSlot(slot)) return { ok: false };
    speakers.applySlot(rec.entries[index], slot);
    rec.analytics = talkTime.computeTalkTime(rec.entries); // talk-time may shift if a line moved channel
    store.save(rec);
    return { ok: true, analytics: rec.analytics };
  });
  // Reassign this line and every following line (by time) to a slot — fast manual diarization.
  // Preserves the user's own (Me) lines so a stray block can't clobber your contributions.
  ipcMain.handle('speaker:reassignFrom', (_e, id, fromT, slot) => {
    const rec = store.get(id);
    if (!rec || !Array.isArray(rec.entries) || !speakers.isValidSlot(slot)) return { ok: false };
    rec.entries.forEach((e) => { if ((e.t || 0) >= fromT && e.speaker !== 'Me') speakers.applySlot(e, slot); });
    rec.analytics = talkTime.computeTalkTime(rec.entries);
    store.save(rec);
    return { ok: true, analytics: rec.analytics };
  });

  // ---- full-text search + cross-meeting Ask (local index over all sessions) ----
  ipcMain.handle('search:query', (_e, text) => {
    const sessions = store.list().map((m) => store.get(m.id)).filter(Boolean);
    return fts.search(sessions.map(sessionDoc), text, 30);
  });
  ipcMain.handle('ask:query', async (_e, text) => {
    const sessions = store.list().map((m) => store.get(m.id)).filter(Boolean);
    const ranked = fts.search(sessions.map(sessionDoc), text, 4); // top meetings
    const byId = {};
    sessions.forEach((s) => { byId[s.id] = s; });
    const context = [];
    ranked.forEach((r) => {
      const s = byId[r.id];
      if (!s) return;
      let sections = fts.relevantSections(s.entries || [], text, { limit: 3, chunkChars: 600 });
      let excerpts = sections.map((x) => x.text);
      if (!excerpts.length) excerpts = [r.snippet]; // fall back to the title/summary snippet
      context.push({ meeting: { id: s.id, title: s.title || 'Meeting', createdAt: s.createdAt }, excerpts });
    });
    return aiSummary.answerQuestion({ question: text, context, modelId: settings.get('summaryModel') });
  });

  // ---- returning-attendee briefs ----
  ipcMain.handle('brief:lookup', (_e, names, excludeId) => {
    const sessions = store.list().map((m) => store.get(m.id)).filter(Boolean); // newest-first
    return briefs.lookup(sessions, names, excludeId);
  });

  // ---- cross-meeting action items ----
  ipcMain.handle('actions:list', () => store.listActionItems());
  ipcMain.handle('actions:set', (_e, key, done) => store.setActionDone(key, !!done));

  // ---- history ----
  ipcMain.handle('history:list', () => store.list());
  ipcMain.handle('history:get', (_e, id) => store.get(id));
  ipcMain.handle('history:rename', (_e, id, title) => store.rename(id, title));
  ipcMain.handle('history:delete', (_e, id) => store.remove(id));
  ipcMain.handle('history:export', (_e, id, what, format) => store.writeExportFile(id, what, format));
  ipcMain.handle('history:setTags', (_e, id, tags) => store.setTags(id, tags));
  ipcMain.handle('history:setFolder', (_e, id, folder) => store.setFolder(id, folder));
}

function wireMeetingDetector() {
  detector.on('detected', (appName) => {
    if (capturing) return;
    new Notification({ title: 'Meeting detected', body: `${appName} is live. Open Debrief to start capture.` }).show();
    if (mainWindow) {
      mainWindow.webContents.send('meeting:detected', { source: appName, autoStart: !!settings.get('autoStart') });
    }
  });
  detector.on('ended', () => {
    if (mainWindow) mainWindow.webContents.send('meeting:ended');
  });
  detector.start();
}

app.whenReady().then(() => {
  installDisplayMediaHandler();
  registerIpc();
  createWindow();
  wireMeetingDetector();
  if (whisper.installed()) whisper.start().catch((e) => console.error('[whisper] warm-up:', e.message));
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  detector.stop();
  whisper.stop();
});
