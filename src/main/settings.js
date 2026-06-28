'use strict';

// Tiny JSON-backed settings store (avoids an extra dependency).
const fs = require('fs');
const config = require('./config');

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = Object.assign({}, config.defaults, JSON.parse(fs.readFileSync(config.settingsPath, 'utf8')));
  } catch {
    cache = Object.assign({}, config.defaults);
  }
  return cache;
}

function get(key) {
  return load()[key];
}

function set(key, value) {
  const s = load();
  s[key] = value;
  try {
    fs.writeFileSync(config.settingsPath, JSON.stringify(s, null, 2));
  } catch (err) {
    console.error('[settings] failed to persist:', err.message);
  }
  return s;
}

module.exports = { load, get, set };
