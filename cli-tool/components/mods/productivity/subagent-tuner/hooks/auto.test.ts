// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { BUILD, CUSTOM, REVIEW, SEARCH, UNTOUCHED, engine, mountBand, offerAgent, spawnAgent, start } from './harness'

test('a call that sets both fields passes untouched and asks nothing', async ($, on) => {
  const { seen, toasts, asked } = engine(on)

  await start($)
  await $.tool.call({ ...REVIEW, model: 'sonnet', effort: 'low' })

  expect(seen).toEqual([{ model: 'sonnet', effort: 'low', description: 'Review the diff' }])
  expect(toasts).toEqual([])
  expect(asked).toEqual([])
})

test('a fork is left untouched: no dialog, no toast', async ($, on) => {
  const { seen, toasts, asked } = engine(on, { store: { mode: 'auto' } })

  await start($)
  await $.tool.call({ ...REVIEW, subagent_type: 'fork' })

  expect(seen).toEqual([UNTOUCHED('Review the diff')])
  expect(toasts).toEqual([])
  expect(asked).toEqual([])
})

test('auto applies the recommendation, and says so', async ($, on) => {
  const { seen, toasts, asked } = engine(on, { store: { mode: 'auto' } })

  await start($)
  await $.tool.call(REVIEW)

  expect(seen[0]).toMatchObject({ model: 'opus', effort: 'high' })
  expect(toasts).toEqual(['Subagent -> opus/high'])
  expect(asked).toEqual([])
})

test('auto applies the saved default over the recommendation', async ($, on) => {
  const { seen, toasts } = engine(on, { store: { mode: 'auto', saved: { model: 'haiku', effort: 'xhigh' } } })

  await start($)
  await $.tool.call(REVIEW)

  expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'xhigh' })
  expect(toasts).toEqual(['Subagent -> haiku/xhigh'])
})

test('a default that leaves a field inherited falls back to the recommendation for it', async ($, on) => {
  const { seen } = engine(on, { store: { mode: 'auto', saved: { model: 'sonnet', effort: null } } })

  await start($)
  await $.tool.call(REVIEW)

  expect(seen[0]).toMatchObject({ model: 'sonnet', effort: 'high' })
})

test('auto fills only the field the call left open', async ($, on) => {
  const { seen, toasts } = engine(on, { store: { mode: 'auto' } })

  await start($)
  await $.tool.call({ ...REVIEW, model: 'sonnet' })

  expect(seen[0]).toMatchObject({ model: 'sonnet', effort: 'high' })
  expect(toasts).toEqual(['Subagent -> sonnet/high'])
})

test('auto with an unknown kind and no default leaves the call alone', async ($, on) => {
  const { seen, toasts } = engine(on, { store: { mode: 'auto' } })

  await start($)
  await $.tool.call({ tool: 'Agent', description: 'Plan the week', prompt: 'p' })

  expect(seen[0]).toEqual(UNTOUCHED('Plan the week'))
  expect(toasts).toEqual([])
})

// Auto: the person's saved default wins over what the agent asked for, so a
// rule that makes the agent pass `model: "opus"` cannot outvote it.
test('auto: the saved default replaces the model the call set, and fills the effort it left open', async ($, on) => {
  const { seen, toasts, asked } = engine(on, { store: { mode: 'auto', saved: { model: 'sonnet', effort: 'high' } } })

  await start($)
  await $.tool.call({ ...REVIEW, model: 'opus' })

  expect(seen).toEqual([{ model: 'sonnet', effort: 'high', description: 'Review the diff' }])
  expect(toasts).toEqual(['Subagent (overridden) -> sonnet/high'])
  expect(asked).toEqual([])
})

test('auto: a call that set both fields is overridden too', async ($, on) => {
  const { seen } = engine(on, { store: { mode: 'auto', saved: { model: 'sonnet', effort: 'high' } } })

  await start($)
  await $.tool.call({ ...REVIEW, model: 'opus', effort: 'low' })

  expect(seen).toEqual([{ model: 'sonnet', effort: 'high', description: 'Review the diff' }])
})

test('auto: a field the default leaves to rec. keeps what the call set, else the recommendation', async ($, on) => {
  const { seen } = engine(on, { store: { mode: 'auto', saved: { model: null, effort: 'high' } } })

  await start($)
  await $.tool.call({ ...REVIEW, model: 'opus', effort: 'low' })
  await $.tool.call(BUILD)

  expect(seen).toEqual([
    { model: 'opus', effort: 'high', description: 'Review the diff' },
    { model: 'sonnet', effort: 'high', description: 'Build the parser' },
  ])
})

test('auto: with no saved default what the call set stands, and the rest is recommended', async ($, on) => {
  const { seen, toasts } = engine(on, { store: { mode: 'auto' } })

  await start($)
  await $.tool.call({ ...REVIEW, model: 'haiku' })
  await $.tool.call({ ...REVIEW, model: 'haiku', effort: 'low' })

  expect(seen).toEqual([
    { model: 'haiku', effort: 'high', description: 'Review the diff' },
    { model: 'haiku', effort: 'low', description: 'Review the diff' },
  ])
  expect(toasts).toEqual(['Subagent -> haiku/high'])
})

test('auto: a call that already matches the default goes through without a toast', async ($, on) => {
  const { seen, toasts } = engine(on, { store: { mode: 'auto', saved: { model: 'sonnet', effort: 'high' } } })

  await start($)
  await $.tool.call({ ...REVIEW, model: 'sonnet', effort: 'high' })

  expect(seen).toEqual([{ model: 'sonnet', effort: 'high', description: 'Review the diff' }])
  expect(toasts).toEqual([])
})

test('auto: a fork and a -p run are still left untouched', async ($, on) => {
  const { seen } = engine(on, { store: { mode: 'auto', saved: { model: 'sonnet', effort: 'high' } } })

  await start($)
  await $.tool.call({ ...REVIEW, subagent_type: 'fork', model: 'opus' })

  expect(seen).toEqual([{ model: 'opus', effort: undefined, description: 'Review the diff' }])
})

test('manual: a call that set both fields still goes through untouched', async ($, on) => {
  const { seen, asked } = engine(on, { store: { mode: 'manual', saved: { model: 'sonnet', effort: 'high' } } })

  await start($)
  await $.tool.call({ ...REVIEW, model: 'opus', effort: 'low' })

  expect(seen).toEqual([{ model: 'opus', effort: 'low', description: 'Review the diff' }])
  expect(asked).toEqual([])
})

test('the stored settings are loaded once, not on every call', async ($, on) => {
  const { gets } = engine(on, { store: { mode: 'auto' } })

  await start($)
  await $.tool.call(REVIEW)
  await $.tool.call(BUILD)
  await $.tool.call(SEARCH)

  expect(gets.sort()).toEqual(['mode', 'saved'])
})

test('a write is not undone by a later call', async ($, on) => {
  const { seen, store } = engine(on, { store: { mode: 'auto' } })

  await start($)

  const ui = await mountBand($, 100)

  await ui.press({ key: 'default-model' })
  // The store lags behind the state, as a slow disk would leave it.
  store.set('saved', null)
  await $.tool.call(REVIEW)

  expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'high' })
  await ui.unmount()
})

test('a failing tuner lets the subagent start untouched', async ($, on) => {
  const { seen } = engine(on, { isStoreBroken: true })

  await $.tool.call(REVIEW)

  expect(seen).toEqual([UNTOUCHED('Review the diff')])
})

test('a stored default that is not a known choice is never applied', async ($, on) => {
  const { seen } = engine(on, { store: { mode: 'auto', saved: { model: 'gpt', effort: 'ultra' } } })

  await start($)
  await $.tool.call(REVIEW)

  expect(seen[0]).toMatchObject({ model: 'opus', effort: 'high' })
})

// A custom agent's definition may pin a model and an effort the tuner never sees, so with no saved
// default it recommends nothing rather than replace them.
test('auto: a custom agent with no saved default passes untouched, a built-in one is recommended', async ($, on) => {
  const { seen, toasts } = engine(on, { store: { mode: 'auto' } })

  await start($)
  await offerAgent($, 'acme-reviewer')
  await $.tool.call(CUSTOM)
  await $.tool.call({ ...CUSTOM, subagent_type: 'general-purpose' })

  expect(seen).toEqual([UNTOUCHED('Review the diff'), { model: 'opus', effort: 'high', description: 'Review the diff' }])
  expect(toasts).toEqual(['Subagent -> opus/high'])
})

test('auto: a custom agent the offers never named is custom too', async ($, on) => {
  const { seen, toasts } = engine(on, { store: { mode: 'auto' } })

  await start($)
  await $.tool.call(CUSTOM)

  expect(seen).toEqual([UNTOUCHED('Review the diff')])
  expect(toasts).toEqual([])
})

test('auto: the saved default still replaces model and effort of a custom agent', async ($, on) => {
  const { seen, toasts } = engine(on, { store: { mode: 'auto', saved: { model: 'sonnet', effort: 'high' } } })

  await start($)
  await offerAgent($, 'acme-reviewer')
  await $.tool.call(CUSTOM)

  expect(seen).toEqual([{ model: 'sonnet', effort: 'high', description: 'Review the diff' }])
  expect(toasts).toEqual(['Subagent -> sonnet/high'])
})

test('auto: a saved effort left to rec. stays inherited for a custom agent', async ($, on) => {
  const { seen } = engine(on, { store: { mode: 'auto', saved: { model: 'sonnet', effort: null } } })

  await start($)
  await offerAgent($, 'acme-reviewer')
  await $.tool.call(CUSTOM)

  expect(seen).toEqual([{ model: 'sonnet', effort: undefined, description: 'Review the diff' }])
})

test('a user or project agent is custom even when offered under the engine core provider', async ($, on) => {
  const { seen } = engine(on, { store: { mode: 'auto', saved: { model: null, effort: null } } })

  await start($)
  await offerAgent($, 'acme-reviewer', false, 'userSettings', { plugin: 'engine', tier: 'core' })
  await offerAgent($, 'Plan', false, 'projectSettings', { plugin: 'engine', tier: 'core' })
  await $.tool.call(CUSTOM)
  await $.tool.call({ ...CUSTOM, subagent_type: 'Plan' })

  expect(seen).toEqual([
    { model: undefined, effort: undefined, description: 'Review the diff' },
    { model: undefined, effort: undefined, description: 'Review the diff' },
  ])
})

// The engine may raise a type's offer only after the call, so the call is judged by name. The spawn
// still names who provides the type: a type the engine itself provides is recommended for there.
const LATE = { ...REVIEW, subagent_type: 'late-builtin', tool_use_id: 'u1' } as never

test('auto: a call judged custom by name is recommended for at the spawn when the engine provides the type', async ($, on) => {
  const { seen, spawned, toasts } = engine(on, { store: { mode: 'auto' } })

  await start($)
  await $.tool.call(LATE)
  await spawnAgent($, 'u1', 'late-builtin')

  expect(seen).toEqual([UNTOUCHED('Review the diff')])
  expect(spawned).toEqual(['opus'])
  expect(toasts).toEqual(['Subagent model -> opus'])
})

test('auto: a call judged custom by name stays untouched at the spawn when a user or project provides the type', async ($, on) => {
  const { spawned, toasts } = engine(on, { store: { mode: 'auto' } })

  await start($)
  await $.tool.call(LATE)
  await spawnAgent($, 'u1', 'late-builtin', { plugin: 'project', tier: 'user' })

  expect(spawned).toEqual([undefined])
  expect(toasts).toEqual([])
})

test('auto: a spawn of a call the tuner did not judge by name, or judged built-in, is left alone', async ($, on) => {
  const { spawned, toasts } = engine(on, { store: { mode: 'auto' } })

  await start($)
  await $.tool.call({ ...SEARCH, tool_use_id: 'u2' } as never)
  await spawnAgent($, 'u2', 'Explore')
  await spawnAgent($, 'unknown-call', 'late-builtin')

  expect(spawned).toEqual([undefined, undefined])
  expect(toasts).toEqual(['Subagent -> haiku/low'])
})

test('manual: the spawn of a call the person was asked about is left alone', async ($, on) => {
  const { spawned } = engine(on, { store: { mode: 'manual' }, script: ['inherit'] })

  await start($)
  await $.tool.call(LATE)
  await spawnAgent($, 'u1', 'late-builtin')

  expect(spawned).toEqual([undefined])
})

test('auto: a type the engine announced as a user agent stays untouched at the spawn even under the engine core provider', async ($, on) => {
  const { spawned, toasts } = engine(on, { store: { mode: 'auto' } })

  await start($)
  await $.tool.call(LATE)
  await offerAgent($, 'late-builtin', false, 'userSettings', { plugin: 'engine', tier: 'core' })
  await spawnAgent($, 'u1', 'late-builtin')

  expect(spawned).toEqual([undefined])
  expect(toasts).toEqual([])
})
