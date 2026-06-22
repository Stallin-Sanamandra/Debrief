# Debrief

A local AI meeting notepad. Type rough notes, capture a transcript, and let Claude turn it into clean structured notes with action items. Everything is stored as plain files on your own machine. Nothing is uploaded anywhere except your direct calls to the Anthropic API, which use your own key.

## What you need once

1. Install Node.js LTS (version 18 or newer): https://nodejs.org
   Download the installer, run it, click through the defaults.

## Run it

1. Unzip this folder somewhere (for example your Desktop).
2. Open a terminal in the folder.
   - macOS: right-click the folder in Finder, Services, "New Terminal at Folder". Or run `cd` to the path.
   - Windows: open the folder, type `cmd` in the address bar, press Enter.
3. Install the app's dependencies (one time, takes a few minutes the first time):
   ```
   npm install
   ```
4. Start the app:
   ```
   npm start
   ```

The app window opens. The first time, click Settings (gear icon, top right) and paste your Anthropic API key.

## Your API key

- Get one from the Anthropic Console under API Keys: https://console.anthropic.com/settings/keys
- The key is stored only on this computer. On macOS and Windows it is encrypted with the OS keychain. It is used to call Anthropic directly from the app.
- Usage is billed to your own Anthropic account. You can switch models in Settings (Sonnet is the default and the most cost-effective for notes; Opus is the most capable).

## Where your notes live

- Notes are saved as a single `notes.json` file in the app's user data folder.
- Click "Notes folder" in the sidebar (or "Open notes folder" in Settings) to reveal it in your file manager.
- You can also export any enhanced note to a Markdown file with the Export button.

## How to use it

1. Make a new note, add a title and attendees.
2. In "My notes", type whatever you want during the meeting. Sparse is fine.
3. Capture the conversation in "Transcript": paste a transcript from Zoom, Meet, or Teams, or click "Simulate meeting" to see the full flow with a sample call.
4. Hit Enhance. Claude merges your notes and the transcript into clean notes with sections, decisions, and next steps.
5. Use Ask to query the meeting, draft a follow-up email, or pull the action items.

## A note on live recording

The Record button uses the browser speech engine, which does not run in this desktop build. Use "Paste transcript" or "Simulate meeting" instead. Real on-device transcription (capturing your computer's audio with a local Whisper model) is the natural next step if you want it; that is a larger add-on and not included here.

## Optional: build a double-click app

If you want a real installer instead of running `npm start`:
```
npm run dist
```
This produces an installer in the `dist` folder for your operating system (.dmg on macOS, .exe on Windows, .AppImage on Linux). It downloads build tooling the first time, so it takes longer.

## If something breaks

- "command not found: npm" means Node.js is not installed yet. Install it from the link above and open a fresh terminal.
- If Enhance or Ask returns an error about the key, open Settings and re-paste your API key.
- To edit the interface code, the source is in `src/app.jsx`. After editing, run `npm run build:renderer` to recompile.
