#!/bin/zsh
# Repackages Debrief.app + .dmg (node_modules already healthy). Logs to build.log.
cd "$(dirname "$0")" || exit 1
[ -f "$HOME/.zprofile" ] && source "$HOME/.zprofile" 2>/dev/null
[ -f "$HOME/.zshrc" ]   && source "$HOME/.zshrc"   2>/dev/null
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

LOG="build.log"
echo "==> dist start $(date)" > "$LOG"

pkill -if "electron-builder" 2>/dev/null
pkill -if "app-builder"     2>/dev/null
sleep 1

echo "==> npm install (idempotent) $(date)" >> "$LOG"
npm install >> "$LOG" 2>&1
echo "==> npm install EXIT=$?" >> "$LOG"

echo "==> ensure stable signing identity $(date)" >> "$LOG"
bash scripts/create-signing-identity.sh >> "$LOG" 2>&1
echo "==> identity step EXIT=$?" >> "$LOG"

echo "==> npm run dist $(date)" >> "$LOG"
npm run dist >> "$LOG" 2>&1
echo "==> dist EXIT=$?" >> "$LOG"
echo "==> end $(date)" >> "$LOG"

echo "Build finished. See build.log in the Debrief folder."
echo "(Press Enter to close.)"
read -r _
