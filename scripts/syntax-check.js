'use strict';

// Parses every project .js file with `node --check` (parse only, no execution),
// so we can validate syntax without an Electron runtime.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = ['src', 'scripts', 'test', 'build'];
let checked = 0;
let failed = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) check(full);
  }
}

function check(file) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    checked++;
  } catch (err) {
    failed++;
    console.error('SYNTAX ERROR:', path.relative(ROOT, file));
    console.error((err.stderr || err.message).toString().trim());
  }
}

for (const d of DIRS) {
  const full = path.join(ROOT, d);
  if (fs.existsSync(full)) walk(full);
}

console.log(`syntax-check: ${checked} file(s) OK, ${failed} failed`);
process.exit(failed ? 1 : 0);
