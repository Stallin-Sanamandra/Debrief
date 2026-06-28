# Debrief

**Local-first meeting notes for macOS.** Debrief captures your microphone and the other participants' system audio, transcribes everything **on-device** with Whisper on the Apple Silicon GPU, and turns each meeting into a clean, speaker-labelled transcript with an optional AI summary, action items, follow-up email, and CRM notes.

> ⚠️ **Early personal project, shared for feedback.** This is something I built for my own meetings and am opening up so others can try it and tell me what breaks or what's missing. It is unsigned, Apple-Silicon-only, and rough in places. Please report bugs and ideas in [GitHub Issues](https://github.com/Stallin-Sanamandra/Debrief/issues).

---

## What it does

- **On-device transcription** — mic + system (loopback) audio, transcribed locally by [whisper.cpp](https://github.com/ggerganov/whisper.cpp) running on Metal. Nothing about transcription touches the network.
- **Speaker labels you control** — your mic is *Me* and system audio is *Others*; you rename or reassign speakers (e.g. "Marcio", "Kirti") live during the meeting or afterwards, including a "relabel everything from here down" option, and names are remembered for next time. An optional, **experimental** voice-matching mode can attempt to tell multiple remote speakers apart — it is off by default and best-effort.
- **AI summary (optional, bring your own key)** — on stop, Debrief can write notes, decisions, and action items with owners. You choose the model (Anthropic, OpenAI, or Google); if you don't add a key it falls back to a basic local keyword summary with no network call.
- **More per meeting** — talk-time analytics (your share, longest monologue, questions asked), meeting templates plus a one-off custom summary instruction, a one-click follow-up email draft, CRM-ready deal notes (Company / Attendees / Pain / Budget / Timeline / Competitors / Next step), and a custom vocabulary so domain terms and names transcribe correctly.
- **Search & Ask across meetings** — full-text search over every saved meeting, plus an *Ask* box that answers questions using your past transcripts as context (uses your chosen model when a key is set; otherwise local keyword results).
- **Returning-attendee briefs** — when someone you've met before is named in a meeting, Debrief surfaces a quick, collapsible brief of your earlier conversations with them.
- **History, folders & tags** — every meeting is saved locally and can be organized into folders and tags, with copy and Markdown/plain-text export, plus a cross-meeting list of open action items.

## Privacy model (read this)

- **Transcription is always 100% local.** The Whisper server is bound to `127.0.0.1` only; audio and transcripts never leave your Mac.
- **AI summaries and Ask are opt-in and bring-your-own-key.** Only if you add an API key and pick a cloud model does Debrief send **transcript text and your typed notes** to that provider (Anthropic, OpenAI, or Google) — to generate a summary/email/CRM notes, or to answer a cross-meeting *Ask* question using the relevant transcript sections as context. Audio is never sent.
- **With no key, nothing leaves the machine** — you get the basic local summary instead.
- **Keys are stored encrypted** in the macOS Keychain via Electron `safeStorage`; they are never written to disk in plaintext and never committed anywhere.

## Requirements

- **macOS 13 (Ventura) or newer, on Apple Silicon (M1 or later).** Intel Macs are not supported.
- For building from source: Node.js 18+, plus `cmake` and `git` (`brew install cmake git`).

---

## Install (the easy way — prebuilt DMG)

1. Download `Debrief-1.0.0-arm64.dmg` from the [latest Release](https://github.com/Stallin-Sanamandra/Debrief/releases/latest).
2. Open the DMG and drag **Debrief** to **Applications**.
3. **Because the app is unsigned**, macOS Gatekeeper will block it the first time. You'll see either *"Debrief is damaged and can't be opened"* or *"can't be opened because Apple cannot check it for malicious software."* Clear the quarantine flag once, in Terminal:

   ```bash
   xattr -cr /Applications/Debrief.app
   ```

4. Open **Debrief**. On your first capture macOS will ask for permissions:
   - **Microphone** — approve the prompt.
   - **Screen Recording** — required to capture the other participants' audio. Enable Debrief under **System Settings ▸ Privacy & Security ▸ Screen Recording**, then **quit and reopen** Debrief so the grant takes effect.

The Whisper engine and the `ggml-small.en` model (~466 MB) are bundled inside the app, so there's no extra download and transcription works fully offline.

> The app is unsigned because it isn't enrolled in the paid Apple Developer Program. The `xattr -cr` step is the standard workaround. If you'd rather not run it, build from source instead.

## Optional: enable AI summaries

Transcription needs no key. To get AI-written summaries, emails, and CRM notes:

1. Open **Settings** in Debrief.
2. Paste an API key for **Anthropic**, **OpenAI**, or **Google** and click Save (keys are stored encrypted on your Mac).
3. Pick your model in the **Summary model** picker (Claude / GPT / Gemini). Anthropic's Claude is the default.

Without a key, Debrief still summarizes — just with the basic local heuristic, clearly labelled.

---

## Build from source

```bash
git clone https://github.com/Stallin-Sanamandra/Debrief.git
cd Debrief
npm install
npm run setup:whisper   # builds a static, Metal-enabled whisper-server + downloads ggml-small.en (~466 MB) into vendor/
npm start               # run in development
```

In development the app appears as **Electron** in the macOS Privacy lists; a packaged build appears as **Debrief**.

### Package a DMG

```bash
npm run dist            # electron-builder, macOS arm64
```

This produces `dist/mac-arm64/Debrief.app` and `dist/Debrief-1.0.0-arm64.dmg`. The build is unsigned (`identity: null`); an `afterPack` hook ad-hoc-signs the app and the bundled `whisper-server` so it runs on Apple Silicon, and the whisper binary + model are copied into `Contents/Resources/whisper/` so the installed app needs no setup and works offline. For wider distribution you'd add a paid Apple Developer ID and notarize.

### Verify

```bash
npm run check           # node --check on every source file
npm test                # unit tests (WAV, de-dup, VAD, summary, glossary, segmenter, analytics, speakers, etc.)
```

---

## How it works (architecture)

```
  microphone ──getUserMedia (echo-cancelled)──┐
                                              ├─► WebAudio (16 kHz mono) ─► AudioWorklet
  system audio ─getDisplayMedia(loopback)─────┘                                │
                                                              utterance segmenter (endpointing)
                                                                                │  WAV
                                                                                ▼
                                              whisper.cpp whisper-server (model warm on Metal, 127.0.0.1)
                                                                                │  /inference
                                                                                ▼
                            de-dup ─► speaker-labelled transcript ─► local session store ─► optional AI summary (BYO key)
```

Mic and system audio are kept as **separate channels** so each utterance can be labelled and split by speaker. Audio is segmented on natural pauses (not fixed windows) so transcription is responsive and doesn't cut words. A local `whisper-server` stays warm on the GPU. On stop, the transcript is assembled, talk-time is computed, and — if you've opted in — sent to your chosen model for a summary.

## Project layout

```
src/main/       Electron main: window, loopback handler, IPC, whisper + summary + storage
src/preload/    contextBridge API (no Node in the renderer)
src/renderer/   capture/mixing UI, transcript, summary, settings, history (Midnight theme)
src/shared/     pure UMD modules shared with tests (wav, dedup, segmenter, analytics, glossary, speakers, search, ...)
scripts/        setup-whisper.sh, create-signing-identity.sh, syntax-check.js
build/          macOS entitlements + electron-builder afterPack signing hook
test/           unit tests for the shared modules
```

## Known limitations

- **Apple Silicon only.** The capture path relies on macOS ScreenCaptureKit loopback; there is no Intel or Windows/Linux build.
- **Unsigned.** Requires the one-time `xattr -cr` step above.
- **Electron is pinned to the 33.x line** on purpose — Chromium changed the default macOS desktop-audio path around Electron v39, which breaks the loopback approach this app uses.
- **Automatic speaker splitting is experimental and off by default.** The reliable path is the built-in rename/reassign (live or after the meeting), which applies across the transcript and is remembered next time.
- On laptop speakers some echo bleed between channels can remain — using headphones or macOS **Voice Isolation** helps; manual relabel covers the rest.

## Feedback & contributing

This is an early project and feedback is very welcome. Please use **[GitHub Issues](https://github.com/Stallin-Sanamandra/Debrief/issues)** to report bugs or request features. Include your macOS version and Mac model, and steps to reproduce.

## License

[MIT](LICENSE) © 2026 Stallin.

Debrief is not affiliated with or endorsed by Anthropic, OpenAI, Google, HubSpot, Zoom, or Microsoft. "Bring your own key" means you are responsible for your own API usage and costs with those providers.
