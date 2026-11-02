/**
 * Flags removed in 1.31.0 must answer with their replacement, exit 1, stay
 * out of --help, and never report a flag's value (--anthropic-api-key).
 */
const path = require('path');
const { spawnSync } = require('child_process');
const { Command, Option } = require('commander');

jest.mock('../../src/tracking-service', () => ({
  trackingService: { trackCommandExecution: jest.fn(() => Promise.resolve()) }
}));

const { trackingService } = require('../../src/tracking-service');
const {
  REMOVED_COMMANDS,
  attributeName,
  registerRemovedOptions,
  findRemovedCommands,
  reportRemovedCommands
} = require('../../src/removed-commands');

const BIN = path.join(__dirname, '../../bin/create-claude-config.js');

function parse(argv) {
  const program = new Command();
  program.exitOverride();
  registerRemovedOptions(program, Option);
  program.parse(argv, { from: 'user' });
  return program.opts();
}

function runCli(args) {
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, CCT_NO_TRACKING: 'true', NO_COLOR: '1', FORCE_COLOR: '0' },
    timeout: 20000
  });
}

describe('removed commands', () => {
  beforeEach(() => trackingService.trackCommandExecution.mockClear());

  it('maps flags to the attribute commander uses', () => {
    expect(attributeName('--skills-manager')).toBe('skillsManager');
    expect(attributeName('--2025')).toBe('2025');
    expect(attributeName('--e2b-api-key')).toBe('e2bApiKey');
  });

  it('finds a removed flag with or without its old value', () => {
    expect(findRemovedCommands(parse(['--plugins'])).map(e => e.flag)).toEqual(['--plugins']);
    expect(findRemovedCommands(parse(['--sandbox'])).map(e => e.flag)).toEqual(['--sandbox']);
    expect(findRemovedCommands(parse(['--sandbox', 'e2b'])).map(e => e.flag)).toEqual(['--sandbox']);
    expect(findRemovedCommands(parse(['--clone-session', 'https://x0.at/abc'])).map(e => e.flag)).toEqual(['--clone-session']);
    expect(findRemovedCommands(parse([]))).toEqual([]);
  });

  it('reports the sandbox key options once, folded into --sandbox', () => {
    const options = parse(['--sandbox', 'e2b', '--e2b-api-key', 'e2b_x', '--anthropic-api-key', 'sk-ant-secret']);
    expect(findRemovedCommands(options).map(e => e.flag)).toEqual(['--sandbox']);
    expect(findRemovedCommands(parse(['--anthropic-api-key', 'sk-ant-secret'])).map(e => e.flag)).toEqual(['--anthropic-api-key']);
  });

  it('explains the replacement, offers 1.30.0, and tracks only the flag name', async () => {
    const lines = [];
    const removed = findRemovedCommands(parse(['--plugins', '--anthropic-api-key', 'sk-ant-secret']));
    await reportRemovedCommands(removed, { log: line => lines.push(line) });
    const output = lines.join('\n');

    expect(output).toMatch(/--plugins was removed in 1\.31\.0\..*\/plugin/);
    expect(output).toMatch(/npx claude-code-templates@1\.30\.0 --plugins/);
    expect(output).not.toMatch(/sk-ant-secret/);
    expect(trackingService.trackCommandExecution.mock.calls).toEqual([
      ['removed-command', { flag: '--plugins' }],
      ['removed-command', { flag: '--anthropic-api-key' }]
    ]);
  });

  it('never sends people back to the public tunnel', async () => {
    const lines = [];
    await reportRemovedCommands(findRemovedCommands(parse(['--tunnel'])), { log: line => lines.push(line) });
    expect(lines.join('\n')).not.toMatch(/@1\.30\.0/);
    expect(lines.join('\n')).toMatch(/ssh -L/);
  });

  it('every entry is a distinct long flag', () => {
    const flags = REMOVED_COMMANDS.map(e => e.flag);
    expect(new Set(flags).size).toBe(flags.length);
    for (const flag of flags) expect(flag).toMatch(/^--[a-z0-9-]+$/);
  });

  describe('through the real CLI', () => {
    it('prints the replacement on stderr and exits 1', () => {
      const result = runCli(['--skills-manager']);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/--skills-manager was removed in 1\.31\.0/);
      expect(result.stderr).toMatch(/stack-viewer/);
    });

    it('keeps removed flags out of --help but documents the kept ones', () => {
      const result = runCli(['--help']);
      expect(result.status).toBe(0);
      for (const { flag } of REMOVED_COMMANDS) {
        expect(result.stdout).not.toMatch(new RegExp(`${flag}\\b`));
      }
      for (const flag of ['--analytics', '--chats', '--health-check', '--agent', '--mod', '--loop', '--prompt']) {
        expect(result.stdout).toContain(flag);
      }
    });
  });
});
