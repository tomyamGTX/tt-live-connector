const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let overlayWindow;
let promptWindow;
let wheelWindow;
let giveawayNames = new Set();

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
      sandbox: false,
    },
  });

  promptWindow.loadFile('username-prompt.html');
}

function createOverlayWindow(username) {
  overlayWindow = new BrowserWindow({
    width: 350,
    height: 330,
    x: 15,
    y: 135,
    frame: false, titleBarStyle: 'hidden',   // ✅ Optional: hides macOS titlebar styling
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    focusable: false, // ✅ MUST be false
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.loadFile('index.html');


  overlayWindow.webContents.once('did-finish-load', () => {
    try {
      const { attachListener } = require('./comment-listener');
      attachListener(overlayWindow, username);
    } catch (err) {
      console.error('❌ Failed to attach comment listener:', err);
    }
  });
}

function openWheelWindow() {
  if (wheelWindow) {
    wheelWindow.show(); // in case it was hidden
    return;
  }

  wheelWindow = new BrowserWindow({
    width: 600,
    height: 600,
    resizable: true,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  wheelWindow.loadFile('wheel.html');

  wheelWindow.on('closed', () => {
    wheelWindow = null; // ✅ this is required
  });

  // Send names once loaded
  wheelWindow.webContents.once('did-finish-load', () => {
    giveawayNames.forEach(name => {
      wheelWindow.webContents.send('add-name', name);
    });
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

ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
  if (overlayWindow) {
    overlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
    console.log(`🔁 Mouse events ${ignore ? 'ignored (click-through)' : 'accepted'} on overlay`);
  } else {
    console.warn('❌ No overlay window to apply ignoreMouseEvents');
  }
});

ipcMain.on('add-to-wheel', (event, name) => {
  openWheelWindow(); // Will .show() again if minimized
  if (wheelWindow) {
    wheelWindow.webContents.send('add-name', name);
  }
});

ipcMain.on('reset-wheel', () => {
  giveawayNames.clear();
  if (wheelWindow && !wheelWindow.isDestroyed()) {
    wheelWindow.webContents.send('reset-wheel');
  }
});

ipcMain.on('minimize-wheel', () => {
  if (wheelWindow) {
    wheelWindow.minimize();
  }
});
ipcMain.handle('is-wheel-visible', () => {
  return !!wheelWindow && !wheelWindow.isDestroyed() && wheelWindow.isVisible();
});

ipcMain.on('quit-app', () => {
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
