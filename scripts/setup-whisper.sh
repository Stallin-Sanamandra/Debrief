#!/usr/bin/env bash
# Builds whisper.cpp with Metal (Apple Silicon) and downloads the small.en model.
# Everything stays under vendor/ and is git-ignored. Fully local — no API keys.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor"
REPO="$VENDOR/whisper.cpp"
MODEL="small.en"

echo "==> Debrief whisper setup"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Warning: this build targets macOS/Metal. Continuing, but GPU acceleration needs Apple Silicon." >&2
fi

for bin in git cmake; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "Error: '$bin' is required but not installed." >&2
    [[ "$bin" == "cmake" ]] && echo "Install with: brew install cmake" >&2
    exit 1
  fi
done

mkdir -p "$VENDOR"

if [[ ! -d "$REPO/.git" ]]; then
  echo "==> Cloning whisper.cpp"
  git clone --depth 1 https://github.com/ggml-org/whisper.cpp "$REPO"
else
  echo "==> Updating whisper.cpp"
  git -C "$REPO" pull --ff-only || true
fi

cd "$REPO"

# Static, self-contained build: whisper-server links the ggml/whisper libs
# statically (no .dylib siblings) and embeds the Metal shader library, so the
# single binary can be bundled into the packaged app and run with no extra files.
echo "==> Configuring (Metal ON, static / self-contained)"
rm -rf build   # clean, so we never mix a previous shared-lib configuration
cmake -B build \
  -DCMAKE_BUILD_TYPE=Release \
  -DGGML_METAL=ON \
  -DGGML_METAL_EMBED_LIBRARY=ON \
  -DBUILD_SHARED_LIBS=OFF \
  -DWHISPER_BUILD_EXAMPLES=ON

echo "==> Building whisper-server (static)"
cmake --build build -j --config Release --target whisper-server

# Sanity: warn if the binary still links project dylibs (it shouldn't, when static).
if command -v otool >/dev/null 2>&1; then
  if otool -L "build/bin/whisper-server" | grep -E "lib(ggml|whisper)" >/dev/null 2>&1; then
    echo "Warning: whisper-server still links ggml/whisper dylibs — bundling may need those too." >&2
  else
    echo "==> whisper-server is self-contained (no ggml/whisper dylib deps)."
  fi
fi

echo "==> Downloading model: $MODEL"
sh ./models/download-ggml-model.sh "$MODEL"

SERVER="$REPO/build/bin/whisper-server"
MODEL_BIN="$REPO/models/ggml-$MODEL.bin"

if [[ -x "$SERVER" && -f "$MODEL_BIN" ]]; then
  echo "==> Done."
  echo "    server: $SERVER"
  echo "    model:  $MODEL_BIN"
else
  echo "Error: build finished but expected outputs are missing." >&2
  echo "  looked for: $SERVER" >&2
  echo "  looked for: $MODEL_BIN" >&2
  exit 1
fi
