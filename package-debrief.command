#!/bin/zsh
# Builds Debrief.app + Debrief.dmg (unsigned, fully bundled). macOS arm64.
cd "$(dirname "$0")" || exit 1
[ -f "$HOME/.zprofile" ] && source "$HOME/.zprofile" 2>/dev/null
[ -f "$HOME/.zshrc" ]   && source "$HOME/.zshrc"   2>/dev/null
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
PYUSERBIN="$(python3 -c 'import site,os;print(os.path.join(site.getuserbase(),"bin"))' 2>/dev/null)"
[ -n "$PYUSERBIN" ] && export PATH="$PATH:$PYUSERBIN"

echo "==> Debrief packager"; echo "    folder: $(pwd)"
command -v node  >/dev/null 2>&1 || { echo "ERROR: node not found."; read -r _; exit 1; }
echo "    node: $(node -v)"
command -v cmake >/dev/null 2>&1 || { echo "ERROR: cmake not found (needed to rebuild whisper). Run start-debrief.command once first."; read -r _; exit 1; }

echo "==> npm install (idempotent)"
npm install || { echo "npm install failed."; read -r _; exit 1; }

echo "==> Rebuilding whisper-server as a self-contained static binary (a few minutes)"
npm run setup:whisper || { echo "setup:whisper failed."; read -r _; exit 1; }

echo "==> Building Debrief.app + Debrief.dmg (electron-builder, unsigned, arm64)"
npm run dist || { echo "electron-builder failed."; read -r _; exit 1; }

echo
echo "==> Build complete. Artifacts:"
ls -1 dist/*.dmg 2>/dev/null
ls -1d dist/mac-arm64/Debrief.app 2>/dev/null
echo
echo "Next: run install-debrief.command to copy to /Applications, clear quarantine, and open."
echo "(Press Enter to close.)"
read -r _
