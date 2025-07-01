const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let overlayWindow;
let promptWindow;
let tiktokUsername = null;

// ✅ Create the transparent overlay window
function createOverlayWindow() {
    overlayWindow = new BrowserWindow({
        width: 500,
        height: 430,
        x: 15,
        y: 135,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        focusable: false,
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.loadFile('index.html');
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });

    overlayWindow.webContents.once('did-finish-load', () => {
        const { attachListener } = require('./comment-listener');
        attachListener(overlayWindow, tiktokUsername);
    });
}

// ✅ Create a prompt window for TikTok username
function createPromptWindow() {
    promptWindow = new BrowserWindow({
        width: 400,
        height: 400,
        resizable: false,
        frame: true,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    promptWindow.loadFile('username-prompt.html');
}

// ✅ Launch prompt first
app.whenReady().then(() => {
    createPromptWindow();
});

// ✅ Receive TikTok username from prompt
ipcMain.on('username-submitted', (event, username) => {
    tiktokUsername = username;
    if (promptWindow) promptWindow.close();
    createOverlayWindow();
});

// ✅ Resize window from renderer
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
