/**
 * Regression tests: untrusted text from a project's .claude/ files, .mcp.json,
 * downloaded components or CLI arguments must never reach a shell, and the
 * local dashboards must not be reachable from other machines or web pages.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const express = require('express');
const WebSocket = require('ws');

const SRC = path.join(__dirname, '../../src');

describe('health-check commandExists', () => {
  const { HealthChecker } = require('../../src/health-check');

  it('does not run a hook command through the shell', () => {
    const marker = path.join(os.tmpdir(), `cct-hc-${process.pid}`);
    fs.rmSync(marker, { force: true });
    const checker = new HealthChecker();
    expect(checker.commandExists(`ls; touch ${marker}`)).toBe(false);
    expect(checker.commandExists(`$(touch ${marker})`)).toBe(false);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('still finds real executables on PATH', () => {
    const checker = new HealthChecker();
    expect(checker.commandExists('node')).toBe(true);
    expect(checker.commandExists('definitely-not-a-command-cct')).toBe(false);
  });
});

describe('claude launcher (--prompt, template review)', () => {
  const { claudeLaunchSpec, claudeCommandLine } = require('../../src/claude-launcher');

  it('passes a prompt as one argv entry without a shell on POSIX', () => {
    const prompt = "don't $(touch /tmp/x); fix the \"bug\" && ship";
    expect(claudeLaunchSpec([prompt], 'linux')).toEqual({ command: 'claude', args: [prompt], shell: false });
    expect(claudeLaunchSpec([prompt], 'darwin').shell).toBe(false);
  });

  it('quotes each argument as one word for cmd.exe on Windows', () => {
    const spec = claudeLaunchSpec(['fix the "bug" & ship it\\'], 'win32');
    expect(spec.shell).toBe(true);
    expect(spec.args).toEqual(["\"fix the 'bug' & ship it\\\\\""]);
  });

  it('prints a copy-pasteable command', () => {
    expect(claudeCommandLine(["it's $(x)"])).toBe("claude 'it'\\''s $(x)'");
  });

  it('is the only way the CLI starts claude', () => {
    for (const file of ['index.js', 'file-operations.js']) {
      const src = fs.readFileSync(path.join(SRC, file), 'utf8');
      expect(src).not.toMatch(/shell:\s*true/);
      expect(src).not.toMatch(/spawn\(\s*['"]sh['"]/);
      expect(src).not.toMatch(/spawn\(\s*['"]claude['"]/);
    }
  });
});

describe('local dashboard guard', () => {
  const { isAllowedHost, isAllowedOrigin, localOnly, verifyLocalWebSocket, LISTEN_HOST } =
    require('../../src/local-server-guard');

  it('accepts only loopback hosts on the dashboard port', () => {
    expect(isAllowedHost('localhost:3333', 3333)).toBe(true);
    expect(isAllowedHost('127.0.0.1:3333', 3333)).toBe(true);
    expect(isAllowedHost('[::1]:3333', 3333)).toBe(true);
    expect(isAllowedHost('LOCALHOST:3333', 3333)).toBe(true);
    expect(isAllowedHost('localhost:3334', 3333)).toBe(false);
    expect(isAllowedHost('localhost', 3333)).toBe(false);
    expect(isAllowedHost('evil.example:3333', 3333)).toBe(false);
    expect(isAllowedHost('localhost.evil.example:3333', 3333)).toBe(false);
    expect(isAllowedHost('192.168.1.20:3333', 3333)).toBe(false);
    expect(isAllowedHost(undefined, 3333)).toBe(false);
  });

  it('accepts no Origin (curl) or the dashboard itself, nothing else', () => {
    expect(isAllowedOrigin(undefined, 3333)).toBe(true);
    expect(isAllowedOrigin('http://localhost:3333', 3333)).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:3333', 3333)).toBe(true);
    expect(isAllowedOrigin('http://evil.example', 3333)).toBe(false);
    expect(isAllowedOrigin('http://localhost:4000', 3333)).toBe(false);
    expect(isAllowedOrigin('https://localhost:3333', 3333)).toBe(false);
    expect(isAllowedOrigin('null', 3333)).toBe(false);
  });

  it('both dashboards listen on loopback and use the guard', () => {
    expect(LISTEN_HOST).toBe('127.0.0.1');
    for (const file of ['analytics.js', 'chats-mobile.js']) {
      const src = fs.readFileSync(path.join(SRC, file), 'utf8');
      expect(src).toMatch(/\.listen\(this\.port, LISTEN_HOST/);
      expect(src).toMatch(/localOnly\(this\.port\)/);
      expect(src).toMatch(/verifyClient: verifyLocalWebSocket\(this\.port\)/);
      expect(src).not.toMatch(/Access-Control-Allow-Origin/);
      expect(src).not.toMatch(/cloudflared|trycloudflare/);
    }
  });

  describe('over HTTP and WebSocket', () => {
    let server;
    let port;
    let wss;

    beforeAll(async () => {
      const app = express();
      server = http.createServer(app);
      await new Promise(resolve => server.listen(0, LISTEN_HOST, resolve));
      port = server.address().port;
      app.use(localOnly(port));
      app.get('/api/conversations', (req, res) => res.json({ conversations: [] }));

      const WebSocketServer = require('../../src/analytics/notifications/WebSocketServer');
      wss = new WebSocketServer(server, { path: '/ws', verifyClient: verifyLocalWebSocket(port) });
      jest.spyOn(console, 'log').mockImplementation(() => {});
      await wss.initialize();
    });

    afterAll(async () => {
      await wss.close();
      await new Promise(resolve => server.close(resolve));
      console.log.mockRestore();
    });

    const get = (headers) => new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: '/api/conversations', headers }, (res) => {
        res.resume();
        resolve(res);
      }).on('error', reject);
    });

    const connect = (origin) => new Promise((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin, headers: { Host: `localhost:${port}` } });
      socket.on('open', () => { socket.close(); resolve('open'); });
      socket.on('unexpected-response', (req, res) => resolve(res.statusCode));
      socket.on('error', () => resolve('error'));
    });

    it('serves the dashboard on localhost', async () => {
      expect((await get({ Host: `localhost:${port}` })).statusCode).toBe(200);
      expect((await get({ Host: `localhost:${port}`, Origin: `http://localhost:${port}` })).statusCode).toBe(200);
    });

    it('refuses DNS rebinding hosts and cross-site pages, with no CORS headers', async () => {
      const rebound = await get({ Host: `evil.example:${port}` });
      expect(rebound.statusCode).toBe(403);
      const fromPage = await get({ Host: `localhost:${port}`, Origin: 'http://evil.example' });
      expect(fromPage.statusCode).toBe(403);
      expect(fromPage.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('accepts the WebSocket from the dashboard page only', async () => {
      expect(await connect(`http://localhost:${port}`)).toBe('open');
      expect(await connect('http://evil.example')).toBe(401);
    });
  });
});
