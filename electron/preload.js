'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('inkdown', {
  // Renderer-triggered actions handled by the main process.
  open: () => ipcRenderer.invoke('app:open'),
  save: () => ipcRenderer.invoke('app:save'),
  saveAs: () => ipcRenderer.invoke('app:saveAs'),
  confirmDiscard: () => ipcRenderer.invoke('app:confirmDiscard'),

  // Resolve the absolute path of a file dropped onto the window (Electron 32+ API).
  getDroppedFilePath: (file) => {
    try { return webUtils.getPathForFile(file) || null; } catch { return null; }
  },

  // Copy text to the system clipboard via the main process (reliable in file://).
  copyText: (text) => ipcRenderer.send('clipboard:write', text),

  // Renderer -> main notifications.
  setTitle: (title) => ipcRenderer.send('title:update', title),
  setRepresentedFile: (filePath) => ipcRenderer.send('document:represented', filePath),
  setEdited: (edited) => ipcRenderer.send('document:edited', edited),

  // Main -> renderer events.
  onMenu: (cb) => ipcRenderer.on('menu', (_e, command) => cb(command)),
  onOpenPath: (cb) => ipcRenderer.on('open-path', (_e, payload) => cb(payload)),
  onSaved: (cb) => ipcRenderer.on('saved', (_e, payload) => cb(payload)),
});
