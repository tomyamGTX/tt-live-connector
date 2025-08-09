const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const ytSearch = require('yt-search');

let overlayWindow;
let promptWindow;
let wheelWindow;
let giveawayNames = new Set();
let currentAudioWindow = null;




function createPromptWindow() {
  promptWindow = new BrowserWindow({
    width: 550,
    height: 500,
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
    width: 360,
    height: 450,
    x: 1150,
    y: 15,
    frame: false,
    titleBarStyle: 'hidden',
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
      autoplayPolicy: 'no-user-gesture-required',
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
    wheelWindow.show();
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
    wheelWindow = null;
  });

  wheelWindow.webContents.once('did-finish-load', () => {
    giveawayNames.forEach((name) => {
      wheelWindow.webContents.send('add-name', name);
    });
  });
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.whenReady().then(() => {
  createPromptWindow();
});

ipcMain.on('play-song', async (event, { query, nickname }) => {
  try {
    const result = await ytSearch(query);
    if (!result || result.videos.length === 0) {
      console.log(`No results for: ${query}`);

      // Notify renderer that no result was found
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('no-song-result', { query, nickname });
      }

      return;
    }

    const video = result.videos[0];

    // Close previous audio window if exists
    if (currentAudioWindow && !currentAudioWindow.isDestroyed()) {
      currentAudioWindow.close();
    }

    currentAudioWindow = new BrowserWindow({
      width: 480,
      height: 300,
      alwaysOnTop: true,
      resizable: false,
      title: `Playing for ${nickname}: ${video.title}`,
      webPreferences: {
        contextIsolation: true,
      },
    });

    currentAudioWindow.loadFile(path.join(__dirname, 'youtube-player.html'), {
      query: {
        v: video.videoId,
        dur: video.seconds,
      },
    });

    currentAudioWindow.on('closed', () => {
      currentAudioWindow = null;
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('song-ended');
      }
    });

    currentAudioWindow.once('ready-to-show', () => {
      setTimeout(() => {
        if (currentAudioWindow && !currentAudioWindow.isDestroyed()) {
          currentAudioWindow.minimize();
        }
      }, 1000);
    });
  } catch (error) {
    console.error('Error playing song:', error);
  }
});



ipcMain.on('skip-song', () => {
  if (currentAudioWindow && !currentAudioWindow.isDestroyed()) {
    currentAudioWindow.close();
  }
});

ipcMain.on('minimize-main', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.minimize();
  }
});

ipcMain.on('show-main', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
  }
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
    console.log(
      `🔁 Mouse events ${ignore ? 'ignored (click-through)' : 'accepted'} on overlay`
    );
  } else {
    console.warn('❌ No overlay window to apply ignoreMouseEvents');
  }
});

ipcMain.on('add-to-wheel', (event, name) => {
  openWheelWindow();
  if (wheelWindow) {
    wheelWindow.webContents.send('add-name', name);
  }
  giveawayNames.add(name);
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
