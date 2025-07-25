# 🎥 TT Live Connector (TikTok Live Overlay)

A lightweight, always-on-top Electron app that listens to real-time TikTok Live chat and gifts — and displays them in a clean overlay, perfect for streamers, VTubers, or live content creators. Includes TTS (text-to-speech) and gift animation support!

## ✨ Features

- 📡 Real-time connection to TikTok Live using `tiktok-live-connector`
- 💬 Displays latest chat comments
- 🔊 Text-to-Speech (TTS) with multiple voices
- 🎁 Gift recognition and animation (with optional videos)
- 👀 Viewer count overlay
- 🕓 Live duration tracking
- 🎮 Always-on-top, transparent overlay — doesn't interfere with games or other windows

## 📷 Preview

> _Coming soon: GIF or screenshot here_

## 🛠 Requirements

- Node.js (v16 or newer)
- Windows (recommended) with Microsoft speech voices installed

## 🚀 Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/tt-live-connector.git
cd tt-live-connector
```

2. **Install dependencies**
```bash
npm install
```

3. **Run the app**
```bash
npm start
```

> Ensure you're live on TikTok with the correct username configured in `comment-listener.js`.

## 🔧 Configuration

Update your TikTok username in:
```js
// comment-listener.js
const username = 'your_tiktok_username';
```

### 🎙 Voice Options

You can customize or randomize from available system TTS voices like:
- `Microsoft Zira Desktop` (en-US)
- `Microsoft David Desktop` (en-US)
- `Microsoft Haruka Desktop` (ja-JP)

### 📁 Gift Video Mapping

Store your videos in the `gift-videos/` folder and map them in `renderer.js`:
```js
const giftMap = {
  'Rose': 'rose.mp4',
  'Flower': 'flower.mp4',
  'TikTok': 'default.mp4'
};
```

## 🗂 .gitignore Tips

Make sure to ignore large files like gift videos or `node_modules`:
```
/node_modules
/gift-videos
.DS_Store
```

## 💡 Ideas for Future Features

- Customize TTS per user
- WebSocket remote control
- OBS integration
- Multi-platform builds

## 📝 License

MIT

---

Made with 💜 for streamers and creators.
