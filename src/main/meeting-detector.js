'use strict';

// Detects active meetings so Debrief can offer one-tap (or hands-free) capture.
// Zoom and Teams are native apps detected by process name. Google Meet runs in a
// browser tab, detected best-effort via AppleScript tab/title scan (degrades silently
// if Automation permission is not granted).
const { execFile } = require('child_process');
const { EventEmitter } = require('events');
const settings = require('./settings');

const NATIVE_MATCHERS = [
  { app: 'Zoom', re: /(^|\/)zoom\.us($|\s)|CptHost|zoom\.us/i },
  { app: 'Microsoft Teams', re: /MSTeams|Microsoft Teams|Teams\.app/i }
];

function ps() {
  return new Promise((resolve) => {
    execFile('ps', ['-Axo', 'comm'], (err, stdout) => resolve(err ? '' : stdout));
  });
}

// Browsers we know how to query for a Google Meet tab, matched against `ps` output.
// We only ever AppleScript a browser that is ACTUALLY RUNNING — referencing an
// uninstalled app by name (e.g. "Arc") would pop a macOS "Where is <app>?" picker.
const MEET_BROWSERS = [
  { name: 'Google Chrome', re: /Google Chrome(\.app)?\//i },
  { name: 'Brave Browser', re: /Brave Browser(\.app)?\//i },
  { name: 'Microsoft Edge', re: /Microsoft Edge(\.app)?\//i },
  { name: 'Arc', re: /\/Arc(\.app)?\//i },
  { name: 'Comet', re: /\/Comet(\.app)?\//i }
];

// Best-effort Google Meet detection: only scripts browsers present in `psOutput`.
function meetInRunningBrowsers(psOutput) {
  const running = MEET_BROWSERS.filter((b) => b.re.test(psOutput)).map((b) => b.name);
  if (!running.length) return Promise.resolve(false);
  const appList = running.map((n) => '"' + n + '"').join(', ');
  const script =
    'set found to false\n' +
    'repeat with appName in {' + appList + '}\n' +
    '  try\n' +
    '    tell application appName\n' +
    '      repeat with w in windows\n' +
    '        repeat with t in tabs of w\n' +
    '          if (URL of t) contains "meet.google.com/" then set found to true\n' +
    '        end repeat\n' +
    '      end repeat\n' +
    '    end tell\n' +
    '  end try\n' +
    'end repeat\n' +
    'return found';
  return new Promise((resolve) => {
    execFile('osascript', ['-e', script], (err, stdout) => resolve(!err && String(stdout).trim() === 'true'));
  });
}

class MeetingDetector extends EventEmitter {
  constructor() {
    super();
    this.timer = null;
    this.current = null; // app name currently detected, or null
    this.intervalMs = 4000;
  }

  async _scan() {
    if (!settings.get('detectMeetings')) return;
    let detected = null;

    const procs = await ps();
    for (const m of NATIVE_MATCHERS) {
      if (m.re.test(procs)) {
        detected = m.app;
        break;
      }
    }
    if (!detected && settings.get('detectMeetInBrowser') && process.platform === 'darwin') {
      if (await meetInRunningBrowsers(procs)) detected = 'Google Meet';
    }

    if (detected && detected !== this.current) {
      this.current = detected;
      this.emit('detected', detected);
    } else if (!detected && this.current) {
      this.current = null;
      this.emit('ended');
    }
  }

  start() {
    if (this.timer) return;
    this._scan().catch(() => {});
    this.timer = setInterval(() => this._scan().catch(() => {}), this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = new MeetingDetector();
