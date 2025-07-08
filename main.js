const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let overlayWindow;
let promptWindow;

function createPromptWindow() {
  promptWindow = new BrowserWindow({
    width: 350,
    height: 300,
    resizable: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false // 👈 must be false for clipboard
    }
  });

  promptWindow.loadFile('username-prompt.html');
}

function createOverlayWindow(username) {
  overlayWindow = new BrowserWindow({
    width: 350,
    height: 330,
    x: 15,
    y: 135,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false // 👈 must be false for clipboard
    }
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.loadFile('index.html');
  // overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  overlayWindow.webContents.once('did-finish-load', () => {
    try {
      const { attachListener } = require('./comment-listener');
      attachListener(overlayWindow, username);
    } catch (err) {
      console.error('❌ Failed to attach comment listener:', err);
    }
  });
}

app.whenReady().then(() => {
  createPromptWindow();
});

ipcMain.on('username-submitted', (event, username) => {
  if (promptWindow) promptWindow.close();
  createOverlayWindow(username);
});

ipcMain.on('resize-window-to-video', (event, width, height) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (!isNaN(w) && !isNaN(h)) {
      win.setSize(w, h);
      console.log(`✅ Window resized to ${w}x${h}`);
    } else {
      console.warn('❌ Invalid resize payload:', width, height);
    }
  }
});

ipcMain.on('toggle-ignore-mouse', (event, shouldIgnore) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setIgnoreMouseEvents(shouldIgnore, { forward: true });
  }
});

ipcMain.on('quit-app', () => {
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
