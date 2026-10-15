// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { REVIEW, SAVE_LABEL, engine, labelOf, mountBand, start } from './harness'
import { SAVE_WAIT_MS } from './register'

test('a slow first load that answers late cannot undo a click made meanwhile', async ($, on) => {
  const { clock, seen, asked } = engine(on, { slowFirstLoad: { staleMode: 'manual' } })
  const starting = start($)

  await clock.settle()

  const ui = await mountBand($, 100)

  await ui.press({ key: 'mode-auto' })
  await clock.advance(1000)
  await starting

  expect(await ui.find({ key: 'mode-auto' })).toMatchObject({ props: { variant: 'primary' } })
  await $.tool.call(REVIEW)

  expect(asked).toEqual([])
  expect(seen[0]).toMatchObject({ model: 'opus', effort: 'high' })
  await ui.unmount()
})

test('a store that refuses a write is said, and the click still takes effect', async ($, on) => {
  const { toasts } = engine(on, { isWriteBroken: true })

  await start($)

  const ui = await mountBand($, 100)

  await ui.press({ key: 'mode-auto' })

  expect(toasts[0]).toContain('could not save')
  expect(await ui.find({ key: 'mode-auto' })).toMatchObject({ props: { variant: 'primary' } })
  await ui.unmount()
})

test('writes land in click order even when an earlier one finishes late: mode', async ($, on) => {
  const { clock, store } = engine(on, { slowSetMs: [300, 0] })

  await start($)

  const ui = await mountBand($, 100)
  const first = ui.press({ key: 'mode-auto' })
  const second = ui.press({ key: 'mode-manual' })

  await clock.advance(1000)
  await Promise.all([first, second])

  expect(store.get('mode')).toBe('manual')
  expect(await ui.find({ key: 'mode-manual' })).toMatchObject({ props: { variant: 'primary' } })
  await ui.unmount()
})

test('writes land in click order even when an earlier one finishes late: default', async ($, on) => {
  const { clock, store } = engine(on, { slowSetMs: [300, 0] })

  await start($)

  const ui = await mountBand($, 100)
  const first = ui.press({ key: 'default-model' })
  const second = ui.press({ key: 'default-model' })

  await clock.advance(1000)
  await Promise.all([first, second])

  expect(store.get('saved')).toEqual({ model: 'sonnet', effort: null })
  expect(await labelOf(ui, 'default-model')).toBe('sonnet')
  await ui.unmount()
})

test('the store is written the state a click made, not the one before it', async ($, on) => {
  const { store } = engine(on)

  await start($)

  const ui = await mountBand($, 100)

  await ui.press({ key: 'mode-auto' })
  expect(store.get('mode')).toBe('auto')
  await ui.press({ key: 'default-effort' })
  expect(store.get('saved')).toEqual({ model: null, effort: 'low' })
  await ui.unmount()
})

test('a stored empty default counts as none: no Reset, rec. shown', async ($, on) => {
  engine(on, { store: { saved: { model: null, effort: null } } })

  await start($)

  const ui = await mountBand($, 100)

  expect(await ui.find({ key: 'reset' })).toBeUndefined()
  expect(await labelOf(ui, 'default-model')).toBe('rec.')
  await ui.unmount()
})

test('a run that does not save leaves the saved default alone', async ($, on) => {
  const saved = { model: 'haiku', effort: 'low' }
  let at = 0
  const { store, seen } = engine(on, { store: { saved }, reply: (_q, labels) => (at++ === 0 ? labels[1]! : 'sonnet/xhigh') })

  await start($)

  for (const expected of [saved, { model: 'sonnet', effort: 'xhigh' }]) {
    await $.tool.call(REVIEW)

    expect(seen.at(-1)).toMatchObject(expected)
    expect(store.get('saved')).toEqual(saved)
  }
})

test('a default set before the first load lands is built on what the store holds', async ($, on) => {
  const { clock, store } = engine(on, {
    store: { saved: { model: 'haiku', effort: 'low' } },
    slowFirstLoad: { staleMode: 'manual', staleSaved: { model: 'opus', effort: 'max' } },
  })
  const starting = start($)

  await clock.settle()

  const ui = await mountBand($, 100)

  await ui.press({ key: 'default-model' })
  await clock.advance(1000)
  await starting

  expect(store.get('saved')).toEqual({ model: 'sonnet', effort: 'low' })
  expect(await labelOf(ui, 'default-model')).toBe('sonnet')
  expect(await labelOf(ui, 'default-effort')).toBe('low')
  await ui.unmount()
})

test('a Reset pressed before the first load lands is not undone by it', async ($, on) => {
  const { clock, store } = engine(on, {
    store: { saved: { model: 'haiku', effort: 'low' } },
    slowFirstLoad: { staleMode: 'manual', staleSaved: { model: 'opus', effort: 'max' } },
  })
  const starting = start($)

  await clock.settle()

  const ui = await mountBand($, 100)

  await ui.press({ key: 'reset' })
  await clock.advance(1000)
  await starting

  expect(store.get('saved')).toBeNull()
  expect(await labelOf(ui, 'default-model')).toBe('rec.')
  expect(await ui.find({ key: 'reset' })).toBeUndefined()
  await ui.unmount()
})

test('a write that failed does not stop the next one', async ($, on) => {
  const { store, toasts } = engine(on, { failWrites: 1 })

  await start($)

  const ui = await mountBand($, 100)

  await ui.press({ key: 'default-effort' })
  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toContain('could not save')
  expect(toasts[0]).toContain('disk full')
  expect(store.has('saved')).toBe(false)

  await ui.press({ key: 'default-effort' })
  expect(store.get('saved')).toEqual({ model: null, effort: 'medium' })
  await ui.unmount()
})

// A refused state read rejects whichever step of the press it lands on; where
// it lands on the read that decides what the first write stores, a chain that
// waits only for success would skip every write after it.
test('a write whose state could not be read does not stop the next one', async ($, on) => {
  const { store, failStateReadIn } = engine(on)

  await start($)

  const ui = await mountBand($, 100)

  for (let step = 1; step <= 4; step += 1) {
    store.delete('mode')
    failStateReadIn(step)
    await ui.press({ key: 'mode-auto' }).catch(() => undefined)
    // A refused read may have landed on the band's own draw: draw it again.
    await ui.redraw()
    await ui.press({ key: 'mode-manual' })

    expect(store.get('mode'), `after a read refused at step ${step}`).toBe('manual')
  }

  await ui.unmount()
})

test('a save that fails still starts the subagent with the chosen values, and says so', async ($, on) => {
  const { seen, toasts } = engine(on, { isWriteBroken: true, reply: (_q, labels) => labels.find(label => label.includes('save default'))! })

  await start($)
  await $.tool.call(REVIEW)

  expect(seen[0]).toMatchObject({ model: 'opus', effort: 'high' })
  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toContain('could not save')
  expect(toasts[0]).toContain('disk full')
})

test('a save that never settles does not hold the launch, and says so', async ($, on) => {
  const { clock, seen, toasts } = engine(on, { isWriteStalled: true, reply: (_q, labels) => labels.find(label => label.includes('save default'))! })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()
  expect(seen[0]).toMatchObject({ model: 'opus', effort: 'high' })

  await clock.advance(SAVE_WAIT_MS)
  await call

  expect(toasts).toEqual(['Subagent tuner: saving the default is taking too long'])
})

// The save is a step of its own: wherever a refused state read lands in it, the
// subagent still starts with what the person chose, and a failure is said.
test('a save that cannot read its state still starts the subagent, and says so', async ($, on) => {
  let step = 1
  let refuseIn = (_n: number): void => undefined
  const { seen, toasts, failStateReadIn } = engine(on, {
    reply: (_question, labels) => {
      refuseIn(step)

      return labels.find(label => label.includes('save default'))!
    },
  })

  refuseIn = failStateReadIn
  await start($)

  for (step = 1; step <= 4; step += 1) {
    await $.tool.call(REVIEW)

    expect(seen.at(-1), `a read refused at step ${step}`).toMatchObject({ model: 'opus', effort: 'high' })
  }

  expect(seen).toHaveLength(4)
  expect(toasts.some(text => text.includes('could not save the default'))).toBe(true)
})

test('the wait on a save stays well inside the 10 s hook budget (HookBudget.ms, d.ts)', () => {
  expect(SAVE_WAIT_MS).toBeLessThanOrEqual(3000)
})

test('one save that never finishes does not block the next change', async ($, on) => {
  const { clock, store, seen, toasts } = engine(on, { stallFirstWrite: true, reply: SAVE_LABEL })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()
  await clock.advance(SAVE_WAIT_MS)
  await call

  expect(seen[0]).toMatchObject({ model: 'opus', effort: 'high' })
  expect(toasts).toEqual(['Subagent tuner: saving the default is taking too long'])

  const ui = await mountBand($, 100)
  const press = ui.press({ key: 'default-effort' })

  await clock.advance(5000)
  await press

  expect(store.get('saved')).toEqual({ model: 'opus', effort: 'xhigh' })
  expect(await labelOf(ui, 'default-effort')).toBe('xhigh')
  await ui.unmount()
})

test('a write that lands late cannot overwrite a newer value, and a stuck one is said', async ($, on) => {
  const { clock, store, toasts } = engine(on, { slowSetMs: [3000, 0] })

  await start($)

  const ui = await mountBand($, 100)
  const first = ui.press({ key: 'mode-auto' })
  const second = ui.press({ key: 'mode-manual' })

  await clock.advance(5000)
  await Promise.all([first, second])

  expect(store.get('mode')).toBe('manual')
  expect(await ui.find({ key: 'mode-manual' })).toMatchObject({ props: { variant: 'primary' } })
  expect(toasts).toEqual(['Subagent tuner: saving the mode is taking too long'])
  await ui.unmount()
})

test('the save runs beside the launch, not after it', async ($, on) => {
  const { clock, store, seen } = engine(on, { agentRunMs: 5000, reply: SAVE_LABEL })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()

  // The subagent is still running; its default is already stored.
  expect(seen).toHaveLength(1)
  expect(store.get('saved')).toEqual({ model: 'opus', effort: 'high' })

  await clock.advance(5000)
  await call
})
