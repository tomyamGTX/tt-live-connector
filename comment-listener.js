const { TikTokLiveConnection } = require('tiktok-live-connector');
const { BrowserWindow } = require('electron');
const say = require('say');

const username = 'hachimy99';
const connection = new TikTokLiveConnection(username);

let mainWindow = null;
const ttsQueue = [];
let isSpeaking = false;
const spokenMessages = new Set();
const MAX_MEMORY = 100;

// Random TTS voice pool
const availableVoices = [
    "Microsoft David Desktop",   // English
    "Microsoft Zira Desktop",    // English (female)
    "Microsoft Haruka Desktop"   // Japanese
];

function getRandomVoice() {
    const index = Math.floor(Math.random() * availableVoices.length);
    return availableVoices[index];
}

function speakNext() {
    if (ttsQueue.length === 0 || isSpeaking) return;

    isSpeaking = true;
    const { comment } = ttsQueue.shift();
    const voice = getRandomVoice();
    console.log(`🔊 Speaking: ${comment} with ${voice}`);

    say.speak(comment, voice, 0.9, (err) => {
        isSpeaking = false;
        if (err) {
            console.error('TTS Error:', err);
        }
        setTimeout(speakNext, 250); // Smooth delay before next TTS
    });
}

function attachListener(win) {
    mainWindow = win;

    async function tryConnect() {
        try {
            await connection.connect();
            console.log(`✅ Connected to TikTok Live for @${username}`);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('live-started'); // ✅ Notify renderer
            }
        } catch (err) {
            console.error("❌ TikTok not live. Retrying in 30s...");
            setTimeout(tryConnect, 30000);
        }
    }

    tryConnect();

    // Viewer count updates
    connection.on('roomUser', (data) => {
        const viewerCount = data.viewerCount || 0;
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('viewer-count', viewerCount);
        }
    });

    // Chat message listener
    connection.on('chat', (msg) => {
        const user = msg.user || msg;
        const nickname = user.nickname || "Seseorang";
        const comment = msg.comment?.trim() || "";

        if (comment.length === 0 || comment.length > 300) return;

        const fullMessage = `${nickname}: ${comment}`;

        if (spokenMessages.has(fullMessage)) return;

        spokenMessages.add(fullMessage);
        if (spokenMessages.size > MAX_MEMORY) {
            const first = spokenMessages.values().next().value;
            spokenMessages.delete(first);
        }

        console.log(`💬 ${nickname}: ${comment}`);

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('new-comment', { nickname, comment });
        }

        ttsQueue.push({ comment });
        speakNext();
    });

    // Gift event
    connection.on('gift', (data) => {
        const user = data.user || {};
        const nickname = user.nickname || "Seseorang";
        const giftName = data.giftName || "hadiah";
        const repeatCount = data.repeatCount || 1;

        console.log(`🎁 ${nickname} sent ${giftName} x${repeatCount}`);

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('new-gift', {
                nickname,
                giftName,
                repeatCount
            });
        }

        const thankYouMsg = `Terima kasih ${nickname} menghantar ${giftName} sebanyak ${repeatCount} kali`;
        ttsQueue.push({ comment: thankYouMsg });
        speakNext();
    });

    connection.on('liveEnd', handleLiveEnd);
    connection.on('streamEnd', handleLiveEnd);

    function handleLiveEnd() {
        console.log("🔴 Live ended");
        setTimeout(() => {
            app.quit();
        }, 2000);
    }
}

module.exports = { attachListener };
