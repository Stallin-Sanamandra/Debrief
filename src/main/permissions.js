'use strict';

// macOS permission helpers. Microphone uses getUserMedia (prompted in the renderer,
// described by NSMicrophoneUsageDescription). Screen Recording is required for
// system-audio loopback via desktopCapturer and is granted in System Settings.
const { systemPreferences, shell } = require('electron');

function isMac() {
  return process.platform === 'darwin';
}

async function ensureMicrophone() {
  if (!isMac()) return true;
  const status = systemPreferences.getMediaAccessStatus('microphone');
  if (status === 'granted') return true;
  // Triggers the system prompt the first time (backed by NSMicrophoneUsageDescription).
  try {
    return await systemPreferences.askForMediaAccess('microphone');
  } catch {
    return false;
  }
}

// Screen Recording cannot be requested programmatically; we can only read status
// and send the user to the right System Settings pane.
function screenStatus() {
  if (!isMac()) return 'granted';
  return systemPreferences.getMediaAccessStatus('screen'); // 'granted' | 'denied' | 'restricted' | 'not-determined'
}

function openScreenRecordingSettings() {
  return shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
  );
}

function openMicrophoneSettings() {
  return shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
  );
}

async function snapshot() {
  return {
    platform: process.platform,
    microphone: isMac() ? systemPreferences.getMediaAccessStatus('microphone') : 'granted',
    screen: screenStatus()
  };
}

module.exports = {
  ensureMicrophone,
  screenStatus,
  openScreenRecordingSettings,
  openMicrophoneSettings,
  snapshot
};
