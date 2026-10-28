// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { ABORTER, BUILD, CHANGE, CLOSER, CUSTOM, MAIN, REVIEW, SEARCH, UNTOUCHED, drawn, engine, expectClean, mountPane, offerAgent, start, valueOf, widthOf } from './harness'
import type { Node } from './harness'
import { PANE_PREFIX, PANE_WAIT_MS } from './register'

test('a manual launch opens a focused pane that holds the keys, and waits on a sentinel', async ($, on) => {
  const { clock, panes } = engine(on, { pane: {} })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()

  expect(panes.opened).toHaveLength(1)
  expect(panes.opened[0]).toMatchObject({ focus: true, closeOnEscape: true, holdToasts: true, rows: 9 })
  expect(panes.opened[0]!.id.startsWith(PANE_PREFIX)).toBe(true)
  expect(panes.waits).toHaveLength(1)

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  await ui.press({ key: 'cancel' })
  await call
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  for (const columns of [40, 52, 100]) {
    test(`pane: selectors start on the recommendation and Run launches with the selection: ${surface} ${columns}`, async ($, on) => {
      const { clock, seen, panes, asked } = engine(on, { pane: {} })

      await start($)

      const call = $.tool.call(REVIEW)

      await clock.settle()

      const ui = await mountPane($, panes.opened[0]!.id, columns, surface)

      expect(await valueOf(ui, 'model')).toBe('opus')
      expect(await valueOf(ui, 'effort')).toBe('high')
      await ui.select({ key: 'model', value: 'sonnet' })
      await ui.select({ key: 'effort', value: 'xhigh' })
      expect(await valueOf(ui, 'model')).toBe('sonnet')
      await ui.press({ key: 'run' })
      await call

      expect(seen).toEqual([{ model: 'sonnet', effort: 'xhigh', description: 'Review the diff' }])
      expect(asked).toEqual([])
      await ui.unmount()
      await expectClean($, panes)
    })
  }
}

test('pane: selectors start per field on the saved default, else the recommendation, else inherit', async ($, on) => {
  const { clock, panes } = engine(on, { pane: {}, store: { saved: { model: 'haiku', effort: null } } })

  await start($)

  const first = $.tool.call(REVIEW)
  const second = $.tool.call({ tool: 'Agent', description: 'Plan the week', prompt: 'p' })

  await clock.settle()

  const one = await mountPane($, panes.opened[0]!.id, 100)
  const two = await mountPane($, panes.opened[1]!.id, 100)

  expect(await valueOf(one, 'model')).toBe('haiku')
  expect(await valueOf(one, 'effort')).toBe('high')
  expect(await valueOf(two, 'model')).toBe('haiku')
  expect(await valueOf(two, 'effort')).toBe('inherit')
  await one.press({ key: 'cancel' })
  await two.press({ key: 'cancel' })
  await Promise.all([first, second])
  await one.unmount()
  await two.unmount()
})

test('pane: Run and save as default stores exactly the selected values and launches with them', async ($, on) => {
  const { clock, seen, store, panes } = engine(on, { pane: {} })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  await ui.select({ key: 'model', value: 'haiku' })
  await ui.select({ key: 'effort', value: 'max' })
  await ui.press({ key: 'save' })
  await call

  expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'max' })
  expect(store.get('saved')).toEqual({ model: 'haiku', effort: 'max' })
  await ui.unmount()
  await expectClean($, panes)
})

test('pane: Run applies the selection but does not save it', async ($, on) => {
  const { clock, store, panes } = engine(on, { pane: {} })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  await ui.select({ key: 'model', value: 'haiku' })
  await ui.press({ key: 'run' })
  await call

  expect(store.has('saved')).toBe(false)
  await ui.unmount()
})

test('pane: the buttons carry the hotkeys r, d and c', async ($, on) => {
  const { clock, panes } = engine(on, { pane: {} })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  expect(await ui.find({ key: 'run' })).toMatchObject({ props: { hotkey: 'r', label: 'Run' } })
  expect(await ui.find({ key: 'save' })).toMatchObject({ props: { hotkey: 'd', label: 'Run and save as default' } })
  expect(await ui.find({ key: 'cancel' })).toMatchObject({ props: { hotkey: 'c', label: 'Cancel' } })
  await ui.press({ key: 'cancel' })
  await call
  await ui.unmount()
})

test('pane: Cancel denies and starts nothing', async ($, on) => {
  const { clock, seen, panes } = engine(on, { pane: {} })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  await ui.select({ key: 'model', value: 'haiku' })
  await ui.press({ key: 'cancel' })

  expect(await call).toMatchObject({ deny: 'cancelled by user' })
  expect(seen).toEqual([])
  await ui.unmount()
  await expectClean($, panes)
})

test('pane: a wait that runs out applies the suggestion and cleans up', async ($, on) => {
  const { clock, seen, toasts, panes } = engine(on, { pane: {}, store: { saved: { model: 'haiku', effort: 'low' } } })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()
  expect(seen).toEqual([])
  await clock.advance(PANE_WAIT_MS)
  await call

  expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'low' })
  expect(toasts).toEqual(['Subagent (no answer) -> haiku/low'])
  await expectClean($, panes)
})

test('pane: the wait is the ten minutes a process may run at most (d.ts)', () => {
  expect(PANE_WAIT_MS).toBe(600_000)
})

test('pane: a field the call set is a Select preset to it, editable, with the save button', async ($, on) => {
  const { clock, seen, panes } = engine(on, { pane: {} })

  await start($)

  const call = $.tool.call({ ...REVIEW, model: 'sonnet' })

  await clock.settle()

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  expect((await ui.find({ key: 'model' }))?.type).toBe('Select')
  expect((await ui.find({ key: 'model' }))?.props.value).toBe('sonnet')
  expect(await ui.find({ type: 'Text', text: 'Model sonnet' })).toBeUndefined()
  expect(await ui.find({ key: 'save' })).toBeDefined()
  await ui.select({ key: 'model', value: 'haiku' })
  await ui.select({ key: 'effort', value: 'low' })
  await ui.press({ key: 'run' })
  await call

  expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'low' })
  await ui.unmount()
})

test('pane: a pane that waits undrawn (a narrow terminal) is closed and the dialogs are used, without a toast', async ($, on) => {
  const { clock, seen, asked, panes, diagnostics, toasts } = engine(on, {
    pane: { isPlaced: false },
    script: ['Change model or effort', 'sonnet', 'low', labels => labels[0]!],
  })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()
  await call

  expect(asked.map(one => one.header)).toEqual(['Subagent', 'Model', 'Effort', 'Subagent'])
  expect(seen).toEqual([{ model: 'sonnet', effort: 'low', description: 'Review the diff' }])
  expect(diagnostics).toEqual([])
  expect(toasts).toEqual([])
  await expectClean($, panes)
})

// The wait takes nothing a host may lack: the sentinel is written through $.fs,
// and the waiting child is sh where it starts (macOS, Linux), powershell.exe
// where it does not (Windows, whose Git puts no sh, mktemp or touch on the PATH).
test('pane: the wait needs no mktemp, touch or rm: $.fs writes the sentinel and sh waits for it', async ($, on) => {
  const { clock, panes } = engine(on, { pane: {} })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  await ui.press({ key: 'cancel' })
  await call
  await ui.unmount()

  expect([...new Set(panes.starts)]).toEqual(['sh'])
  expect(panes.waits).toEqual([{ shell: 'sh', sentinel: panes.written[0]! }])
  expect(panes.written[0]).toMatch(/\/\.waits\/subagent-tuner-[^/]+-\d+$/)
  await expectClean($, panes)
})

test('pane: where sh cannot start (Windows) powershell.exe waits, and Run launches with the selection', async ($, on) => {
  const { clock, seen, asked, diagnostics, panes } = engine(on, { pane: { shells: ['powershell.exe'] } })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  await ui.select({ key: 'model', value: 'sonnet' })
  await ui.press({ key: 'run' })
  await call
  await ui.unmount()

  expect(seen).toEqual([{ model: 'sonnet', effort: 'high', description: 'Review the diff' }])
  expect(asked).toEqual([])
  expect(diagnostics).toEqual([])
  expect(panes.waits.map(one => one.shell)).toEqual(['powershell.exe'])
  await expectClean($, panes)
})

test('pane: where no shell can wait the dialog is asked, and nothing is left open', async ($, on) => {
  const { clock, asked, panes } = engine(on, { pane: { shells: [] } })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()
  await call

  expect(asked).toHaveLength(1)
  expect(panes.opened).toEqual([])
})

test('pane: a pane that does not hold the keyboard says how to reach it', async ($, on) => {
  const { clock, toasts, panes } = engine(on, { pane: { isFocused: false } })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()
  expect(toasts).toEqual(['Subagent tuner: press ctrl+x then Tab to reach the pane'])

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  await ui.press({ key: 'run' })
  await call
  await ui.unmount()
})

for (const surfaces of [['vscode'], ['mobile']] as const) {
  test(`pane: none is opened where the band cannot be drawn: ${surfaces.join('+') || 'none'}`, async ($, on) => {
    const { seen, panes } = engine(on, { pane: {}, surfaces })

    await start($)
    await $.tool.call(REVIEW)

    expect(panes.opened).toEqual([])
    expect(seen[0]).toMatchObject({ model: 'opus', effort: 'high' })
  })
}

test('pane: auto mode opens none', async ($, on) => {
  const { seen, panes } = engine(on, { pane: {}, store: { mode: 'auto' } })

  await start($)
  await $.tool.call(REVIEW)

  expect(panes.opened).toEqual([])
  expect(seen[0]).toMatchObject({ model: 'opus', effort: 'high' })
})

test('pane: three launches at once each get a pane of their own, and each launches with its own selection', async ($, on) => {
  const { clock, seen, panes } = engine(on, { pane: {} })

  await start($)

  const calls = [$.tool.call(REVIEW), $.tool.call(BUILD), $.tool.call(SEARCH)]

  await clock.settle()
  expect(new Set(panes.opened.map(one => one.id)).size).toBe(3)

  const uis = await Promise.all(panes.opened.map(one => mountPane($, one.id, 100)))

  await uis[0]!.select({ key: 'model', value: 'fable' })
  await uis[1]!.select({ key: 'effort', value: 'max' })
  await uis[2]!.select({ key: 'model', value: 'opus' })
  await uis[2]!.select({ key: 'effort', value: 'low' })

  // Answered out of order, each launch keeps its own selection.
  await uis[2]!.press({ key: 'run' })
  await uis[0]!.press({ key: 'run' })
  await uis[1]!.press({ key: 'run' })
  await Promise.all(calls)

  expect(seen.find(one => one.description === 'Review the diff')).toMatchObject({ model: 'fable', effort: 'high' })
  expect(seen.find(one => one.description === 'Build the parser')).toMatchObject({ model: 'sonnet', effort: 'max' })
  expect(seen.find(one => one.description === 'Search the repo')).toMatchObject({ model: 'opus', effort: 'low' })
  await Promise.all(uis.map(ui => ui.unmount()))
  await expectClean($, panes)
})

test('a pane that is not the tuner\'s is left to the engine', async ($, on) => {
  engine(on, { pane: {} })
  await start($)

  const ui = await mountPane($, 'someone-elses-pane', 100)

  expect(await ui.find({ key: 'model' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /engine pane/ })).toBeDefined()
  await ui.unmount()
})

test('a pane a previous copy left open is closed when the session starts', async ($, on) => {
  const { panes } = engine(on, { pane: {} })

  panes.open.set(`${PANE_PREFIX}stale`, { id: `${PANE_PREFIX}stale`, title: 'x', isShown: true, isFocused: false, isPlaced: true })
  panes.open.set('other-plugins-pane', { id: 'other-plugins-pane', title: 'x', isShown: true, isFocused: false, isPlaced: true })
  await start($)

  expect(panes.closed).toEqual([`${PANE_PREFIX}stale`])
})

// Select's painted width is UNVERIFIED live: it is drawn `Model [ value ▾ ]`
// here, its label, a space and the widest option in a bracketed field.
test('every row of the pane fits every width from 28 to 140', { timeoutMs: 60000 }, async ($, on) => {
  const { clock, panes } = engine(on, { pane: {} })

  await start($)

  const call = $.tool.call({ ...REVIEW, description: 'd'.repeat(200) })

  await clock.settle()

  for (let columns = 28; columns <= 140; columns += 1) {
    const ui = await mountPane($, panes.opened[0]!.id, columns)
    const root = (await drawn(ui)) as { children?: Node[] }

    for (const row of root.children ?? []) {
      expect(widthOf(row), `row at ${columns}`).toBeLessThanOrEqual(columns)
    }

    await ui.unmount()
  }

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  await ui.press({ key: 'cancel' })
  await call
  await ui.unmount()
})

for (const one of [
  { columns: 52, selectorsRow: true, buttonsRow: true },
  { columns: 51, selectorsRow: false, buttonsRow: true },
  { columns: 50, selectorsRow: false, buttonsRow: true },
  { columns: 49, selectorsRow: false, buttonsRow: false },
]) {
  test(`pane layout at ${one.columns} columns: selectors ${one.selectorsRow ? 'share a row' : 'one each'}, buttons ${one.buttonsRow ? 'share a row' : 'one each'}`, async ($, on) => {
    const { clock, panes } = engine(on, { pane: {} })

    await start($)

    const call = $.tool.call(REVIEW)

    await clock.settle()

    const ui = await mountPane($, panes.opened[0]!.id, one.columns)
    const root = (await drawn(ui)) as { children?: { props?: { flexDirection?: string } }[] }

    expect(root.children![1]!.props?.flexDirection === 'column').toBe(!one.selectorsRow)
    expect(root.children![2]!.props?.flexDirection === 'column').toBe(!one.buttonsRow)
    await ui.press({ key: 'cancel' })
    await call
    await ui.unmount()
  })
}

test('chain: nothing is left behind when the pane was tried first', async ($, on) => {
  const { clock, panes } = engine(on, { pane: { isPlaced: false }, script: [CHANGE, 'haiku', 'low', MAIN] })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()
  await call
  await expectClean($, panes)
})

test('pane: a pane closed by a plugin does not cancel the launch (only the person closing it does)', { plugins: [CLOSER] }, async ($, on) => {
  const { clock, seen, panes } = engine(on, { pane: {} })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: panes.opened[0]!.id })
  await clock.settle()
  expect(seen).toEqual([])

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  await ui.press({ key: 'run' })
  await call

  expect(seen[0]).toMatchObject({ model: 'opus', effort: 'high' })
  await ui.unmount()
})

test('pane: an abort before the wait can start starts nothing and leaves nothing behind', { plugins: [ABORTER] }, async ($, on) => {
  let release!: () => void
  const gate = new Promise<void>(done => {
    release = done
  })
  const { clock, seen, panes } = engine(on, { pane: { probeGate: gate } })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()
  await clock.advance(1000)
  expect(await call).toMatchObject({ deny: 'abandoned' })
  release()
  await clock.settle()

  expect(seen).toEqual([])
  expect(panes.opened).toEqual([])
  expect(panes.written).toEqual([])
})

test('pane: a wait that runs out applies the person\'s live selection, not the preset', async ($, on) => {
  const { clock, seen, toasts, panes } = engine(on, { pane: {} })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  await ui.select({ key: 'model', value: 'haiku' })
  await clock.advance(PANE_WAIT_MS)
  await call

  expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'high' })
  expect(toasts).toEqual(['Subagent (no answer) -> haiku/high'])
  await ui.unmount()
  await expectClean($, panes)
})

test('pane: Run says what happens when both fields are inherited although the call set one', async ($, on) => {
  const { clock, panes } = engine(on, { pane: {} })

  await start($)

  const call = $.tool.call({ ...REVIEW, model: 'opus' })

  await clock.settle()

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  expect((await ui.find({ key: 'run' }))?.props.label).toBe('Run')
  await ui.select({ key: 'model', value: 'inherit' })
  await ui.select({ key: 'effort', value: 'inherit' })
  expect((await ui.find({ key: 'run' }))?.props.label).toBe('Run with inherited model and effort')
  await ui.press({ key: 'cancel' })
  await call
  await ui.unmount()
})

test('pane: Run stays plain where the call set nothing and nothing is selected', async ($, on) => {
  const { clock, panes } = engine(on, { pane: {} })

  await start($)

  const call = $.tool.call({ tool: 'Agent', description: 'Plan the week', prompt: 'p' })

  await clock.settle()

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  expect((await ui.find({ key: 'run' }))?.props.label).toBe('Run')
  await ui.press({ key: 'cancel' })
  await call
  await ui.unmount()
})

// The wait cannot end when the sentinel cannot be written (a read-only plugin
// folder, a full disk), so the decision recorded before the write stands when
// the ten minutes run out: a Cancel must not start the subagent.
for (const one of [
  { press: 'cancel', deny: 'cancelled by user' },
  { press: 'save', deny: undefined },
] as const) {
  test(`pane: ${one.press} pressed while the sentinel cannot be written is still honoured when the wait runs out`, async ($, on) => {
    const { clock, seen, store, toasts, panes } = engine(on, { pane: { unwritable: 'sentinel' } })

    await start($)

    const call = $.tool.call(REVIEW)

    await clock.settle()
    expect(panes.opened).toHaveLength(1)

    const ui = await mountPane($, panes.opened[0]!.id, 100)

    await ui.select({ key: 'model', value: 'haiku' })
    await ui.press({ key: one.press })
    await clock.advance(PANE_WAIT_MS)

    const outcome = await call

    expect(toasts).toContain('Subagent tuner: could not release the pane; your choice applies when its wait ends')

    if (one.deny === undefined) {
      expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'high' })
      expect(store.get('saved')).toEqual({ model: 'haiku', effort: 'high' })
    } else {
      expect(outcome).toMatchObject({ deny: one.deny })
      expect(seen).toEqual([])
    }

    await ui.unmount()
    await expectClean($, panes)
  })
}

// Better than waiting ten minutes for nothing: a folder that takes no write
// cannot be answered in a pane, so the dialogs are asked at once.
test('pane: a waits folder that takes no write falls back to the dialogs, with nothing left behind', async ($, on) => {
  const { clock, seen, asked, diagnostics, panes } = engine(on, { pane: { unwritable: 'everything' } })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()
  await call

  expect(asked).toHaveLength(1)
  expect(seen).toHaveLength(1)
  expect(diagnostics).toEqual([expect.stringMatching(/^Subagent tuner: pane unavailable: waits folder not writable/)])
  expect(panes.opened).toEqual([])
  expect(panes.waits).toEqual([])
  await expectClean($, panes)
})

test('pane: the probe of the waits folder is removed once it has shown a write works', async ($, on) => {
  const { clock, panes } = engine(on, { pane: {} })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  expect(panes.probed).toHaveLength(1)
  expect(panes.probed[0]).toMatch(/\/\.waits\/subagent-tuner-[^/]+-\d+\.probe$/)
  expect(panes.removed).toEqual(panes.probed)
  await ui.press({ key: 'cancel' })
  await call
  await ui.unmount()
  await expectClean($, panes)
})

// With the call's field set and both inherited, Run is the long label: the
// buttons then need more than BUTTONS_FROM, so the row waits for the width the
// labels actually take (the needed width is read off the drawn row, not assumed).
test('pane layout: the long Run label keeps the buttons in a column until they fit one row', async ($, on) => {
  const { clock, panes } = engine(on, { pane: {} })

  await start($)

  const call = $.tool.call({ ...REVIEW, model: 'opus' })

  await clock.settle()

  const id = panes.opened[0]!.id
  const wide = await mountPane($, id, 140)

  await wide.select({ key: 'model', value: 'inherit' })
  await wide.select({ key: 'effort', value: 'inherit' })

  const row = ((await drawn(wide)) as { children: Node[] }).children[2]!
  const needed = widthOf(row)

  expect(needed).toBeGreaterThan(50)
  await wide.unmount()

  for (const columns of [50, 60, needed - 1, needed, needed + 1]) {
    const ui = await mountPane($, id, columns)
    const buttons = ((await drawn(ui)) as { children: { props?: { flexDirection?: string } }[] }).children[2]!

    expect(buttons.props?.flexDirection === 'column', `column at ${columns}`).toBe(columns < needed)

    for (const one of ((await drawn(ui)) as { children?: Node[] }).children ?? []) {
      expect(widthOf(one), `row at ${columns}`).toBeLessThanOrEqual(columns)
    }

    await ui.unmount()
  }

  const ui = await mountPane($, id, 100)

  await ui.press({ key: 'cancel' })
  await call
  await ui.unmount()
})

test('pane: a custom agent starts on inherit for the open fields, and Run starts the call unchanged', async ($, on) => {
  const { clock, seen, panes } = engine(on, { pane: {} })

  await start($)
  await offerAgent($, 'acme-reviewer')

  const call = $.tool.call(CUSTOM)

  await clock.settle()

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  expect(await valueOf(ui, 'model')).toBe('inherit')
  expect(await valueOf(ui, 'effort')).toBe('inherit')
  await ui.press({ key: 'run' })
  await call

  expect(seen).toEqual([UNTOUCHED('Review the diff')])
  await ui.unmount()
  await expectClean($, panes)
})

test('pane: a custom agent still takes a model picked in the pane', async ($, on) => {
  const { clock, seen, panes } = engine(on, { pane: {} })

  await start($)
  await offerAgent($, 'acme-reviewer')

  const call = $.tool.call(CUSTOM)

  await clock.settle()

  const ui = await mountPane($, panes.opened[0]!.id, 100)

  await ui.select({ key: 'model', value: 'haiku' })
  await ui.press({ key: 'run' })
  await call

  expect(seen).toEqual([{ model: 'haiku', effort: undefined, description: 'Review the diff' }])
  await ui.unmount()
  await expectClean($, panes)
})
