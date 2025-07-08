const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  submitUsername: (username) => ipcRenderer.send('username-submitted', username),
  resizeWindow: (w, h) => ipcRenderer.send('resize-window-to-video', w, h),
  toggleIgnoreMouse: (ignore) => ipcRenderer.send('toggle-ignore-mouse', ignore),
  quitApp: () => ipcRenderer.send('quit-app'),
  onLiveStarted: (callback) => ipcRenderer.on('live-started', callback),
  onViewerCount: (callback) => ipcRenderer.on('viewer-count', (_, count) => callback(count)),
  onNewComment: (callback) => {
    ipcRenderer.on('new-comment', (_, data) => callback(data));
  },
  copyText: (text) => clipboard.writeText(text),
  onNewGift: (callback) => ipcRenderer.on('new-gift', (_, data) => callback(data)),
  onLiveEnded: (callback) => ipcRenderer.on('live-ended', callback),
});

