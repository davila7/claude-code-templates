/**
 * Regression tests for HealthChecker.checkMCPConfigurationSyntax().
 *
 * Claude Code MCP servers in .mcp.json are either local stdio servers
 * (`command`) or remote servers (`url` with `type` "http" — alias
 * "streamable-http" — "sse" or "ws"). The check used to require `command`
 * for every server, so every remote catalog entry (e.g. agent-guild, devplan)
 * was reported as "Missing command".
 *
 * Claude Code also expands `${VAR}` / `${VAR:-default}` templates inside
 * `url`. The check must accept that syntax without reading the environment,
 * and must not report a url it cannot resolve as verified.
 *
 * All fixtures are temp-dir files; no network, no environment lookups.
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

  test('accepts remote servers: http, streamable-http alias, sse, ws, and headers', () => {
    writeConfig({
      'agent-guild': { type: 'http', url: 'https://agent-guild-5d5r.onrender.com/mcp' },
      streamable: { type: 'streamable-http', url: 'https://example.com/mcp' },
      devplan: { type: 'sse', url: 'https://mcp.devplanmcp.store/sse' },
      events: { type: 'ws', url: 'wss://mcp.example.com/socket', headers: { Authorization: 'Bearer token' } },
      authenticated: { type: 'http', url: 'https://example.com/mcp', headers: { Authorization: 'Bearer ${TOKEN}' } }
    });
    expect(run()).toEqual({ status: 'pass', message: 'All 5 MCP server configurations are valid' });
  });

  test('accepts a url whose environment template has a default (validated on the default)', () => {
    writeConfig({
      defaulted: { type: 'http', url: '${API_BASE_URL:-https://api.example.com}/mcp' },
      defaultedPort: { type: 'ws', url: 'wss://${MCP_HOST:-localhost}:${MCP_PORT:-8080}/socket' }
    });
    expect(run()).toEqual({ status: 'pass', message: 'All 2 MCP server configurations are valid' });
  });

  test('warns, without reading the environment, when a url depends on an unresolved variable', () => {
    const previous = process.env.MCP_URL;
    process.env.MCP_URL = 'ftp://would-be-rejected-if-read';
    try {
      writeConfig({
        fullUrl: { type: 'http', url: '${MCP_URL}' },
        hostPort: { type: 'http', url: 'https://${MCP_HOST}:${MCP_PORT}/mcp' }
      });
      const result = run();
      expect(result.status).toBe('warn');
      expect(result.message).toContain('2 use unresolved environment variables in url (not verified)');
      expect(result.message).toContain('${MCP_URL} (not verified) for fullUrl in .mcp.json');
      expect(result.message).toContain('${MCP_HOST}, ${MCP_PORT} (not verified) for hostPort in .mcp.json');
      expect(result.message).not.toContain(process.env.MCP_URL);
    } finally {
      if (previous === undefined) {
        delete process.env.MCP_URL;
      } else {
        process.env.MCP_URL = previous;
      }
    }
  });

  test('checks the literal scheme of a templated url against the transport', () => {
    writeConfig({
      ftpHost: { type: 'http', url: 'ftp://${MCP_HOST}/mcp' },
      wsForHttp: { type: 'http', url: '${MCP_URL:-wss://example.com}/mcp' },
      unbalanced: { type: 'http', url: 'https://${MCP_HOST/mcp' },
      badName: { type: 'http', url: 'https://${1HOST}/mcp' },
      ok: { type: 'sse', url: 'https://${MCP_HOST}/sse' }
    });
    const result = run();
    expect(result.status).toBe('warn');
    expect(result.message).toContain('1/5 MCP servers valid, 4 issues found');
    expect(result.message).toContain('${MCP_HOST} (not verified) for ok in .mcp.json');
  });

  test('reports a url without type as a configuration error (Claude Code skips it)', () => {
    writeConfig({ sentry: { url: 'https://mcp.sentry.dev/mcp' } });
    expect(run()).toEqual({ status: 'fail', message: 'All 1 MCP server configurations have issues' });
  });

  test('rejects a non-string type without throwing (was reported valid)', () => {
    writeConfig({
      objectType: { type: { toString: null }, url: 'https://example.com/mcp' },
      numberType: { type: 5, url: 'https://example.com/mcp' },
      nullType: { type: null, url: 'https://example.com/mcp' }
    });
    expect(run()).toEqual({ status: 'fail', message: 'All 3 MCP server configurations have issues' });
  });

  test('requires remote header values to be strings (literal or ${VAR} template)', () => {
    writeConfig({
      objectValue: { type: 'http', url: 'https://example.com/mcp', headers: { Authorization: { bad: true } } },
      numberValue: { type: 'http', url: 'https://example.com/mcp', headers: { 'X-Retries': 3 } },
      nullValue: { type: 'ws', url: 'wss://example.com/socket', headers: { Authorization: null } },
      literal: { type: 'http', url: 'https://example.com/mcp', headers: { Authorization: 'Bearer token' } },
      template: { type: 'http', url: 'https://example.com/mcp', headers: { Authorization: 'Bearer ${API_KEY}' } }
    });
    expect(run()).toEqual({ status: 'warn', message: '2/5 MCP servers valid, 3 issues found' });
  });

  test('still rejects a server with neither command nor url', () => {
    writeConfig({ empty: {} });
    expect(run()).toEqual({ status: 'fail', message: 'All 1 MCP server configurations have issues' });
  });

  test('rejects malformed remote definitions', () => {
    writeConfig({
      noUrl: { type: 'http' },
      wrongTransport: { type: 'stdio', url: 'https://example.com/mcp' },
      unsupportedType: { type: 'grpc', url: 'https://example.com' },
      badScheme: { type: 'http', url: 'ftp://example.com/mcp' },
      httpForWs: { type: 'ws', url: 'https://example.com/socket' },
      notAUrl: { type: 'sse', url: 'not a url' },
      badHeaders: { type: 'http', url: 'https://example.com/mcp', headers: ['x'] }
    });
    expect(run()).toEqual({ status: 'fail', message: 'All 7 MCP server configurations have issues' });
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
