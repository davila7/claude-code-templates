/**
 * --analytics and --chats read conversations from ~/.claude/projects. One bad
 * entry (Claude Code leaves ~/.claude/debug/latest dangling) used to abort the
 * whole scan and show 0 conversations (issues #575, #621).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const ConversationAnalyzer = require('../../src/analytics/core/ConversationAnalyzer');

function makeClaudeDir() {
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cct-claude-'));
  const project = path.join(claudeDir, 'projects', '-home-me-app');
  fs.mkdirSync(path.join(project, 'session-1', 'subagents'), { recursive: true });
  fs.writeFileSync(path.join(project, 'session-1.jsonl'), '{}\n');
  fs.writeFileSync(path.join(project, 'session-1', 'subagents', 'agent-1.jsonl'), '{}\n');
  fs.writeFileSync(path.join(project, 'notes.txt'), 'not a transcript');
  // A dangling link inside projects/ and one where Claude Code leaves it
  fs.symlinkSync(path.join(claudeDir, 'missing'), path.join(project, 'dead-link'));
  fs.mkdirSync(path.join(claudeDir, 'debug'));
  fs.symlinkSync(path.join(claudeDir, 'debug', 'gone.txt'), path.join(claudeDir, 'debug', 'latest'));
  // A link loop must not recurse forever
  fs.symlinkSync(project, path.join(project, 'loop'));
  // Not conversations, even though they are .jsonl
  fs.writeFileSync(path.join(claudeDir, 'history.jsonl'), '{}\n');
  fs.mkdirSync(path.join(claudeDir, 'plugins', 'marketplaces', 'm'), { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'plugins', 'marketplaces', 'm', 'data.jsonl'), '{}\n');
  return { claudeDir, project };
}

describe('conversation scan', () => {
  let dirs;
  let analyzer;

  beforeAll(() => {
    dirs = makeClaudeDir();
    analyzer = new ConversationAnalyzer(dirs.claudeDir);
  });

  afterAll(() => fs.rmSync(dirs.claudeDir, { recursive: true, force: true }));

  it('finds every transcript under projects/ and skips bad entries', async () => {
    const files = await analyzer.findConversationFiles(path.join(dirs.claudeDir, 'projects'));
    expect(files.map(f => path.relative(dirs.project, f)).sort()).toEqual([
      'session-1.jsonl',
      path.join('session-1', 'subagents', 'agent-1.jsonl')
    ]);
  });

  it('returns nothing, without throwing, when projects/ does not exist', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'cct-empty-'));
    try {
      expect(await new ConversationAnalyzer(empty).findConversationFiles(path.join(empty, 'projects'))).toEqual([]);
      expect(await new ConversationAnalyzer(empty).loadActiveProjects()).toEqual([]);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it('lists project directories, not the other ~/.claude folders', async () => {
    const projects = await analyzer.loadActiveProjects();
    expect(projects.map(p => p.name)).toEqual(['-home-me-app']);
  });

  it('loads the conversations despite the dangling links', async () => {
    const stateCalculator = {
      determineConversationStatus: () => 'inactive',
      determineConversationState: () => 'idle'
    };
    jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const conversations = await analyzer.loadConversations(stateCalculator);
      expect(conversations.map(c => c.id).sort()).toEqual(['agent-1', 'session-1']);
    } finally {
      console.log.mockRestore();
    }
  });
});
