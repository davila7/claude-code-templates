import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = {
  plugin: 'thinking-pane',
  component: 'Pane',
  requestId: 'thinking',
  props: {
    title: 'Thinking',
    isFocused: false,
    bodyColumns: 56,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// Stands in for the engine beneath the plugin.
function engine(on: On, thinking: Record<string, string[]>) {
  on('command.register', () => ({ value: { command: 'thinking' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.scroll', () => ({}))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'explore-1' }))
  on('turn.step', async function* (_, e) {
    for (const text of thinking[e.agentId ?? 'main'] ?? []) yield { kind: 'thinking', index: 0, text }
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
}

async function drain(stream: AsyncGenerator<unknown, unknown>) {
  for await (const _ of stream) {
    // read it to the end
  }
}

test('subagents are cards on main; a card opens its page, back returns, the viewed transcript opens its page', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 10, 3, 14, 2, 7) })
  engine(on, {
    main: ['Users get logged out ', 'after an hour.'],
    'explore-1': ['Grep for refreshToken across src.'],
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't1', text: 'users get logged out after an hour, fix it' })
  await drain($.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 }))
  await $.agent.spawn({ prompt: 'find callers', description: 'find refresh callers', subagentType: 'Explore', tool_use_id: 'tu1', provider: { plugin: 'engine', tier: 'core' }, parentModel: 'm', background: false, fork: false })
  await $.turn.start({ turnId: 's1', text: 'find callers', agentId: 'explore-1' })
  await clock.advance(3000)
  await drain($.turn.step({ turnId: 's1', index: 0, model: 'm', messageCount: 1, agentId: 'explore-1' }))
  await clock.advance(200)

  // Main shows the agent as a card to open, without its thinking.
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Users get logged out after an hour\./ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Explore$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /● 0:0\d/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Grep for refreshToken/ })).toBeUndefined()

  // Its card opens its page: the trail back, and its thinking alone.
  await ui.press({ key: 'open-explore-1' })
  await clock.advance(200)
  expect(await ui.find({ type: 'Text', text: /Grep for refreshToken/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Users get logged out/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /› Explore/ })).toBeDefined()

  // The agent's card on its page folds to its header and opens again.
  await ui.press({ key: 'card-explore-1' })
  await clock.advance(200)
  expect(await ui.find({ type: 'Text', text: /Grep for refreshToken/ })).toBeUndefined()
  await ui.press({ key: 'card-explore-1' })
  await clock.advance(200)
  expect(await ui.find({ type: 'Text', text: /Grep for refreshToken/ })).toBeDefined()

  // Back returns to main.
  await ui.press({ key: 'back' })
  await clock.advance(200)
  expect(await ui.find({ type: 'Text', text: /Grep for refreshToken/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Users get logged out/ })).toBeDefined()
  await ui.unmount()

  await clock.advance(9000)
  await $.turn.complete({ turnId: 's1', agentId: 'explore-1', answer: '', durationMs: 12000, isAborted: false, reason: 'answer' })
  await clock.advance(200)

  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /✓ 1[23]s/ })).toBeDefined()
  await ui.unmount()

  // Opening the agent's transcript beside the pane opens its page.
  ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, view: { agentId: 'explore-1' } } })
  expect(await ui.find({ type: 'Text', text: /Grep for refreshToken/ })).toBeDefined()
  await ui.unmount()
})

test('thinking is styled; a turn with no thinking keeps only its prompt row, which opens', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 10, 3, 14, 2, 7) })
  engine(on, { main: ['Check **the token check** in `src/auth.ts` and run `npm test`.'] })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't0', text: 'a turn with no thinking' })
  await $.turn.start({ turnId: 't1', text: 'fix it' })
  await drain($.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 }))
  await clock.advance(200)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^src\/auth\.ts$/ }))?.props.color).toBe('#f9e2af')
  expect((await ui.find({ type: 'Text', text: /^npm test$/ }))?.props.color).toBe('#f5c2e7')
  expect((await ui.find({ type: 'Text', text: /^the token check$/ }))?.props.bold).toBe(true)
  expect(await ui.find({ type: 'Text', text: /\*\*/ })).toBeUndefined()
  // A turn with no thinking keeps its prompt row and shows no empty card.
  expect(await ui.find({ type: 'Text', text: /a turn with no thinking/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /No thinking/ })).toBeUndefined()

  // The prompt box is headed "user", like the agent cards are headed by their type.
  expect(await ui.find({ type: 'Text', text: /^user$/ })).toBeDefined()
  // The prompt has the row to itself; its time sits on the line above it.
  expect(await ui.find({ type: 'Text', text: /^fix it$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^\d{1,2}:\d{2}:\d{2} [AP]M$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: / · / })).toBeUndefined()

  // The prompt box folds to its header, like the main card, and opens again.
  await ui.press({ key: 'prompt-t1' })
  await clock.advance(200)
  expect(await ui.find({ type: 'Text', text: /^fix it$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^▸ $/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /a turn with no thinking/ })).toBeDefined()
  await ui.press({ key: 'prompt-t1' })
  await clock.advance(200)
  expect(await ui.find({ type: 'Text', text: /^fix it$/ })).toBeDefined()

  // The main card folds to its header, like the prompt box, and opens again.
  await ui.press({ key: 'main-t1' })
  await clock.advance(200)
  expect(await ui.find({ type: 'Text', text: /^src\/auth\.ts$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^main$/ })).toBeDefined()
  await ui.press({ key: 'main-t1' })
  await clock.advance(200)
  expect(await ui.find({ type: 'Text', text: /^src\/auth\.ts$/ })).toBeDefined()
  await ui.unmount()
})

test('a long prompt shows its first lines; its text opens the rest', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 10, 3, 14, 2, 7) })
  engine(on, {})
  const long = 'start ' + 'word '.repeat(60) + 'the end'

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't1', text: long })
  await clock.advance(200)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^start word/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /the end$/ })).toBeUndefined()
  await ui.press({ key: 'prompt-t1-text' })
  await clock.advance(200)
  expect(await ui.find({ type: 'Text', text: /the end$/ })).toBeDefined()
  await ui.unmount()
})

test('only the newest three turns draw their contents; an older one opens on request', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 10, 3, 14, 2, 7) })
  engine(on, { main: ['Thinking about it.'] })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const n of [1, 2, 3, 4, 5]) {
    await $.turn.start({ turnId: 't' + n, text: 'prompt number ' + n })
    await drain($.turn.step({ turnId: 't' + n, index: 0, model: 'm', messageCount: 1 }))
    await $.turn.complete({ turnId: 't' + n, answer: '', durationMs: 1000, isAborted: false, reason: 'answer' })
    await clock.advance(1000)
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  // t1 and t2 fold to their headers; t3 to t5 stay open.
  expect(await ui.find({ type: 'Text', text: /^prompt number 1$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^prompt number 2$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^prompt number 3$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^prompt number 5$/ })).toBeDefined()
  expect((await ui.findAll({ type: 'Text', text: /^Thinking about it\.$/ })).length).toBe(3)

  // An old turn's prompt and thinking open from their headers.
  await ui.press({ key: 'prompt-t1' })
  await ui.press({ key: 'main-t1' })
  await clock.advance(200)
  expect(await ui.find({ type: 'Text', text: /^prompt number 1$/ })).toBeDefined()
  expect((await ui.findAll({ type: 'Text', text: /^Thinking about it\.$/ })).length).toBe(4)
  await ui.unmount()
})

test('a long hash renders at once and plain; a URL is not a path', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 10, 3, 14, 2, 7) })
  const hash = 'c5d038d0291a5e11564d103d02f7351c3ce56752'
  engine(on, { main: ['Pushed ' + hash + ' and ' + 'q'.repeat(5000) + ', see https://github.com/a/b/c for src/x.ts'] })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't1', text: 'go' })
  const started = Date.now()
  await drain($.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 }))
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(Date.now() - started).toBeLessThan(2000)
  // The hash is drawn as plain text: no path or code color on any run holding it.
  const withHash = await ui.findAll({ type: 'Text', text: new RegExp(hash) })
  expect(withHash.length).toBeGreaterThan(0)
  expect(withHash.every(node => node.props.color === undefined)).toBe(true)
  expect((await ui.find({ type: 'Text', text: /^src\/x\.ts$/ }))?.props.color).toBe('#f9e2af')
  expect(await ui.find({ type: 'Text', text: /^\/a\/b\/c$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^github\.com\/a\/b\/c$/ })).toBeUndefined()
  await ui.unmount()
})

test('the page of a viewed transcript stays open on later redraws; a resume starts the pane over', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 10, 3, 14, 2, 7) })
  engine(on, { main: ['Main thinks.'], 'explore-1': ['Explore thinks.'] })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't1', text: 'go' })
  await drain($.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 }))
  await $.agent.spawn({ prompt: 'p', description: 'look', subagentType: 'Explore', tool_use_id: 'tu1', provider: { plugin: 'engine', tier: 'core' }, parentModel: 'm', background: false, fork: false })
  await $.turn.start({ turnId: 's1', text: 'p', agentId: 'explore-1' })
  await clock.advance(200)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, view: { agentId: 'explore-1' } } })
  await clock.advance(200)
  // More thinking redraws the pane; it stays on the agent's page.
  await drain($.turn.step({ turnId: 's1', index: 0, model: 'm', messageCount: 1, agentId: 'explore-1' }))
  await clock.advance(200)
  expect(await ui.find({ type: 'Text', text: /Explore thinks\./ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Main thinks\./ })).toBeUndefined()
  await ui.unmount()

  await $.session.end({ reason: 'resume', sessionId: 'old', resume: { sessionId: 'old' } as never })
  await clock.advance(200)
    // The new conversation reuses the old agent id: the pane still opens on main.
  await $.turn.start({ turnId: 't9', text: 'new conversation' })
  await $.turn.start({ turnId: 's9', text: 'p', agentId: 'explore-1' })
  await clock.advance(200)
  const after = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await after.find({ type: 'Text', text: /^new conversation$/ })).toBeDefined()
  expect(await after.find({ type: 'Text', text: /Main thinks\./ })).toBeUndefined()
  await after.unmount()
})
