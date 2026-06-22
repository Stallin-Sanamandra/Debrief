const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("granola", {
  loadNotes: () => ipcRenderer.invoke("notes:load"),
  saveNotes: (notes) => ipcRenderer.invoke("notes:save", notes),
  openNotesFolder: () => ipcRenderer.invoke("notes:openFolder"),
  exportNote: (payload) => ipcRenderer.invoke("note:export", payload),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (patch) => ipcRenderer.invoke("settings:set", patch),
  claude: (payload) => ipcRenderer.invoke("claude:call", payload),
});
