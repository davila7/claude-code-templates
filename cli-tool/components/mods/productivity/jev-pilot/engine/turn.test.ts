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
  mock.clock(on)
  mock.env(on, { HOME: '/nowhere' })
  on('ui.log', async (_$, e) => {
    log.push(e.text)
    return { value: undefined }
  })
  on('ui.status', async () => ({ value: undefined }))
  on('model.classify', async () => ({ value: tier }))
  on('session.messages', async () => ({ value: messages() }))
  on('command.list', async () => ({ value: [] }))
  on('turn.step', async function* (_$, e) {
    efforts.push(e.effort)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'tool_use' as const, usage: null }
  })
  return { log, efforts }
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
  expect(log.some((line) => line.includes('main loop → effort high'))).toBe(true)
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

test('no key: nothing is attached to the prompt, whatever the tier', async ($, on) => {
  world(on, 'deep', () => [])
  const submitted: unknown[] = []
  on('prompt.submit', async (_$, e) => {
    submitted.push(e.context ?? [])
    return { text: e.text, context: e.context }
  })
  await $.prompt.submit({ text: 'build the whole billing service', wait: false } as never)
  expect(submitted).toEqual([[]])
})
