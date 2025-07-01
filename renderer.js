const { ipcRenderer } = require('electron');

const commentBox = document.getElementById('comment');
const commentList = document.getElementById('comments');
const giftMsg = document.getElementById('giftThankYou');
const video = document.getElementById('giftVideo');
const liveStatus = document.getElementById('liveStatus');
const viewerStatus = document.getElementById('viewerStatus');
const container = document.getElementById('container');

let latestViewerCount = 0;
let lastCommentTime = 0;
let liveStartTime = null;
let liveTimerInterval = null;

const giftVideoQueue = [];
const uiWidth = 430;
let isVideoPlaying = false;
let isIdle = false;
const idleTimeoutDuration = 8000;
let idleTimeout;

// 💤 IDLE HANDLING
function enterIdleMode() {
  if (isIdle || isVideoPlaying) return;
  isIdle = true;

  commentBox.style.opacity = '0';
  commentList.style.opacity = '0';

  container.classList.remove('expanded');
  container.style.maxWidth = '300px';
  container.style.maxHeight = '80px';
  container.style.minHeight = '80px';

  ipcRenderer.send('resize-window-to-video', 300, 100);
}

function exitIdleMode() {
  if (!isIdle) return;
  isIdle = false;

  commentBox.style.opacity = '1';
  commentList.style.opacity = '1';

  container.style.maxWidth = '500px';
  container.style.minHeight = `${uiWidth}px`;

  ipcRenderer.send('resize-window-to-video', 500, uiWidth);
}

function resetIdleTimer() {
  clearTimeout(idleTimeout);
  exitIdleMode(); // Always exit idle mode first

  if (isVideoPlaying) return;
  idleTimeout = setTimeout(enterIdleMode, idleTimeoutDuration);
}

// 🔄 UTILITIES
function formatDuration(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function truncateNickname(nickname, maxLength = 25) {
  return nickname.length > maxLength ? nickname.slice(0, maxLength) + '…' : nickname;
}

// 🔔 EVENTS
ipcRenderer.on('live-started', () => {
  liveStartTime = Date.now();
  clearInterval(liveTimerInterval);

  liveTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - liveStartTime) / 1000);
    liveStatus.textContent = `🟢 Live sekarang — ${formatDuration(elapsed)}`;
  }, 1000);
});

ipcRenderer.on('viewer-count', (_, viewerCount) => {
  latestViewerCount = viewerCount;
  viewerStatus.textContent = `👀 ${viewerCount} sedang menonton`;

  if (!isIdle) resetIdleTimer();
});

ipcRenderer.on('new-comment', (_, data) => {
  lastCommentTime = Date.now();
  resetIdleTimer();

  const div = document.createElement('div');
  div.className = 'comment';
  const shortName = truncateNickname(data.nickname);
  div.textContent = `${shortName}: ${data.comment}`;
  div.title = `${data.nickname}: ${data.comment}`;
  commentList.appendChild(div);

  while (commentList.children.length > 6) {
    commentList.removeChild(commentList.firstChild);
  }

  commentList.scrollTop = commentList.scrollHeight;
  commentBox.textContent = `${shortName}: ${data.comment}`;
  commentBox.style.opacity = 1;

  // 🧪 Simulate gift on keyword "dev"
  if (data.comment.toLowerCase().includes('dev')) {
    giftVideoQueue.push({
      nickname: data.nickname,
      giftName: 'TikTok',
      repeatCount: 1,
    });
    processGiftQueue();
  }
});

ipcRenderer.on('new-gift', (_, data) => {
  giftVideoQueue.push(data);
  processGiftQueue();
});

// 🎁 VIDEO GIFT PROCESSING
function processGiftQueue() {
  if (isVideoPlaying || giftVideoQueue.length === 0) return;

  const data = giftVideoQueue.shift();
  isVideoPlaying = true;
  exitIdleMode(); // prevent idle while video active

  const text = `🎁 ${data.nickname} hantar ${data.giftName} x${data.repeatCount}`;
  const giftDiv = document.createElement('div');
  giftDiv.className = 'gift';
  giftDiv.innerText = text;
  commentList.appendChild(giftDiv);
  commentList.scrollTop = commentList.scrollHeight;

  giftDiv.classList.add('fade-in');
  setTimeout(() => {
    giftDiv.classList.add('fade-out');
    setTimeout(() => giftDiv.remove(), 500);
  }, 5000);

  giftMsg.innerHTML = `🎁 Terima kasih <strong>${data.nickname}</strong> atas ${data.giftName} x${data.repeatCount} 🙏`;
  giftMsg.style.display = 'block';
  setTimeout(() => (giftMsg.style.display = 'none'), 5000);

  const giftMap = {
    Rose: 'rose.mp4',
    Flower: 'flower.mp4',
    TikTok: 'default.mp4',
  };

  const file = giftMap[data.giftName] || 'default.mp4';
  video.src = `gift-videos/${file}`;
  video.style.display = 'block';
  video.muted = false; // ensure autoplay works
  video.currentTime = 0;

  video.onerror = () => {
    console.error('⚠️ Video failed to load:', video.src);
    cleanupAfterVideo();
  };

  video.onloadedmetadata = () => {
    const width = video.videoWidth || 600;
    const height = video.videoHeight || 400;

    container.style.maxWidth = `${width}px`;
    container.style.maxHeight = `${height}px`;
    ipcRenderer.send('resize-window-to-video', width, height);

    video.play().catch((err) => {
      console.error('❌ Video play failed:', err);
      cleanupAfterVideo();
    });
  };

  video.onended = cleanupAfterVideo;

  commentBox.style.display = 'none';
  commentList.style.display = 'none';
}

function cleanupAfterVideo() {
  video.style.display = 'none';
  container.classList.remove('expanded');
  isVideoPlaying = false;

  commentBox.style.display = 'block';
  commentList.style.display = 'flex';

  ipcRenderer.send('resize-window-to-video', 500, uiWidth);
  processGiftQueue();
}
ipcRenderer.on('live-ended', () => {
  console.log("Live ended. Fading out...");

  // Apply a fade-out effect to the body
  document.body.style.transition = 'opacity 1s ease';
  document.body.style.opacity = '0';

  // Wait for the fade to finish, then tell main to quit
  setTimeout(() => {
    ipcRenderer.send('quit-app');
  }, 1000); // match transition duration
});
console.log('👋 Renderer loaded');
