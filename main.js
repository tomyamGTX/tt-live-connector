const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const youtubedl = require('youtube-dl-exec');
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
      autoplayPolicy: 'no-user-gesture-required'  // ✅ Add this
    }
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


app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.whenReady().then(() => {
  createPromptWindow();
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

ipcMain.handle('getAudioStream', async (event, url) => {
  try {
    const output = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: ['referer:youtube.com', 'user-agent:googlebot'],
    });

    const audioFormat = output.formats.find(f => f.asr && f.ext === 'm4a');
    return audioFormat?.url || null;
  } catch (err) {
    console.error('❌ youtube-dl failed:', err);
    return null;
  }
});

ipcMain.on('open-audio-window', async (event, { title }) => {
  if (currentAudioWindow && !currentAudioWindow.isDestroyed()) {
    currentAudioWindow.close(); // ensure only one audio window
  }

  currentAudioWindow = new BrowserWindow({
    width: 480,
    height: 300,
    alwaysOnTop: true,
    resizable: false,
    title: `Now Playing: ${title}`,
    webPreferences: {
      contextIsolation: true,
    },
  });

  async function trySearch(term) {
    const result = await ytSearch(term);
    const video = result.videos.find(v => v.videoId && v.seconds > 0 && !v.live);
    return video || null;
  }

  try {
    let video = await trySearch(title);

    // If no valid result, try fallback
    if (!video) {
      console.warn(`⚠️ Primary search failed for: ${title}. Trying fallback...`);
      video = await trySearch(title + ' audio');
    }

    if (!video) {
      console.warn(`❌ No playable video found for: ${title}`);
      currentAudioWindow.close(); // ⛔ Close the window instead of showing message
      return;
    }

    const playerPath = path.join(__dirname, 'youtube-player.html');
    currentAudioWindow.loadFile(playerPath, {
      query: {
        v: video.videoId,
        dur: video.seconds  // Pass video duration to renderer
      }
    });


    // 🔽 Auto-minimize after loading and delay
    currentAudioWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        if (currentAudioWindow && !currentAudioWindow.isDestroyed()) {
          currentAudioWindow.minimize();
        }
      }, 3000); // ⏱️ 3 seconds delay (adjust as needed)
    });

    currentAudioWindow.on('closed', () => {
      currentAudioWindow = null;
      overlayWindow?.webContents.send('popup-audio-closed');
    });

  } catch (err) {
    console.error('❌ YouTube search threw error:', err);
    currentAudioWindow.close(); // ⛔ Close window on error too
  }
});


ipcMain.on('minimize-audio-popup', () => {
  if (currentAudioWindow && !currentAudioWindow.isDestroyed()) {
    currentAudioWindow.minimize();
  }
});

ipcMain.on('close-audio-window', () => {
  if (currentAudioWindow && !currentAudioWindow.isDestroyed()) {
    currentAudioWindow.close();
    currentAudioWindow = null;
  }
});


ipcMain.on('quit-app', () => {
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
