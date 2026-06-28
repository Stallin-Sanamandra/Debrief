#!/bin/zsh
# Installs the built Debrief.app to /Applications, clears quarantine, and launches it.
cd "$(dirname "$0")" || exit 1
APP="dist/mac-arm64/Debrief.app"
DMG="$(ls -1 dist/*.dmg 2>/dev/null | head -1)"

if [ ! -d "$APP" ]; then
  echo "ERROR: $APP not found. Run package-debrief.command first."
  read -r _; exit 1
fi

echo "==> Stopping any running Debrief / dev instance / whisper-server"
pkill -if "/Applications/Debrief.app/Contents/MacOS/Debrief" 2>/dev/null
pkill -if "Claude/Projects/Debrief/node_modules/electron" 2>/dev/null  # dev (npm start) instance
pkill -if "whisper-server" 2>/dev/null
sleep 1

echo "==> Installing to /Applications"
rm -rf "/Applications/Debrief.app" 2>/dev/null
if ! cp -R "$APP" /Applications/ 2>/dev/null; then
  echo "cp to /Applications failed (permissions). Installing to ~/Applications instead."
  mkdir -p "$HOME/Applications"
  rm -rf "$HOME/Applications/Debrief.app"
  cp -R "$APP" "$HOME/Applications/" || { echo "install failed."; read -r _; exit 1; }
  TARGET="$HOME/Applications/Debrief.app"
else
  TARGET="/Applications/Debrief.app"
fi

echo "==> Clearing quarantine (xattr -cr)"
xattr -cr "$TARGET"

echo "==> Launching $TARGET"
open "$TARGET"

echo
echo "Installed: $TARGET"
echo "DMG:       $DMG"
echo "(Press Enter to close.)"
read -r _
