/**
 * Unit Tests for network.js
 * Tests fetchFromGitHub helper with proper error handling
 */

const { fetchFromGitHub } = require('../../src/network');

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock chalk to avoid ANSI codes in tests
jest.mock('chalk', () => ({
  yellow: (str) => str,
  cyan: (str) => str
}));

describe('fetchFromGitHub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('successful requests', () => {
    it('should return response on successful fetch', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('content')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await fetchFromGitHub('https://example.com/file.md');

      expect(response).toBe(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/file.md',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'claude-code-templates-cli'
          }),
          redirect: 'follow'
        })
      );
    });

    it('should merge custom headers with default User-Agent', async () => {
      const mockResponse = { ok: true, status: 200 };
      mockFetch.mockResolvedValue(mockResponse);

      await fetchFromGitHub('https://example.com', {
        headers: { 'Accept': 'application/json' }
      });

      // Verify User-Agent is present in the call
      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers['User-Agent']).toBe('claude-code-templates-cli');
      expect(callArgs[1].headers['Accept']).toBe('application/json');
    });

    it('should pass through additional fetch options', async () => {
      const mockResponse = { ok: true, status: 200 };
      mockFetch.mockResolvedValue(mockResponse);

      await fetchFromGitHub('https://example.com', {
        method: 'POST',
        body: JSON.stringify({ test: true })
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ test: true })
        })
      );
    });
  });

  describe('SSL certificate errors', () => {
    it('should provide helpful message for "unable to get local issuer certificate"', async () => {
      const sslError = new Error('fetch failed');
      sslError.cause = { message: 'unable to get local issuer certificate' };
      mockFetch.mockRejectedValue(sslError);

      await expect(fetchFromGitHub('https://github.com/test'))
        .rejects
        .toThrow(/SSL certificate error/);
    });

    it('should provide helpful message for UNABLE_TO_GET_ISSUER_CERT_LOCALLY', async () => {
      const sslError = new Error('fetch failed');
      sslError.cause = { code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' };
      mockFetch.mockRejectedValue(sslError);

      await expect(fetchFromGitHub('https://github.com/test'))
        .rejects
        .toThrow(/SSL certificate error/);
    });

    it('should include troubleshooting suggestions for SSL errors', async () => {
      const sslError = new Error('fetch failed');
      sslError.cause = { message: 'certificate has expired' };
      mockFetch.mockRejectedValue(sslError);

      await expect(fetchFromGitHub('https://github.com/test'))
        .rejects
        .toThrow(/Corporate proxy|Outdated Node.js|VPN/);
    });

    it('should include fix suggestions for SSL errors', async () => {
      const sslError = new Error('fetch failed');
      sslError.cause = { message: 'SSL routines' };
      mockFetch.mockRejectedValue(sslError);

      await expect(fetchFromGitHub('https://github.com/test'))
        .rejects
        .toThrow(/nvm install|brew install|NODE_TLS_REJECT_UNAUTHORIZED/);
    });
  });

  describe('DNS errors', () => {
    it('should provide helpful message for ENOTFOUND', async () => {
      const dnsError = new Error('fetch failed');
      dnsError.cause = { code: 'ENOTFOUND' };
      mockFetch.mockRejectedValue(dnsError);

      await expect(fetchFromGitHub('https://github.com/test'))
        .rejects
        .toThrow(/DNS resolution failed/);
    });

    it('should provide helpful message for EAI_AGAIN', async () => {
      const dnsError = new Error('fetch failed');
      dnsError.cause = { message: 'EAI_AGAIN' };
      mockFetch.mockRejectedValue(dnsError);

      await expect(fetchFromGitHub('https://github.com/test'))
        .rejects
        .toThrow(/DNS resolution failed/);
    });

    it('should suggest checking internet connection for DNS errors', async () => {
      const dnsError = new Error('fetch failed');
      dnsError.cause = { code: 'ENOTFOUND' };
      mockFetch.mockRejectedValue(dnsError);

      await expect(fetchFromGitHub('https://github.com/test'))
        .rejects
        .toThrow(/Check your internet connection/);
    });
  });

  describe('connection errors', () => {
    it('should provide helpful message for ECONNREFUSED', async () => {
      const connError = new Error('fetch failed');
      connError.cause = { code: 'ECONNREFUSED' };
      mockFetch.mockRejectedValue(connError);

      await expect(fetchFromGitHub('https://github.com/test'))
        .rejects
        .toThrow(/Connection failed/);
    });

    it('should provide helpful message for ECONNRESET', async () => {
      const connError = new Error('fetch failed');
      connError.cause = { message: 'ECONNRESET' };
      mockFetch.mockRejectedValue(connError);

      await expect(fetchFromGitHub('https://github.com/test'))
        .rejects
        .toThrow(/Connection failed/);
    });

    it('should suggest checking firewall for connection errors', async () => {
      const connError = new Error('fetch failed');
      connError.cause = { code: 'ECONNREFUSED' };
      mockFetch.mockRejectedValue(connError);

      await expect(fetchFromGitHub('https://github.com/test'))
        .rejects
        .toThrow(/firewall/);
    });
  });

  describe('timeout handling', () => {
    it('should set up AbortController with signal', async () => {
      const mockResponse = { ok: true, status: 200 };
      mockFetch.mockResolvedValue(mockResponse);

      await fetchFromGitHub('https://github.com/test');

      // Verify AbortSignal was passed to fetch
      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].signal).toBeDefined();
      expect(callArgs[1].signal.constructor.name).toBe('AbortSignal');
    });

    it('should provide helpful message for timeout/abort', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      await expect(fetchFromGitHub('https://github.com/test'))
        .rejects
        .toThrow(/timed out after 30 seconds/);
    });
  });

  describe('generic errors', () => {
    it('should wrap unknown errors with cause in Network error', async () => {
      const unknownError = new Error('fetch failed');
      unknownError.cause = { message: 'some unknown network issue' };
      mockFetch.mockRejectedValue(unknownError);

      await expect(fetchFromGitHub('https://github.com/test'))
        .rejects
        .toThrow(/Network error: some unknown network issue/);
    });

    it('should re-throw errors without cause as-is', async () => {
      const plainError = new Error('plain error');
      mockFetch.mockRejectedValue(plainError);

      await expect(fetchFromGitHub('https://github.com/test'))
        .rejects
        .toThrow('plain error');
    });
  });

  describe('cleanup', () => {
    it('should clear timeout on successful response', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const mockResponse = { ok: true, status: 200 };
      mockFetch.mockResolvedValue(mockResponse);

      await fetchFromGitHub('https://example.com');

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should clear timeout on error', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const error = new Error('test error');
      mockFetch.mockRejectedValue(error);

      await expect(fetchFromGitHub('https://example.com')).rejects.toThrow();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});
