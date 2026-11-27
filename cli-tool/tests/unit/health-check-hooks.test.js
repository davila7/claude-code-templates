/**
 * --health-check reads hooks the way Claude Code stores them: an object keyed
 * by event, each event a list of matcher groups whose `hooks` array holds the
 * handlers. It used to treat `hooks` as an array, so it reported
 * "undefined hooks configured" and "No hooks configured" for any real setup.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { HealthChecker } = require('../../src/health-check');

describe('health check hooks', () => {
  const savedPath = process.env.PATH;
  let root;
  let home;
  let project;
  let bin;

  function writeSettings(dir, file, settings) {
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', file), JSON.stringify(settings));
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cct-health-hooks-'));
    home = path.join(root, 'home');
    project = path.join(root, 'project');
    bin = path.join(root, 'bin');
    fs.mkdirSync(home);
    fs.mkdirSync(project);
    fs.mkdirSync(bin);
    // One program on PATH, so "found" and "not found" do not depend on the machine.
    const tool = path.join(bin, process.platform === 'win32' ? 'fake-formatter.cmd' : 'fake-formatter');
    fs.writeFileSync(tool, '#!/bin/sh\n');
    fs.chmodSync(tool, 0o755);
    process.env.PATH = bin;
    jest.spyOn(os, 'homedir').mockReturnValue(home);
    jest.spyOn(process, 'cwd').mockReturnValue(project);
  });

  afterEach(() => {
    process.env.PATH = savedPath;
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('counts the hook handlers in each settings file', () => {
    writeSettings(home, 'settings.json', {
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo checking' }] }],
        PostToolUse: [
          { matcher: 'Edit|Write', hooks: [
            { type: 'command', command: 'fake-formatter --write' },
            { type: 'command', command: 'fake-formatter --check' }
          ] }
        ]
      }
    });
    writeSettings(project, 'settings.json', {
      hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo hello' }] }] }
    });
    writeSettings(project, 'settings.local.json', { permissions: { allow: [] } });

    const checker = new HealthChecker({ interactive: false });
    expect(checker.checkUserHooks()).toEqual({ status: 'pass', message: '3 hooks configured in ~/.claude/settings.json' });
    expect(checker.checkProjectHooks()).toEqual({ status: 'pass', message: '1 hooks configured in .claude/settings.json' });
    expect(checker.checkLocalHooks()).toEqual({ status: 'pass', message: '0 hooks configured in .claude/settings.local.json' });
  });

  it('checks every command hook and reports a program that is not on PATH', () => {
    writeSettings(project, 'settings.json', {
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo checking' }] }],
        PostToolUse: [
          { matcher: 'Edit|Write', hooks: [
            { type: 'command', command: 'fake-formatter --write' },
            { type: 'command', command: 'missing-formatter --write' }
          ] }
        ]
      }
    });

    const checker = new HealthChecker({ interactive: false });
    expect(checker.checkHookCommands()).toEqual({ status: 'warn', message: '2/3 hook commands valid, 1 issues found' });
  });

  it('leaves shell syntax it cannot resolve and non-command hooks alone', () => {
    writeSettings(project, 'settings.json', {
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [
          { type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/check.sh' },
          { type: 'command', command: 'input=$(cat); echo "$input"' }
        ] }],
        Stop: [{ hooks: [{ type: 'prompt', prompt: 'Did the task finish?' }] }]
      }
    });

    const checker = new HealthChecker({ interactive: false });
    expect(checker.checkHookCommands()).toEqual({ status: 'pass', message: 'All 2 hook commands are valid' });
  });

  it('still says when no hooks are configured', () => {
    writeSettings(project, 'settings.json', { permissions: { allow: [] } });

    const checker = new HealthChecker({ interactive: false });
    expect(checker.checkHookCommands()).toEqual({ status: 'warn', message: 'No hooks configured' });
  });
});
