/**
 * Regression tests for GHSA-4jm9-m3fr-9jpx:
 * unauthenticated OS command injection through the Console Bridge.
 *
 * Two properties are asserted:
 *  1. terminal input never reaches a shell, so quoting in the payload cannot
 *     break out and run an independent command;
 *  2. the port-3334 WebSocket handshake is gated, so a cross-site WebSocket
 *     hijack or a co-resident process cannot reach the sink at all.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');
const ConsoleBridge = require('../../src/console-bridge');

const hasExpect = ['/usr/bin/expect', '/usr/local/bin/expect', '/opt/homebrew/bin/expect']
  .some((p) => fs.existsSync(p));

const TEST_PORT = 43334;

describe('ConsoleBridge command injection (GHSA-4jm9-m3fr-9jpx)', () => {
  let marker;
  let bridge;

  beforeEach(() => {
    marker = path.join(os.tmpdir(), `cct-bridge-test-${process.pid}-${Date.now()}`);
    bridge = new ConsoleBridge({ port: TEST_PORT });
    bridge.terminalDevice = '/dev/null';
    bridge.attachedPid = process.pid;
  });

  afterEach(() => {
    try { fs.unlinkSync(marker); } catch (error) { /* not created */ }
  });

  const settle = () => new Promise((resolve) => setTimeout(resolve, 1500));

  (hasExpect ? it : it.skip)('does not execute a shell breakout in terminal input', async () => {
    // A single quote used to terminate the `expect -c '...'` argument, so
    // everything after it was parsed by /bin/sh as a new command.
    bridge.writeToTerminal(`x'; : > ${marker} #\n`);
    await settle();
    expect(fs.existsSync(marker)).toBe(false);
  });

  (hasExpect ? it : it.skip)('does not evaluate Tcl substitutions in terminal input', async () => {
    // The text is read back with $env(...) rather than interpolated into the
    // script source, so Tcl never re-parses it.
    bridge.writeToTerminal(`x[exec /bin/sh -c ": > ${marker}"]\n`);
    await settle();
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('ignores a choice response whose value is not a number', () => {
    const spy = jest.spyOn(bridge, 'writeToTerminal').mockImplementation(() => {});
    bridge.sendResponseToClaudeCode({ type: 'choice', value: "1'; id #" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('falls back exactly once when expect cannot be spawned', async () => {
    // Node emits both 'error' and 'close' for a missing binary.
    const spy = jest.spyOn(bridge, 'tryAlternativeInput').mockImplementation(() => {});
    const realPath = process.env.PATH;
    process.env.PATH = '/nonexistent';
    try {
      bridge.writeToTerminal('hello\n');
      await settle();
    } finally {
      process.env.PATH = realPath;
    }
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('ignores a text response whose value is not a string', () => {
    const spy = jest.spyOn(bridge, 'writeToTerminal').mockImplementation(() => {});
    bridge.sendResponseToClaudeCode({ type: 'text', value: { toString: () => "x'; id #" } });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('ConsoleBridge WebSocket handshake (GHSA-4jm9-m3fr-9jpx)', () => {
  let bridge;

  beforeAll(async () => {
    bridge = new ConsoleBridge({ port: TEST_PORT + 1 });
    await bridge.setupWebSocketServer();
  });

  afterAll(() => {
    if (bridge && bridge.wss) bridge.wss.close();
  });

  const connect = (suffix, headers) => new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT + 1}${suffix}`, { headers });
    const finish = (accepted) => { try { ws.close(); } catch (error) { /* already closed */ } resolve(accepted); };
    ws.on('open', () => finish(true));
    ws.on('error', () => finish(false));
  });

  it('rejects a connection with no token', async () => {
    await expect(connect('')).resolves.toBe(false);
  });

  it('rejects a connection with the wrong token', async () => {
    await expect(connect(`?token=${'a'.repeat(48)}`)).resolves.toBe(false);
  });

  it('rejects a cross-origin connection even with a valid token', async () => {
    await expect(
      connect(`?token=${bridge.authToken}`, { Origin: 'http://evil.example' })
    ).resolves.toBe(false);
  });

  it('accepts a local client with a valid token', async () => {
    await expect(connect(`?token=${bridge.authToken}`)).resolves.toBe(true);
    await expect(
      connect(`?token=${bridge.authToken}`, { Origin: 'http://localhost:3333' })
    ).resolves.toBe(true);
  });
});
