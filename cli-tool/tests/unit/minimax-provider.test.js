const fs = require('fs');
const path = require('path');

describe('MiniMax provider setting', () => {
  const settingPath = path.join(
    __dirname,
    '../../components/settings/partnerships/minimax-provider.json'
  );
  let setting;

  beforeAll(() => {
    setting = JSON.parse(fs.readFileSync(settingPath, 'utf8'));
  });

  test('uses the international Anthropic-compatible endpoint', () => {
    expect(setting.env.ANTHROPIC_BASE_URL).toBe(
      'https://api.minimax.io/anthropic'
    );
  });

  test('uses a safe API key placeholder', () => {
    expect(setting.env.ANTHROPIC_AUTH_TOKEN).toBe('YOUR-MINIMAX-API-KEY');
  });

  test('maps current MiniMax models to Claude model classes', () => {
    expect(setting.env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe('MiniMax-M2.7');
    expect(setting.env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe('MiniMax-M3');
    expect(setting.env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe('MiniMax-M3');
  });

  test('documents the MiniMax-M3 context window', () => {
    expect(setting.description).toContain('1,000,000-token context window');
    expect(setting.description).not.toMatch(/512K/i);
  });

  test.each(['text', 'image', 'video'])(
    'documents %s input support',
    (modality) => {
      expect(setting.description).toMatch(
        new RegExp(`\\b${modality}\\b`, 'i')
      );
    }
  );

  test('documents where to obtain an API key', () => {
    expect(setting.description).toContain('https://platform.minimax.io');
  });
});
