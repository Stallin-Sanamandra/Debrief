'use strict';

// Manages a local whisper.cpp `whisper-server` process (model loaded once, kept warm
// on the M1 GPU via Metal) and turns WAV audio chunks into transcript deltas.
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { app } = require('electron');
const config = require('./config');
const settings = require('./settings');
const { mergeTranscript } = require('../shared/dedup');

// Transcription models. small.en is bundled; base.en / medium.en download on demand.
function modelsDir() {
  const d = path.join(app.getPath('userData'), 'whisper-models');
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function modelPath(name) {
  if (name === 'small.en') return config.whisper.model; // bundled in Resources
  return path.join(modelsDir(), `ggml-${name}.bin`);
}

class WhisperEngine {
  constructor() {
    this.proc = null;
    this.ready = false;
    // Separate running transcripts per speaker so de-dup is independent per channel.
    this.transcripts = { Me: '', Others: '' };
    this.baseUrl = `http://${config.server.host}:${config.server.port}`;
  }

  installed() {
    return fs.existsSync(config.whisper.server) && fs.existsSync(config.whisper.model);
  }

  // Spawn whisper-server bound to loopback only. Resolves once the port accepts a connection.
  async start() {
    if (this.proc) return;
    if (!this.installed()) {
      const err = new Error('whisper-server or model not found. Run: npm run setup:whisper');
      err.code = 'WHISPER_NOT_INSTALLED';
      throw err;
    }

    const wantName = settings.get('transcriptionModel') || 'small.en';
    let modelFile = modelPath(wantName);
    if (!fs.existsSync(modelFile)) modelFile = config.whisper.model; // fall back to bundled small.en
    const args = [
      '--host', config.server.host,
      '--port', String(config.server.port),
      '-m', modelFile,
      '-t', String(config.server.threads),
      '-l', config.server.language,
      '--no-timestamps'
    ];

    this.proc = spawn(config.whisper.server, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.proc.stdout.on('data', (d) => console.log('[whisper]', d.toString().trim()));
    this.proc.stderr.on('data', (d) => console.log('[whisper]', d.toString().trim()));
    this.proc.on('exit', (code) => {
      console.log('[whisper] server exited', code);
      this.proc = null;
      this.ready = false;
    });

    await this._waitForPort(config.server.startupTimeoutMs);
    this.ready = true;
  }

  _waitForPort(timeoutMs) {
    const start = Date.now();
    const { host, port } = config.server;
    return new Promise((resolve, reject) => {
      const tryConnect = () => {
        const socket = net.createConnection({ host, port });
        socket.once('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.once('error', () => {
          socket.destroy();
          if (Date.now() - start > timeoutMs) {
            reject(new Error('whisper-server did not become ready in time'));
          } else {
            setTimeout(tryConnect, 300);
          }
        });
      };
      tryConnect();
    });
  }

  resetTranscripts() {
    this.transcripts = { Me: '', Others: '' };
  }

  // Send one WAV segment (Node Buffer / ArrayBuffer) for a given speaker ('Me' | 'Others')
  // to /inference. `continued` = true means this segment overlaps the previous one (a forced
  // cut mid-monologue), so we de-dup the overlap; otherwise the segment is silence-separated
  // and is appended verbatim (no overlap trimming, which avoids dropping repeated short words).
  // Returns { delta, speaker, text } — delta is the text to append to the UI.
  async transcribeChunk(wav, speaker, continued) {
    if (!this.ready) throw new Error('whisper engine not ready');
    const bytes = wav instanceof Buffer ? wav : Buffer.from(wav);
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'audio/wav' }), 'chunk.wav');
    form.append('response_format', 'json');
    form.append('temperature', '0.0');

    const res = await fetch(`${this.baseUrl}/inference`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`whisper-server ${res.status}`);
    const data = await res.json();
    const text = (data.text || '').trim();
    const key = speaker === 'Me' ? 'Me' : 'Others';
    if (!text) return { delta: '', speaker: key, text: '' };

    if (continued) {
      const { delta, merged } = mergeTranscript(this.transcripts[key], text);
      this.transcripts[key] = merged;
      return { delta, speaker: key, text };
    }
    const sep = this.transcripts[key] ? ' ' : '';
    this.transcripts[key] = (this.transcripts[key] + sep + text).trim();
    return { delta: text, speaker: key, text };
  }

  // Download base.en / medium.en into userData on demand (small.en is bundled).
  async ensureModel(name) {
    if (name === 'small.en') return true;
    const dest = modelPath(name);
    if (fs.existsSync(dest)) return true;
    const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${name}.bin`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`model download failed (${res.status})`);
    const { Readable } = require('stream');
    const tmp = dest + '.part';
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(tmp);
      Readable.fromWeb(res.body).pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
    });
    fs.renameSync(tmp, dest);
    return true;
  }

  // Switch transcription model: download if needed, persist choice, restart the server.
  async setModel(name) {
    if (!['small.en', 'base.en', 'medium.en'].includes(name)) name = 'small.en';
    await this.ensureModel(name);
    settings.set('transcriptionModel', name);
    if (this.proc) {
      this.proc.kill('SIGTERM');
      this.proc = null;
      this.ready = false;
      await new Promise((r) => setTimeout(r, 500));
    }
    await this.start();
    return { ok: true, model: name };
  }

  modelStatus() {
    return {
      current: settings.get('transcriptionModel') || 'small.en',
      available: {
        'small.en': true,
        'base.en': fs.existsSync(modelPath('base.en')),
        'medium.en': fs.existsSync(modelPath('medium.en'))
      }
    };
  }

  stop() {
    if (this.proc) {
      this.proc.kill('SIGTERM');
      this.proc = null;
    }
    this.ready = false;
  }
}

module.exports = new WhisperEngine();
