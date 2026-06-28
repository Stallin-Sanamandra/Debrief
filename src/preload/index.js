'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('debrief', {
  permissions: {
    snapshot: () => ipcRenderer.invoke('permissions:snapshot'),
    ensureMic: () => ipcRenderer.invoke('permissions:ensureMic'),
    openScreen: () => ipcRenderer.invoke('permissions:openScreen'),
    openMic: () => ipcRenderer.invoke('permissions:openMic')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value)
  },
  catalog: {
    get: () => ipcRenderer.invoke('catalog:get')
  },
  keys: {
    status: () => ipcRenderer.invoke('keys:status'),
    set: (provider, value) => ipcRenderer.invoke('keys:set', provider, value)
  },
  engine: {
    status: () => ipcRenderer.invoke('whisper:status'),
    ensure: () => ipcRenderer.invoke('engine:ensure'),
    models: () => ipcRenderer.invoke('whisper:models'),
    setModel: (name) => ipcRenderer.invoke('whisper:setModel', name)
  },
  session: {
    start: (meta) => ipcRenderer.invoke('session:start', meta),
    stop: (customPrompt) => ipcRenderer.invoke('session:stop', customPrompt),
    updateNotes: (text) => ipcRenderer.invoke('notes:update', text)
  },
  summary: {
    regenerate: (id, customPrompt) => ipcRenderer.invoke('summary:regenerate', id, customPrompt)
  },
  history: {
    list: () => ipcRenderer.invoke('history:list'),
    get: (id) => ipcRenderer.invoke('history:get', id),
    rename: (id, title) => ipcRenderer.invoke('history:rename', id, title),
    remove: (id) => ipcRenderer.invoke('history:delete', id),
    exportText: (id, what, format) => ipcRenderer.invoke('history:export', id, what, format),
    setTags: (id, tags) => ipcRenderer.invoke('history:setTags', id, tags),
    setFolder: (id, folder) => ipcRenderer.invoke('history:setFolder', id, folder)
  },
  email: {
    draft: (id) => ipcRenderer.invoke('email:draft', id),
    exportText: (id, subject, body) => ipcRenderer.invoke('email:export', id, subject, body)
  },
  crm: {
    draft: (id) => ipcRenderer.invoke('crm:draft', id),
    exportText: (id, text) => ipcRenderer.invoke('crm:export', id, text)
  },
  actions: {
    list: () => ipcRenderer.invoke('actions:list'),
    setDone: (key, done) => ipcRenderer.invoke('actions:set', key, done)
  },
  search: {
    query: (text) => ipcRenderer.invoke('search:query', text),
    ask: (text) => ipcRenderer.invoke('ask:query', text)
  },
  brief: {
    lookup: (names, excludeId) => ipcRenderer.invoke('brief:lookup', names, excludeId)
  },
  voiceprints: {
    list: () => ipcRenderer.invoke('voiceprints:list'),
    remove: (name) => ipcRenderer.invoke('voiceprints:remove', name)
  },
  speakers: {
    rename: (id, slot, name) => ipcRenderer.invoke('speaker:rename', id, slot, name),
    reassign: (id, index, slot) => ipcRenderer.invoke('speaker:reassign', id, index, slot),
    reassignFrom: (id, fromT, slot) => ipcRenderer.invoke('speaker:reassignFrom', id, fromT, slot),
    renameLive: (slot, name) => ipcRenderer.invoke('speaker:renameLive', slot, name)
  },
  // Send a 16 kHz mono WAV window for a speaker; resolves with { delta, speaker, t }.
  transcribe: (arrayBuffer, meta) => ipcRenderer.invoke('whisper:chunk', arrayBuffer, meta),

  onMeetingDetected: (cb) => ipcRenderer.on('meeting:detected', (_e, payload) => cb(payload)),
  onMeetingEnded: (cb) => ipcRenderer.on('meeting:ended', () => cb())
});
