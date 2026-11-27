/**
 * Claude Code keeps its user data in CLAUDE_CONFIG_DIR when that is set (#631).
 * --analytics, --chats and --health-check read ~/.claude regardless, so with a
 * second profile they showed the other profile's conversations and settings.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { claudeConfigDir } = require('../../src/claude-paths');

describe('claudeConfigDir', () => {
  it('is CLAUDE_CONFIG_DIR when set, otherwise ~/.claude', () => {
    expect(claudeConfigDir({ CLAUDE_CONFIG_DIR: '/profiles/work' })).toBe('/profiles/work');
    expect(claudeConfigDir({})).toBe(path.join(os.homedir(), '.claude'));
    expect(claudeConfigDir({ CLAUDE_CONFIG_DIR: '' })).toBe(path.join(os.homedir(), '.claude'));
  });
});

describe('with CLAUDE_CONFIG_DIR set', () => {
  const saved = process.env.CLAUDE_CONFIG_DIR;
  let configDir;

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cct-config-'));
    process.env.CLAUDE_CONFIG_DIR = configDir;
  });

  afterEach(() => {
    fs.rmSync(configDir, { recursive: true, force: true });
    if (saved === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = saved;
  });

  it('--chats loads the conversations stored there', async () => {
    const project = path.join(configDir, 'projects', '-home-me-app');
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(path.join(project, 'session-1.jsonl'), '{}\n');
    const { ChatsMobile } = require('../../src/chats-mobile');
    const chats = new ChatsMobile();
    try {
      await chats.loadInitialData();
      expect(chats.data.conversations.map(c => c.id)).toEqual(['session-1']);
    } finally {
      chats.dataCache.cleanup();
    }
  });

  it('--health-check reads the commands, agents and settings stored there', () => {
    fs.mkdirSync(path.join(configDir, 'commands'));
    fs.writeFileSync(path.join(configDir, 'commands', 'review.md'), '# Review\n');
    fs.mkdirSync(path.join(configDir, 'agents'));
    fs.writeFileSync(path.join(configDir, 'agents', 'reviewer.md'), '# Reviewer\n');
    fs.writeFileSync(path.join(configDir, 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(npm test)'] } }));
    const { HealthChecker } = require('../../src/health-check');
    const checker = new HealthChecker({ interactive: false });

    expect(checker.checkPersonalCommands()).toMatchObject({ status: 'pass', message: expect.stringMatching(/^1 commands/) });
    expect(checker.checkPersonalAgents()).toMatchObject({ status: 'pass', message: expect.stringMatching(/^1 agents/) });
    expect(checker.checkUserSettings()).toEqual({ status: 'pass', message: 'Valid user settings (1 allow rules)' });
  });
});
