# 📡 INTERCOM — Local Network Video Intercom

One-on-one video calling over your local network. No internet required after setup.

## Requirements
- Node.js (v16 or newer) — https://nodejs.org

## Quick Start

```bash
# 1. Install dependencies (one time only)
npm install

# 2. Start the server
node server.js
```

The server will print your local network URL, e.g.:
```
┌─────────────────────────────────────────┐
│           INTERCOM SERVER READY          │
├─────────────────────────────────────────┤
│  http://192.168.1.42:3000               │
│  http://localhost:3000                  │
└─────────────────────────────────────────┘
```

## Usage

1. Open `http://<your-ip>:3000` on **both devices** (same Wi-Fi/LAN)
2. Both devices appear in each other's **peer list** automatically
3. Click the peer name to select it
4. Press the big **📞 CALL** button
5. The other device sees an incoming call popup — press **ACCEPT**
6. 🎉 Video call connects!

## Device Roles

| Role | Can call | Can receive |
|------|----------|-------------|
| **Both sides** (default) | ✅ | ✅ |
| **Caller only** | ✅ | ❌ |
| **Receiver only** | ❌ | ✅ |

## Notes

- Works on the **same local network** (Wi-Fi, LAN)
- No internet needed for calls — the server only relays the initial handshake
- Video/audio travels **peer-to-peer** via WebRTC after connection
- Port 3000 must be accessible on your LAN (check Windows Firewall if needed)

## Change Port

```bash
PORT=8080 node server.js
```
