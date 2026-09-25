import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, SessionMessage } from 'claude-code'

/**
 * The world beneath the plugin for one session with no backend key: the
 * built-in classifier answers `tier`, the transcript is `messages()`, and
 * every log line is kept. Returns the log and the efforts each request of
 * the turn reached the model with.
 */
function world(on: On, tier: string, messages: () => SessionMessage[]) {
  const log: string[] = []
  const efforts: unknown[] = []
  const statuses: string[] = []
  const clock = mock.clock(on)
  mock.env(on, { HOME: '/nowhere' })
  mock.store(on)
  on('ui.log', async (_$, e) => {
    log.push(e.text)
    return { value: undefined }
  })
  on('ui.status', async (_$, e) => {
    statuses.push(String((e as { text?: unknown }).text ?? ''))
    return { value: undefined }
  })
  on('model.classify', async () => ({ value: tier }))
  on('session.messages', async () => ({ value: messages() }))
  on('command.list', async () => ({ value: [] }))
  on('command.register', async (_$, e) => ({ value: { command: (e as { name: string }).name } }))
  // Beneath the plugin, the engine draws nothing in the band.
  on('ui.render', async () => ({ type: 'Box', props: {}, children: [] }) as never)
  on('turn.step', async function* (_$, e) {
    efforts.push(e.effort)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'tool_use' as const, usage: null }
  })
  return { log, efforts, statuses, clock }
}

/** Beneath the plugins, Bash fails on `false` and succeeds on anything else; a `deny` command is refused. */
function tools(on: On) {
  on('tool.call', async (_$, e) => {
    const command = String((e as { command?: unknown }).command)
    if (command === 'deny') return { deny: 'the user said no' }
    return command === 'false' ? { result: 'exit 1', text: 'exit 1', isError: true as const } : { result: 'ok', text: 'ok' }
  })
}

async function bash($: Engine, command: string) {
  await $.tool.call({ tool: 'Bash', command } as never)
}

/** What the pet's bubble shows, drawn by the plugin in the band above the prompt. */
async function bubble($: Engine): Promise<string> {
  const ui = await $.ui.mount({
    plugin: 'jev-pilot',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100 },
  } as never)
  const said = await ui.find({ key: 'jev:say' } as never)
  const drawn = said ? '' : JSON.stringify(await ui.drawn()).slice(0, 600)
  await ui.unmount()
  return String((said as { text?: unknown } | undefined)?.text ?? `NOT FOUND; drawn: ${drawn}`)
}

/** One request of turn `t1` through the plugins, drained to its end. */
async function step($: Engine, index: number, effort: 'medium') {
  for await (const _chunk of $.turn.step({ turnId: 't1', index, model: 'claude-opus-5-5', effort, messageCount: 1 })) {
  }
}

test('two failed tool calls in a row raise the turn one rung, once', async ($, on) => {
  const transcript: SessionMessage[] = [{ role: 'user', text: 'fix the build', toolUses: [] }]
  const { efforts, log } = world(on, 'balanced', () => transcript)
  tools(on)
  on('prompt.submit', async (_$, e) => ({ text: e.text, context: e.context }))

  await $.prompt.submit({ text: 'fix the build', wait: false } as never)
  await step($, 0, 'medium')
  await bash($, 'false')
  await step($, 1, 'medium')
  await bash($, 'false')
  await step($, 2, 'medium')
  await bash($, 'false')
  await step($, 3, 'medium')

  expect(efforts).toEqual(['medium', 'medium', 'high', 'high'])
  // By default jev-pilot talks through the pet, never in the conversation.
  expect(log.filter((line) => line.startsWith('jev') || line.startsWith('[jev'))).toEqual([])
  // The pet's bubble says the raise.
  expect(await bubble($)).toContain('2 fails → high')
})

test('a success resets the run, and a refused permission is not a failure', async ($, on) => {
  const { efforts } = world(on, 'balanced', () => [])
  tools(on)
  on('prompt.submit', async (_$, e) => ({ text: e.text, context: e.context }))

  await $.prompt.submit({ text: 'fix the build', wait: false } as never)
  await step($, 0, 'medium')
  // A success resets the run: false, true, false is one failure, not two.
  await bash($, 'false')
  await bash($, 'true')
  await bash($, 'false')
  await step($, 1, 'medium')
  // A refusal between two failures neither counts nor clears: false, deny,
  // false is two in a row, and only that raises the turn.
  await bash($, 'deny')
  await bash($, 'false')
  await step($, 2, 'medium')

  expect(efforts).toEqual(['medium', 'medium', 'high'])
})

test('no key: no strategy advice is attached, whatever the tier; only the note to the model, once', async ($, on) => {
  world(on, 'deep', () => [])
  const submitted: string[][] = []
  on('prompt.submit', async (_$, e) => {
    submitted.push([...((e.context ?? []) as string[])])
    return { text: e.text, context: e.context }
  })
  await $.prompt.submit({ text: 'build the whole billing service', wait: false } as never)
  await $.prompt.submit({ text: 'and add tests for it', wait: false } as never)
  // The first prompt carries what jev-pilot does, for the model; no advice.
  expect(submitted[0]).toHaveLength(1)
  expect(submitted[0]?.[0]).toContain('<jev_pilot>')
  expect(submitted[0]?.[0]).toContain("each subagent's model")
  // The second carries nothing: the note is once per session.
  expect(submitted[1]).toEqual([])
})

test('the session announces jev-pilot as it opens, before any prompt', async ($, on) => {
  const { log, statuses } = world(on, 'balanced', () => [])
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/tmp/project', surface: null, isInteractive: true } as never)
  expect(await bubble($)).toContain('ready · no key, built-in')
  // Nothing in the conversation, nothing in the footer: the pet says it.
  expect(log).toEqual([])
  expect(statuses).toEqual([])
})

async function jev($: Engine, args: string): Promise<string> {
  const result = await $.command.run({ command: 'jev', args, origin: { kind: 'composer' } } as never)
  return String((result as { text?: unknown }).text ?? '')
}

test('/jev lists the switches, and /jev raise off stops the mid-turn raise live', async ($, on) => {
  const { efforts } = world(on, 'balanced', () => [])
  tools(on)
  on('prompt.submit', async (_$, e) => ({ text: e.text, context: e.context }))

  const status = await jev($, '')
  for (const name of ['effort', 'raise', 'subagents', 'skills', 'strategy', 'model', 'pet']) expect(status).toContain(name)
  expect(await jev($, 'raise off')).toContain('raise off')

  await $.prompt.submit({ text: 'fix the build', wait: false } as never)
  await step($, 0, 'medium')
  await bash($, 'false')
  await bash($, 'false')
  await step($, 1, 'medium')
  // Two failures in a row, and still no raise: the switch is off.
  expect(efforts).toEqual(['medium', 'medium'])

  expect(await jev($, 'reset')).toMatch(/on\s+raise/)
})

test('/jev pet off hides the pet; /jev pet on brings it back', async ($, on) => {
  world(on, 'balanced', () => [])
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/tmp/project', surface: null, isInteractive: true } as never)
  expect(await bubble($)).toContain('ready')
  await jev($, 'pet off')
  expect(await bubble($)).toContain('NOT FOUND')
  await jev($, 'pet on')
  expect(await bubble($)).toContain('ready')
  await jev($, 'reset')
})

test('the pet shows what Claude is doing: reading during a Read, running during a Bash, thinking between', async ($, on) => {
  world(on, 'balanced', () => [])
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  const during: string[] = []
  // Beneath the plugins, each tool reads the bubble while it runs.
  on('tool.call', async () => {
    during.push(await bubble($))
    return { result: 'ok', text: 'ok' }
  })
  await $.turn.start({ text: 'look at the build', turnId: 't1' } as never)
  expect(await bubble($)).toContain('thinking')
  await $.tool.call({ tool: 'Read', file_path: '/tmp/x' } as never)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  expect(during[0]).toContain('reading')
  expect(during[1]).toContain('running')
  expect(await bubble($)).toContain('thinking')
})

test('subagents still working in the background: the pilot cruises until they are done', async ($, on) => {
  const { clock } = world(on, 'balanced', () => [])
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  let status = 'running'
  on('agent.list', async () => ({ value: [{ id: 'a1', description: 'build', type: 'general-purpose', status }] }))
  await $.session.start({ cwd: '/tmp/project', surface: null, isInteractive: true } as never)
  await clock.advance(1600)
  expect(await bubble($)).toContain('working')
  status = 'completed'
  await clock.advance(1600)
  expect(await bubble($)).not.toContain('working')
})
