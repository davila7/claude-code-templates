const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { copyTemplateFiles, processSettingsFile } = require('../../src/file-operations');

const templatesRoot = path.resolve(__dirname, '../../templates');
const languages = ['javascript-typescript', 'python', 'ruby'];

function expectScopedBashPermissions(settings) {
  const bashRules = settings.permissions.allow.filter(rule => rule.startsWith('Bash'));
  expect(bashRules.length).toBeGreaterThan(0);
  for (const rule of bashRules) {
    // Neither a bare tool name nor an equivalent catch-all belongs in a
    // language template. Keep the existing named-command prefix rules.
    expect(rule).toMatch(/^Bash\([\w-]+:\*\)$/);
  }
  expect(settings.permissions.allow).toEqual(expect.arrayContaining(['Edit', 'MultiEdit', 'Write']));
  expect(settings.permissions.deny).toEqual([
    'Bash(curl:*)', 'Bash(wget:*)', 'Bash(rm -rf:*)'
  ]);
  expect(settings.permissions.defaultMode).toBe('allowEdits');
}

describe('language template Bash permissions', () => {
  test.each(languages)('%s has command-scoped rules without blanket Bash approval', async language => {
    const settings = await fs.readJson(path.join(templatesRoot, language, '.claude/settings.json'));
    expectScopedBashPermissions(settings);
  });
});

describe('installing language template settings', () => {
  let targetDir;

  beforeEach(async () => {
    targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cct-template-permissions-'));
    // Exercise the real download/copy pipeline with local template bytes in
    // place of HTTP. Do not fetch upstream files or run any template hooks.
    jest.spyOn(global, 'fetch').mockImplementation(async url => {
      const parsed = new URL(url);
      const source = parsed.pathname.split('/cli-tool/templates/')[1];
      if (parsed.hostname === 'api.github.com') {
        const items = source.endsWith('/commands') ? [] : [{
          type: 'file', name: 'settings.json', path: `cli-tool/templates/${source}/settings.json`
        }];
        return { ok: true, json: async () => items };
      }
      const content = await fs.readFile(path.join(templatesRoot, source), 'utf8');
      return { ok: true, text: async () => content };
    });
  });

  afterEach(async () => {
    await fs.remove(targetDir);
    jest.restoreAllMocks();
  });

  for (const language of languages) {
    test(`${language} keeps scoped rules when downloading the base settings`, async () => {
      const source = `${language}/.claude/settings.json`;
      const original = await fs.readJson(path.join(templatesRoot, source));
      const config = {
        language,
        files: [{ source: `${language}/.claude`, destination: '.claude' }]
      };

      expect(await copyTemplateFiles(config, targetDir, { yes: true })).toBe(true);
      const installed = await fs.readJson(path.join(targetDir, '.claude/settings.json'));
      expectScopedBashPermissions(installed);
      expect(installed.permissions).toEqual(original.permissions);
      expect(installed).toEqual(original);
    });

    test(`${language} keeps scoped rules when processing settings without hooks`, async () => {
      const sourcePath = path.join(templatesRoot, language, '.claude/settings.json');
      const destination = path.join(targetDir, '.claude/settings.json');
      const original = await fs.readJson(sourcePath);
      await processSettingsFile(sourcePath, destination, { language, selectedHooks: [] });
      const installed = await fs.readJson(destination);
      expectScopedBashPermissions(installed);
      const { hooks, ...withoutHooks } = original;
      expect(installed).toEqual(withoutHooks);
    });
  }
});
