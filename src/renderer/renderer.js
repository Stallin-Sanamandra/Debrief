'use strict';

// Debrief renderer: multi-view UI (Session / History / Settings) over a local capture
// pipeline. Captures mic ("Me") + system loopback ("Others"), mixes to 16 kHz mono,
// slices into overlapping windows, VAD-gates, and streams each to the local Whisper
// engine. On stop, the transcript + the user's notes go to the selected summary model.
(function () {
  const SAMPLE_RATE = 16000;
  // Audio is segmented into utterances by src/shared/segmenter.js (endpointing on pauses).
  // Tuning lives in that module's DEFAULTS.

  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const state = {
    capturing: false,
    audioCtx: null, micStream: null, sysStream: null, channels: null,
    txnChain: Promise.resolve(),
    timerId: null, startedAt: 0,
    catalog: { models: [], templates: [] },
    transcriptionModel: 'small.en',
    detailId: null, detailRecord: null,
    notesTimer: null, toastTimer: null,
    busy: false, sessionStale: false, // sessionStale: notes/title reflect a finished session
    lastSessionId: null, emailId: null, crmId: null, actionItems: [], liveEntries: [],
    briefsShown: null, briefs: [], briefsCollapsed: true, // returning-attendee briefs
    voiceId: false,        // voice fingerprinting on? (computes an embedding per utterance)
    allMeetings: [], folderFilter: '', tagFilter: '', // History folder/tag filtering
    speakerNames: {},      // names APPLIED in the current session (empty = honest Me/Others defaults)
    rememberedNames: {}    // names from past sessions — used only as rename SUGGESTIONS, never auto-applied
  };

  const Spk = window.DebriefSpeakers;
  const slotOf = Spk.slotOf;
  const nameFor = Spk.nameFor;
  // Distinct colors per speaker: me=violet, others1=teal, others2=amber, then a cycling palette.
  const SPK_COLORS = { me: 'var(--me)', others1: 'var(--others)', others2: 'var(--others2)' };
  const SPK_PALETTE = ['#5BA8FF', '#E879B9', '#7BD88F', '#C58AF0', '#F0A35E', '#54D1C5'];
  function speakerColor(slot) {
    if (SPK_COLORS[slot]) return SPK_COLORS[slot];
    const m = /^others(\d+)$/.exec(slot);
    if (m) return SPK_PALETTE[((parseInt(m[1], 10) - 3) % SPK_PALETTE.length + SPK_PALETTE.length) % SPK_PALETTE.length];
    return 'var(--text)';
  }
  function sortSlots(slots) {
    return slots.slice().sort((a, b) => {
      if (a === 'me') return -1;
      if (b === 'me') return 1;
      return parseInt((a.match(/\d+/) || [1])[0], 10) - parseInt((b.match(/\d+/) || [1])[0], 10);
    });
  }

  // ---------- small helpers ----------
  function toast(msg) {
    const t = el('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => t.classList.add('hidden'), 2400);
  }
  function fmt(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
  function modelLabel(id) {
    const m = state.catalog.models.find((x) => x.id === id);
    return m ? m.label : id;
  }

  // ---------- view + tab switching ----------
  function showView(name) {
    ['Session', 'History', 'Actions', 'Settings', 'Detail'].forEach((v) => el('view' + v).classList.toggle('active', v === name));
    el('navSession').classList.toggle('active', name === 'Session');
    el('navHistory').classList.toggle('active', name === 'History');
    el('navActions').classList.toggle('active', name === 'Actions');
    el('navSettings').classList.toggle('active', name === 'Settings');
    if (name === 'History') loadHistory();
    if (name === 'Actions') loadActions();
    if (name === 'Settings') renderVoiceprints();
  }
  async function renderVoiceprints() {
    const box = el('voiceprintList');
    if (!box) return;
    const items = await window.debrief.voiceprints.list();
    if (!items || !items.length) {
      box.innerHTML = '<div class="muted" style="font-size:12px">No enrolled voices yet. Name a speaker in any transcript to enroll their voice.</div>';
      return;
    }
    box.innerHTML = items.map((v) => '<span class="vp-chip">' + esc(v.name) + ' <button data-n="' + esc(v.name) + '" title="Remove">✕</button></span>').join('');
    box.querySelectorAll('.vp-chip button').forEach((b) => {
      b.onclick = async () => { await window.debrief.voiceprints.remove(b.getAttribute('data-n')); renderVoiceprints(); };
    });
  }

  // Logo / home: always go to the Session view. If a capture is live, just navigate (never
  // stop or disturb it). Only when idle reset to the fresh, ready-to-capture state.
  function goHome() {
    showView('Session');
    if (state.capturing) return;
    resetSessionView();
  }
  function resetSessionView() {
    state.liveEntries = [];
    state.briefsShown = new Set();
    state.briefs = [];
    state.briefsCollapsed = true;
    state.speakerNames = {};
    el('attendeeBriefs').innerHTML = '';
    el('transcript').innerHTML = '';
    el('transcriptEmpty').classList.remove('hidden');
    el('myNotes').value = '';
    el('sessTitle').value = '';
    el('sessCustomPrompt').value = '';
    el('summary').innerHTML = '<div class="muted">The AI summary appears here after you stop.</div>';
    el('analytics').innerHTML = '';
    el('analytics').classList.add('hidden');
    el('summaryActions').classList.add('hidden');
    el('savePath').textContent = '';
    el('timer').textContent = '00:00';
    state.sessionStale = false;
    state.lastSessionId = null;
    showPane('Transcript');
  }
  function showPane(which) {
    ['Transcript', 'Notes', 'Summary'].forEach((p) => {
      el('tab' + p).classList.toggle('active', p === which);
      el('pane' + p).classList.toggle('hidden', p !== which);
    });
  }
  function showDetailPane(which) {
    ['Summary', 'Transcript', 'Notes'].forEach((p) => {
      el('dtab' + p).classList.toggle('active', p === which);
      el('dPane' + p).classList.toggle('hidden', p !== which);
    });
  }

  // ---------- transcript rendering ----------
  // appendEntry(container, entry, names[, onReassign]) — entry: {speaker, sub?, t, text}.
  function appendEntry(container, entry, names, onReassign) {
    if (!entry || !entry.text) return;
    const slot = slotOf(entry);
    const div = document.createElement('div');
    div.className = 'entry ' + (slot === 'me' ? 'me' : 'others');
    const who = document.createElement('span');
    who.className = 'who' + (onReassign ? ' editable' : '');
    who.textContent = nameFor(slot, names);
    who.style.color = speakerColor(slot);
    if (onReassign) {
      who.title = 'Click to name or reassign this speaker';
      who.onclick = (ev) => { ev.stopPropagation(); onReassign(entry, ev); };
    }
    const ts = document.createElement('span');
    ts.className = 'ts';
    ts.textContent = ' ' + fmt(entry.t || 0);
    const txt = document.createElement('span');
    txt.className = 'txt';
    txt.textContent = ' ' + entry.text;
    div.appendChild(who);
    div.appendChild(ts);
    div.appendChild(txt);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // ---------- summary rendering ----------
  function renderSummary(node, summary) {
    if (!summary) { node.innerHTML = '<div class="muted">No summary.</div>'; return; }
    const eng = summary.engine || 'basic';
    let h = '';
    if (eng === 'basic') h += '<div class="sum-engine basic">Basic keyword summary — set an API key in Settings for AI notes.</div>';
    else if (eng === 'error') h += '<div class="sum-engine err">' + esc(summary.error || 'AI summary unavailable.') + ' Showing the basic summary below.</div>';
    else h += '<div class="sum-engine">AI summary · ' + esc(modelLabel(eng)) + '</div>';
    const list = (items) => (items && items.length)
      ? '<ul>' + items.map((i) => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      : '<div class="none">None.</div>';
    const acts = (items) => (items && items.length)
      ? '<ul>' + items.map((a) => '<li>' + esc(a.text) + (a.owner ? ' <span class="owner">— ' + esc(a.owner) + '</span>' : '') + '</li>').join('') + '</ul>'
      : '<div class="none">None.</div>';
    h += '<h4>Notes</h4>' + list(summary.notes);
    h += '<h4>Decisions</h4>' + list(summary.decisions);
    h += '<h4>Action items</h4>' + acts(summary.actions);
    node.innerHTML = h;
  }

  // ---------- talk-time analytics ----------
  function durLabel(s) {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m ? `${m}m ${sec}s` : `${sec}s`;
  }
  function renderAnalytics(node, a) {
    if (!node) return;
    if (!a || (!a.totalSeconds && !a.totalWords)) { node.innerHTML = ''; node.classList.add('hidden'); return; }
    node.classList.remove('hidden');
    const pctMe = Math.round((a.ratioMe || 0) * 100);
    const pctOthers = 100 - pctMe;
    let h = '';
    h += '<div class="tt-bar"><div class="tt-me" style="width:' + pctMe + '%"></div><div class="tt-others" style="width:' + pctOthers + '%"></div></div>';
    h += '<div class="tt-legend"><span class="me"><span class="dot"></span>You ' + pctMe + '%</span><span class="others"><span class="dot"></span>Others ' + pctOthers + '%</span></div>';
    h += '<div class="tt-stats">';
    if (a.longestMonologue) {
      const who = a.longestMonologue.speaker === 'Me' ? 'You' : 'Others';
      h += '<span class="tt-stat">Longest monologue <b>' + durLabel(a.longestMonologue.seconds) + '</b> (' + esc(who) + ')</span>';
    }
    h += '<span class="tt-stat">Questions — you <b>' + (a.me ? a.me.questions : 0) + '</b> · others <b>' + (a.others ? a.others.questions : 0) + '</b></span>';
    if (a.basis === 'time') h += '<span class="tt-stat">Talk time <b>' + durLabel(a.me.seconds) + '</b> / <b>' + durLabel(a.others.seconds) + '</b></span>';
    h += '</div>';
    if (a.basis === 'words') h += '<div class="tt-basis">Split estimated from word counts (recorded before talk-time tracking).</div>';
    node.innerHTML = h;
  }

  // ---------- follow-up email ----------
  async function showEmailDraft(id) {
    if (!id) { toast('Save the meeting first'); return; }
    state.emailId = id;
    el('emailEngine').textContent = '';
    el('emailEngine').className = 'sum-engine';
    el('emailSubject').value = '';
    el('emailBody').value = 'Drafting…';
    el('emailModal').classList.remove('hidden');
    const r = await window.debrief.email.draft(id);
    if (!r) { el('emailBody').value = 'Could not draft the email.'; return; }
    el('emailSubject').value = r.subject || '';
    el('emailBody').value = r.body || '';
    const lbl = el('emailEngine');
    if (r.engine === 'basic') { lbl.textContent = 'Built from your summary — set an API key for an AI-written email.'; lbl.classList.add('basic'); }
    else if (r.engine === 'error') { lbl.textContent = (r.error || 'AI draft failed.') + ' Built from your summary instead.'; lbl.classList.add('err'); }
    else lbl.textContent = 'Drafted by ' + modelLabel(r.engine);
  }
  function closeEmailModal() { el('emailModal').classList.add('hidden'); }

  // ---------- CRM / HubSpot deal notes ----------
  async function showCrmNotes(id) {
    if (!id) { toast('Save the meeting first'); return; }
    state.crmId = id;
    el('crmEngine').textContent = '';
    el('crmEngine').className = 'sum-engine';
    el('crmBody').value = 'Drafting…';
    el('crmModal').classList.remove('hidden');
    const r = await window.debrief.crm.draft(id);
    if (!r) { el('crmBody').value = 'Could not draft deal notes.'; return; }
    el('crmBody').value = r.text || '';
    const lbl = el('crmEngine');
    if (r.engine === 'basic') { lbl.textContent = 'Built from your summary — set an API key for AI field extraction.'; lbl.classList.add('basic'); }
    else if (r.engine === 'error') { lbl.textContent = (r.error || 'AI extraction failed.') + ' Built from your summary instead.'; lbl.classList.add('err'); }
    else lbl.textContent = 'Extracted by ' + modelLabel(r.engine);
  }

  // ---------- timer ----------
  function startTimer() {
    if (state.timerId) clearInterval(state.timerId); // never leak a prior interval
    state.startedAt = Date.now();
    el('timer').textContent = '00:00';
    state.timerId = setInterval(() => { el('timer').textContent = fmt((Date.now() - state.startedAt) / 1000); }, 500);
  }
  function stopTimer() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
    // Freeze the display at the exact elapsed time so it halts immediately on Stop.
    if (state.startedAt) el('timer').textContent = fmt((Date.now() - state.startedAt) / 1000);
  }

  // ---------- capture pipeline (per-channel utterance segmenter -> whisper) ----------
  function makeChannel(speaker) {
    return { speaker, seg: new window.DebriefSegmenter.Segmenter({ sampleRate: SAMPLE_RATE }), worklet: null };
  }
  function onAudioBlock(chan, block) {
    for (const s of chan.seg.push(block)) enqueueSegment(chan, s);
  }
  // Serialize POSTs across both channels (whisper-server is single-threaded).
  function enqueueSegment(chan, s) {
    state.txnChain = state.txnChain
      .then(() => transcribeSegment(chan.speaker, s.audio, s.tStart, s.continued))
      .catch(() => {});
  }
  async function transcribeSegment(speaker, buf, t, continued) {
    const dur = buf.length / SAMPLE_RATE; // spoken seconds of this utterance (for talk-time)
    const f0 = speaker === 'Others' ? window.DebriefVoiceFeatures.estimateF0(buf, SAMPLE_RATE) : 0; // pitch for Others 1/2 split
    const emb = state.voiceId ? window.DebriefEmbed.embed(buf, SAMPLE_RATE) : null; // voice fingerprint
    const wav = window.DebriefWav.encodeWav(buf, SAMPLE_RATE);
    const res = await window.debrief.transcribe(wav, { speaker, t, continued, dur, f0, emb });
    if (res && res.error) { el('engineStatus').textContent = 'engine: error'; return; }
    if (res && res.delta) {
      const entry = { speaker: res.speaker || speaker, t: res.t != null ? res.t : t, text: res.delta };
      state.liveEntries.push(entry);
      // Drop echo-bleed twins live (a Me line duplicating a near-simultaneous Others line).
      state.liveEntries = window.DebriefBleed.dedupeCrossChannel(state.liveEntries);
      renderLiveTranscript();
    }
  }

  // Live transcript: rebuild from the kept entries (used after a live speaker rename).
  function renderLiveTranscript() {
    const tnode = el('transcript');
    tnode.innerHTML = '';
    state.liveEntries.forEach((e) => appendEntry(tnode, e, state.speakerNames, (e2) => renameLiveSlot(slotOf(e2))));
    el('transcriptEmpty').classList.toggle('hidden', state.liveEntries.length > 0);
  }
  // Rename a speaker mid-capture. Applies across the whole transcript immediately, persists
  // into the live session, and is remembered for next time. Audio capture keeps running.
  async function renameLiveSlot(slot) {
    const cur = nameFor(slot, state.speakerNames);
    const isDefault = cur === Spk.defaultName(slot);
    const suggestion = isDefault ? (state.rememberedNames[slot] || '') : cur; // suggest the remembered name
    const next = await inputPrompt('Rename this speaker — applies to the whole transcript, remembered next time', suggestion);
    if (next == null) return;
    const nm = next.trim();
    if (!nm) return;
    state.speakerNames = Object.assign({}, state.speakerNames, { [slot]: nm });
    state.rememberedNames = Object.assign({}, state.rememberedNames, { [slot]: nm });
    await window.debrief.speakers.renameLive(slot, nm);
    renderLiveTranscript();
    showBriefsForNames([nm]); // they just identified an attendee — surface a brief if we've met them
    toast('Named “' + nm + '”');
  }

  // ---------- returning-attendee briefs ----------
  function isNamedAttendee(n) {
    return n && !/^(Me|Others)( \d+)?$/.test(String(n).trim());
  }
  async function showBriefsForNames(names) {
    if (!state.briefsShown) state.briefsShown = new Set();
    const fresh = (names || [])
      .map((n) => String(n || '').trim())
      .filter((n) => isNamedAttendee(n) && !state.briefsShown.has(n.toLowerCase()));
    if (!fresh.length) return;
    fresh.forEach((n) => state.briefsShown.add(n.toLowerCase())); // mark attempted so we don't re-query
    const results = await window.debrief.brief.lookup(fresh, null);
    results.forEach((b) => {
      if (!state.briefs.find((x) => x.name.toLowerCase() === b.name.toLowerCase())) state.briefs.push(b);
    });
    renderBriefs();
  }
  // Slim collapsible bar; expanded view groups attendees who share the same last meeting.
  function renderBriefs() {
    const box = el('attendeeBriefs');
    const briefs = state.briefs || [];
    if (!briefs.length) { box.innerHTML = ''; return; }
    const names = briefs.map((b) => b.name);
    let h = '<div class="briefs-bar">' +
      '<span class="briefs-label">👋 People you\'ve met: ' + esc(names.join(', ')) + '</span>' +
      '<button class="briefs-toggle">' + (state.briefsCollapsed ? 'details ▾' : 'hide ▴') + '</button>' +
      '<button class="briefs-x" title="Dismiss">✕</button></div>';
    if (!state.briefsCollapsed) {
      const groups = {};
      briefs.forEach((b) => {
        if (!groups[b.sessionId]) groups[b.sessionId] = { sessionId: b.sessionId, title: b.title, createdAt: b.createdAt, notes: b.notes, actions: b.actions, names: [] };
        groups[b.sessionId].names.push(b.name);
      });
      h += '<div class="briefs-list">' + Object.keys(groups).map((k) => briefCardHtml(groups[k])).join('') + '</div>';
    }
    box.innerHTML = h;
    box.querySelector('.briefs-toggle').onclick = () => { state.briefsCollapsed = !state.briefsCollapsed; renderBriefs(); };
    box.querySelector('.briefs-x').onclick = () => { state.briefs = []; renderBriefs(); };
    box.querySelectorAll('.brief-open').forEach((btn) => { btn.onclick = () => openDetail(btn.getAttribute('data-id')); });
  }
  function briefCardHtml(g) {
    const when = g.createdAt ? new Date(g.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
    const items = (g.notes || []).filter(Boolean)
      .concat((g.actions || []).map((a) => a.text + (a.owner ? ' (' + a.owner + ')' : '')))
      .slice(0, 3);
    let h = '<div class="brief"><div class="brief-head">Last met <b>' + esc(g.names.join(', ')) + '</b> in “' + esc(g.title || 'a meeting') + '” · ' + esc(when) + '</div>';
    if (items.length) h += '<ul>' + items.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    h += '<button class="brief-open" data-id="' + esc(g.sessionId) + '">Open meeting →</button></div>';
    return h;
  }

  // ---------- permission + engine status ----------
  function setChip(node, label, status) {
    node.textContent = `${label}: ${status === 'granted' ? 'ok' : status}`;
    node.classList.toggle('ok', status === 'granted');
    node.classList.toggle('bad', status === 'denied' || status === 'restricted');
  }
  async function refreshPermissionChips() {
    const snap = await window.debrief.permissions.snapshot();
    setChip(el('chipMic'), 'mic', snap.microphone);
    setChip(el('chipScreen'), 'screen', snap.screen);
    return snap;
  }
  async function refreshEngine() {
    const s = await window.debrief.engine.status();
    el('engineStatus').textContent = s.ready
      ? `engine: ${state.transcriptionModel} (local)`
      : s.installed ? 'engine: warming…' : 'engine: not installed';
    return s;
  }

  function cleanupStreams() {
    [state.micStream, state.sysStream].forEach((s) => s && s.getTracks().forEach((t) => t.stop()));
    state.micStream = state.sysStream = null;
    if (state.channels) {
      for (const chan of Object.values(state.channels)) {
        if (chan.worklet) { try { chan.worklet.disconnect(); } catch (e) {} chan.worklet = null; }
      }
      state.channels = null;
    }
    if (state.audioCtx) { state.audioCtx.close().catch(() => {}); state.audioCtx = null; }
  }
  function setLiveUI(live) {
    el('recordBtn').classList.toggle('live', live);
    el('recordLabel').textContent = live ? 'Stop capture' : 'Start capture';
  }

  // Mic capture with the strongest available echo cancellation. On laptop speakers the remote
  // voice bleeds into the mic; the OS/"system" AEC (macOS voice processing) removes most of it.
  // Falls back progressively if the browser rejects the richer constraints.
  async function getMicStream() {
    const strong = {
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      autoGainControl: { ideal: true },
      echoCancellationType: { ideal: 'system' },
      advanced: [
        { echoCancellationType: 'system' },
        { googEchoCancellation: true },
        { googExperimentalEchoCancellation: true },
        { googNoiseSuppression: true },
        { googAutoGainControl: true },
        { googHighpassFilter: true }
      ]
    };
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: strong });
    } catch (e1) {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e2) {
        return await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    }
  }

  async function startCapture(source) {
    if (state.capturing) return;

    await window.debrief.permissions.ensureMic();
    await refreshPermissionChips();

    const eng = await window.debrief.engine.ensure();
    await refreshEngine();
    if (!eng.installed) { toast('Whisper not installed — run npm run setup:whisper'); return; }
    if (!eng.ready) { toast('Engine could not start' + (eng.error ? ': ' + eng.error : '')); return; }

    try {
      state.micStream = await getMicStream();
    } catch (err) { toast('Microphone access denied — enable Debrief under Privacy & Security > Microphone'); return; }

    try {
      state.sysStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      state.sysStream.getVideoTracks().forEach((t) => t.stop());
    } catch (err) {
      await refreshPermissionChips();
      toast('Screen Recording needed for system audio — approve the prompt, then Start again');
      window.debrief.permissions.openScreen();
      cleanupStreams();
      return;
    }

    state.audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    await state.audioCtx.audioWorklet.addModule('pcm-worklet.js');
    state.channels = { me: makeChannel('Me'), others: makeChannel('Others') };
    const attach = (stream, chan) => {
      if (!stream || !stream.getAudioTracks().length) return;
      const srcNode = state.audioCtx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(state.audioCtx, 'pcm-processor');
      node.port.onmessage = (e) => onAudioBlock(chan, e.data);
      srcNode.connect(node);
      chan.worklet = node;
    };
    attach(state.micStream, state.channels.me);
    attach(state.sysStream, state.channels.others);

    state.txnChain = Promise.resolve();
    state.liveEntries = [];
    el('transcript').innerHTML = '';
    el('transcriptEmpty').classList.remove('hidden');
    el('summary').innerHTML = '<div class="muted">Recording… the AI summary appears here after you stop.</div>';
    el('analytics').innerHTML = '';
    el('analytics').classList.add('hidden');
    el('summaryActions').classList.add('hidden');
    el('attendeeBriefs').innerHTML = '';
    state.briefsShown = new Set();
    state.briefs = [];
    state.briefsCollapsed = true;
    state.speakerNames = {}; // honest defaults each session; remembered names are only suggestions
    el('savePath').textContent = '';
    // Reset notes + title that belong to the previous session (but keep anything typed
    // before pressing Start, which sessionStale=false signals).
    if (state.sessionStale) { el('myNotes').value = ''; el('sessTitle').value = ''; el('sessCustomPrompt').value = ''; state.sessionStale = false; }

    const template = el('sessTemplate').value || 'general';
    await window.debrief.session.start({ source: source || 'manual', template });

    state.capturing = true;
    setLiveUI(true);
    startTimer();
    showPane('Transcript');
    // Briefs are informational (who you've met before) — fine to use remembered names; the
    // transcript itself stays honest (Me/Others) until you rename.
    showBriefsForNames(Object.values(state.rememberedNames || {}));
  }

  async function stopCapture() {
    if (!state.capturing) return;
    state.capturing = false;
    setLiveUI(false);
    stopTimer();

    // Flush each channel's buffered utterance so the tail of the meeting isn't lost.
    if (state.channels) {
      for (const chan of Object.values(state.channels)) {
        if (chan.worklet) chan.worklet.port.onmessage = null;
        for (const s of chan.seg.flush()) enqueueSegment(chan, s);
      }
    }
    await state.txnChain;
    cleanupStreams();

    // Push the latest notes, then summarize.
    await window.debrief.session.updateNotes(el('myNotes').value || '');
    el('summary').innerHTML = '<div class="muted">Summarizing…</div>';
    showPane('Summary');

    const res = await window.debrief.session.stop(el('sessCustomPrompt').value || '');
    if (res && res.error) { toast('Stop failed: ' + res.error); return; }
    if (res) {
      if (res.title) el('sessTitle').value = res.title;
      state.lastSessionId = res.id;
      el('summaryActions').classList.remove('hidden');
      // Re-render the transcript from glossary-corrected entries so the live view matches what was saved.
      if (res.entries && res.entries.length) {
        const tnode = el('transcript');
        tnode.innerHTML = '';
        res.entries.slice().sort((a, b) => a.t - b.t).forEach((e) => appendEntry(tnode, e, state.speakerNames));
        el('transcriptEmpty').classList.add('hidden');
      }
      renderAnalytics(el('analytics'), res.analytics);
      renderSummary(el('summary'), res.summary);
      if (res.path) el('savePath').textContent = 'Saved: ' + res.path;
      toast('Saved “' + (res.title || 'Meeting') + '”');
    }
    // Notes + title now belong to a finished session; the next Start clears them.
    state.sessionStale = true;
  }

  // ---------- history ----------
  // Strip "Speaker [mm:ss]:" labels so snippets read as clean prose.
  function cleanSnippet(s) {
    return String(s || '')
      .replace(/\*?\*?[A-Za-z][\w'-]{0,20}\*?\*?\s*\[\d{1,2}:\d{2}\]:\s*/g, '') // "Name [mm:ss]:" (single token)
      .replace(/\[\d{1,2}:\d{2}\]:\s*/g, '') // any residual bare timestamps
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  // Minimal, safe markdown for AI answers (escape first, then bold + bullet lists + paragraphs).
  function mdLite(text) {
    let h = esc(text || '').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    const lines = h.split(/\n/);
    let out = '';
    let inList = false;
    for (const raw of lines) {
      const line = raw.trim();
      const m = line.match(/^[-•]\s+(.*)$/);
      if (m) {
        if (!inList) { out += '<ul class="md-ul">'; inList = true; }
        out += '<li>' + m[1] + '</li>';
      } else {
        if (inList) { out += '</ul>'; inList = false; }
        if (line) out += '<p>' + line + '</p>';
      }
    }
    if (inList) out += '</ul>';
    return out;
  }

  function meetingRow(it, snippet) {
    const d = new Date(it.createdAt);
    const when = d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const dur = fmt(it.durationSec || 0);
    const clean = snippet ? cleanSnippet(snippet) : '';
    const tagLine = (it.folder ? '📁 ' + esc(it.folder) : '') +
      (it.tags && it.tags.length ? (it.folder ? ' · ' : '') + it.tags.map((t) => '#' + esc(t)).join(' ') : '');
    const row = document.createElement('div');
    row.className = 'hist';
    row.innerHTML =
      '<div class="h-main"><div class="h-title">' + esc(it.title || 'Meeting') + '</div>' +
      '<div class="h-meta">' + esc(when) + ' · ' + dur + '</div>' +
      (clean ? '<div class="h-snippet">' + esc(clean) + '</div>' : '') +
      (tagLine ? '<div class="h-tags">' + tagLine + '</div>' : '') +
      '</div><div class="h-actions"><button class="btn small open">Open</button></div>';
    row.querySelector('.open').onclick = (e) => { e.stopPropagation(); openDetail(it.id); };
    row.onclick = () => openDetail(it.id);
    return row;
  }
  async function loadHistory() {
    el('askResult').classList.add('hidden');
    state.allMeetings = await window.debrief.history.list();
    renderFolderFilter();
    renderTagFilter();
    renderFilteredHistory();
  }
  function renderFolderFilter() {
    const sel = el('folderFilter');
    const folders = Array.from(new Set((state.allMeetings || []).map((m) => m.folder).filter(Boolean))).sort();
    const opts = [{ v: '', l: 'All folders' }, { v: '__unfiled__', l: 'Unfiled' }].concat(folders.map((f) => ({ v: f, l: f })));
    sel.innerHTML = opts.map((o) => '<option value="' + esc(o.v) + '"' + (o.v === state.folderFilter ? ' selected' : '') + '>' + esc(o.l) + '</option>').join('');
  }
  function renderTagFilter() {
    const box = el('tagFilter');
    const tags = Array.from(new Set([].concat.apply([], (state.allMeetings || []).map((m) => m.tags || [])))).sort();
    box.innerHTML = tags.map((t) => '<button class="tag-chip' + (t === state.tagFilter ? ' active' : '') + '" data-t="' + esc(t) + '">' + esc(t) + '</button>').join('');
    box.querySelectorAll('.tag-chip').forEach((b) => {
      b.onclick = () => { const t = b.getAttribute('data-t'); state.tagFilter = (state.tagFilter === t) ? '' : t; renderTagFilter(); renderFilteredHistory(); };
    });
  }
  function renderFilteredHistory() {
    let items = state.allMeetings || [];
    if (state.folderFilter === '__unfiled__') items = items.filter((m) => !m.folder);
    else if (state.folderFilter) items = items.filter((m) => m.folder === state.folderFilter);
    if (state.tagFilter) items = items.filter((m) => (m.tags || []).includes(state.tagFilter));
    const list = el('historyList');
    if (!items.length) {
      list.innerHTML = '<div class="empty">' + (state.folderFilter || state.tagFilter ? 'No meetings match this filter.' : 'No meetings yet. Record one from the Session tab.') + '</div>';
      return;
    }
    list.innerHTML = '';
    items.forEach((it) => list.appendChild(meetingRow(it)));
  }
  async function renderSearchResults(q) {
    const results = await window.debrief.search.query(q);
    const list = el('historyList');
    if (!results || !results.length) { list.innerHTML = '<div class="empty">No meetings match “' + esc(q) + '”.</div>'; return; }
    list.innerHTML = '';
    results.forEach((r) => list.appendChild(meetingRow(r, r.snippet)));
  }
  // Full-text search over all saved meetings.
  async function runSearch() {
    const q = el('historySearch').value.trim();
    el('askResult').classList.add('hidden');
    if (!q) { loadHistory(); return; }
    await renderSearchResults(q);
  }
  // Cross-meeting Ask: answer with the chosen model + show the supporting meetings below.
  async function runAsk() {
    const q = el('historySearch').value.trim();
    if (!q) { toast('Type a question first'); return; }
    const box = el('askResult');
    box.classList.remove('hidden');
    box.innerHTML = '<div class="ask-answer muted">Thinking…</div>';
    renderSearchResults(q); // supporting meetings (local, instant) below the answer
    renderAsk(box, await window.debrief.search.ask(q), q);
  }
  function renderAsk(box, r, q) {
    if (!r) { box.innerHTML = '<div class="ask-answer">Could not answer.</div>'; return; }
    if (r.noContext) { box.innerHTML = '<button class="ask-close" title="Dismiss">✕</button><div class="ask-answer muted">No meetings matched “' + esc(q) + '”. Try different words.</div>'; wireAskClose(box); return; }
    let h = '<button class="ask-close" title="Dismiss">✕</button>';
    if (r.noKey) h += '<div class="ask-engine basic">Add an API key in Settings to get an answer. Most relevant meetings:</div>';
    else if (r.engine === 'error') h += '<div class="ask-engine err">' + esc(r.error || 'Ask failed.') + '</div>';
    else {
      h += '<div class="ask-engine">Answered by ' + esc(modelLabel(r.engine)) + ' · grounded in your meetings</div>';
      h += '<div class="ask-answer">' + mdLite(r.answer || '') + '</div>';
    }
    if (r.sources && r.sources.length) {
      h += '<div class="ask-sources"><span class="lbl">Sources:</span> ' +
        r.sources.map((m) => '<button class="ask-src" data-id="' + esc(m.id) + '">' + esc(m.title || 'Meeting') +
          (m.createdAt ? ' · ' + new Date(m.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '') +
          '</button>').join('') + '</div>';
    }
    box.innerHTML = h;
    wireAskClose(box);
    box.querySelectorAll('.ask-src').forEach((b) => { b.onclick = () => openDetail(b.getAttribute('data-id')); });
  }
  function wireAskClose(box) {
    const c = box.querySelector('.ask-close');
    if (c) c.onclick = () => box.classList.add('hidden');
  }

  async function openDetail(id) {
    const rec = await window.debrief.history.get(id);
    if (!rec) { toast('Could not load meeting'); return; }
    state.detailId = id;
    state.detailRecord = rec;
    el('detailTitle').textContent = rec.title || 'Meeting';
    el('detailPrompt').value = rec.customPrompt || '';
    renderDetailMeta(rec);
    renderSummary(el('detailSummary'), rec.summary);
    renderDetail(rec); // analytics + speakers bar + editable transcript
    el('detailNotes').textContent = (rec.myNotes && rec.myNotes.trim()) ? rec.myNotes : 'No notes were taken.';
    showDetailPane('Summary');
    showView('Detail');
  }

  // A session's own applied names are authoritative (no global auto-apply; nameFor fills defaults).
  function detailNames(rec) {
    return Object.assign({}, rec.speakerNames || {});
  }
  function renderDetail(rec) {
    renderAnalytics(el('detailAnalytics'), rec.analytics || window.DebriefAnalytics.computeTalkTime(rec.entries || []));
    renderDetailSpeakers(rec);
    renderDetailTranscript(rec);
  }
  function renderDetailSpeakers(rec) {
    const bar = el('detailSpeakers');
    const names = detailNames(rec);
    const present = sortSlots([...new Set((rec.entries || []).map(slotOf))]);
    if (!present.length) { bar.innerHTML = ''; return; }
    bar.innerHTML = '<span class="spk-label">Speakers (click to name):</span> ' +
      present.map((s) => '<button class="spk-chip" data-slot="' + s + '" style="color:' + speakerColor(s) + '">' + esc(nameFor(s, names)) + '</button>').join('');
    bar.querySelectorAll('.spk-chip').forEach((chip) => {
      chip.onclick = () => renameSlot(rec, chip.getAttribute('data-slot'));
    });
  }
  function renderDetailTranscript(rec) {
    const tnode = el('detailTranscript');
    tnode.innerHTML = '';
    const names = detailNames(rec);
    const sorted = (rec.entries || []).slice().sort((a, b) => a.t - b.t);
    if (!sorted.length) { tnode.innerHTML = '<div class="muted">No transcript.</div>'; return; }
    sorted.forEach((e) => appendEntry(tnode, e, names, (entry, ev) => openSpeakerMenu(rec, entry, ev)));
  }

  // All speaker slots offered for a meeting: present in the transcript, named in this
  // session, or remembered globally — plus 'me'/'others1' and the current line's slot.
  function listSlotsForRec(rec, cur) {
    const set = new Set(['me', 'others1']);
    (rec.entries || []).forEach((e) => set.add(slotOf(e)));
    Object.keys(rec.speakerNames || {}).forEach((s) => { if (Spk.isValidSlot(s)) set.add(s); });
    if (cur) set.add(cur);
    return sortSlots([...set]);
  }

  // Popover from a transcript line: reassign the line to a speaker, add a new speaker, or rename.
  function openSpeakerMenu(rec, entry, ev) {
    const menu = el('spkMenu');
    const names = detailNames(rec);
    const cur = slotOf(entry);
    const slots = listSlotsForRec(rec, cur);
    let h = '<div class="spk-menu-title">This line is</div>';
    slots.forEach((s) => {
      h += '<button class="spk-opt' + (s === cur ? ' current' : '') + '" data-act="one" data-slot="' + s + '" style="color:' + speakerColor(s) + '">' + esc(nameFor(s, names)) + (s === cur ? ' ✓' : '') + '</button>';
    });
    h += '<button class="spk-opt spk-new" data-act="one">➕ New speaker…</button>';
    h += '<div class="spk-menu-div"></div><div class="spk-menu-title">From here down →</div>';
    slots.forEach((s) => {
      h += '<button class="spk-opt" data-act="below" data-slot="' + s + '" style="color:' + speakerColor(s) + '">' + esc(nameFor(s, names)) + '</button>';
    });
    h += '<button class="spk-opt spk-new" data-act="below">➕ New speaker…</button>';
    h += '<div class="spk-menu-div"></div><button class="spk-rename">✎ Rename “' + esc(nameFor(cur, names)) + '”…</button>';
    menu.innerHTML = h;
    menu.style.left = Math.min(ev.clientX, window.innerWidth - 250) + 'px';
    menu.style.top = Math.min(ev.clientY, window.innerHeight - 160) + 'px';
    menu.classList.remove('hidden');
    menu.querySelectorAll('.spk-opt').forEach((b) => {
      b.onclick = () => {
        closeSpeakerMenu();
        const below = b.getAttribute('data-act') === 'below';
        if (b.classList.contains('spk-new')) { below ? addNewSpeakerFrom(rec, entry) : addNewSpeaker(rec, entry); return; }
        const s = b.getAttribute('data-slot');
        if (below) reassignFromEntry(rec, entry, s);
        else if (s !== cur) reassignEntry(rec, entry, s);
      };
    });
    menu.querySelector('.spk-rename').onclick = () => { closeSpeakerMenu(); renameSlot(rec, cur); };
  }
  // Reassign this line + all following (non-Me) lines to a slot — fast manual diarization.
  async function reassignFromEntry(rec, entry, slot) {
    const fromT = entry.t || 0;
    rec.entries.forEach((e) => { if ((e.t || 0) >= fromT && e.speaker !== 'Me') Spk.applySlot(e, slot); });
    const r = await window.debrief.speakers.reassignFrom(rec.id, fromT, slot);
    if (r && r.analytics) rec.analytics = r.analytics;
    renderDetail(rec);
  }
  async function addNewSpeakerFrom(rec, entry) {
    const input = await inputPrompt('New speaker name (e.g. Priya) — applies from this line down', '');
    if (input == null) return;
    const name = input.trim();
    if (!name) return;
    const named = Object.keys(Object.assign({}, state.rememberedNames, rec.speakerNames));
    const slot = Spk.nextOthersSlot(rec.entries, named);
    const r = await window.debrief.speakers.rename(rec.id, slot, name);
    if (r && r.speakerNames) rec.speakerNames = r.speakerNames;
    state.rememberedNames = Object.assign({}, state.rememberedNames, { [slot]: name });
    await reassignFromEntry(rec, entry, slot);
    toast('Added “' + name + '”');
  }
  function closeSpeakerMenu() { el('spkMenu').classList.add('hidden'); }

  async function addNewSpeaker(rec, entry) {
    const input = await inputPrompt('New speaker name (e.g. Priya)', '');
    if (input == null) return;
    const name = input.trim();
    if (!name) return;
    const named = Object.keys(Object.assign({}, state.rememberedNames, rec.speakerNames));
    const slot = Spk.nextOthersSlot(rec.entries, named);
    const r = await window.debrief.speakers.rename(rec.id, slot, name);
    if (r && r.speakerNames) rec.speakerNames = r.speakerNames;
    state.rememberedNames = Object.assign({}, state.rememberedNames, { [slot]: name });
    await reassignEntry(rec, entry, slot);
    toast('Added “' + name + '”');
  }

  // In-app text prompt (Electron does NOT support window.prompt — it returns null).
  function inputPrompt(title, initial) {
    return new Promise((resolve) => {
      const modal = el('inputModal');
      const field = el('inputField');
      el('inputTitle').textContent = title || 'Edit';
      field.value = initial || '';
      modal.classList.remove('hidden');
      setTimeout(() => { field.focus(); field.select(); }, 0);
      let done = false;
      const finish = (val) => {
        if (done) return;
        done = true;
        modal.classList.add('hidden');
        el('inputOkBtn').onclick = el('inputCancelBtn').onclick = el('inputX').onclick = modal.onclick = field.onkeydown = null;
        resolve(val);
      };
      el('inputOkBtn').onclick = () => finish(field.value);
      el('inputCancelBtn').onclick = () => finish(null);
      el('inputX').onclick = () => finish(null);
      modal.onclick = (e) => { if (e.target === modal) finish(null); };
      field.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(field.value); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(null); }
      };
    });
  }

  async function reassignEntry(rec, entry, slot) {
    const idx = rec.entries.indexOf(entry);
    if (idx < 0) return;
    Spk.applySlot(entry, slot);
    const r = await window.debrief.speakers.reassign(rec.id, idx, slot);
    if (r && r.analytics) rec.analytics = r.analytics;
    renderDetail(rec);
  }
  async function renameSlot(rec, slot) {
    const names = detailNames(rec);
    const cur = nameFor(slot, names);
    const isDefault = cur === Spk.defaultName(slot);
    const suggestion = isDefault ? (state.rememberedNames[slot] || '') : cur; // suggest the remembered name
    const next = await inputPrompt('Name this speaker (e.g. Marcio) — applies to all their lines, remembered next time', suggestion);
    if (next == null) return;
    const nm = next.trim();
    if (!nm) return;
    const r = await window.debrief.speakers.rename(rec.id, slot, nm);
    if (r && r.speakerNames) rec.speakerNames = r.speakerNames;
    state.rememberedNames = Object.assign({}, state.rememberedNames, { [slot]: nm });
    renderDetail(rec);
    toast('Named “' + nm + '”');
  }

  // ---------- folders / tags editor (Detail) ----------
  function renderDetailMeta(rec) {
    const box = el('detailMeta');
    const tags = rec.tags || [];
    const sugg = (window.DebriefTags.suggestTags(rec.summary, rec.title) || [])
      .filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase())).slice(0, 5);
    let h = '<div class="meta-row"><span class="meta-lbl">Folder</span><input id="detailFolder" type="text" placeholder="e.g. Acme account" value="' + esc(rec.folder || '') + '" /></div>';
    h += '<div class="meta-row"><span class="meta-lbl">Tags</span><div class="meta-tags">' +
      tags.map((t) => '<span class="tag-chip on">' + esc(t) + ' <button data-t="' + esc(t) + '" title="Remove">✕</button></span>').join('') +
      '<input id="detailTagInput" class="tag-input" type="text" placeholder="add tag…" /></div></div>';
    if (sugg.length) h += '<div class="meta-sugg">Suggested: ' + sugg.map((s) => '<button class="tag-sugg" data-t="' + esc(s) + '">+ ' + esc(s) + '</button>').join('') + '</div>';
    box.innerHTML = h;
    el('detailFolder').onchange = async () => { rec.folder = await window.debrief.history.setFolder(rec.id, el('detailFolder').value); };
    box.querySelectorAll('.tag-chip.on button').forEach((b) => {
      b.onclick = async () => { rec.tags = await window.debrief.history.setTags(rec.id, (rec.tags || []).filter((x) => x !== b.getAttribute('data-t'))); renderDetailMeta(rec); };
    });
    el('detailTagInput').onkeydown = async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const t = window.DebriefTags.normalizeTag(e.target.value);
      if (t && !(rec.tags || []).some((x) => x.toLowerCase() === t.toLowerCase())) {
        rec.tags = await window.debrief.history.setTags(rec.id, (rec.tags || []).concat(t));
        renderDetailMeta(rec);
      }
    };
    box.querySelectorAll('.tag-sugg').forEach((b) => {
      b.onclick = async () => { rec.tags = await window.debrief.history.setTags(rec.id, (rec.tags || []).concat(b.getAttribute('data-t'))); renderDetailMeta(rec); };
    });
  }

  // ---------- cross-meeting action items ----------
  async function loadActions() {
    state.actionItems = await window.debrief.actions.list();
    renderActions();
  }
  function renderActions() {
    const items = state.actionItems || [];
    const hideDone = el('actionsHideDone').checked;
    el('actionsCount').textContent = items.filter((i) => !i.done).length + ' open';
    const shown = hideDone ? items.filter((i) => !i.done) : items;
    const list = el('actionsList');
    if (!shown.length) {
      list.innerHTML = '<div class="empty">' + (items.length ? 'No open action items. Nice.' : 'No action items yet — they are collected from your meeting summaries.') + '</div>';
      return;
    }
    list.innerHTML = '';
    shown.forEach((it) => {
      const row = document.createElement('div');
      row.className = 'action' + (it.done ? ' done' : '');
      const date = it.createdAt ? new Date(it.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
      row.innerHTML =
        '<label class="act-check"><input type="checkbox"' + (it.done ? ' checked' : '') + ' /></label>' +
        '<div class="act-main"><div class="act-text">' + esc(it.text) + '</div>' +
        '<div class="act-meta">' + (it.owner ? '<span class="act-owner">' + esc(it.owner) + '</span> · ' : '') + esc(it.sessionTitle) + (date ? ' · ' + esc(date) : '') + '</div></div>';
      const cb = row.querySelector('input');
      cb.onchange = async () => {
        it.done = cb.checked;
        await window.debrief.actions.setDone(it.key, cb.checked);
        row.classList.toggle('done', cb.checked);
        el('actionsCount').textContent = (state.actionItems || []).filter((i) => !i.done).length + ' open';
        if (el('actionsHideDone').checked && cb.checked) row.remove();
      };
      row.querySelector('.act-main').onclick = () => openDetail(it.sessionId);
      list.appendChild(row);
    });
  }

  // ---------- catalog / settings ----------
  function fillSelect(node, options, selected) {
    node.innerHTML = '';
    options.forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      if (o.disabled) opt.disabled = true;
      if (o.value === selected) opt.selected = true;
      node.appendChild(opt);
    });
  }

  async function loadCatalogAndSettings() {
    const [cat, settings, keyStatus, models] = await Promise.all([
      window.debrief.catalog.get(),
      window.debrief.settings.get(),
      window.debrief.keys.status(),
      window.debrief.engine.models()
    ]);
    state.catalog = cat;
    state.transcriptionModel = (models && models.current) || 'small.en';

    // Template pickers (session + default).
    const tplOpts = cat.templates.map((t) => ({ value: t.id, label: t.label }));
    fillSelect(el('sessTemplate'), tplOpts, settings.defaultTemplate || 'general');
    fillSelect(el('defaultTemplate'), tplOpts, settings.defaultTemplate || 'general');

    // Summary model picker.
    const modelOpts = cat.models.map((m) => ({
      value: m.id,
      label: m.label + (m.note ? ' (' + m.note + ')' : ''),
      disabled: !!m.disabled
    }));
    fillSelect(el('summaryModel'), modelOpts, settings.summaryModel || 'claude-sonnet');
    updateModelKeyHint(settings.summaryModel || 'claude-sonnet', keyStatus);

    // Key status pills.
    applyKeyStatus(keyStatus);

    // Transcription model.
    const avail = (models && models.available) || {};
    const tmOpts = [
      { value: 'small.en', label: 'small.en — bundled, fastest' },
      { value: 'base.en', label: 'base.en' + (avail['base.en'] ? '' : ' (downloads ~150 MB)') },
      { value: 'medium.en', label: 'medium.en' + (avail['medium.en'] ? '' : ' (downloads ~1.5 GB)') }
    ];
    fillSelect(el('transcriptionModel'), tmOpts, state.transcriptionModel);

    // Custom vocabulary / glossary.
    el('glossary').value = settings.glossary || '';

    // Remembered names are rename SUGGESTIONS only; the live session starts with honest defaults.
    state.rememberedNames = Object.assign({}, settings.speakerNames || {});
    state.speakerNames = {};
    el('splitSpeakers').checked = !!settings.splitSpeakers;
    el('voiceId').checked = !!settings.voiceId;
    state.voiceId = !!settings.voiceId;

    // General.
    el('autoStart').checked = !!settings.autoStart;
  }

  async function saveGlossary() {
    await window.debrief.settings.set('glossary', el('glossary').value || '');
    el('glossaryHint').textContent = 'Saved. Applied to new recordings.';
    setTimeout(() => { el('glossaryHint').textContent = ''; }, 2500);
  }

  function applyKeyStatus(status) {
    const map = { anthropic: 'statAnthropic', openai: 'statOpenai', google: 'statGoogle' };
    Object.keys(map).forEach((p) => {
      const pill = el(map[p]);
      const on = status && status[p];
      pill.textContent = on ? 'saved' : 'not set';
      pill.classList.toggle('ok', !!on);
    });
  }
  function updateModelKeyHint(modelId, status) {
    const m = state.catalog.models.find((x) => x.id === modelId);
    const node = el('modelKeyHint');
    if (!m || !m.requiresKey) { node.textContent = m && m.provider === 'basic' ? 'No AI — keyword heuristic only.' : ''; return; }
    const have = status && status[m.requiresKey];
    node.textContent = have
      ? 'Using your ' + m.requiresKey + ' key (stored on this Mac).'
      : 'No ' + m.requiresKey + ' key set — summaries fall back to basic until you add one below.';
  }

  // ---------- wiring ----------
  function wire() {
    el('brandHome').onclick = goHome;
    el('navSession').onclick = () => showView('Session');
    el('navHistory').onclick = () => showView('History');
    el('navActions').onclick = () => showView('Actions');
    el('navSettings').onclick = () => showView('Settings');
    el('actionsHideDone').onchange = renderActions;

    // Dismiss the speaker popover on an outside click or Escape.
    document.addEventListener('click', (e) => {
      const m = el('spkMenu');
      if (!m.classList.contains('hidden') && !m.contains(e.target)) closeSpeakerMenu();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSpeakerMenu(); });

    el('tabTranscript').onclick = () => showPane('Transcript');
    el('tabNotes').onclick = () => showPane('Notes');
    el('tabSummary').onclick = () => showPane('Summary');

    el('dtabSummary').onclick = () => showDetailPane('Summary');
    el('dtabTranscript').onclick = () => showDetailPane('Transcript');
    el('dtabNotes').onclick = () => showDetailPane('Notes');
    el('detailBack').onclick = () => showView('History');

    // Busy-guard: ignore clicks while a start/stop transition is in flight, so the
    // record button can't be re-entered (a double-click used to spawn a 2nd timer).
    el('recordBtn').onclick = async () => {
      if (state.busy) return;
      state.busy = true;
      el('recordBtn').disabled = true;
      try {
        if (state.capturing) await stopCapture();
        else await startCapture('manual');
      } finally {
        state.busy = false;
        el('recordBtn').disabled = false;
      }
    };

    // Live notes -> main (debounced).
    el('myNotes').oninput = () => {
      state.sessionStale = false; // user is writing fresh notes; don't clear them on next Start
      clearTimeout(state.notesTimer);
      state.notesTimer = setTimeout(() => window.debrief.session.updateNotes(el('myNotes').value || ''), 400);
    };
    el('sessTitle').oninput = () => { state.sessionStale = false; };
    el('sessCustomPrompt').oninput = () => { state.sessionStale = false; };

    el('detailResummarize').onclick = async () => {
      if (!state.detailId) return;
      el('detailSummary').innerHTML = '<div class="muted">Re-summarizing…</div>';
      const r = await window.debrief.summary.regenerate(state.detailId, el('detailPrompt').value || '');
      if (r && r.summary) {
        if (state.detailRecord) state.detailRecord.summary = r.summary;
        renderSummary(el('detailSummary'), r.summary);
        toast('Summary updated');
      } else {
        toast('Re-summarize failed' + (r && r.error ? ': ' + r.error : ''));
      }
    };

    el('historyRefresh').onclick = loadHistory;
    el('searchBtn').onclick = runSearch;
    el('askBtn').onclick = runAsk;
    el('historySearch').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } };
    el('folderFilter').onchange = () => { state.folderFilter = el('folderFilter').value; renderFilteredHistory(); };

    // Follow-up email.
    el('draftEmailBtn').onclick = () => showEmailDraft(state.lastSessionId);
    el('detailEmail').onclick = () => showEmailDraft(state.detailId);
    el('emailClose').onclick = closeEmailModal;
    el('emailModal').onclick = (e) => { if (e.target === el('emailModal')) closeEmailModal(); };
    el('emailCopy').onclick = async () => {
      const text = 'Subject: ' + (el('emailSubject').value || '') + '\n\n' + (el('emailBody').value || '');
      try { await navigator.clipboard.writeText(text); toast('Email copied'); } catch (e) { toast('Copy failed'); }
    };
    el('emailExport').onclick = async () => {
      if (!state.emailId) return;
      const r = await window.debrief.email.exportText(state.emailId, el('emailSubject').value || '', el('emailBody').value || '');
      if (r && r.path) toast('Saved: ' + r.path); else toast('Export failed');
    };

    // CRM deal notes.
    el('draftCrmBtn').onclick = () => showCrmNotes(state.lastSessionId);
    el('detailCrm').onclick = () => showCrmNotes(state.detailId);
    el('crmClose').onclick = () => el('crmModal').classList.add('hidden');
    el('crmModal').onclick = (e) => { if (e.target === el('crmModal')) el('crmModal').classList.add('hidden'); };
    el('crmCopy').onclick = async () => {
      try { await navigator.clipboard.writeText(el('crmBody').value || ''); toast('Copied for HubSpot'); }
      catch (e) { toast('Copy failed'); }
    };
    el('crmExport').onclick = async () => {
      if (!state.crmId) return;
      const r = await window.debrief.crm.exportText(state.crmId, el('crmBody').value || '');
      if (r && r.path) toast('Saved: ' + r.path); else toast('Export failed');
    };

    // Detail actions.
    el('detailRename').onclick = async () => {
      if (!state.detailId) return;
      const next = await inputPrompt('Rename meeting', el('detailTitle').textContent || '');
      if (next == null) return;
      const title = next.trim();
      if (!title) return;
      await window.debrief.history.rename(state.detailId, title);
      el('detailTitle').textContent = title;
      toast('Renamed');
    };
    el('detailDelete').onclick = async () => {
      if (!state.detailId) return;
      if (!window.confirm('Delete this meeting permanently?')) return;
      await window.debrief.history.remove(state.detailId);
      state.detailId = null;
      showView('History');
      toast('Deleted');
    };
    el('copyText').onclick = async () => {
      const rec = state.detailRecord;
      if (!rec) return;
      const text = buildPlainExport(rec);
      try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); }
      catch (e) { toast('Copy failed'); }
    };
    el('exportMd').onclick = () => doExport('md');
    el('exportTxt').onclick = () => doExport('txt');

    // Settings handlers.
    el('summaryModel').onchange = async () => {
      const id = el('summaryModel').value;
      await window.debrief.settings.set('summaryModel', id);
      const status = await window.debrief.keys.status();
      updateModelKeyHint(id, status);
    };
    el('defaultTemplate').onchange = async () => {
      const id = el('defaultTemplate').value;
      await window.debrief.settings.set('defaultTemplate', id);
      // Keep the session picker in sync if not mid-capture.
      if (!state.capturing) el('sessTemplate').value = id;
    };
    el('autoStart').onchange = () => window.debrief.settings.set('autoStart', el('autoStart').checked);
    el('splitSpeakers').onchange = () => window.debrief.settings.set('splitSpeakers', el('splitSpeakers').checked);
    el('voiceId').onchange = () => { const c = el('voiceId').checked; window.debrief.settings.set('voiceId', c); state.voiceId = c; };

    el('saveGlossary').onclick = saveGlossary;
    el('glossary').onblur = saveGlossary; // also persist if they click away

    document.querySelectorAll('.keysave').forEach((btn) => {
      btn.onclick = async () => {
        const prov = btn.getAttribute('data-prov');
        const input = el('key' + prov.charAt(0).toUpperCase() + prov.slice(1));
        const val = (input.value || '').trim();
        if (!val) { toast('Paste a key first'); return; }
        const r = await window.debrief.keys.set(prov, val);
        input.value = '';
        if (r && r.ok === false) { toast('Could not save key'); return; }
        const status = await window.debrief.keys.status();
        applyKeyStatus(status);
        updateModelKeyHint(el('summaryModel').value, status);
        toast(prov + ' key saved');
      };
    });

    el('applyTranscription').onclick = async () => {
      const name = el('transcriptionModel').value;
      if (name === state.transcriptionModel) { toast('Already using ' + name); return; }
      el('transcriptionHint').textContent = 'Switching to ' + name + ' (downloading if needed)…';
      const r = await window.debrief.engine.setModel(name);
      if (r && r.ok) {
        state.transcriptionModel = name;
        el('transcriptionHint').textContent = 'Now transcribing with ' + name + '.';
        refreshEngine();
        toast('Transcription model: ' + name);
      } else {
        el('transcriptionHint').textContent = 'Failed: ' + ((r && r.error) || 'unknown error');
      }
    };

    window.debrief.onMeetingDetected((payload) => {
      if (state.capturing) return;
      if (payload && payload.autoStart) startCapture(payload.source);
      else toast((payload && payload.source ? payload.source : 'Meeting') + ' detected — press Start to capture');
    });
    window.debrief.onMeetingEnded(() => {});
  }

  function buildPlainExport(rec) {
    const lines = [];
    lines.push(rec.title || 'Meeting');
    lines.push('');
    const s = rec.summary || {};
    lines.push('SUMMARY');
    (s.notes || []).forEach((n) => lines.push('- ' + n));
    if (s.decisions && s.decisions.length) { lines.push(''); lines.push('Decisions'); s.decisions.forEach((d) => lines.push('- ' + d)); }
    if (s.actions && s.actions.length) { lines.push(''); lines.push('Action items'); s.actions.forEach((a) => lines.push('- ' + a.text + (a.owner ? ' (' + a.owner + ')' : ''))); }
    lines.push(''); lines.push('TRANSCRIPT');
    (rec.entries || []).slice().sort((a, b) => a.t - b.t).forEach((e) => lines.push(e.speaker + ' [' + fmt(e.t) + ']: ' + e.text));
    return lines.join('\n');
  }
  async function doExport(format) {
    if (!state.detailId) return;
    const r = await window.debrief.history.exportText(state.detailId, 'both', format);
    if (r && r.path) toast('Exported: ' + r.path);
    else toast('Export failed');
  }

  // ---------- init ----------
  (async function init() {
    wire();
    await loadCatalogAndSettings();
    await refreshPermissionChips();
    await refreshEngine();
    const poll = setInterval(async () => {
      const st = await refreshEngine();
      if (st.ready || !st.installed) clearInterval(poll);
    }, 1500);
  })();
})();
