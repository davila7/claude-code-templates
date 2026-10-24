const { detectClient, detectAgentName, detectEntrypoint, KNOWN_AGENTS } = require('../../src/agent-detection');

const noDevin = () => false;

describe('agent-detection', () => {
  test('a plain terminal is not an agent', () => {
    expect(detectClient({}, { isTTY: true }, noDevin)).toEqual({ agent: null, entrypoint: null, isTty: true });
  });

  test('missing isTTY counts as no terminal', () => {
    expect(detectClient({}, {}, noDevin).isTty).toBe(false);
  });

  test('Claude Code AI_AGENT value maps to claude', () => {
    expect(detectAgentName({ AI_AGENT: 'claude-code_2-1-309_agent' }, noDevin)).toBe('claude');
  });

  test('unknown AI_AGENT becomes other, never the raw value', () => {
    expect(detectAgentName({ AI_AGENT: 'someone@example.com' }, noDevin)).toBe('other');
  });

  test.each([
    [{ CLAUDECODE: '1' }, 'claude'],
    [{ CLAUDECODE: '1', CLAUDE_CODE_IS_COWORK: '1' }, 'cowork'],
    [{ CURSOR_TRACE_ID: 'x' }, 'cursor'],
    [{ CURSOR_AGENT: '1' }, 'cursor-cli'],
    [{ CODEX_SANDBOX: 'seatbelt' }, 'codex'],
    [{ GEMINI_CLI: '1' }, 'gemini'],
    [{ OPENCODE: '1' }, 'opencode'],
    [{ REPL_ID: 'x' }, 'replit'],
    [{ COPILOT_MODEL: 'x' }, 'github-copilot']
  ])('%o is detected as %s', (env, name) => {
    expect(detectAgentName(env, noDevin)).toBe(name);
  });

  test('Devin is detected from /opt/.devin', () => {
    expect(detectAgentName({}, (p) => p === '/opt/.devin')).toBe('devin');
  });

  test('every reported name is in KNOWN_AGENTS', () => {
    for (const env of [{ AI_AGENT: 'codex' }, { AI_AGENT: 'whatever' }, { CLAUDECODE: '1' }]) {
      expect(KNOWN_AGENTS).toContain(detectAgentName(env, noDevin));
    }
  });

  test('entrypoint keeps short slugs only', () => {
    expect(detectEntrypoint({ CLAUDE_CODE_ENTRYPOINT: 'sdk-ts' })).toBe('sdk-ts');
    expect(detectEntrypoint({ CLAUDE_CODE_ENTRYPOINT: 'a b/c' })).toBeNull();
    expect(detectEntrypoint({})).toBeNull();
  });
});
