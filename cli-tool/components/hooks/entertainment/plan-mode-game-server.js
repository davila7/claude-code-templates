#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3456;
const PID_FILE = path.join(__dirname, 'server.pid');
const SECRET_FILE = path.join(__dirname, '.secret');
const sseClients = new Set();

function getSecret() {
  try {
    return fs.readFileSync(SECRET_FILE, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
    return secret;
  }
}

const hmacSecret = getSecret();

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Serve the game
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const htmlPath = path.join(__dirname, 'index.html');
    fs.readFile(htmlPath, (err, data) => {
      if (err) { res.writeHead(500); return res.end('Error loading game'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // SSE endpoint
  if (req.method === 'GET' && req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('data: connected\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // Trigger announcement
  if (req.method === 'POST' && req.url === '/done') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1024) req.destroy(); });
    req.on('end', () => {
      const message = body || 'Claude Finished!';
      for (const client of sseClients) {
        client.write(`event: done\ndata: ${message}\n\n`);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, clients: sseClients.size }));
    });
    return;
  }

  // Activity feed from hooks
  if (req.method === 'POST' && req.url === '/activity') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 8192) req.destroy(); });
    req.on('end', () => {
      for (const client of sseClients) {
        client.write(`event: activity\ndata: ${body}\n\n`);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // Pause - Claude needs user input
  if (req.method === 'POST' && req.url === '/pause') {
    for (const client of sseClients) {
      client.write(`event: pause\ndata: Claude needs you\n\n`);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  // Status - check if plan mode is active
  if (req.method === 'GET' && req.url === '/status') {
    const planActive = fs.existsSync(path.join(__dirname, '.plan-active'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ planActive }));
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', clients: sseClients.size }));
  }

  // Share scores - generate signed URL
  if (req.method === 'POST' && req.url === '/share') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1024) req.destroy(); });
    req.on('end', () => {
      try {
        const { dino, snake, flappy } = JSON.parse(body);
        const payload = { d: dino || 0, s: snake || 0, f: flappy || 0, t: Date.now() };
        const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const sig = crypto.createHmac('sha256', hmacSecret).update(payloadB64).digest('hex').slice(0, 16);
        const token = `${payloadB64}.${sig}`;
        const url = `http://localhost:${PORT}/v/${token}`;
        const text = [
          'Plan Mode Game Scores:',
          `\u{1F995} Dino Runner: ${payload.d} pts`,
          `\u{1F40D} Snake: ${payload.s} pts`,
          `\u{1F426} Flappy Bird: ${payload.f} pts`,
          '',
          `Verify: ${url}`
        ].join('\n');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ url, text }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  // Verify scores - render verification page
  if (req.method === 'GET' && req.url.startsWith('/v/')) {
    const token = req.url.slice(3);
    const dotIdx = token.lastIndexOf('.');
    let valid = false, payload = null;

    if (dotIdx > 0) {
      const payloadB64 = token.slice(0, dotIdx);
      const sig = token.slice(dotIdx + 1);
      const expected = crypto.createHmac('sha256', hmacSecret).update(payloadB64).digest('hex').slice(0, 16);
      valid = sig === expected;
      try { payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()); } catch { valid = false; }
    }

    const ts = payload && payload.t ? new Date(payload.t).toLocaleString() : 'Unknown';
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${valid ? 'Verified' : 'Invalid'} - Plan Mode Game</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a2e;color:#e5e7eb;font-family:'Courier New',monospace;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{text-align:center;max-width:420px;padding:40px;background:#12121f;border:1px solid #2d2d4e;border-radius:16px}
.icon{width:100px;height:100px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:48px}
.icon.valid{background:linear-gradient(135deg,#059669,#10b981);box-shadow:0 0 40px rgba(16,185,129,0.3)}
.icon.invalid{background:linear-gradient(135deg,#dc2626,#ef4444);box-shadow:0 0 40px rgba(239,68,68,0.3)}
h1{font-size:28px;margin-bottom:8px;letter-spacing:1px}
h1.valid{color:#10b981}
h1.invalid{color:#ef4444}
.subtitle{color:#6b7280;font-size:13px;margin-bottom:28px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
td{padding:10px 16px;border-bottom:1px solid #1e1e35;font-size:14px}
tr:last-child td{border-bottom:none}
.game{color:#d1d5db;text-align:left}
.pts{color:#a78bfa;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}
.meta{color:#4b5563;font-size:11px;letter-spacing:0.5px}
.play-link{display:inline-block;margin-top:20px;color:#a78bfa;text-decoration:none;font-size:13px;letter-spacing:1px;padding:10px 24px;border:1px solid #7c3aed;border-radius:8px;transition:all 0.2s}
.play-link:hover{background:#7c3aed;color:#fff}
</style></head><body><div class="card">
<div class="icon ${valid ? 'valid' : 'invalid'}">${valid ? '\u2713' : '\u2717'}</div>
<h1 class="${valid ? 'valid' : 'invalid'}">${valid ? 'VERIFIED' : 'INVALID'}</h1>
<p class="subtitle">${valid ? 'These scores are authentic' : 'This score link has been tampered with'}</p>
${valid && payload ? `<table>
<tr><td class="game">\u{1F995} Dino Runner</td><td class="pts">${payload.d} pts</td></tr>
<tr><td class="game">\u{1F40D} Snake</td><td class="pts">${payload.s} pts</td></tr>
<tr><td class="game">\u{1F426} Flappy Bird</td><td class="pts">${payload.f} pts</td></tr>
</table>
<p class="meta">Shared on ${ts}</p>` : ''}
<a class="play-link" href="/">Play Plan Mode Game</a>
</div></body></html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// Handle port conflicts
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use. Exiting.`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  fs.writeFileSync(PID_FILE, String(process.pid));
  console.log(`Plan Mode Game server running on http://localhost:${PORT}`);
});

// SSE heartbeat - keeps connections alive and cleans dead clients
setInterval(() => {
  for (const client of sseClients) {
    try { client.write(': heartbeat\n\n'); }
    catch { sseClients.delete(client); }
  }
}, 30000);

// Cleanup on exit
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

function cleanup() {
  try { fs.unlinkSync(PID_FILE); } catch {}
  server.close();
  process.exit(0);
}
