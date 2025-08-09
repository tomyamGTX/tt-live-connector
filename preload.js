// ✅ preload.js
const { contextBridge, ipcRenderer, clipboard } = require('electron');
const ytSearch = require('yt-search');
let noSongResultCallback = null;

// 🧠 Listen for 'add-name' from main process and re-dispatch to frontend
ipcRenderer.on('add-name', (_, name) => {
  window.dispatchEvent(new CustomEvent('add-name', { detail: name }));
});
ipcRenderer.on('update-audio', (_, data) => {
  window.dispatchEvent(new CustomEvent('update-audio', { detail: data }));
});


ipcRenderer.on('no-song-result', (event, data) => {
  if (typeof noSongResultCallback === 'function') {
    noSongResultCallback(data);
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse-events', ignore),
  submitUsername: (username) => ipcRenderer.send('username-submitted', username),
  resizeWindow: (w, h) => ipcRenderer.send('resize-window-to-video', w, h),
  toggleIgnoreMouse: (ignore) => ipcRenderer.send('toggle-ignore-mouse', ignore),
  quitApp: () => ipcRenderer.send('quit-app'),
  onLiveStarted: (callback) => ipcRenderer.on('live-started', callback),
  onViewerCount: (callback) => ipcRenderer.on('viewer-count', (_, count) => callback(count)),
  onNewComment: (callback) => ipcRenderer.on('new-comment', (_, data) => callback(data)),
  addToWheel: (name) => ipcRenderer.send('add-to-wheel', name),
  copyText: (text) => clipboard.writeText(text),
  onNewGift: (callback) => ipcRenderer.on('new-gift', (_, data) => callback(data)),
  onLiveEnded: (callback) => ipcRenderer.on('live-ended', callback),
  getWindowTitle: () => ipcRenderer.invoke('get-window-title'),
  isWheelVisible: () => ipcRenderer.invoke('is-wheel-visible'),
  resetWheel: () => ipcRenderer.send('reset-wheel'),
  minimizeWheel: () => ipcRenderer.send('minimize-wheel'),
  minimizeWindow: () => ipcRenderer.send('minimize-main'),
  showWindow: () => ipcRenderer.send('show-main'),
  onAddName: (callback) => {
    window.addEventListener('add-name', (e) => callback(null, e.detail));
  },
  playSong: (query, nickname) => ipcRenderer.send('play-song', { query, nickname }),
  onSongEnded: (callback) => ipcRenderer.on('song-ended', callback),
  skipSong: () => ipcRenderer.send('skip-song'),
  onNoSongResult: (callback) => {
    noSongResultCallback = callback;
  },
  searchYouTube: async (query) => {
    const result = await ytSearch(query);
    if (result && result.videos.length > 0) {
      return result.videos[0]; // top result
    }
    return null;
  },
});
