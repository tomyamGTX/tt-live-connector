const { app, BrowserWindow } = require('electron');
const path = require('path');
const { attachListener } = require('./comment-listener'); // ✅ import the listener

function createWindow() {
    let win = new BrowserWindow({
        width: 320,                   // 📏 Smaller width
        height: 320,                  // 📏 Shorter height
        x: 50,                        // 📍 Position near top-left (adjust as needed)
        y: 450,
        frame: false,                 // ✅ No title bar
        transparent: true,           // ✅ Transparent background
        alwaysOnTop: true,           // ✅ Stay above all windows
        skipTaskbar: true,           // ✅ Hidden from taskbar
        resizable: false,
        focusable: false,            // ✅ So game stays in focus
        hasShadow: false,            // ✅ Prevent window shadows
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.setAlwaysOnTop(true, 'screen-saver'); // Ensures it's truly topmost
    win.loadFile('index.html');

    win.webContents.once('did-finish-load', () => {
        attachListener(win); // ✅ Listen to TikTok events
    });
}


// ✅ This was probably missing:
app.whenReady().then(() => {
    createWindow();
});
