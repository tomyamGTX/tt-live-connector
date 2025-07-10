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
let isProcessing = false;
const idleTimeoutDuration = 8000;
let idleTimeout;
let lastTriggeredByDev = null;
let lastGift = null;

async function enterIdleMode() {
  if (isIdle || isVideoPlaying) return;

  const wheelVisible = await window.electronAPI.isWheelVisible();
  if (wheelVisible) {
    console.log('🎡 Giveaway active — skipping idle mode');
    return;
  }

  isIdle = true;
  console.log('💤 Entering idle mode - enabling click-through');

  commentBox.style.opacity = '0';
  commentList.style.opacity = '0';

  container.classList.remove('expanded');
  container.style.maxWidth = '350px';
  container.style.maxHeight = '120px';
  container.style.minHeight = '120px';

  window.electronAPI.setIgnoreMouseEvents(true);
  window.electronAPI.resizeWindow(300, 100);
}


function exitIdleMode() {
  if (!isIdle) return;
  isIdle = false;

  console.log('✅ Exiting idle mode - disabling click-through');

  commentBox.style.opacity = '1';
  commentList.style.opacity = '1';

  container.style.maxWidth = '350px';
  container.style.minHeight = `${uiWidth}px`;

  window.electronAPI.setIgnoreMouseEvents(false); // Click-through OFF
  window.electronAPI.resizeWindow(400, uiWidth);
}

function resetIdleTimer() {
  clearTimeout(idleTimeout);
  exitIdleMode();
  if (isVideoPlaying) return;
  idleTimeout = setTimeout(enterIdleMode, idleTimeoutDuration);
}

function formatDuration(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function truncateNickname(nickname, maxLength = 25) {
  return nickname.length > maxLength ? nickname.slice(0, maxLength) + '…' : nickname;
}

function processGiftQueue() {
  if (isProcessing || isVideoPlaying || giftVideoQueue.length === 0) return;

  isProcessing = true;
  const data = giftVideoQueue.shift();
  isVideoPlaying = true;
  exitIdleMode();

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
  setTimeout(() => (giftMsg.style.display = 'none'), 8000);

  const videoList = [
    'rose.mp4',
    'flower.mp4',
    'star.mp4',
    'heart.mp4',
    'balloon.mp4',
    'sparkle.mp4',
    'confetti.mp4',
    'default.mp4'
  ];

  const randomIndex = Math.floor(Math.random() * videoList.length);
  const randomFile = videoList[randomIndex];

  video.src = `gift-videos/${randomFile}`;
  video.style.display = 'block';
  video.muted = false;
  video.currentTime = 0;
  video.volume = 0.5;


  video.onerror = () => {
    console.error('⚠️ Video failed to load:', video.src);
    cleanupAfterVideo();
  };

  video.onloadeddata = () => {
    const width = video.videoWidth || 400;
    const height = video.videoHeight || 400;

    container.style.maxWidth = `${width}px`;
    container.style.maxHeight = `${height}px`;
    window.electronAPI.resizeWindow(width, height);
    video.play().then(() => {
      videoTimeout = setTimeout(() => {
        if (!video.paused) {
          video.pause();
          cleanupAfterVideo();
        }
      }, 19000);
    }).catch(err => {
      cleanupAfterVideo();
    });
  };

  video.onended = () => {
    clearTimeout(videoTimeout);
    cleanupAfterVideo();
  };

  commentBox.style.display = 'none';
  commentList.style.display = 'none';
}

function cleanupAfterVideo() {
  video.style.display = 'none';
  container.classList.remove('expanded');
  isVideoPlaying = false;
  isProcessing = false;

  commentBox.style.display = 'block';
  commentList.style.display = 'flex';

  window.electronAPI.resizeWindow(500, uiWidth);
  processGiftQueue(); // Try next gift if any
}

document.addEventListener('DOMContentLoaded', () => {
  window.electronAPI.onLiveStarted(() => {
    liveStartTime = Date.now();
    clearInterval(liveTimerInterval);

    liveTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - liveStartTime) / 1000);
      liveStatus.textContent = `🟢 Live sekarang — ${formatDuration(elapsed)}`;
    }, 1000);
    // ⬇️ Exit idle when user clicks the live overlay
    const liveOverlay = document.getElementById('container');
    if (liveOverlay) {
      liveOverlay.addEventListener('click', () => {
        resetIdleTimer();    // Restart the idle countdown
        exitIdleMode();      // Exit idle immediately if in idle mode
      });
    }
  });

  window.electronAPI.onViewerCount(viewerCount => {
    latestViewerCount = viewerCount;
    viewerStatus.textContent = `👀 ${viewerCount} sedang menonton`;
    if (!isIdle) resetIdleTimer();
  });

  window.electronAPI.onNewComment((data) => {
    lastCommentTime = Date.now();
    resetIdleTimer();

    const commentText = data.comment;
    const shortName = truncateNickname(data.nickname);
    const fullDisplayText = `${shortName}: ${commentText}`;

    const div = document.createElement('div');
    div.className = 'comment new';
    div.title = `${data.nickname}: ${commentText}`;

    // Create comment text span
    const span = document.createElement('span');
    span.textContent = fullDisplayText;
    span.style.userSelect = 'text';
    span.style.pointerEvents = 'none';
    div.appendChild(span);

    // ✅ Copy button for !play
    if (commentText.toLowerCase().includes('!play')) {
      const copyBtn = document.createElement('button');
      copyBtn.textContent = '📋';
      copyBtn.className = 'copy-btn';
      copyBtn.title = 'Salin !play';

      copyBtn.onclick = async (e) => {
        e.stopPropagation();
        const match = commentText.match(/!play\s+(.*)/i);
        const playText = match ? match[1].trim() : '';
        try {
          await window.electronAPI.copyText(playText);
          copyBtn.textContent = '✅';
          setTimeout(() => {
            copyBtn.textContent = '📋';
          }, 1000);
        } catch (err) {
          console.error('❌ Clipboard error:', err);
        }
      };

      div.appendChild(copyBtn);
    }
    // ✅ Handle !giveaway (add to spinner)
    if (commentText.toLowerCase().startsWith('!giveaway')) {
      const match = commentText.match(/!giveaway\s+(.*)/i);
      const giveawayName = match ? match[1].trim() : data.nickname;

      if (giveawayName.length > 0) {
        window.electronAPI.addToWheel(giveawayName);
      }
    }




    // ✅ Copy button for UID (Genshin, HSR, ZZZ Asia)
    const uidPatterns = [
      { game: 'Genshin Impact', regex: /\b8\d{8}\b/, region: 'Asia' },
      { game: 'Honkai: Star Rail', regex: /\b2\d{8}\b/, region: 'Asia' },
      { game: 'Zenless Zone Zero', regex: /\b13\d{8}\b/, region: 'Asia' }, // 10-digit
    ];

    for (const { game, regex, region } of uidPatterns) {
      const match = commentText.match(regex);
      if (match) {
        const uid = match[0];
        const copyUidBtn = document.createElement('button');
        copyUidBtn.textContent = '📋';
        copyUidBtn.className = 'copy-btn';
        copyUidBtn.title = `Salin UID ${game} (${region})`;

        copyUidBtn.onclick = async (e) => {
          e.stopPropagation();
          try {
            await window.electronAPI.copyText(uid);
            copyUidBtn.textContent = '✅';
            setTimeout(() => {
              copyUidBtn.textContent = '📋';
            }, 1000);
          } catch (err) {
            console.error('❌ Clipboard error:', err);
          }
        };

        div.appendChild(copyUidBtn);
        break; // only attach one UID button
      }
    }

    // ✅ Append to comment list
    commentList.appendChild(div);

    // Limit to 3 comments
    while (commentList.children.length > 3) {
      commentList.removeChild(commentList.firstChild);
    }

    commentList.scrollTop = commentList.scrollHeight;

    commentBox.textContent = fullDisplayText;
    commentBox.style.opacity = 1;

    if (commentText.toLowerCase().includes('dev')) {
      if (lastTriggeredByDev !== data.nickname) {
        lastTriggeredByDev = data.nickname;
        giftVideoQueue.push({
          nickname: data.nickname,
          giftName: 'TikTok',
          repeatCount: 1,
        });
        processGiftQueue();
      }
    }

    setTimeout(() => div.classList.remove('new'), 400);
  });



  window.electronAPI.onNewGift(data => {
    const gift = {
      ...data,
      timestamp: Date.now()
    };

    if (isDuplicateGift(gift)) {
      console.warn('⚠️ Duplicate gift ignored:', gift);
      return;
    }

    lastGift = gift;

    giftVideoQueue.push(gift);
    console.log('🎁 Queued gift:', gift.nickname, gift.giftName, 'x' + gift.repeatCount);
    processGiftQueue();
  });

  window.electronAPI.onLiveEnded(() => {
    document.body.style.transition = 'opacity 1s ease';
    document.body.style.opacity = '0';
    setTimeout(() => {
      window.electronAPI.quitApp();
    }, 1000);
  });

  console.log('👋 Renderer loaded');
});

function isDuplicateGift(gift) {
  return (
    lastGift &&
    lastGift.nickname === gift.nickname &&
    lastGift.giftName === gift.giftName &&
    lastGift.repeatCount === gift.repeatCount &&
    Date.now() - lastGift.timestamp < 1000 // Within 1s
  );
}