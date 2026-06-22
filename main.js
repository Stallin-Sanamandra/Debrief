const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");

const userData = () => app.getPath("userData");
const notesPath = () => path.join(userData(), "notes.json");
const settingsPath = () => path.join(userData(), "settings.json");

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
  } catch {
    return {};
  }
}
function writeSettings(s) {
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2));
  } catch (e) {
    console.error("settings write failed", e);
  }
}
function getApiKey() {
  const s = readSettings();
  if (!s.apiKey) return "";
  if (s.enc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(s.apiKey, "base64"));
    } catch {
      return "";
    }
  }
  return s.apiKey;
}
function setApiKey(key) {
  const s = readSettings();
  if (safeStorage.isEncryptionAvailable()) {
    s.apiKey = safeStorage.encryptString(key).toString("base64");
    s.enc = true;
  } else {
    s.apiKey = key;
    s.enc = false;
  }
  writeSettings(s);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 720,
    minHeight: 540,
    backgroundColor: "#0F1115",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/* ---- IPC: notes ---- */
ipcMain.handle("notes:load", () => {
  try {
    return JSON.parse(fs.readFileSync(notesPath(), "utf8"));
  } catch {
    return null;
  }
});
ipcMain.handle("notes:save", (_e, notes) => {
  try {
    fs.writeFileSync(notesPath(), JSON.stringify(notes, null, 2));
    return true;
  } catch (e) {
    console.error("notes save failed", e);
    return false;
  }
});
ipcMain.handle("notes:openFolder", () => {
  try {
    if (!fs.existsSync(notesPath())) fs.writeFileSync(notesPath(), "[]");
    shell.showItemInFolder(notesPath());
  } catch (e) {
    shell.openPath(userData());
  }
});
ipcMain.handle("note:export", async (_e, { title, markdown }) => {
  const safe = (title || "note").replace(/[^\w\- ]+/g, "").trim().slice(0, 80) || "note";
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: safe + ".md",
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (canceled || !filePath) return null;
  try {
    fs.writeFileSync(filePath, markdown || "");
    return filePath;
  } catch {
    return null;
  }
});

/* ---- IPC: settings ---- */
ipcMain.handle("settings:get", () => {
  const s = readSettings();
  return {
    hasKey: !!s.apiKey,
    model: s.model || "claude-sonnet-4-6",
    notesPath: notesPath(),
    encrypted: !!s.enc,
  };
});
ipcMain.handle("settings:set", (_e, patch) => {
  const s = readSettings();
  if (typeof patch.model === "string" && patch.model) s.model = patch.model;
  writeSettings(s);
  if (typeof patch.apiKey === "string" && patch.apiKey.trim()) setApiKey(patch.apiKey.trim());
  const ns = readSettings();
  return {
    hasKey: !!ns.apiKey,
    model: ns.model || "claude-sonnet-4-6",
    notesPath: notesPath(),
    encrypted: !!ns.enc,
  };
});

/* ---- IPC: Anthropic API proxy (key never leaves the main process) ---- */
ipcMain.handle("claude:call", async (_e, { system, messages, max_tokens }) => {
  const key = getApiKey();
  if (!key) return { ok: false, error: "no-key" };
  const s = readSettings();
  const model = s.model || "claude-sonnet-4-6";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: max_tokens || 2048, system, messages }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = (j.error && j.error.message) || "";
      } catch {}
      return { ok: false, error: "http-" + res.status + (detail ? ": " + detail : "") };
    }
    const data = await res.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: (err && err.message) || "request-failed" };
  }
});
