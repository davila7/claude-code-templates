/**
 * Regression tests: untrusted text from a project's .claude/ files, .mcp.json,
 * downloaded components or CLI arguments must never reach a shell, and local
 * servers must not be reachable from web pages.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

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

describe('stats commands spawn claude without a shell', () => {
  it.each(['command-stats.js', 'hook-stats.js', 'mcp-stats.js'])('%s', (file) => {
    const src = fs.readFileSync(path.join(__dirname, '../../src', file), 'utf8');
    expect(src).not.toMatch(/spawn\(\s*['"]sh['"]/);
    expect(src).toMatch(/spawn\('claude', \[/);
  });
});

describe('global agent wrapper', () => {
  it('passes prompts to claude as argv, not a shell string', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../src/sdk/global-agent-manager.js'), 'utf8');
    expect(src).toMatch(/execFileSync\('claude', claudeArgs/);
    expect(src).not.toMatch(/execSync\(claudeCmd/);
  });
});

describe('session sharing', () => {
  const SessionSharing = require('../../src/session-sharing');

  it('refuses non-http session URLs before running curl', async () => {
    const sharing = new SessionSharing(null);
    await expect(sharing.downloadSession('file:///etc/passwd')).rejects.toThrow(/protocol/);
    await expect(sharing.downloadSession('"; touch /tmp/x; "')).rejects.toThrow(/Invalid session URL/);
  });

  it('refuses a conversation id that is not a plain filename', async () => {
    const sharing = new SessionSharing(null);
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cct-home-'));
    const spy = jest.spyOn(os, 'homedir').mockReturnValue(home);
    try {
      await expect(sharing.installSession({
        conversation: { id: '../../../evil', project: 'p' },
        messages: []
      }, {})).rejects.toThrow(/conversation id/);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('Claude API proxy', () => {
  const ClaudeAPIProxy = require('../../src/claude-api-proxy');
  let proxy;

  beforeAll(async () => {
    proxy = new ClaudeAPIProxy();
    proxy.port = 0;
    await proxy.start();
  });
  afterAll(() => proxy.stop());

  const get = (headers) => new Promise((resolve, reject) => {
    const { port } = proxy.server.address();
    http.get({ host: '127.0.0.1', port, path: '/api/sessions', headers }, (res) => {
      res.resume();
      resolve(res);
    }).on('error', reject);
  });

  it('listens on loopback only', () => {
    expect(proxy.server.address().address).toBe('127.0.0.1');
  });

  it('refuses browser requests and rebinding hosts, sends no CORS', async () => {
    const fromPage = await get({ Origin: 'http://evil.example', Host: 'localhost' });
    expect(fromPage.statusCode).toBe(403);
    expect(fromPage.headers['access-control-allow-origin']).toBeUndefined();
    const rebound = await get({ Host: 'evil.example' });
    expect(rebound.statusCode).toBe(403);
  });
});
