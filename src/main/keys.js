'use strict';

// Secure API-key storage using Electron safeStorage (OS keychain-backed).
// The renderer never receives raw key values — only set() and status() booleans.
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

// In-memory cache of decrypted keys for this app run. Decrypting via safeStorage hits the
// OS keychain (which can prompt), so we unlock each provider at most once per launch.
const mem = {};

function file() {
  return path.join(app.getPath('userData'), 'keys.enc.json');
}
function load() {
  try {
    return JSON.parse(fs.readFileSync(file(), 'utf8'));
  } catch {
    return {};
  }
}
function persist(obj) {
  try {
    fs.writeFileSync(file(), JSON.stringify(obj));
  } catch (err) {
    console.error('[keys] persist failed:', err.message);
  }
}

// provider: 'anthropic' | 'openai' | 'google'. Empty value clears the key.
function setKey(provider, value) {
  const obj = load();
  if (!value) {
    delete obj[provider];
    delete mem[provider];
    persist(obj);
    return { ok: true };
  }
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: 'OS secure storage is unavailable on this machine.' };
  }
  obj[provider] = safeStorage.encryptString(String(value)).toString('base64');
  mem[provider] = String(value); // cache so we never need to decrypt this one again this run
  persist(obj);
  return { ok: true };
}

// Main-process only: decrypt and return the raw key for an API call. Cached in memory
// after the first successful unlock so repeated summaries don't re-prompt the keychain.
function getKey(provider) {
  if (Object.prototype.hasOwnProperty.call(mem, provider)) return mem[provider];
  const enc = load()[provider];
  if (!enc) return null;
  try {
    const val = safeStorage.decryptString(Buffer.from(enc, 'base64'));
    mem[provider] = val;
    return val;
  } catch {
    return null;
  }
}

// Safe for the renderer: which providers have a key set.
function status() {
  const obj = load();
  return { anthropic: !!obj.anthropic, openai: !!obj.openai, google: !!obj.google };
}

module.exports = { setKey, getKey, status };
