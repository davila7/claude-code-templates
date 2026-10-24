const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { getTemplateConfig } = require('../../src/templates');

const rawBase = 'https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/templates/';
const apiBase = 'https://api.github.com/repos/davila7/claude-code-templates/contents/cli-tool/templates/';
const settings = { permissions: { allow: ['Bash(npm test)'] } };
const settingsContent = JSON.stringify(settings);
const settingsFile = {
  source: 'javascript-typescript/.claude/settings.json',
  destination: '.claude/settings.json'
};

function directoryEntry(source) {
  return {
    type: 'file',
    name: path.basename(source),
    path: `cli-tool/templates/${source}`
  };
}

describe('copyTemplateFiles', () => {
  let targetDir;
  let copyTemplateFiles;

  beforeEach(async () => {
    // Reset the module's download cache as well as the mocked responses.
    jest.resetModules();
    ({ copyTemplateFiles } = require('../../src/file-operations'));
    targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cct-file-operations-'));

    const responses = new Map([
      [`${rawBase}javascript-typescript/CLAUDE.md`, '# JavaScript project'],
      [`${rawBase}${settingsFile.source}`, settingsContent],
      [`${rawBase}javascript-typescript/.mcp.json`, '{"mcpServers":{}}'],
      [`${rawBase}javascript-typescript/.claude/commands/test.md`, '# Base test command'],
      [`${rawBase}javascript-typescript/examples/vue-app/.claude/commands/vue-component.md`, '# Vue command'],
      [`${apiBase}javascript-typescript/.claude?ref=main`, [directoryEntry(settingsFile.source)]],
      [`${apiBase}javascript-typescript/.claude/commands?ref=main`, [
        directoryEntry('javascript-typescript/.claude/commands/test.md')
      ]],
      [`${apiBase}javascript-typescript/examples/vue-app/.claude/commands?ref=main`, [
        directoryEntry('javascript-typescript/examples/vue-app/.claude/commands/vue-component.md')
      ]]
    ]);

    // All downloads are local fixtures; no network requests are made.
    jest.spyOn(global, 'fetch').mockImplementation(async url => {
      if (!responses.has(url)) {
        throw new Error(`Unexpected download: ${url}`);
      }
      const content = responses.get(url);
      return {
        ok: true,
        status: 200,
        text: async () => content,
        json: async () => content
      };
    });
  });

  afterEach(async () => {
    await fs.remove(targetDir);
  });

  test.each([[], undefined])('installs a settings file with selectedHooks=%j', async selectedHooks => {
    const result = await copyTemplateFiles({ files: [settingsFile], selectedHooks }, targetDir, { yes: true });
    const destPath = path.join(targetDir, settingsFile.destination);

    expect(result).toBe(true);
    expect((await fs.stat(destPath)).isFile()).toBe(true);
    expect(await fs.readJson(destPath)).toEqual(settings);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(`${rawBase}${settingsFile.source}`);
  });

  test('installs base configuration, settings and Vue commands without EEXIST', async () => {
    const templateConfig = getTemplateConfig({ language: 'javascript-typescript', framework: 'vue' });
    templateConfig.selectedHooks = [];

    const result = await copyTemplateFiles(templateConfig, targetDir, { yes: true });

    expect(result).toBe(true);
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('EEXIST'));
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('files failed to download'));
    expect((await fs.stat(path.join(targetDir, settingsFile.destination))).isFile()).toBe(true);
    expect(await fs.readJson(path.join(targetDir, settingsFile.destination))).toEqual(settings);
    expect(await fs.readFile(path.join(targetDir, '.claude/commands/test.md'), 'utf8'))
      .toBe('# Base test command');
    expect(await fs.readFile(path.join(targetDir, '.claude/commands/vue-component.md'), 'utf8'))
      .toBe('# Vue command');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('(with selected hooks)'));
    expect(global.fetch).not.toHaveBeenCalledWith(`${apiBase}${settingsFile.source}?ref=main`);
  });
});
