const fs = require('fs');
const path = require('path');

describe('iFlytek Astron Token Plan setting', () => {
  const settingPath = path.join(
    __dirname,
    '../../components/settings/partnerships/iflytek-astron-token-plan.json'
  );
  let setting;

  beforeAll(() => {
    setting = JSON.parse(fs.readFileSync(settingPath, 'utf8'));
  });

  test('uses the Token Plan Anthropic-compatible endpoint', () => {
    expect(setting.env.ANTHROPIC_BASE_URL).toBe(
      'https://maas-token-api.cn-huabei-1.xf-yun.com/anthropic'
    );
  });

  test('does not point at the Coding Plan or pay-as-you-go hosts', () => {
    expect(setting.env.ANTHROPIC_BASE_URL).not.toMatch(/maas-coding-api/);
    expect(setting.env.ANTHROPIC_BASE_URL).not.toMatch(/\/\/maas-api\./);
  });

  test('uses a safe API key placeholder', () => {
    expect(setting.env.ANTHROPIC_AUTH_TOKEN).toBe(
      'YOUR-ASTRON-TOKEN-PLAN-API-KEY'
    );
  });

  test('pins the main model so the 1M-context default alias is not used', () => {
    expect(setting.env.ANTHROPIC_MODEL).toBe('spark-x2.5');
  });

  test('maps Spark-X2.5 to every Claude model class', () => {
    expect(setting.env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe('spark-x2.5');
    expect(setting.env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe('spark-x2.5');
    expect(setting.env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe('spark-x2.5');
  });

  test('keeps every env value a string', () => {
    Object.values(setting.env).forEach((value) => {
      expect(typeof value).toBe('string');
    });
  });

  test('documents the Spark-X2.5 context window', () => {
    expect(setting.description).toContain('256K context window');
  });

  test('documents where to obtain an API key', () => {
    expect(setting.description).toContain(
      'https://maas.xfyun.cn/tokenPlan/subscription'
    );
  });
});

describe('Spark-X2.5 llama.cpp setting', () => {
  const settingPath = path.join(
    __dirname,
    '../../components/settings/partnerships/iflytek-spark-llama-cpp.json'
  );
  let setting;

  beforeAll(() => {
    setting = JSON.parse(fs.readFileSync(settingPath, 'utf8'));
  });

  test('points at a local llama-server', () => {
    expect(setting.env.ANTHROPIC_BASE_URL).toBe('http://127.0.0.1:8080');
    expect(setting.description).toContain('--port 8080');
  });

  test('uses the model alias the server is started with', () => {
    expect(setting.description).toContain('--alias spark-x2.5');
    [
      'ANTHROPIC_MODEL',
      'ANTHROPIC_DEFAULT_HAIKU_MODEL',
      'ANTHROPIC_DEFAULT_SONNET_MODEL',
      'ANTHROPIC_DEFAULT_OPUS_MODEL',
    ].forEach((key) => {
      expect(setting.env[key]).toBe('spark-x2.5');
    });
  });

  test('starts llama-server with the chat template and enough context', () => {
    expect(setting.description).toContain('--jinja');
    expect(setting.description).toContain('-c 65536');
  });

  test('keeps every env value a string', () => {
    Object.values(setting.env).forEach((value) => {
      expect(typeof value).toBe('string');
    });
  });

  test('links the published GGUF weights', () => {
    expect(setting.description).toContain(
      'https://huggingface.co/XHToken/Spark-X2.5-4B-GGUF'
    );
  });
});
