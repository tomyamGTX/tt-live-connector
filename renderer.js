// ====== Cached DOM elements ======
const el = (id) => document.getElementById(id);
const [
  commentBox, commentList, giftMsg, video, liveStatus,
  viewerStatus, container, audioPlayer, songListEl
] = [
  'comment', 'comments', 'giftThankYou', 'giftVideo', 'liveStatus',
  'viewerStatus', 'container', 'audioPlayer', 'songList'
].map(el);

// ====== State ======
const skipCooldowns = new Map(); // nickname -> last skip time
const giftVideoQueue = [];
let isAudioPlaying = false;
let isVideoPlaying = false;
let isProcessing = false;
let hasEnded = false;
let latestViewerCount = 0;
let liveStartTime = null;
let liveTimerInterval = null;
let lastViewerCountUpdate = 0;
let lastTriggeredByDev = null;
let lastGift = null;
let interactionTimeout;
const uiWidth = 430;
const songQueue = [];
let isSongPlaying = false;

// ====== Helpers ======
const resetInteractionTimer = (timeout = 180000) => {
  clearTimeout(interactionTimeout);
  window.electronAPI.showWindow();
  interactionTimeout = setTimeout(() => {
    if (!isVideoPlaying) window.electronAPI.minimizeWindow();
  }, timeout);
};

const formatDuration = (sec) =>
  [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');

const truncate = (str, len = 25) =>
  str.length > len ? str.slice(0, len) + '…' : str;

const cleanupAfterVideo = () => {
  video.style.display = 'none';
  container.classList.remove('expanded');
  isVideoPlaying = isProcessing = false;
  commentBox.style.display = 'block';
  commentList.style.display = 'flex';
  window.electronAPI.resizeWindow(500, uiWidth);
  resetInteractionTimer();
  processGiftQueue();
};

// ====== Songs ======
function updateNowPlaying(title) {
  const nowPlaying = document.getElementById('nowPlaying');
  const currentSongTitle = document.getElementById('currentSongTitle');

  if (title && title.trim() !== '') {
    currentSongTitle.textContent = title;
    nowPlaying.style.display = 'block';
  } else {
    nowPlaying.style.display = 'none';
    currentSongTitle.textContent = '';
  }
}

// Update the UI list of queued songs under "permintaan lagu"
function updateSongQueueUI() {
  songListEl.innerHTML = ''; // Clear existing list

  if (songQueue.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.textContent = 'Tiada permintaan lagu dalam barisan.';
    emptyMsg.className = 'empty-queue';
    songListEl.appendChild(emptyMsg);
    return;
  }

  songQueue.forEach(({ query, nickname }, index) => {
    const item = document.createElement('div');
    item.className = 'queue-item';
    item.textContent = `${index + 1}. ${query} — oleh ${nickname}`;
    songListEl.appendChild(item);
  });
}

// ====== Gifts ======
function processGiftQueue() {
  if (isProcessing || isVideoPlaying || !giftVideoQueue.length) return;
  isProcessing = isVideoPlaying = true;

  const { nickname, giftName, repeatCount } = giftVideoQueue.shift();
  const text = `🎁 ${nickname} hantar ${giftName} x${repeatCount}`;

  const giftDiv = document.createElement('div');
  giftDiv.className = 'gift fade-in';
  giftDiv.innerText = text;
  commentList.append(giftDiv);
  commentList.scrollTop = commentList.scrollHeight;

  setTimeout(() => {
    giftDiv.classList.add('fade-out');
    setTimeout(() => giftDiv.remove(), 500);
  }, 5000);

  giftMsg.innerHTML = `🎁 Terima kasih <strong>${nickname}</strong> atas ${giftName} x${repeatCount} 🙏`;
  giftMsg.style.display = 'block';
  setTimeout(() => (giftMsg.style.display = 'none'), 8000);

  const videos = [
    'rose', 'flower', 'star', 'heart', 'balloon',
    'sparkle', 'confetti', 'hutao', 'default'
  ];
  video.src = `gift-videos/${videos[Math.floor(Math.random() * videos.length)]}.mp4`;
  video.style.display = 'block';
  video.muted = false;
  video.currentTime = 0;
  video.volume = 0.5;

  video.onerror = cleanupAfterVideo;
  video.onloadeddata = () => {
    const { videoWidth: w = 400, videoHeight: h = 400 } = video;
    container.style.maxWidth = `${w}px`;
    container.style.maxHeight = `${h}px`;
    window.electronAPI.resizeWindow(w, h);
    video.onended = cleanupAfterVideo;
    video.play().catch((err) => {
      console.error("❌ Video play error:", err);
      cleanupAfterVideo();
    });
  };

  commentBox.style.display = commentList.style.display = 'none';
}

// ====== Main ======
document.addEventListener('DOMContentLoaded', () => {
  // Live start
  window.electronAPI.onLiveStarted(() => {
    liveStartTime = Date.now();
    clearInterval(liveTimerInterval);
    liveTimerInterval = setInterval(() => {
      liveStatus.textContent = `🟢 Live sekarang — ${formatDuration(
        Math.floor((Date.now() - liveStartTime) / 1000)
      )}`;
    }, 1000);
  });

  // Viewer count
  window.electronAPI.onViewerCount((count) => {
    const now = Date.now();
    if (now - lastViewerCountUpdate > 3000) {
      latestViewerCount = count;
      viewerStatus.textContent = `👀 ${count} sedang menonton`;
      resetInteractionTimer();
      lastViewerCountUpdate = now;
    }
  });

  // Comments
  window.electronAPI.onNewComment((data) => {
    resetInteractionTimer();
    const { nickname, comment } = data;
    const shortName = truncate(nickname);
    const fullText = `${shortName}: ${comment}`;

    const div = document.createElement('div');
    div.className = 'comment new';
    div.title = `${nickname}: ${comment}`;
    div.innerHTML = `<span>${fullText}</span>`;

    // Check if comment starts with "!play "
    const playCmd = /^!play\s+(.+)/i.exec(comment);

    if (playCmd) {
      const query = playCmd[1].trim();
      if (query) {
        songQueue.push({ query, nickname });
        updateSongQueueUI(); // update UI
        if (!isSongPlaying) {
          playNextSong();
        }
        updateNowPlaying(query);
      }
    }

    if (/^!skip/i.test(comment)) {
      if (isSongPlaying) {
        window.electronAPI.skipSong();
      }
    }

    // !giveaway
    if (/^!giveaway/i.test(comment)) {
      const giveawayName = comment.replace(/^!giveaway\s*/i, '').trim() || nickname;
      window.electronAPI.addToWheel(giveawayName);
    }

    // UID buttons
    [
      { game: 'Genshin Impact', regex: /\b8\d{8}\b/, region: 'Asia' },
      { game: 'Honkai: Star Rail', regex: /\b2\d{8}\b/, region: 'Asia' },
      { game: 'Zenless Zone Zero', regex: /\b13\d{8}\b/, region: 'Asia' },
    ].some(({ game, regex, region }) => {
      const match = comment.match(regex);
      if (match) {
        const uid = match[0];
        const btn = document.createElement('button');
        btn.textContent = '📋';
        btn.className = 'copy-btn';
        btn.title = `Salin UID ${game} (${region})`;
        btn.onclick = async (e) => {
          e.stopPropagation();
          try {
            await window.electronAPI.copyText(uid);
            btn.textContent = '✅';
            setTimeout(() => (btn.textContent = '📋'), 1000);
          } catch (err) {
            console.error('❌ Clipboard error:', err);
          }
        };
        div.appendChild(btn);
        return true;
      }
    });

    commentList.append(div);
    while (commentList.children.length > 2) commentList.removeChild(commentList.firstChild);
    commentList.scrollTop = commentList.scrollHeight;
    commentBox.textContent = fullText;

    if (/dev/i.test(comment) && lastTriggeredByDev !== nickname) {
      lastTriggeredByDev = nickname;
      giftVideoQueue.push({ nickname, giftName: 'TikTok', repeatCount: 1 });
      processGiftQueue();
    }

    setTimeout(() => div.classList.remove('new'), 400);
  });

  function playNextSong() {
    if (songQueue.length === 0) {
      isSongPlaying = false;
      updateNowPlaying('');
      updateSongQueueUI(); // update UI to clear queue display
      return;
    }

    const { query, nickname } = songQueue.shift();
    updateSongQueueUI(); // update UI after removing from queue

    isSongPlaying = true;
    window.electronAPI.playSong(query, nickname);
    updateNowPlaying(query);
  }

  window.electronAPI.onSongEnded(() => {
    isSongPlaying = false;
    playNextSong();
  });

  // Gifts
  window.electronAPI.onNewGift((data) => {
    lastGift = { ...data, timestamp: Date.now() };
    giftVideoQueue.push(lastGift);
    processGiftQueue();
    resetInteractionTimer();
  });

  //no song
  window.electronAPI.onNoSongResult(({ query, nickname }) => {
    // Show a message in your UI or log it
    console.log(`No video found for "${query}" requested by ${nickname}`);

    // Optionally, show a toast or UI notification here

    // Skip to next song if you want:
    isSongPlaying = false;
    playNextSong();
  });
  // Live end
  window.electronAPI.onLiveEnded(() => {
    if (hasEnded) return;
    hasEnded = true;
    document.body.style.transition = 'opacity 0.8s ease-in-out';
    document.body.style.opacity = '0';
    requestAnimationFrame(() =>
      setTimeout(() => {
        try {
          window.electronAPI.quitApp?.();
        } catch (err) {
          console.error('Failed to quit app:', err);
        }
      }, 800)
    );
  });

  console.log('👋 Renderer loaded');
});
