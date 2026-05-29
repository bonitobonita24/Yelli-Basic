/**
 * INTERCOM - Local Network Signaling Server
 * Run: node server.js
 * Then open http://<your-ip>:3000 on both devices
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// ── HTTP server (serves static files from /public) ──────────────────────────
const httpServer = http.createServer((req, res) => {
  let filePath = path.join(__dirname, 'public',
    req.url === '/' ? 'index.html' : req.url);

  const ext = path.extname(filePath);
  const mime = {
    '.html': 'text/html',
    '.js':   'text/javascript',
    '.css':  'text/css',
    '.ico':  'image/x-icon',
  }[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404); res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    }
  });
});

// ── WebSocket signaling ──────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

// clients: Map<id, ws>
const clients = new Map();

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function broadcast(obj, excludeId = null) {
  for (const [id, ws] of clients) {
    if (id !== excludeId) send(ws, obj);
  }
}

wss.on('connection', (ws) => {
  let myId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      // Client announces itself
      case 'register': {
        myId = msg.id;
        clients.set(myId, ws);
        console.log(`[+] Registered: ${myId}  (total: ${clients.size})`);

        // Tell this client who else is online
        const others = [...clients.keys()].filter(id => id !== myId);
        send(ws, { type: 'peers', peers: others });

        // Tell others this client joined
        broadcast({ type: 'peer-joined', id: myId }, myId);
        break;
      }

      // Relay: offer, answer, ice-candidate, call-request, call-reject, call-end
      case 'offer':
      case 'answer':
      case 'ice-candidate':
      case 'call-request':
      case 'call-reject':
      case 'call-end': {
        const target = clients.get(msg.to);
        if (target) {
          send(target, { ...msg, from: myId });
        } else {
          send(ws, { type: 'error', message: `Peer ${msg.to} not found` });
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (myId) {
      clients.delete(myId);
      console.log(`[-] Left: ${myId}  (total: ${clients.size})`);
      broadcast({ type: 'peer-left', id: myId });
    }
  });
});

// ── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  // Print all local IPs
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│           INTERCOM SERVER READY          │');
  console.log('├─────────────────────────────────────────┤');
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`│  http://${net.address}:${PORT}`.padEnd(43) + '│');
      }
    }
  }
  console.log(`│  http://localhost:${PORT}`.padEnd(43) + '│');
  console.log('└─────────────────────────────────────────┘');
  console.log('\nOpen the URL on BOTH devices on the same network.\n');
});
