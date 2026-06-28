'use strict';

// electron-builder afterPack hook (macOS).
// Signs the bundled whisper-server and the whole .app. It prefers a STABLE self-signed
// identity ("Debrief Local Signing", created by scripts/create-signing-identity.sh) so the
// signature — and therefore macOS TCC grants like Screen Recording — stays constant across
// rebuilds. If that identity isn't installed, it falls back to ad-hoc (`-`), which still
// runs on Apple Silicon but resets permissions on every rebuild.
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const IDENTITY = process.env.DEBRIEF_SIGN_IDENTITY || 'Debrief Local Signing';

function resolveIdentity() {
  try {
    const out = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' });
    if (out.includes(IDENTITY)) return IDENTITY;
  } catch (_) {
    /* security unavailable — fall through to ad-hoc */
  }
  return '-';
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const productName = context.packager.appInfo.productFilename; // "Debrief"
  const appPath = path.join(context.appOutDir, `${productName}.app`);
  const binPath = path.join(appPath, 'Contents', 'Resources', 'whisper', 'whisper-server');

  const signId = resolveIdentity();
  const label = signId === '-' ? 'ad-hoc (resets grants on rebuild)' : `"${signId}" (stable)`;
  console.log(`[afterPack] signing with ${label}`);

  function sign(target, extraArgs = []) {
    execFileSync('codesign', ['--force', '--sign', signId, '--timestamp=none', ...extraArgs, target], {
      stdio: 'inherit'
    });
  }

  // Bundled whisper-server first (it lives in Resources, which a deep app sign won't reach).
  if (fs.existsSync(binPath)) {
    fs.chmodSync(binPath, 0o755);
    try {
      sign(binPath);
      console.log('[afterPack] signed whisper-server');
    } catch (err) {
      console.error('[afterPack] failed to sign whisper-server:', err.message);
    }
  } else {
    console.warn('[afterPack] whisper-server not found at', binPath);
  }

  // Then the whole app (deep re-seals Electron Frameworks/Helpers).
  try {
    sign(appPath, ['--deep']);
    console.log('[afterPack] signed', `${productName}.app`);
  } catch (err) {
    console.error('[afterPack] failed to sign app:', err.message);
  }
};
