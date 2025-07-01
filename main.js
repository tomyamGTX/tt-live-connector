const { app, BrowserWindow, ipcMain } = require('electron');
const { attachListener } = require('./comment-listener');

let win;

function createWindow() {
    win = new BrowserWindow({
        width: 500,
        height: 430,
        x: 30,
        y: 120,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        focusable: false,
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.setAlwaysOnTop(true, 'screen-saver');
    win.loadFile('index.html');
    win.setIgnoreMouseEvents(true, { forward: true });
    win.webContents.once('did-finish-load', () => {
        attachListener(win);
    });
}

app.whenReady().then(createWindow);

// ✅ Resize when triggered by renderer
ipcMain.on('resize-window-to-video', (event, width, height) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        const w = parseInt(width, 10);
        const h = parseInt(height, 10);

        if (!isNaN(w) && !isNaN(h)) {
            win.setSize(w, h);
        } else {
            console.warn('❌ Invalid size payload:', width, height);
        }
    }
});

ipcMain.on('toggle-ignore-mouse', (event, shouldIgnore) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setIgnoreMouseEvents(shouldIgnore, { forward: true });
  }
});

