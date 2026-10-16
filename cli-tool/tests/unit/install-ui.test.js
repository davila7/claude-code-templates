// @clack/prompts ships ESM only, which this Jest setup does not transform.
jest.mock('@clack/prompts', () => ({
  S_BAR: '│', S_BAR_END: '└', S_STEP_SUBMIT: '◇', S_STEP_ACTIVE: '◆', unicodeOr: (u) => u
}));

const path = require('path');
const os = require('os');
const { createInstallUI, describeWrites, displayPath } = require('../../src/install-ui');

describe('install-ui', () => {
  const target = path.join(os.tmpdir(), 'cct-install-ui');

  test('displayPath shows project files relative and home files with ~', () => {
    expect(displayPath(path.join(target, '.claude', 'agents', 'a.md'), target)).toBe('.claude/agents/a.md');
    expect(displayPath(path.join(os.homedir(), '.claude', 'settings.json'), target)).toBe('~/.claude/settings.json');
  });

  test('describeWrites names settings files and the extra script', () => {
    const files = [
      path.join(target, '.claude', 'settings.local.json'),
      path.join(target, '.claude', 'hooks', 'guard.py')
    ];
    expect(describeWrites(files, target)).toBe('.claude/settings.local.json + hooks/guard.py');
    expect(describeWrites([...files, path.join(target, '.claude', 'settings.json')], target))
      .toBe('settings.local.json, settings.json + hooks/guard.py');
  });

  test('describeWrites collapses a skill directory', () => {
    const dir = path.join(target, '.claude', 'skills', 'x');
    const files = ['SKILL.md', 'a.md', 'scripts/b.py'].map(f => path.join(dir, f));
    expect(describeWrites(files, target)).toBe('.claude/skills/x/ (3 files)');
  });

  test('runStep hides installer output and reports failures with their reason', async () => {
    const lines = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...a) => lines.push(a.join(' ')));
    const ui = createInstallUI({ version: '0.0.0', targetDir: target });
    ui.plan([{ type: 'mcp', name: 'db/nope' }]);
    const result = await ui.runStep({ type: 'mcp', name: 'db/nope' }, async () => {
      console.log('📥 Downloading from GitHub (main branch)...');
      console.log('❌ MCP "db/nope" not found');
      return undefined;
    });
    spy.mockRestore();
    expect(result.ok).toBe(false);
    expect(result.detail).toBe('MCP "db/nope" not found');
    expect(lines.join('\n')).not.toContain('Downloading');
  });
});
