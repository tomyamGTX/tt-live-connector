const commentBox = document.getElementById('comment');
const commentList = document.getElementById('comments');
const giftMsg = document.getElementById('giftThankYou');
const video = document.getElementById('giftVideo');
const liveStatus = document.getElementById('liveStatus');
const viewerStatus = document.getElementById('viewerStatus');
const container = document.getElementById('container');
const audioPlayer = document.getElementById('audioPlayer');
const songListEl = document.getElementById('songList');

let songQueue = [];
let isAudioPlaying = false;


let latestViewerCount = 0;
let liveStartTime = null;
let liveTimerInterval = null;
let lastViewerCountUpdate = 0;
const giftVideoQueue = [];
let isVideoPlaying = false;
let isProcessing = false;
let lastTriggeredByDev = null;
let lastGift = null;
let interactionTimeout;

const uiWidth = 430;

function resetInteractionTimer(timeout = 10000) {
  clearTimeout(interactionTimeout);
  window.electronAPI.showWindow();

  interactionTimeout = setTimeout(() => {
    const hasActiveAudio = isAudioPlaying || songQueue.length > 0;
    if (!isVideoPlaying && !hasActiveAudio) {
      window.electronAPI.minimizeWindow();
    }
  }, timeout);
}


function playNextSong() {
  if (songQueue.length === 0) return;

  const nextSong = songQueue.shift();
  isAudioPlaying = true;

  currentSong = nextSong;
  const nowPlayingDiv = document.getElementById('nowPlaying');
  const titleSpan = document.getElementById('currentSongTitle');
  nowPlayingDiv.style.display = 'block';
  titleSpan.textContent = nextSong.title;

  window.electronAPI.getAudioStream(nextSong.url).then(streamUrl => {
    if (streamUrl) {
      window.electronAPI.openAudioWindow(nextSong.title, streamUrl);
    }
  });

  // Remove visual song request
  const list = document.getElementById('songList');
  if (list.firstChild) list.removeChild(list.firstChild);
}



audioPlayer.addEventListener('ended', () => {
  isAudioPlaying = false;
  document.getElementById('nowPlaying').style.display = 'none'; // hide it
  playNextSong(); // if anything left
});

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
    'hutao.mp4',
    'default.mp4'
  ];

  const randomFile = videoList[Math.floor(Math.random() * videoList.length)];
  video.src = `gift-videos/${randomFile}`;
  video.style.display = 'block';
  video.muted = false;
  video.currentTime = 0;
  video.volume = 0.5;

  video.onerror = () => cleanupAfterVideo();
  video.onloadeddata = () => {
    const width = video.videoWidth || 400;
    const height = video.videoHeight || 400;

    container.style.maxWidth = `${width}px`;
    container.style.maxHeight = `${height}px`;
    window.electronAPI.resizeWindow(width, height);

    video.play().then(() => {
      setTimeout(() => {
        if (!video.paused) {
          video.pause();
          cleanupAfterVideo();
        }
      }, 19000);
    }).catch(cleanupAfterVideo);
  };

  video.onended = cleanupAfterVideo;
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
  resetInteractionTimer();
  processGiftQueue();
}

document.addEventListener('DOMContentLoaded', () => {
  window.electronAPI.onLiveStarted(() => {
    liveStartTime = Date.now();
    clearInterval(liveTimerInterval);

    liveTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - liveStartTime) / 1000);
      liveStatus.textContent = `🟢 Live sekarang — ${formatDuration(elapsed)}`;
    }, 1000);
  });

  window.electronAPI.onViewerCount(viewerCount => {
    const now = Date.now();
    if (now - lastViewerCountUpdate > 3000) {
      latestViewerCount = viewerCount;
      viewerStatus.textContent = `👀 ${viewerCount} sedang menonton`;
      resetInteractionTimer();
      lastViewerCountUpdate = now;
    }
  });

  window.electronAPI.onNewComment((data) => {
    resetInteractionTimer();

    const commentText = data.comment;
    const shortName = truncateNickname(data.nickname);
    const fullDisplayText = `${shortName}: ${commentText}`;

    const div = document.createElement('div');
    div.className = 'comment new';
    div.title = `${data.nickname}: ${commentText}`;

    const span = document.createElement('span');
    span.textContent = fullDisplayText;
    div.appendChild(span);


    if (commentText.toLowerCase().includes('!play')) {
      const match = commentText.match(/!play\s+(.*)/i);
      const playText = match ? match[1].trim() : '';

      if (playText) {
        window.electronAPI.searchYouTube(playText).then((song) => {
          if (!song) {
            console.warn('Tiada hasil untuk:', playText);
            return;
          }

          // Create visual element
          const songDiv = document.createElement('div');
          songDiv.className = 'song-request';
          songDiv.innerHTML = `
<div><strong>${truncateNickname(data.nickname)}</strong> minta:
<span>${song.title}</span></div>`;

          songListEl.appendChild(songDiv);

          // Add to queue and auto-play if idle
          songQueue.push({ title: song.title, url: song.url });
          if (!isAudioPlaying) playNextSong();

          // Limit to 5 visible
          while (songListEl.children.length > 5) {
            songListEl.removeChild(songListEl.firstChild);
          }
        });

      }
    }



    if (commentText.toLowerCase().startsWith('!skip')) {
      audioPlayer.pause();
      playNextSong();
    }

    // Handle !giveaway
    if (commentText.toLowerCase().startsWith('!giveaway')) {
      const match = commentText.match(/!giveaway\s+(.*)/i);
      const giveawayName = match ? match[1].trim() : data.nickname;
      if (giveawayName.length > 0) window.electronAPI.addToWheel(giveawayName);
    }

    // UID button
    const uidPatterns = [
      { game: 'Genshin Impact', regex: /\b8\d{8}\b/, region: 'Asia' },
      { game: 'Honkai: Star Rail', regex: /\b2\d{8}\b/, region: 'Asia' },
      { game: 'Zenless Zone Zero', regex: /\b13\d{8}\b/, region: 'Asia' },
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
            setTimeout(() => (copyUidBtn.textContent = '📋'), 1000);
          } catch (err) {
            console.error('❌ Clipboard error:', err);
          }
        };
        div.appendChild(copyUidBtn);
        break;
      }
    }

    commentList.appendChild(div);
    while (commentList.children.length > 2) {
      commentList.removeChild(commentList.firstChild);
    }

    commentList.scrollTop = commentList.scrollHeight;
    commentBox.textContent = fullDisplayText;

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

    if (isDuplicateGift(gift)) return;

    lastGift = gift;
    giftVideoQueue.push(gift);
    processGiftQueue();
    resetInteractionTimer();
  });

  window.electronAPI.onLiveEnded(() => {
    document.body.style.transition = 'opacity 1s ease';
    document.body.style.opacity = '0';
    setTimeout(() => window.electronAPI.quitApp(), 1000);
  });

  window.electronAPI.onPopupAudioClosed(() => {
    isAudioPlaying = false;

    // Remove first song from UI
    const list = document.getElementById('songList');
    if (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    // If no more songs, hide the "Now Playing" section
    if (songQueue.length === 0) {
      document.getElementById('nowPlaying').style.display = 'none';
    }

    // Play next song in queue
    playNextSong();
  });


  console.log('👋 Renderer loaded');
});

function isDuplicateGift(gift) {
  return (
    lastGift &&
    lastGift.nickname === gift.nickname &&
    lastGift.giftName === gift.giftName &&
    lastGift.repeatCount === gift.repeatCount &&
    Date.now() - lastGift.timestamp < 1000
  );
}
