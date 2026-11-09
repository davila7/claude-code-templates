/**
 * With a `claude` process running, the dashboard marks its conversation active
 * and recomputes the conversation's state with that process in mind. The
 * refresh built the transcript path from conversation.fileName, which
 * conversations do not have (they carry filename and filePath): it threw at
 * the first match, the error was swallowed, no state was recomputed and the
 * other conversations were skipped.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const ConversationAnalyzer = require('../../src/analytics/core/ConversationAnalyzer');
const ProcessDetector = require('../../src/analytics/core/ProcessDetector');
const StateCalculator = require('../../src/analytics/core/StateCalculator');

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000);

// A prompt 40 minutes ago, answered `answeredMinutesAgo` minutes ago
function writeTranscript(claudeDir, cwd, sessionId, answeredMinutesAgo) {
  const dir = path.join(claudeDir, 'projects', cwd.replace(/\//g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sessionId}.jsonl`);
  const lines = [
    { type: 'user', cwd, sessionId, timestamp: minutesAgo(40).toISOString(), message: { role: 'user', content: 'Run the tests' } },
    { type: 'assistant', cwd, sessionId, timestamp: minutesAgo(answeredMinutesAgo).toISOString(), message: { role: 'assistant', content: [{ type: 'text', text: 'All tests pass.' }] } }
  ];
  fs.writeFileSync(file, lines.map(line => JSON.stringify(line)).join('\n') + '\n');
  fs.utimesSync(file, minutesAgo(answeredMinutesAgo), minutesAgo(answeredMinutesAgo));
}

describe('process refresh', () => {
  let claudeDir;

  beforeAll(() => {
    claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cct-process-'));
    writeTranscript(claudeDir, '/home/me/app', 'app-session', 20);
    writeTranscript(claudeDir, '/home/me/api', 'api-session', 6);
  });

  afterAll(() => fs.rmSync(claudeDir, { recursive: true, force: true }));

  it('recomputes the state of every conversation that has a running claude process', async () => {
    const stateCalculator = new StateCalculator();
    const conversations = await new ConversationAnalyzer(claudeDir).loadConversations(stateCalculator);
    const stateOf = (id) => conversations.find(c => c.id === id).conversationState;
    expect(stateOf('app-session')).toBe('User typing...');
    expect(stateOf('api-session')).toBe('Awaiting user input...');

    const detector = new ProcessDetector();
    jest.spyOn(detector, 'detectRunningClaudeProcesses').mockResolvedValue([
      { pid: '111', command: 'claude', workingDir: '/home/me/app' },
      { pid: '222', command: 'claude', workingDir: '/home/me/api' }
    ]);

    const result = await detector.enrichWithRunningProcesses(conversations, claudeDir, stateCalculator);

    expect(result.activeProcessCount).toBe(2);
    const byId = Object.fromEntries(result.conversations.map(c => [c.id, c]));
    expect(byId['app-session'].runningProcess).toMatchObject({ pid: '111' });
    expect(byId['api-session'].runningProcess).toMatchObject({ pid: '222' });
    // Answered 20 minutes ago with claude still running: an open session, not someone typing
    expect(byId['app-session'].conversationState).toBe('Active session');
    // Answered 6 minutes ago: still waiting on the user (needs the parsed messages' roles)
    expect(byId['api-session'].conversationState).toBe('Awaiting user input...');
  });
});
