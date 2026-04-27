/**
 * Unit Tests for MiniMax Provider Settings
 * Validates structure and content of the MiniMax partnership configuration
 */

const path = require('path');
const fs = require('fs');

const MINIMAX_SETTINGS_PATH = path.join(
  __dirname,
  '../../components/settings/partnerships/minimax-provider.json'
);

describe('MiniMax Provider Settings', () => {
  let settings;

  beforeAll(() => {
    const raw = fs.readFileSync(MINIMAX_SETTINGS_PATH, 'utf8');
    settings = JSON.parse(raw);
  });

  describe('File structure', () => {
    it('should be valid JSON', () => {
      expect(settings).toBeDefined();
      expect(typeof settings).toBe('object');
    });

    it('should have a description field', () => {
      expect(settings.description).toBeDefined();
      expect(typeof settings.description).toBe('string');
      expect(settings.description.length).toBeGreaterThan(10);
    });

    it('should have an env field', () => {
      expect(settings.env).toBeDefined();
      expect(typeof settings.env).toBe('object');
    });
  });

  describe('Environment variables', () => {
    it('should set ANTHROPIC_BASE_URL to MiniMax Anthropic-compatible endpoint', () => {
      expect(settings.env.ANTHROPIC_BASE_URL).toBeDefined();
      expect(settings.env.ANTHROPIC_BASE_URL).toBe('https://api.minimax.io/anthropic');
    });

    it('should include ANTHROPIC_AUTH_TOKEN placeholder', () => {
      expect(settings.env.ANTHROPIC_AUTH_TOKEN).toBeDefined();
      expect(typeof settings.env.ANTHROPIC_AUTH_TOKEN).toBe('string');
    });

    it('should not contain a real API key', () => {
      const authToken = settings.env.ANTHROPIC_AUTH_TOKEN;
      // Placeholder should not look like a real token (real keys are long hex/base64 strings)
      expect(authToken).toMatch(/YOUR[-_]/i);
    });

    it('should configure MiniMax-M2.7 as the sonnet (default) model', () => {
      expect(settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe('MiniMax-M2.7');
    });

    it('should configure MiniMax-M2.7 as the opus (most capable) model', () => {
      expect(settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe('MiniMax-M2.7');
    });

    it('should configure MiniMax-M2.7-highspeed as the haiku (fast) model', () => {
      expect(settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe('MiniMax-M2.7-highspeed');
    });

    it('should use the international MiniMax endpoint (not domestic)', () => {
      expect(settings.env.ANTHROPIC_BASE_URL).toContain('api.minimax.io');
      expect(settings.env.ANTHROPIC_BASE_URL).not.toContain('api.minimax.chat');
      expect(settings.env.ANTHROPIC_BASE_URL).not.toContain('api.minimaxi.com');
    });
  });

  describe('Description content', () => {
    it('should mention MiniMax in the description', () => {
      expect(settings.description.toLowerCase()).toContain('minimax');
    });

    it('should mention API key requirement', () => {
      expect(settings.description.toLowerCase()).toMatch(/api.key|minimax.api/);
    });
  });
});
