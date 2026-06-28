#!/bin/zsh
# Debrief on-device test launcher (macOS).
cd "$(dirname "$0")" || exit 1
[ -f "$HOME/.zprofile" ] && source "$HOME/.zprofile" 2>/dev/null
[ -f "$HOME/.zshrc" ]   && source "$HOME/.zshrc"   2>/dev/null
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
PYUSERBIN="$(python3 -c 'import site,os;print(os.path.join(site.getuserbase(),"bin"))' 2>/dev/null)"
[ -n "$PYUSERBIN" ] && export PATH="$PATH:$PYUSERBIN"

# Stop any previous Debrief instance + its whisper-server (avoids a second window
# and a port-8178 conflict). Patterns are specific to this project, not other apps.
pkill -if "Claude/Projects/Debrief/node_modules/electron" 2>/dev/null
pkill -if "whisper-server" 2>/dev/null
sleep 1

echo "==> Debrief launcher"; echo "    folder: $(pwd)"
command -v node >/dev/null 2>&1 || { echo "ERROR: node not found."; read -r _; exit 1; }
echo "    node: $(node -v)"

echo "==> npm install (idempotent)"
npm install || { echo "npm install failed."; read -r _; exit 1; }

if [ ! -f vendor/whisper.cpp/models/ggml-small.en.bin ] || [ ! -x vendor/whisper.cpp/build/bin/whisper-server ]; then
  if ! command -v cmake >/dev/null 2>&1; then
    echo "==> installing cmake via pip (no admin needed)"
    pip3 install --user --upgrade cmake || pip3 install --user --break-system-packages --upgrade cmake || { echo "pip cmake install failed."; read -r _; exit 1; }
    export PATH="$PATH:$PYUSERBIN"
  fi
  echo "    cmake: $(cmake --version | head -1)"
  echo "==> Building whisper.cpp + downloading small.en (first run only)"
  npm run setup:whisper || { echo "setup:whisper failed."; read -r _; exit 1; }
else
  echo "==> whisper.cpp ready, skipping setup"
fi

echo "==> Launching Debrief (npm start)"
npm start
