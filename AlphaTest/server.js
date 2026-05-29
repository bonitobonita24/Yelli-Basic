/**
 * INTERCOM - Local Network Signaling Server
 * Run: node server.js
 * Then open http://<your-ip>:3000 on both devices
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const APP_NAME = process.env.APP_NAME || 'INTERCOM';

function sanitizeName(raw) {
  const s = (typeof raw === 'string' ? raw : '').trim();
  if (!s) return 'Guest';
  return s.slice(0, 30);
}

// ── HTTP(S) server (serves static files from /public) ──────────────────────
const PUBLIC_DIR = path.resolve(__dirname, 'public');

// Auto-detect self-signed cert. WebRTC's getUserMedia is gated on HTTPS for
// non-localhost origins, so LAN devices need TLS to grant camera/mic access.
// Generate with: ./scripts/gen-cert.sh
const CERT_PATH = path.join(__dirname, 'certs', 'cert.pem');
const KEY_PATH  = path.join(__dirname, 'certs', 'key.pem');
const useHttps  = fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);

const requestHandler = (req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url === '/' ? '/index.html' : req.url).split('?')[0]);
  } catch {
    res.writeHead(400); res.end('Bad request'); return;
  }
  const filePath = path.resolve(PUBLIC_DIR, '.' + urlPath);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

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
      if (ext === '.html') {
        data = Buffer.from(data.toString('utf8').replace(/\{\{APP_NAME\}\}/g, APP_NAME));
      }
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    }
  });
};

const httpServer = useHttps
  ? https.createServer({
      cert: fs.readFileSync(CERT_PATH),
      key:  fs.readFileSync(KEY_PATH),
    }, requestHandler)
  : http.createServer(requestHandler);

// ── WebSocket signaling ──────────────────────────────────────────────────────
// WebSocketServer rides the same server, so ws→wss is automatic when TLS is on.
const wss = new WebSocketServer({ server: httpServer });

// clients: Map<id, ws>
const clients = new Map();           // id → ws
const names   = new Map();           // id → displayName

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
        const displayName = sanitizeName(msg.displayName);
        clients.set(myId, ws);
        names.set(myId, displayName);
        console.log(`[+] Registered: ${myId} as "${displayName}"  (total: ${clients.size})`);

        // Tell this client who else is online
        const others = [...clients.keys()]
          .filter(id => id !== myId)
          .map(id => ({ id, displayName: names.get(id) }));
        send(ws, { type: 'peers', peers: others });

        // Tell others this client joined
        broadcast({ type: 'peer-joined', id: myId, displayName }, myId);
        break;
      }

      case 'rename': {
        if (!myId) break;
        const displayName = sanitizeName(msg.displayName);
        names.set(myId, displayName);
        console.log(`[~] Renamed: ${myId} → "${displayName}"`);
        broadcast({ type: 'peer-renamed', id: myId, displayName }, myId);
        break;
      }

      // Relay: offer, answer, ice-candidate, call-request, call-accept, call-reject, call-end
      case 'offer':
      case 'answer':
      case 'ice-candidate':
      case 'call-request':
      case 'call-accept':
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
      names.delete(myId);
      console.log(`[-] Left: ${myId}  (total: ${clients.size})`);
      broadcast({ type: 'peer-left', id: myId });
    }
  });
});

// ── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  const proto = useHttps ? 'https' : 'http';
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  console.log('\n┌─────────────────────────────────────────┐');
  console.log(`│        ${APP_NAME} SERVER READY (${useHttps ? 'TLS' : 'PLN'})       │`);
  console.log('├─────────────────────────────────────────┤');
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`│  ${proto}://${net.address}:${PORT}`.padEnd(43) + '│');
      }
    }
  }
  console.log(`│  ${proto}://localhost:${PORT}`.padEnd(43) + '│');
  console.log('└─────────────────────────────────────────┘');
  if (!useHttps) {
    console.log('\n⚠ Plain HTTP — getUserMedia only works on localhost.');
    console.log('  Run ./scripts/gen-cert.sh to enable HTTPS for LAN devices.');
  }
  console.log('\nOpen the URL on BOTH devices on the same network.\n');
});
