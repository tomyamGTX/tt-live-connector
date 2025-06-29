const { ipcRenderer } = require('electron');

const commentBox = document.getElementById('comment');
const commentList = document.getElementById('comments');
const giftMsg = document.getElementById('giftThankYou');
const video = document.getElementById('giftVideo');
const liveStatus = document.getElementById('liveStatus');

let timeoutId;
let latestViewerCount = 0;
let lastCommentTime = 0;
let liveStartTime = null;
let liveTimerInterval = null;

// 🕐 Format duration as HH:MM:SS
function formatDuration(seconds) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// ✂️ Truncate long nicknames
function truncateNickname(nickname, maxLength = 25) {
    return nickname.length > maxLength ? nickname.slice(0, maxLength) + '…' : nickname;
}

// 🟢 Live started
ipcRenderer.on('live-started', () => {
    liveStartTime = Date.now();

    if (liveTimerInterval) clearInterval(liveTimerInterval);

    liveTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - liveStartTime) / 1000);
        if (liveStatus) {
            liveStatus.textContent = `🟢 Live sekarang — ${formatDuration(elapsed)}`;
        }
    }, 1000);
});

// 👀 Viewer count
ipcRenderer.on('viewer-count', (_, viewerCount) => {
    latestViewerCount = viewerCount;

    const now = Date.now();
    if (now - lastCommentTime > 6000) {
        commentBox.textContent = `👀 ${viewerCount} sedang menonton`;
        commentBox.style.opacity = 0.5;
    }
});

ipcRenderer.on('new-comment', (_, data) => {
    console.log('📩 Received comment:', data);

    const div = document.createElement('div');
    div.className = 'comment';

    const shortName = truncateNickname(data.nickname);
    div.textContent = `${shortName}: ${data.comment}`;
    div.title = `${data.nickname}: ${data.comment}`;

    if (commentList) {
        commentList.appendChild(div);

        // ✅ Keep only the last 3 comments
        while (commentList.children.length > 3) {
            commentList.removeChild(commentList.firstChild);
        }

        // ✅ Scroll to the bottom if needed
        commentList.scrollTop = commentList.scrollHeight;
    }

    // Show main overlay comment
    if (commentBox) {
        commentBox.textContent = `${shortName}: ${data.comment}`;
        commentBox.style.opacity = 1;

        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            commentBox.textContent = `👀 ${latestViewerCount} sedang menonton`;
            commentBox.style.opacity = 0.6;
        }, 6000);
    }
});


// 🎁 Gift received
ipcRenderer.on('new-gift', (_, data) => {
    const text = `🎁 ${data.nickname} hantar ${data.giftName} x${data.repeatCount}`;

    const giftDiv = document.createElement('div');
    giftDiv.className = 'gift';
    giftDiv.innerText = text;

    if (commentList) {
        commentList.appendChild(giftDiv);
        commentList.scrollTop = commentList.scrollHeight;

        giftDiv.classList.add('fade-in');
        setTimeout(() => {
            giftDiv.classList.add('fade-out');
            setTimeout(() => giftDiv.remove(), 500);
        }, 5000);
    }

    if (giftMsg) {
        giftMsg.innerHTML = `🎁 Terima kasih <strong>${data.nickname}</strong> atas ${data.giftName} x${data.repeatCount} 🙏`;
        giftMsg.style.display = 'block';
        setTimeout(() => {
            giftMsg.style.display = 'none';
        }, 5000);
    }

    // 🎥 Play gift video
    const giftMap = {
        'Rose': 'rose.mp4',
        'Flower': 'flower.mp4',
        'TikTok': 'default.mp4'
    };
    const file = giftMap[data.giftName] || 'default.mp4';

    if (video) {
        video.src = `gift-videos/${file}`;
        video.style.display = 'block';
        video.currentTime = 0;
        video.play();

        video.onended = () => {
            video.style.display = 'none';
        };
    }
});

console.log('👋 Renderer loaded');
