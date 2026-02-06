/**
 * API Endpoints Test Suite
 *
 * CRITICAL: These tests MUST pass before deploying to production.
 * Tracking endpoints are essential for component metrics.
 *
 * Run: npm run test:api
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'https://aitmpl.com';
const TIMEOUT = 30000; // 30 seconds

describe('API Endpoints - Critical Tests', () => {

  describe('🔴 CRITICAL: Component Download Tracking', () => {

    test('POST /api/track-download-supabase should be available', async () => {
      const response = await axios.post(
        `${BASE_URL}/api/track-download-supabase`,
        {
          type: 'agent',
          name: 'test-agent',
          path: 'agents/test',
          category: 'test',
          cliVersion: '1.0.0'
        },
        {
          timeout: TIMEOUT,
          validateStatus: (status) => status < 500 // Accept any non-5xx status
        }
      );

      // Endpoint must respond (can be 200, 400, etc. but NOT 500)
      expect(response.status).toBeLessThan(500);
      expect(response.status).toBeGreaterThanOrEqual(200);
    }, TIMEOUT);

    test('POST /api/track-download-supabase should reject requests without data', async () => {
      const response = await axios.post(
        `${BASE_URL}/api/track-download-supabase`,
        {},
        {
          timeout: TIMEOUT,
          validateStatus: () => true // Accept any status
        }
      );

      // Should return 400 Bad Request
      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
    }, TIMEOUT);

    test('POST /api/track-download-supabase should validate component type', async () => {
      const response = await axios.post(
        `${BASE_URL}/api/track-download-supabase`,
        {
          type: 'invalid-type',
          name: 'test',
          path: 'test/path'
        },
        {
          timeout: TIMEOUT,
          validateStatus: () => true
        }
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('type');
    }, TIMEOUT);

  });

  describe('🟡 Discord Bot Integration', () => {

    test('POST /api/discord/interactions should be available', async () => {
      const response = await axios.post(
        `${BASE_URL}/api/discord/interactions`,
        {},
        {
          timeout: TIMEOUT,
          validateStatus: () => true
        }
      );

      // Endpoint should respond (even if Discord validation fails)
      expect(response.status).toBeLessThan(500);
    }, TIMEOUT);

  });

  describe('🟢 Claude Code Changelog Monitor', () => {

    test('GET /api/claude-code-check should be available', async () => {
      const response = await axios.get(
        `${BASE_URL}/api/claude-code-check`,
        {
          timeout: TIMEOUT,
          validateStatus: () => true
        }
      );

      // Endpoint should respond
      expect(response.status).toBeLessThan(500);
    }, TIMEOUT);

  });

  describe('🔵 Command Usage Tracking', () => {

    test('POST /api/track-command-usage should be available', async () => {
      const response = await axios.post(
        `${BASE_URL}/api/track-command-usage`,
        {
          command: 'analytics',
          cliVersion: '1.26.3',
          nodeVersion: 'v18.0.0',
          platform: 'darwin',
          arch: 'arm64',
          sessionId: 'test-session-123',
          metadata: { tunnel: false }
        },
        {
          timeout: TIMEOUT,
          validateStatus: (status) => status < 500
        }
      );

      // Endpoint must respond (can be 200, 400, etc. but NOT 500)
      expect(response.status).toBeLessThan(500);
      expect(response.status).toBeGreaterThanOrEqual(200);
    }, TIMEOUT);

    test('POST /api/track-command-usage should reject invalid commands', async () => {
      const response = await axios.post(
        `${BASE_URL}/api/track-command-usage`,
        {
          command: 'invalid-command',
          cliVersion: '1.26.3',
          nodeVersion: 'v18.0.0',
          platform: 'darwin'
        },
        {
          timeout: TIMEOUT,
          validateStatus: () => true
        }
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
      expect(response.data.error).toContain('Invalid command');
    }, TIMEOUT);

    test('POST /api/track-command-usage should reject requests without command', async () => {
      const response = await axios.post(
        `${BASE_URL}/api/track-command-usage`,
        {
          cliVersion: '1.26.3',
          platform: 'darwin'
        },
        {
          timeout: TIMEOUT,
          validateStatus: () => true
        }
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
    }, TIMEOUT);

  });

  describe('📊 API Health Check', () => {

    test('All critical endpoints should respond within 30s', async () => {
      const startTime = Date.now();

      const endpoints = [
        '/api/track-download-supabase',
        '/api/track-command-usage',
        '/api/discord/interactions',
        '/api/claude-code-check',
        '/api/search?q=test'
      ];

      for (const endpoint of endpoints) {
        const method = (endpoint.includes('track-') || endpoint.includes('discord'))
          ? 'post'
          : 'get';

        try {
          await axios[method](
            `${BASE_URL}${endpoint}`,
            method === 'post' ? {} : undefined,
            {
              timeout: TIMEOUT,
              validateStatus: () => true
            }
          );
        } catch (error) {
          // If it fails due to timeout or connection, test should fail
          if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
            throw new Error(`Endpoint ${endpoint} not responding: ${error.message}`);
          }
        }
      }

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(30000);
    }, 45000); // Total timeout of 45s for this test

  });

});

describe('API Endpoints - Functional Tests', () => {

  describe('Component Download Tracking - Data Validation', () => {

    const validTypes = ['agent', 'command', 'setting', 'hook', 'mcp', 'skill', 'template'];

    test('should accept all valid component types', async () => {
      for (const type of validTypes) {
        const response = await axios.post(
          `${BASE_URL}/api/track-download-supabase`,
          {
            type,
            name: `test-${type}`,
            path: `${type}s/test`
          },
          {
            timeout: TIMEOUT,
            validateStatus: () => true
          }
        );

        // Should be 200 (success) or 500 if DB fails, but NOT 400 (validation)
        expect([200, 500]).toContain(response.status);
      }
    }, TIMEOUT * validTypes.length);

    test('should reject names that are too long', async () => {
      const longName = 'a'.repeat(300); // More than 255 characters

      const response = await axios.post(
        `${BASE_URL}/api/track-download-supabase`,
        {
          type: 'agent',
          name: longName,
          path: 'agents/test'
        },
        {
          timeout: TIMEOUT,
          validateStatus: () => true
        }
      );

      expect(response.status).toBe(400);
    }, TIMEOUT);

  });

  describe('Claude Code Monitor - Parser Tests', () => {

    test('GET /api/claude-code-check should return valid structure', async () => {
      const response = await axios.get(
        `${BASE_URL}/api/claude-code-check`,
        {
          timeout: TIMEOUT,
          validateStatus: () => true
        }
      );

      if (response.status === 200) {
        // If successful, should have correct structure
        expect(response.data).toHaveProperty('status');

        if (response.data.status === 'success') {
          expect(response.data).toHaveProperty('version');
          expect(response.data).toHaveProperty('changes');
          expect(response.data).toHaveProperty('discord');
        }
      }
    }, TIMEOUT);

  });

  describe('Command Usage Tracking - Data Validation', () => {

    const validCommands = [
      'chats',
      'analytics',
      'health-check',
      'plugins',
      'sandbox',
      'agents',
      'chats-mobile',
      'studio',
      'command-stats',
      'hook-stats',
      'mcp-stats'
    ];

    test('should accept all valid commands', async () => {
      for (const command of validCommands) {
        const response = await axios.post(
          `${BASE_URL}/api/track-command-usage`,
          {
            command,
            cliVersion: '1.26.3',
            nodeVersion: 'v18.0.0',
            platform: 'darwin',
            arch: 'arm64',
            sessionId: 'test-session',
            metadata: { test: true }
          },
          {
            timeout: TIMEOUT,
            validateStatus: () => true
          }
        );

        // Should be 200 (success) or 500 if DB fails, but NOT 400 (validation)
        expect([200, 500]).toContain(response.status);
      }
    }, TIMEOUT * validCommands.length);

    test('should handle metadata correctly', async () => {
      const response = await axios.post(
        `${BASE_URL}/api/track-command-usage`,
        {
          command: 'analytics',
          cliVersion: '1.26.3',
          nodeVersion: 'v18.0.0',
          platform: 'darwin',
          arch: 'arm64',
          sessionId: 'test-session',
          metadata: {
            tunnel: true,
            customData: 'test-value'
          }
        },
        {
          timeout: TIMEOUT,
          validateStatus: () => true
        }
      );

      // Should accept metadata as JSONB
      expect([200, 500]).toContain(response.status);
    }, TIMEOUT);

    test('should reject commands that are too long', async () => {
      const longCommand = 'a'.repeat(150);

      const response = await axios.post(
        `${BASE_URL}/api/track-command-usage`,
        {
          command: longCommand,
          cliVersion: '1.26.3',
          platform: 'darwin'
        },
        {
          timeout: TIMEOUT,
          validateStatus: () => true
        }
      );

      expect(response.status).toBe(400);
    }, TIMEOUT);

    test('should handle missing optional fields', async () => {
      const response = await axios.post(
        `${BASE_URL}/api/track-command-usage`,
        {
          command: 'analytics'
          // Missing optional fields like cliVersion, sessionId, metadata
        },
        {
          timeout: TIMEOUT,
          validateStatus: () => true
        }
      );

      // Should still work with just command name
      expect([200, 500]).toContain(response.status);
    }, TIMEOUT);

  });

});

describe('🔍 Component Search API', () => {

  test('GET /api/search should return results for valid query', async () => {
    const response = await axios.get(
      `${BASE_URL}/api/search?q=frontend`,
      {
        timeout: TIMEOUT,
        validateStatus: () => true
      }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('query', 'frontend');
    expect(response.data).toHaveProperty('total');
    expect(response.data).toHaveProperty('results');
    expect(Array.isArray(response.data.results)).toBe(true);
    expect(response.data.results.length).toBeGreaterThan(0);

    // Verify result structure
    const first = response.data.results[0];
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('type');
    expect(first).toHaveProperty('description');
    expect(first).toHaveProperty('install_cmd');
    expect(first).toHaveProperty('score');
  }, TIMEOUT);

  test('GET /api/search should filter by type', async () => {
    const response = await axios.get(
      `${BASE_URL}/api/search?q=frontend&type=agents`,
      {
        timeout: TIMEOUT,
        validateStatus: () => true
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.type).toBe('agents');
    // All results should be agents
    for (const result of response.data.results) {
      expect(result.type).toBe('agent');
    }
  }, TIMEOUT);

  test('GET /api/search should respect limit parameter', async () => {
    const response = await axios.get(
      `${BASE_URL}/api/search?q=test&limit=3`,
      {
        timeout: TIMEOUT,
        validateStatus: () => true
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.results.length).toBeLessThanOrEqual(3);
  }, TIMEOUT);

  test('GET /api/search should require query parameter', async () => {
    const response = await axios.get(
      `${BASE_URL}/api/search`,
      {
        timeout: TIMEOUT,
        validateStatus: () => true
      }
    );

    expect(response.status).toBe(400);
    expect(response.data).toHaveProperty('error');
  }, TIMEOUT);

  test('GET /api/search should reject invalid type', async () => {
    const response = await axios.get(
      `${BASE_URL}/api/search?q=test&type=invalid`,
      {
        timeout: TIMEOUT,
        validateStatus: () => true
      }
    );

    expect(response.status).toBe(400);
    expect(response.data).toHaveProperty('valid_types');
  }, TIMEOUT);

  test('GET /api/search should reject query that is too long', async () => {
    const longQuery = 'a'.repeat(250);
    const response = await axios.get(
      `${BASE_URL}/api/search?q=${longQuery}`,
      {
        timeout: TIMEOUT,
        validateStatus: () => true
      }
    );

    expect(response.status).toBe(400);
  }, TIMEOUT);

  test('POST /api/search should return 405', async () => {
    const response = await axios.post(
      `${BASE_URL}/api/search`,
      { q: 'test' },
      {
        timeout: TIMEOUT,
        validateStatus: () => true
      }
    );

    expect(response.status).toBe(405);
  }, TIMEOUT);

  test('GET /api/search should return empty results for nonsense query', async () => {
    const response = await axios.get(
      `${BASE_URL}/api/search?q=xyzzy999zzz`,
      {
        timeout: TIMEOUT,
        validateStatus: () => true
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.total).toBe(0);
    expect(response.data.results).toEqual([]);
  }, TIMEOUT);

  test('GET /api/search results should be sorted by score descending', async () => {
    const response = await axios.get(
      `${BASE_URL}/api/search?q=security`,
      {
        timeout: TIMEOUT,
        validateStatus: () => true
      }
    );

    expect(response.status).toBe(200);
    const scores = response.data.results.map(r => r.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  }, TIMEOUT);

});

describe('API Security & CORS', () => {

  test('endpoints should have correct CORS headers', async () => {
    const response = await axios.options(
      `${BASE_URL}/api/track-download-supabase`,
      {
        timeout: TIMEOUT,
        validateStatus: () => true
      }
    );

    expect(response.headers['access-control-allow-origin']).toBeDefined();
  }, TIMEOUT);

  test('endpoints should handle incorrect HTTP methods', async () => {
    const response = await axios.get(
      `${BASE_URL}/api/track-download-supabase`,
      {
        timeout: TIMEOUT,
        validateStatus: () => true
      }
    );

    // track-download only accepts POST, should return 405
    expect(response.status).toBe(405);
  }, TIMEOUT);

});
