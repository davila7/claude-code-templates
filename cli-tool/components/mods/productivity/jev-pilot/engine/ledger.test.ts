import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

/**
 * A keyless session beneath the plugins, with a store in memory: the built-in
 * classifier answers `balanced`, Bash fails on `false`, and each turn ends
 * with an answer that used 321 output tokens.
 */
function world(on: On): Map<string, unknown> {
  // The plugin's store, in a map the test can read (the test's `$` is the
  // engine's, which has no store of its own).
  const store = new Map<string, unknown>()
  mock.clock(on)
  mock.env(on, { HOME: '/home/test' })
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, JSON.parse(JSON.stringify(e.value)))
    return { value: undefined }
  })
  on('store.delete', async (_$, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', async () => ({ value: [...store.keys()] }))
  on('ui.log', async () => ({ value: undefined }))
  on('ui.status', async () => ({ value: undefined }))
  on('model.classify', async () => ({ value: 'balanced' }))
  on('session.messages', async () => ({ value: [] }))
  on('command.list', async () => ({ value: [] }))
  on('prompt.submit', async (_$, e) => ({ text: e.text, context: e.context }))
  on('tool.call', async (_$, e) => {
    const failed = String((e as { command?: unknown }).command) === 'false'
    return failed ? { result: 'exit 1', text: 'exit 1', isError: true as const } : { result: 'ok', text: 'ok' }
  })
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'tool_use' as const, usage: null }
  })
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  on('skill.prompt', async (_$, e) => ({ text: e.text }))
  return store
}

async function turn($: Engine, turnId: string, commands: string[]) {
  await $.prompt.submit({ text: 'fix the build', wait: false } as never)
  for (const [index, command] of ['', ...commands].entries()) {
    if (command) await $.tool.call({ tool: 'Bash', command } as never)
    for await (const _chunk of $.turn.step({ turnId, index, model: 'claude-opus-5-5', effort: 'medium', messageCount: 1 })) {
    }
  }
  await $.turn.complete({
    turnId,
    answer: 'done',
    durationMs: 4200,
    isAborted: false,
    reason: 'answer',
    usage: { input_tokens: 10, output_tokens: 321, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' },
  } as never)
}

test('each main-loop turn leaves one entry: its start, its raise, its tools and its tokens', async ($, on) => {
  const store = world(on)
  await turn($, 't1', ['false', 'false', 'true'])
  await turn($, 't2', ['true'])

  const ledger = store.get('ledger') as Record<string, unknown>[]
  expect(ledger).toHaveLength(2)
  const [first, second] = ledger
  expect(first).toMatchObject({
    started: 'medium',
    raisedTo: 'high',
    toolCalls: 3,
    failures: 2,
    outcome: 'answer',
    durationMs: 4200,
    outputTokens: 321,
    tier: 'balanced',
  })
  expect(second).toMatchObject({ raisedTo: null, toolCalls: 1, failures: 0 })
  // No prompt text is ever stored.
  expect(JSON.stringify(ledger)).not.toContain('fix the build')
})

test('the report command reads the ledger, and reset clears it', async ($, on) => {
  const store = world(on)
  await turn($, 't1', ['false', 'false'])

  const report = await $.skill.prompt({ skill: 'jev-pilot:report', text: 'Mode: ' })
  expect(report.text).toContain('Decision ledger: 1 turns')
  expect(report.text).toContain('| medium | 1 | 100% |')
  expect(report.text).toContain('Do not change any settings')

  await $.skill.prompt({ skill: 'jev-pilot:report', text: 'Mode: reset' })
  expect(store.has('ledger')).toBe(false)
})
