/**
 * Minimal local dev server for Vercel serverless functions.
 * Mounts the /api/collections handlers on port 3000.
 *
 * Usage: node api/dev-server.js
 * Requires: .env with NEON_DATABASE_URL, CLERK_SECRET_KEY
 */
import { createServer } from 'node:http';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

import collectionsIndex from './collections/index.js';
import collectionsId from './collections/[id].js';
import collectionsItems from './collections/items.js';

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
  });
}

function createRes(nodeRes) {
  const headers = {};
  return {
    statusCode: 200,
    setHeader(k, v) { headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) {
      nodeRes.writeHead(this.statusCode, { ...headers, 'Content-Type': 'application/json' });
      nodeRes.end(JSON.stringify(data));
    },
    end(body) {
      nodeRes.writeHead(this.statusCode, headers);
      nodeRes.end(body);
    },
  };
}

const server = createServer(async (req, nodeRes) => {
  // CORS
  nodeRes.setHeader('Access-Control-Allow-Origin', '*');
  nodeRes.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  nodeRes.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    nodeRes.writeHead(200);
    nodeRes.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:3000`);
  const path = url.pathname;

  req.body = await parseBody(req);
  req.query = Object.fromEntries(url.searchParams);
  const res = createRes(nodeRes);

  try {
    if (path === '/api/collections' || path === '/api/collections/') {
      await collectionsIndex(req, res);
    } else if (path === '/api/collections/items' || path === '/api/collections/items/') {
      await collectionsItems(req, res);
    } else if (path.match(/^\/api\/collections\/[^/]+$/)) {
      req.query.id = path.split('/').pop();
      await collectionsId(req, res);
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.API_PORT || 3000;
server.listen(PORT, () => {
  console.log(`API dev server running on http://localhost:${PORT}`);
});
