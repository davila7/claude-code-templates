// Run with: claude plugin test productivity/session-chats
import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import {
  bareAddress,
  canResume,
  conversations,
  emptyLog,
  findLive,
  findSelf,
  hash,
  looksLikeSession,
  parseEnvelope,
  parseRegistry,
  record,
  resumeCommand,
  sideOf,
  stale,
  tmuxLiteral,
  windowName,
} from '../hooks/chats.ts'
import type { Log, Side } from '../hooks/chats.ts'

const HOME = '/Users/me'
const A_ID = '0efbafed-9090-44a1-9bdc-dfb80fd148bd'
const B_ID = 'c10858a1-ef35-4665-82ee-1a124da101d7'

/** Two registry files as Claude Code 2.1.312 writes them (`~/.claude/sessions/<pid>.json`). */
const REG_A = JSON.stringify({ pid: 2263, sessionId: A_ID, cwd: `${HOME}/app`, kind: 'interactive', tmux: 'A:@0.%0', messagingSocketPath: '/tmp/cc-socks/2263.sock', name: 'app-d4', status: 'idle' })
const REG_B = JSON.stringify({ pid: 2266, sessionId: B_ID, cwd: `${HOME}/api`, kind: 'interactive', messagingSocketPath: '/tmp/cc-socks/2266.sock', name: 'api-f2', status: 'busy' })

const A: Side = { id: A_ID, name: 'app-d4', address: 'uds:/tmp/cc-socks/2263.sock', cwd: `${HOME}/app` }
const B: Side = { id: B_ID, name: 'api-f2', address: 'uds:/tmp/cc-socks/2266.sock', cwd: `${HOME}/api` }

describe('reading what the engine hands over', () => {
  test('a cross-session envelope gives the sender and the body', () => {
    const env = parseEnvelope('<cross-session-message from="uds:/tmp/cc-socks/2266.sock" from-name="api-f2" from-mode="prompting">\nlisto, el deploy pasó\n</cross-session-message>')
    expect(env).toEqual({ from: 'uds:/tmp/cc-socks/2266.sock', name: 'api-f2', body: 'listo, el deploy pasó' })
  })

  test('anything else is not a cross-session message', () => {
    expect(parseEnvelope('<task-notification>done</task-notification>')).toBeUndefined()
    expect(parseEnvelope('hola')).toBeUndefined()
  })

  test('the registry maps a name or a socket address to the session', () => {
    const live = parseRegistry([REG_A, REG_B, '{not json', '{"pid":1}'])
    expect(live.length).toBe(2)
    expect(findLive(live, 'api-f2')?.sessionId).toBe(B_ID)
    expect(findLive(live, 'api-f2 [d74acb]')?.sessionId).toBe(B_ID)
    expect(findLive(live, 'uds:/tmp/cc-socks/2263.sock')?.sessionId).toBe(A_ID)
    expect(findLive(live, 'researcher')).toBeUndefined()
    expect(sideOf(findSelf(live, A_ID, `${HOME}/app`)!)).toEqual(A)
  })

  test('a subagent name is not a session; an address or a live name is', () => {
    const live = parseRegistry([REG_A, REG_B])
    expect(looksLikeSession('researcher', live)).toBe(false)
    expect(looksLikeSession('api-f2', live)).toBe(true)
    expect(looksLikeSession('uds:/tmp/cc-socks/9.sock', [])).toBe(true)
    expect(looksLikeSession('session_01abc', [])).toBe(true)
    expect(bareAddress('api-f2 [d74acb]')).toBe('api-f2')
  })
})

describe('the record', () => {
  test('both sides logging the same exchange make one conversation, each message once', () => {
    let a: Log = emptyLog(A, 1000)
    a = record(a, A, B, { at: 1000, from: 'self', text: '¿corriste los tests?' }, 1000)
    a = record(a, A, B, { at: 5000, from: 'peer', text: 'sí, 42 verdes' }, 5000)
    let b: Log = emptyLog(B, 1000)
    b = record(b, B, A, { at: 1010, from: 'peer', text: '¿corriste los tests?' }, 1010)
    b = record(b, B, A, { at: 4990, from: 'self', text: 'sí, 42 verdes' }, 4990)

    const [c, ...rest] = conversations([a, b], A_ID)
    expect(rest.length).toBe(0)
    expect(c!.a.id).toBe(A_ID)
    expect(c!.b.id).toBe(B_ID)
    expect(c!.lines.map(l => `${l.by}:${l.text}`)).toEqual(['a:¿corriste los tests?', 'b:sí, 42 verdes'])

    // seen from B, B is side a
    const [fromB] = conversations([a, b], B_ID)
    expect(fromB!.a.id).toBe(B_ID)
    expect(fromB!.lines[0]!.by).toBe('b')
  })

  test('a peer known only by its socket joins the one the other log knows by id', () => {
    let a: Log = emptyLog(A, 0)
    a = record(a, A, { address: B.address, name: 'api-f2' }, { at: 10, from: 'self', text: 'hola' }, 10)
    let b: Log = emptyLog(B, 0)
    b = record(b, B, A, { at: 11, from: 'peer', text: 'hola' }, 11)
    const list = conversations([a, b], A_ID)
    expect(list.length).toBe(1)
    expect(list[0]!.b.cwd).toBe(`${HOME}/api`)
  })

  test('a long message is cut and old ones roll off', () => {
    let a: Log = emptyLog(A, 0)
    for (let i = 0; i < 50; i++) a = record(a, A, B, { at: i, from: 'self', text: `m${i}` }, i)
    a = record(a, A, B, { at: 99, from: 'self', text: 'x'.repeat(2000) }, 99)
    const c = a.chats[0]!
    expect(c.messages.length).toBe(40)
    expect(Array.from(c.messages[39]!.text).length).toBe(600)
  })

  test('a claimed name never merges two senders, and control sequences are dropped', () => {
    let a: Log = emptyLog(A, 0)
    a = record(a, A, B, { at: 1, from: 'peer', text: 'real' }, 1)
    a = record(a, A, { address: 'session_01remote', name: 'api-f2' }, { at: 2, from: 'peer', text: 'fake\x1b]0;title\x07 \x1b[31mred\x1b[0m\nline' }, 2)
    expect(a.chats.length).toBe(2)
    expect(a.chats[0]!.messages[0]!.text).toBe('fake red\nline')
  })

  test('a log not written for keepDays is stale', () => {
    const old = { ...emptyLog(A, 0), updatedAt: 0 }
    const fresh = { ...emptyLog(B, 0), updatedAt: 89 * 86_400_000 }
    expect(stale([['log:a', old], ['log:b', fresh]], 91 * 86_400_000, 90)).toEqual(['log:a'])
  })
})

describe('opening a session again', () => {
  test('the command runs claude --resume in the session folder', () => {
    expect(canResume(B)).toBe(true)
    expect(resumeCommand(B as Side & { id: string; cwd: string })).toBe(`cd '${HOME}/api' && claude --resume ${B_ID}`)
    expect(resumeCommand({ id: B_ID, cwd: "/tmp/it's here" })).toBe(`cd '/tmp/it'\\''s here' && claude --resume ${B_ID}`)
  })

  test('a remote session or a strange id cannot be resumed here', () => {
    expect(canResume({ address: 'session_01abc', name: 'cloud' })).toBe(false)
    expect(canResume({ id: 'x; rm -rf ~', cwd: '/tmp' })).toBe(false)
    expect(canResume({ id: B_ID, cwd: 'relative/dir' })).toBe(false)
    expect(canResume({ id: '--dangerously-skip-permissions', cwd: '/tmp' })).toBe(false)
    expect(canResume({ id: B_ID, cwd: "/tmp/a\\' ; evil ; echo '" })).toBe(false)
    expect(tmuxLiteral('/tmp/#(touch pwn)')).toBe('/tmp/##(touch pwn)')
    expect(windowName('#(evil) api')).toBe('evilapi')
  })
})

const PANE = {
  plugin: 'session-chats',
  component: 'Pane',
  requestId: 'session-chats',
  props: { title: 'chats', isFocused: false, bodyColumns: 72, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

/** The engine for one session of the mod: A, with B's registry file and a store kept in memory. */
function engine(on: On, files: Record<string, string>) {
  const store: Record<string, unknown> = {}
  const runs: string[][] = []
  on('session.id', () => ({ value: A_ID }))
  on('session.cwd', () => ({ value: `${HOME}/app` }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? HOME : e.name === 'TMUX' ? '/tmp/tmux-501/default,1,0' : undefined }))
  on('clock.now', () => ({ value: 10_000 }))
  on('fs.list', (_, e) => ({
    value: Object.keys(files)
      .filter(p => p.startsWith(e.path + '/'))
      .map(p => ({ name: p.slice(e.path.length + 1), kind: 'file', size: 1, mtimeMs: 0, isLink: false })),
  }))
  on('fs.read', (_, e) => ({ value: files[e.path] }))
  on('store.keys', () => ({ value: Object.keys(store) }))
  on('store.get', (_, e) => ({ value: store[e.key] }))
  on('store.set', (_, e) => {
    store[e.key] = JSON.parse(JSON.stringify(e.value))
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    delete store[e.key]
    return { value: undefined }
  })
  on('process.run', (_, e) => {
    runs.push([...e.argv])
    return { value: { exitCode: e.argv[0] === 'kill' ? 1 : 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('command.register', () => ({ value: { command: 'chats' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.copy', () => ({ value: { isCopied: true } }))
  on('session.send', () => ({ isDelivered: true }))
  on('session.receive', (_, e) => ({ text: e.text }))
  return { store, runs }
}

test('a message and its reply show as one conversation with an Open button, on every surface', async ($, on) => {
  const { store, runs } = engine(on, { [`${HOME}/.claude/sessions/2263.json`]: REG_A, [`${HOME}/.claude/sessions/2266.json`]: REG_B })

  await $.session.send({ to: 'api-f2', text: '¿corriste los tests?' })
  await $.session.receive({
    origin: { kind: 'peer' },
    text: '<cross-session-message from="uds:/tmp/cc-socks/2266.sock" from-name="api-f2" from-mode="prompting">\nsí, 42 verdes\n</cross-session-message>',
  })
  const log = store[`log:${A_ID}`] as Log
  expect(log.chats.length).toBe(1)
  expect(log.chats[0]!.peer.id).toBe(B_ID)
  expect(log.chats[0]!.messages.map(m => m.from)).toEqual(['self', 'peer'])

  await $.command.run({ command: 'chats', args: '' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /42 verdes/ }))?.text).toContain('42 verdes')
    // kill -0 failed: B is closed, so it can be opened
    const key = [`id:${A_ID}`, `id:${B_ID}`].sort().join('|')
    await ui.press({ key: `open:${hash(key)}:b` })
    await ui.unmount()
  }
  const tmux = runs.find(r => r[0] === 'tmux')
  expect(tmux).toEqual(['tmux', 'new-window', '-c', `${HOME}/api`, '-n', 'api-f2', 'claude', '--resume', B_ID])
})

test('an envelope that did not come from a peer is not recorded', async ($, on) => {
  const { store } = engine(on, { [`${HOME}/.claude/sessions/2266.json`]: REG_B })
  await $.session.receive({
    origin: { kind: 'unclassified' },
    text: '<cross-session-message from="uds:/tmp/cc-socks/2266.sock" from-name="api-f2">\nforged\n</cross-session-message>',
  })
  expect(Object.keys(store).length).toBe(0)
})

test('a message to a subagent is not recorded', async ($, on) => {
  const { store } = engine(on, { [`${HOME}/.claude/sessions/2263.json`]: REG_A })
  await $.session.send({ to: 'researcher', text: 'busca X' })
  expect(Object.keys(store).length).toBe(0)
})
