/**
 * Regression tests for HealthChecker.checkMCPConfigurationSyntax().
 *
 * Claude Code MCP servers are either local stdio servers (`command`) or remote
 * servers (`url` with `type` "http" or "sse"). The check used to require
 * `command` for every server, so every remote catalog entry (e.g. sentry,
 * huggingface, agent-guild) was reported as "Missing command".
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { HealthChecker } = require('../../src/health-check');

describe('HealthChecker.checkMCPConfigurationSyntax', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cct-health-mcp-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(mcpServers) {
    fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify({ mcpServers }, null, 2));
  }

  function run() {
    return new HealthChecker().checkMCPConfigurationSyntax();
  }

  test('accepts a local stdio server with command/args/env', () => {
    writeConfig({ local: { command: 'npx', args: ['-y', 'some-server'], env: { KEY: 'value' } } });
    expect(run()).toEqual({ status: 'pass', message: 'All 1 MCP server configurations are valid' });
  });

  test('accepts remote servers: explicit http, explicit sse, and url without type', () => {
    writeConfig({
      'agent-guild': { type: 'http', url: 'https://agent-guild-5d5r.onrender.com/mcp' },
      devplan: { type: 'sse', url: 'https://mcp.devplanmcp.store/sse' },
      sentry: { url: 'https://mcp.sentry.dev/mcp' },
      authenticated: { type: 'http', url: 'https://example.com/mcp', headers: { Authorization: 'Bearer ${TOKEN}' } }
    });
    expect(run()).toEqual({ status: 'pass', message: 'All 4 MCP server configurations are valid' });
  });

  test('still rejects a server with neither command nor url', () => {
    writeConfig({ empty: {} });
    expect(run()).toEqual({ status: 'fail', message: 'All 1 MCP server configurations have issues' });
  });

  test('rejects malformed remote definitions', () => {
    writeConfig({
      noUrl: { type: 'http' },
      wrongTransport: { type: 'stdio', url: 'https://example.com/mcp' },
      unsupportedType: { type: 'ws', url: 'wss://example.com' },
      badScheme: { url: 'ftp://example.com/mcp' },
      notAUrl: { type: 'sse', url: 'not a url' },
      badHeaders: { type: 'http', url: 'https://example.com/mcp', headers: ['x'] }
    });
    expect(run()).toEqual({ status: 'fail', message: 'All 6 MCP server configurations have issues' });
  });

  test('keeps the existing args/env format checks for stdio servers', () => {
    writeConfig({
      badArgs: { command: 'npx', args: 'not-an-array' },
      badEnv: { command: 'npx', env: 'not-an-object' },
      fine: { command: 'npx' }
    });
    expect(run()).toEqual({ status: 'warn', message: '1/3 MCP servers valid, 2 issues found' });
  });

  test('warns when no servers are configured', () => {
    writeConfig({});
    expect(run()).toEqual({ status: 'warn', message: 'No MCP servers configured' });
  });
});
