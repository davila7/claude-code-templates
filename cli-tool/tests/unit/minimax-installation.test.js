// Exercise the public installer entry point without network access or user files.
jest.mock('@clack/prompts', () => ({
  S_BAR: '|', S_BAR_END: '|', S_STEP_SUBMIT: '+', S_STEP_ACTIVE: '*', unicodeOr: (u) => u
}));
jest.mock('inquirer', () => ({ prompt: jest.fn() }));
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn(), pathExists: jest.fn(), readJson: jest.fn(), writeJson: jest.fn()
}));
jest.mock('../../src/tracking-service', () => ({
  trackingService: { trackDownload: jest.fn(), trackInstallationOutcome: jest.fn() }
}));
jest.mock('../../src/analytics', () => ({}));
jest.mock('../../src/chats-mobile', () => ({}));
jest.mock('../../src/plugin-dashboard', () => ({}));
jest.mock('../../src/skill-dashboard', () => ({}));
jest.mock('../../src/teams-dashboard', () => ({}));
jest.mock('../../src/sdk/global-agent-manager', () => ({}));
jest.mock('../../src/session-sharing', () => ({}));

const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');
const { createClaudeConfig } = require('../../src/index');
const setting = require('../../components/settings/partnerships/minimax-provider.json');

const target = path.join(__dirname, 'minimax-installation-fixture');
const targetFile = path.join(target, '.claude', 'settings.local.json');
const install = () => createClaudeConfig({
  setting: 'partnerships/minimax-provider', directory: target, yes: true
});

describe('MiniMax setting installation', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, text: async () => JSON.stringify(setting)
    });
    fs.pathExists.mockResolvedValue(false);
    fs.readJson.mockResolvedValue({});
    inquirer.prompt.mockResolvedValue({ shouldOverwrite: false });
  });

  afterEach(() => { global.fetch = originalFetch; });

  test('downloads the component and writes Flash defaults with the M3 alternative', async () => {
    await install();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/settings/partnerships/minimax-provider.json'
    );
    expect(fs.writeJson).toHaveBeenCalledWith(targetFile, { model: 'MiniMax-M3.1-Flash', env: {
      ANTHROPIC_BASE_URL: 'https://api.minimax.io/anthropic',
      ANTHROPIC_AUTH_TOKEN: 'YOUR-MINIMAX-API-KEY',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'MiniMax-M3.1-Flash',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'MiniMax-M3.1-Flash',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'MiniMax-M3'
    } }, { spaces: 2 });
    expect(inquirer.prompt).not.toHaveBeenCalled();
  });

  test.each(['MiniMax-M3', 'MiniMax-M2.7', 'custom-model'])(
    'preserves explicit saved model %s and unrelated settings', async (model) => {
      const existing = { model, permissions: { allow: ['Read'] }, env: { CUSTOM_FLAG: 'keep' } };
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(existing);
      await install();
      expect(inquirer.prompt).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ name: 'shouldOverwrite', default: false })
      ]));
      expect(fs.writeJson).not.toHaveBeenCalled();
    }
  );

  test.each([
    { ANTHROPIC_DEFAULT_SONNET_MODEL: 'MiniMax-M2.7' },
    { ANTHROPIC_DEFAULT_SONNET_MODEL: 'custom-model' },
    { ANTHROPIC_BASE_URL: 'https://api.minimaxi.com/anthropic' }
  ])('requires consent before replacing an existing mapping or region: %j', async (env) => {
    fs.pathExists.mockResolvedValue(true);
    fs.readJson.mockResolvedValue({ env });
    await install();
    expect(inquirer.prompt).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: 'shouldOverwrite', default: false })
    ]));
    expect(fs.writeJson).not.toHaveBeenCalled();
  });

  test('preserves unrelated settings when adding defaults', async () => {
    const existing = { permissions: { allow: ['Read'] }, env: { CUSTOM_FLAG: 'keep' } };
    fs.pathExists.mockResolvedValue(true);
    fs.readJson.mockResolvedValue(existing);
    await install();
    expect(fs.writeJson).toHaveBeenCalledWith(targetFile, {
      ...existing, model: 'MiniMax-M3.1-Flash', env: { ...existing.env, ...setting.env }
    }, { spaces: 2 });
  });

  test('applies new defaults when replacement is explicitly approved', async () => {
    fs.pathExists.mockResolvedValue(true);
    fs.readJson.mockResolvedValue({ env: { ANTHROPIC_DEFAULT_SONNET_MODEL: 'MiniMax-M2.7' } });
    inquirer.prompt.mockResolvedValue({ shouldOverwrite: true });
    await install();
    expect(fs.writeJson).toHaveBeenCalledWith(targetFile, {
      model: 'MiniMax-M3.1-Flash', env: setting.env
    }, { spaces: 2 });
  });
});
