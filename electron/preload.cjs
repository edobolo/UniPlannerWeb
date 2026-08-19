const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('is-window-maximized'),
  platform: process.platform,
  
  // AutoUpdater API
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  restartAndInstallUpdate: () => ipcRenderer.send('restart-and-install-update'),
  onUpdateChecking: (cb) => ipcRenderer.on('update-checking', () => cb()),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_e, info) => cb(info)),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available', (_e, info) => cb(info)),
  onUpdateProgress: (cb) => ipcRenderer.on('update-download-progress', (_e, progress) => cb(progress)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_e, info) => cb(info)),
  onUpdateError: (cb) => ipcRenderer.on('update-error', (_e, err) => cb(err)),
  removeAllUpdaterListeners: () => {
    ipcRenderer.removeAllListeners('update-checking');
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-not-available');
    ipcRenderer.removeAllListeners('update-download-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('update-error');
  }
});

