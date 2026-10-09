/**
 * Unit Tests for HealthChecker.checkMCPConfigurationSyntax
 * Covers remote (http/sse) and stdio MCP server entries in .mcp.json
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { HealthChecker } = require('../../src/health-check');

describe('HealthChecker.checkMCPConfigurationSyntax', () => {
  let tmpDir;

  const check = (mcpServers) => {
    fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify({ mcpServers }));
    return new HealthChecker().checkMCPConfigurationSyntax();
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cct-health-'));
    jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('remote servers', () => {
    it.each([
      ['http with https url', { type: 'http', url: 'https://mcp.example.com' }],
      ['http with http url', { type: 'http', url: 'http://localhost:8080/mcp' }],
      ['sse with url', { type: 'sse', url: 'https://mcp.example.com/sse' }],
      ['http with header object', { type: 'http', url: 'https://mcp.example.com', headers: { Authorization: 'Bearer x' } }],
    ])('accepts %s without a command', (_name, config) => {
      expect(check({ remote: config }).status).toBe('pass');
    });

    it.each([
      ['missing url', { type: 'http' }],
      ['non-string url', { type: 'http', url: 42 }],
      ['url without hostname', { type: 'http', url: 'https://' }],
      ['unparseable url', { type: 'http', url: 'not a url' }],
      ['non-http scheme', { type: 'sse', url: 'ftp://mcp.example.com' }],
      ['array headers', { type: 'http', url: 'https://mcp.example.com', headers: [] }],
      ['string headers', { type: 'http', url: 'https://mcp.example.com', headers: 'Authorization: x' }],
      ['null headers', { type: 'http', url: 'https://mcp.example.com', headers: null }],
      ['empty-string headers', { type: 'http', url: 'https://mcp.example.com', headers: '' }],
    ])('rejects %s', (_name, config) => {
      const result = check({ remote: config });
      expect(result.status).toBe('fail');
    });
  });

  describe('stdio servers', () => {
    it('accepts a command with array args', () => {
      expect(check({ local: { command: 'npx', args: ['-y', 'some-server'] } }).status).toBe('pass');
    });

    it('rejects a server without a command or remote type', () => {
      expect(check({ local: { args: ['x'] } }).status).toBe('fail');
    });

    it('rejects a url-only entry that does not declare a remote type', () => {
      expect(check({ local: { url: 'https://mcp.example.com' } }).status).toBe('fail');
    });
  });

  it('reports a mix of valid and invalid servers as a warning', () => {
    const result = check({
      remote: { type: 'http', url: 'https://mcp.example.com' },
      broken: { type: 'http', url: 'https://' },
    });
    expect(result.status).toBe('warn');
  });
});
