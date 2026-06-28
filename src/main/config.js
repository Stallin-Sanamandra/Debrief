'use strict';

// Central configuration + path resolution (dev vs. packaged).
const path = require('path');
const os = require('os');
const { app } = require('electron');

const isPackaged = app.isPackaged;

// In dev, the whisper binary + model live under vendor/ (built by scripts/setup-whisper.sh).
// In a packaged build they are copied to Resources/whisper/ via electron-builder extraResources.
function whisperPaths() {
  if (isPackaged) {
    const base = path.join(process.resourcesPath, 'whisper');
    return {
      server: path.join(base, 'whisper-server'),
      model: path.join(base, 'ggml-small.en.bin')
    };
  }
  const repo = path.join(app.getAppPath(), 'vendor', 'whisper.cpp');
  return {
    server: path.join(repo, 'build', 'bin', 'whisper-server'),
    model: path.join(repo, 'models', 'ggml-small.en.bin')
  };
}

module.exports = {
  isPackaged,
  whisper: whisperPaths(),

  // Local whisper-server (loopback only — never bound to a public interface).
  server: {
    host: '127.0.0.1',
    port: 8178,
    threads: 4,
    language: 'en',
    startupTimeoutMs: 30000
  },

  // Chunking. Audio is captured at 16 kHz mono in the renderer.
  audio: {
    sampleRate: 16000,
    windowSeconds: 7, // length of each transcription window (renderer is source of truth)
    overlapSeconds: 1.2, // re-sent at the head of the next window so boundary words aren't lost
    silenceRms: 0.004 // windows quieter than this are skipped (saves GPU)
  },

  // Where finished session transcripts are written.
  outputDir: path.join(app.getPath('documents'), 'Debrief Sessions'),

  // Persisted user settings file.
  settingsPath: path.join(app.getPath('userData'), 'settings.json'),

  defaults: {
    // Meeting auto-detect is OFF by default — no background polling, notifications,
    // or auto-start until the user opts in.
    autoStart: false,
    detectMeetings: false,
    detectMeetInBrowser: false,
    // Phase 1: summary model + meeting template + transcription model.
    summaryModel: 'claude-sonnet', // id from src/shared/models.js; no key -> heuristic fallback
    defaultTemplate: 'general', // id from src/shared/templates.js
    transcriptionModel: 'small.en', // small.en bundled; base.en/medium.en download on demand
    glossary: '', // domain terms / name aliases; correction pass on transcript + summary
    // Remembered speaker names — used only as RENAME SUGGESTIONS, never auto-applied to a new
    // meeting (auto-applying mislabels). Honest default is Me / Others until you rename.
    speakerNames: { me: 'Me', others1: 'Others', others2: 'Others 2' },
    // Best-effort pitch-based Others 1/2 split. Off by default: it tends to split one voice
    // into two. Real separation comes from voice fingerprinting; this stays opt-in.
    splitSpeakers: false,
    // Voice fingerprinting (experimental, fully local). When on, naming a speaker enrols their
    // voice, and at stop other speakers are labelled by matching their voice. Off by default.
    voiceId: false
  },

  hostname: os.hostname()
};
