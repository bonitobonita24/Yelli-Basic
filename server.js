/**
 * INTERCOM - Local Network Signaling Server
 * Run: node server.js
 * Then open https://<your-ip>:PORT on both devices.
 *
 * Admin UI: /_pwbt/  (Basic Auth, defaults to admin/admin -- set
 *   ADMIN_USER and ADMIN_PASSWORD env vars to change)
 */

const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');

// ---------- Config ----------
const PORT       = process.env.PORT || 3000;
const APP_NAME   = process.env.APP_NAME   || 'INTERCOM';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin';

const PUBLIC_DIR    = path.resolve(__dirname, 'public');
const DATA_DIR      = path.resolve(__dirname, 'data');
const BRANDING_FILE = path.join(DATA_DIR, 'branding.json');
const LOGO_BASE     = 'logo';
const APPLY_UPDATE  = path.resolve(__dirname, 'deploy', 'windows', 'apply-update.ps1');

const CERT_PATH = path.join(__dirname, 'certs', 'cert.pem');
const KEY_PATH  = path.join(__dirname, 'certs', 'key.pem');
const useHttps  = fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);

// ---------- Helpers ----------
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function sanitizeName(raw) {
  const s = (typeof raw === 'string' ? raw : '').trim();
  return s ? s.slice(0, 30) : 'Guest';
}

function sanitizeBrandName(raw) {
  return (typeof raw === 'string' ? raw : '').trim().slice(0, 40);
}

function readBranding() {
  try { return JSON.parse(fs.readFileSync(BRANDING_FILE, 'utf8')); }
  catch { return { name: APP_NAME, logoFile: null, updatedAt: null }; }
}

function writeBranding(b) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(BRANDING_FILE, JSON.stringify(b, null, 2));
}

function effectiveAppName() {
  const n = (readBranding().name || '').trim();
  return n || APP_NAME;
}

function findLogoPath() {
  const b = readBranding();
  if (!b.logoFile) return null;
  const p = path.join(DATA_DIR, b.logoFile);
  return fs.existsSync(p) ? p : null;
}

function constantTimeEqual(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba);   // dummy compare to keep timing uniform
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

function checkBasicAuth(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) return false;
  try {
    const idx = Buffer.from(auth.slice(6), 'base64').toString().indexOf(':');
    if (idx < 0) return false;
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const u = decoded.slice(0, idx);
    const p = decoded.slice(idx + 1);
    const uOk = constantTimeEqual(u, ADMIN_USER);
    const pOk = constantTimeEqual(p, ADMIN_PASS);
    return uOk && pOk;
  } catch { return false; }
}

function requireAuth(req, res) {
  if (checkBasicAuth(req)) return true;
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Yelli Admin"' });
  res.end('Authentication required');
  return false;
}

function readJsonBody(req, limit = 3_500_000) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', c => {
      buf += c;
      if (buf.length > limit) { reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(JSON.parse(buf || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function decodeDataUrl(dataUrl) {
  // SVG intentionally rejected: an admin (or an attacker with default admin creds)
  // could upload a script-bearing SVG; serving it as image/svg+xml would XSS the
  // origin when the logo URL is opened directly. PNG/JPG only.
  const m = /^data:image\/(png|jpe?g);base64,([\s\S]+)$/i.exec(dataUrl || '');
  if (!m) return null;
  const sub = m[1].toLowerCase();
  const ext = sub === 'jpeg' ? 'jpg' : sub;
  return { ext, buffer: Buffer.from(m[2], 'base64') };
}

function getCurrentCommit() {
  // Look for .git in the update-source clone first (production), then alongside server.js (dev)
  const candidates = [
    path.resolve(__dirname, '..', '.update-source', '.git'),
    path.resolve(__dirname, '.update-source', '.git'),
    path.resolve(__dirname, '..', '.git'),
    path.resolve(__dirname, '.git'),
  ];
  for (const gitDir of candidates) {
    try {
      if (!fs.existsSync(gitDir)) continue;
      const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
      let sha;
      if (head.startsWith('ref: ')) {
        sha = fs.readFileSync(path.join(gitDir, head.slice(5)), 'utf8').trim();
      } else { sha = head; }
      return sha.slice(0, 7);
    } catch { /* try next */ }
  }
  return null;
}

// ---------- MIME ----------
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.ico':  'image/x-icon',
  '.mp3':  'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.png':  'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
};

function serveStaticFile(req, res, baseDir, urlPath) {
  const filePath = path.resolve(baseDir, '.' + urlPath);
  if (filePath !== baseDir && !filePath.startsWith(baseDir + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    if (ext === '.html') {
      data = Buffer.from(data.toString('utf8').replace(/\{\{APP_NAME\}\}/g, effectiveAppName()));
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

function serveLogo(req, res) {
  const p = findLogoPath();
  if (!p) { res.writeHead(404); res.end('No logo set'); return; }
  const ext  = path.extname(p).toLowerCase();
  // Whitelist enforced (upload path drops anything but PNG/JPG); double-check on read.
  if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
    res.writeHead(415); res.end('Unsupported logo format'); return;
  }
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'",
  });
  fs.createReadStream(p).pipe(res);
}

// ---------- Admin API ----------
async function handleAdminApi(req, res, urlPath) {
  if (!requireAuth(req, res)) return;

  if (urlPath === '/_pwbt/api/branding' && req.method === 'GET') {
    const b = readBranding();
    return sendJson(res, 200, {
      name: b.name || APP_NAME,
      logoUrl: findLogoPath() ? '/branding/logo' : null,
      updatedAt: b.updatedAt,
      commit: getCurrentCommit(),
      defaultsActive: ADMIN_USER === 'admin' && ADMIN_PASS === 'admin',
    });
  }

  if (urlPath === '/_pwbt/api/branding' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const name = sanitizeBrandName(body.name);
      let logoFile = readBranding().logoFile;

      if (body.logoDataUrl === null) {
        if (logoFile) {
          try { fs.unlinkSync(path.join(DATA_DIR, logoFile)); } catch {}
        }
        logoFile = null;
      } else if (typeof body.logoDataUrl === 'string' && body.logoDataUrl) {
        const dec = decodeDataUrl(body.logoDataUrl);
        if (!dec) return sendJson(res, 400, { error: 'Invalid logo format (need PNG, JPG, or SVG data URL).' });
        if (dec.buffer.length > 2_000_000) return sendJson(res, 400, { error: 'Logo too large (max 2 MB).' });
        ensureDir(DATA_DIR);
        const nextFile = `${LOGO_BASE}.${dec.ext}`;
        if (logoFile && logoFile !== nextFile) {
          try { fs.unlinkSync(path.join(DATA_DIR, logoFile)); } catch {}
        }
        fs.writeFileSync(path.join(DATA_DIR, nextFile), dec.buffer);
        logoFile = nextFile;
      }

      writeBranding({ name, logoFile, updatedAt: new Date().toISOString() });
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      return sendJson(res, 400, { error: String(e.message || e) });
    }
  }

  if (urlPath === '/_pwbt/api/update' && req.method === 'POST') {
    if (!fs.existsSync(APPLY_UPDATE)) {
      return sendJson(res, 500, { error: 'apply-update.ps1 not found. Reinstall via Install-Yelli.cmd to enable updates.' });
    }
    try {
      const child = spawn('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', APPLY_UPDATE],
        { detached: true, stdio: 'ignore' });
      child.unref();
      return sendJson(res, 202, { status: 'started', message: 'Update launched. Service restarts in ~10-30s.' });
    } catch (e) {
      return sendJson(res, 500, { error: String(e.message || e) });
    }
  }

  return sendJson(res, 404, { error: 'Unknown admin endpoint' });
}

// ---------- Request router ----------
const ADMIN_DIR = path.resolve(__dirname, 'public', '_pwbt');

function requestHandler(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url === '/' ? '/index.html' : req.url).split('?')[0]);
  } catch {
    res.writeHead(400); res.end('Bad request'); return;
  }

  // Public branding endpoint (used by index.html to live-update name on the fly)
  if (urlPath === '/api/branding' && req.method === 'GET') {
    const b = readBranding();
    return sendJson(res, 200, {
      name: b.name || APP_NAME,
      logoUrl: findLogoPath() ? '/branding/logo' : null,
    });
  }

  // Public logo file
  if (urlPath === '/branding/logo') return serveLogo(req, res);

  // Admin namespace
  if (urlPath.startsWith('/_pwbt')) {
    if (urlPath.startsWith('/_pwbt/api/')) return handleAdminApi(req, res, urlPath);
    if (!requireAuth(req, res)) return;
    const relative = urlPath === '/_pwbt' || urlPath === '/_pwbt/' ? '/index.html' : urlPath.slice('/_pwbt'.length);
    return serveStaticFile(req, res, ADMIN_DIR, relative);
  }

  // Default: public/
  serveStaticFile(req, res, PUBLIC_DIR, urlPath);
}

// ---------- HTTP(S) + WS ----------
const httpServer = useHttps
  ? https.createServer({ cert: fs.readFileSync(CERT_PATH), key: fs.readFileSync(KEY_PATH) }, requestHandler)
  : http.createServer(requestHandler);

const wss = new WebSocketServer({ server: httpServer });

const clients = new Map();   // id -> ws
const names   = new Map();   // id -> displayName

function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(obj, excludeId = null) {
  for (const [id, ws] of clients) if (id !== excludeId) send(ws, obj);
}

wss.on('connection', (ws) => {
  let myId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'register': {
        myId = msg.id;
        const displayName = sanitizeName(msg.displayName);
        clients.set(myId, ws);
        names.set(myId, displayName);
        console.log(`[+] Registered: ${myId} as "${displayName}"  (total: ${clients.size})`);
        const others = [...clients.keys()]
          .filter(id => id !== myId)
          .map(id => ({ id, displayName: names.get(id) }));
        send(ws, { type: 'peers', peers: others });
        broadcast({ type: 'peer-joined', id: myId, displayName }, myId);
        break;
      }
      case 'rename': {
        if (!myId) break;
        const displayName = sanitizeName(msg.displayName);
        names.set(myId, displayName);
        console.log(`[~] Renamed: ${myId} -> "${displayName}"`);
        broadcast({ type: 'peer-renamed', id: myId, displayName }, myId);
        break;
      }
      case 'offer':
      case 'answer':
      case 'ice-candidate':
      case 'call-request':
      case 'call-accept':
      case 'call-reject':
      case 'call-end': {
        const target = clients.get(msg.to);
        if (target) send(target, { ...msg, from: myId });
        else send(ws, { type: 'error', message: `Peer ${msg.to} not found` });
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

// ---------- Boot ----------
httpServer.listen(PORT, '0.0.0.0', () => {
  const proto = useHttps ? 'https' : 'http';
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const eff  = effectiveAppName();
  console.log('\n+-----------------------------------------+');
  console.log(`|  ${eff} SERVER READY (${useHttps ? 'TLS' : 'PLN'})`.padEnd(43) + '|');
  console.log('+-----------------------------------------+');
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`|  ${proto}://${net.address}:${PORT}`.padEnd(43) + '|');
      }
    }
  }
  console.log(`|  ${proto}://localhost:${PORT}`.padEnd(43) + '|');
  console.log('+-----------------------------------------+');
  console.log(`Admin: ${proto}://<host>:${PORT}/_pwbt/  (user: ${ADMIN_USER})`);
  if (ADMIN_USER === 'admin' && ADMIN_PASS === 'admin') {
    console.log('!! Admin defaults active (admin/admin). Set ADMIN_USER and ADMIN_PASSWORD env vars to change.');
  }
  if (!useHttps) console.log('\n! Plain HTTP -- getUserMedia only works on localhost.');
  console.log('\nOpen the URL on BOTH devices on the same network.\n');
});
