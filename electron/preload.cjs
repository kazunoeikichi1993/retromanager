const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  onSelectedDirectory: (callback) => {
    ipcRenderer.on('selected-directory', (_event, value) => callback(value));
  },
});
