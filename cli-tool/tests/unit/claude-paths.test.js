const path = require('path');
const { getClaudeConfigDir } = require('../../src/claude-paths');

describe('getClaudeConfigDir', () => {
  test('defaults to the Claude directory in the user home', () => {
    expect(getClaudeConfigDir('/home/tester', {})).toBe(path.join('/home/tester', '.claude'));
  });

  test('uses CLAUDE_CONFIG_DIR when configured', () => {
    expect(getClaudeConfigDir('/home/tester', {
      CLAUDE_CONFIG_DIR: '/profiles/claude-enterprise'
    })).toBe(path.resolve('/profiles/claude-enterprise'));
  });

  test('resolves a relative CLAUDE_CONFIG_DIR from the working directory', () => {
    expect(getClaudeConfigDir('/home/tester', { CLAUDE_CONFIG_DIR: 'custom-dir' }))
      .toBe(path.resolve('custom-dir'));
  });

  test('ignores an empty CLAUDE_CONFIG_DIR', () => {
    expect(getClaudeConfigDir('/home/tester', { CLAUDE_CONFIG_DIR: '  ' }))
      .toBe(path.join('/home/tester', '.claude'));
  });
});

describe('Claude data consumers', () => {
  const originalConfigDir = process.env.CLAUDE_CONFIG_DIR;

  afterEach(() => {
    if (originalConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR;
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalConfigDir;
    }
  });

  test.each([
    ['API proxy', () => new (require('../../src/claude-api-proxy'))()],
    ['plugin dashboard', () => new (require('../../src/plugin-dashboard').PluginDashboard)()],
    ['skill dashboard', () => new (require('../../src/skill-dashboard').SkillDashboard)()],
    ['teams dashboard', () => new (require('../../src/teams-dashboard').TeamsDashboard)()],
    ['mobile chats', () => new (require('../../src/chats-mobile').ChatsMobile)()]
  ])('%s reads from the configured directory', (_name, createConsumer) => {
    process.env.CLAUDE_CONFIG_DIR = '/profiles/claude-enterprise';
    const consumer = createConsumer();

    expect(consumer.claudeDir ?? consumer.conversationAnalyzer.claudeDir)
      .toBe(path.resolve('/profiles/claude-enterprise'));
    consumer.dataCache?.cleanup();
  });
});
