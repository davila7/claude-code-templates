// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { REVIEW, drawn, engine, labelOf, mountBand, start, textOf, widthOf } from './harness'
import type { Band } from './harness'
import { MIN_COLUMNS } from './view'

const SAVED_CASES = [
  { saved: null, model: 'rec.', effort: 'rec.' },
  { saved: { model: 'sonnet', effort: 'medium' }, model: 'sonnet', effort: 'medium' },
  { saved: { model: 'sonnet', effort: 'xhigh' }, model: 'sonnet', effort: 'xhigh' },
  { saved: { model: 'haiku', effort: 'max' }, model: 'haiku', effort: 'max' },
  { saved: { model: 'fable', effort: 'xhigh' }, model: 'fable', effort: 'xhigh' },
  { saved: { model: 'sonnet', effort: null }, model: 'sonnet', effort: 'rec.' },
  { saved: { model: null, effort: 'medium' }, model: 'rec.', effort: 'medium' },
] as const

// Each case is a session of its own whose saved default is the one drawn: the
// state is not hydrated, so the band reads the store, and the labels are
// checked so a test that drew the wrong default would say so.
for (const one of SAVED_CASES) {
  test(`the band is one row that fits every width from ${MIN_COLUMNS} to 140 with default ${JSON.stringify(one.saved)}`, async ($, on) => {
    engine(on, { store: one.saved === null ? {} : { saved: one.saved } })

    for (let columns = MIN_COLUMNS; columns <= 140; columns += 1) {
      const ui = await mountBand($, columns)
      const root = await drawn(ui)
      const short = columns < bracketedNeed(one.saved, 'manual') && one.effort === 'medium' ? 'med' : one.effort

      expect(await labelOf(ui, 'default-model'), `model at ${columns}`).toBe(one.model)
      expect(await labelOf(ui, 'default-effort'), `effort at ${columns}`).toBe(short)
      expect(root).toMatchObject({ props: { height: 1 } })
      expect(widthOf(root), `width at ${columns}`).toBeLessThanOrEqual(columns)
      await ui.unmount()
    }
  })
}

test('narrower than the smallest layout the band draws nothing of its own', async ($, on) => {
  const { beneath } = engine(on)

  beneath.draw = () => h('Text', {}, 'engine band')

  const ui = await mountBand($, MIN_COLUMNS - 1)

  expect(await ui.find({ key: 'mode-manual' })).toBeUndefined()
  expect(await textOf(ui, /engine band/)).toBeDefined()
  await ui.unmount()
})

test('the band shows the default, shortened when narrow', async ($, on) => {
  engine(on, { store: { saved: { model: 'sonnet', effort: 'medium' } } })

  const wide = await mountBand($, 100)
  const narrow = await mountBand($, 40)

  // Before any call or press the band reads what the store holds.
  expect(await labelOf(wide, 'default-model')).toBe('sonnet')
  expect(await labelOf(wide, 'default-effort')).toBe('medium')
  expect(await labelOf(narrow, 'default-effort')).toBe('med')
  expect(await textOf(wide, /default/)).toBeDefined()
  expect(await textOf(narrow, /default/)).toBeUndefined()
  await wide.unmount()
  await narrow.unmount()
})

test('the default is set by clicking the band, and persists', async ($, on) => {
  const { seen, store } = engine(on, { store: { mode: 'auto' } })

  await start($)

  const ui = await mountBand($, 100)

  expect(await labelOf(ui, 'default-model')).toBe('rec.')
  await ui.press({ key: 'default-model' })
  await ui.press({ key: 'default-model' })
  await ui.press({ key: 'default-effort' })

  expect(await labelOf(ui, 'default-model')).toBe('sonnet')
  expect(await labelOf(ui, 'default-effort')).toBe('low')
  expect(store.get('saved')).toEqual({ model: 'sonnet', effort: 'low' })

  await $.tool.call(REVIEW)
  expect(seen[0]).toMatchObject({ model: 'sonnet', effort: 'low' })
  await ui.unmount()
})

test('cycling both fields back to rec. clears the default; Reset clears it too', async ($, on) => {
  const { store } = engine(on, { store: { saved: { model: 'fable', effort: null } } })

  await start($)

  const ui = await mountBand($, 100)

  await ui.press({ key: 'default-model' })
  expect(store.get('saved')).toBeNull()

  await ui.press({ key: 'default-effort' })
  expect(await ui.find({ key: 'reset' })).toBeDefined()
  await ui.press({ key: 'reset' })
  expect(store.get('saved')).toBeNull()
  expect(await ui.find({ key: 'reset' })).toBeUndefined()
  await ui.unmount()
})

test('the mode toggle is clickable and persists', async ($, on) => {
  const { seen, store } = engine(on)

  await start($)

  const ui = await mountBand($, 100)

  await ui.press({ key: 'mode-auto' })
  expect(store.get('mode')).toBe('auto')
  await $.tool.call(REVIEW)
  expect(seen[0]).toMatchObject({ model: 'opus', effort: 'high' })
  await ui.press({ key: 'mode-manual' })
  expect(store.get('mode')).toBe('manual')
  await ui.unmount()
})

test('the band yields to a survey', async ($, on) => {
  engine(on)
  await start($)

  const ui = await mountBand($, 100, 'terminal', true)

  expect(await ui.find({ key: 'mode-manual' })).toBeUndefined()
  await ui.unmount()
})

test('the band draws on the desktop surface too', async ($, on) => {
  const { store } = engine(on)

  await start($)

  const ui = await mountBand($, 100, 'desktop')

  await ui.press({ key: 'mode-auto' })
  expect(store.get('mode')).toBe('auto')
  await ui.unmount()
})

const DECOY = { model: 'opus', effort: 'low' }
const MODEL_CYCLE = [null, 'haiku', 'sonnet', 'opus', 'fable'] as const
const EFFORT_CYCLE = [null, 'low', 'medium', 'high', 'xhigh', 'max'] as const
// The cells the compact bracketed layout (lead, full mode words, brackets) needs
// for these labels, worked out here on its own: below it the cyclers go plain.
const bracketedNeed = (saved: { model: string | null; effort: string | null } | null, mode: string) =>
  6 + (mode === 'manual' ? 11 : 10) + (mode === 'auto' ? 9 : 8) + 3 + ((saved?.model ?? 'rec.').length + 4) + 1 + ((saved?.effort ?? 'rec.').length + 4) + (saved === null ? 0 : 6)

// The cells the smallest layout that still spells Manual needs: the mode, plain
// cyclers with the effort shortened, nothing else.
const manualNeed = (saved: { model: string | null; effort: string | null } | null, mode: string) => {
  const effort = saved?.effort === 'medium' ? 'med' : (saved?.effort ?? 'rec.')

  return (mode === 'manual' ? 11 : 10) + (mode === 'auto' ? 9 : 8) + 1 + ((saved?.model ?? 'rec.').length + 1) + 1 + (effort.length + 1)
}

// What a drawn band must be at this width: one row that fits, the cyclers
// naming the default (plain and marked clickable only where the bracketed layout
// does not fit), the active mode marked in words, and the mode spelled in full
// wherever it fits.
async function expectBand(ui: Band, columns: number, saved: { model: string | null; effort: string | null } | null, mode: string) {
  const root = await drawn(ui)
  const isPlain = columns < bracketedNeed(saved, mode)
  const model = saved?.model ?? 'rec.'
  const effort = saved?.effort ?? 'rec.'
  const raw = async (key: string) => String((await ui.find({ key }))?.props.label)

  expect(await raw('default-model'), `model at ${columns}`).toBe(model + (isPlain ? '>' : ''))
  expect(await raw('default-effort'), `effort at ${columns}`).toBe((isPlain && effort === 'medium' ? 'med' : effort) + (isPlain ? '>' : ''))
  expect(root).toMatchObject({ props: { height: 1 } })
  expect(widthOf(root), `width at ${columns} (${model}/${effort})`).toBeLessThanOrEqual(columns)
  expect((await raw('mode-manual')).startsWith('*'), `manual mark at ${columns}`).toBe(mode === 'manual')
  expect((await raw('mode-auto')).startsWith('*'), `auto mark at ${columns}`).toBe(mode === 'auto')

  if (columns >= manualNeed(saved, mode)) {
    expect((await raw('mode-manual')).replace('*', ''), `Manual in full at ${columns}`).toBe('Manual')
  }
}

const mountAll = async ($: Engine) => {
  const bands = new Map<number, Band>()

  for (let columns = MIN_COLUMNS; columns <= 140; columns += 1) {
    bands.set(columns, await mountBand($, columns))
  }

  return bands
}

const HYDRATED_CASES = [
  null,
  { model: 'sonnet', effort: 'medium' },
  { model: 'sonnet', effort: 'xhigh' },
  { model: 'haiku', effort: 'max' },
  { model: 'fable', effort: 'xhigh' },
  { model: 'sonnet', effort: null },
  { model: null, effort: 'medium' },
  { model: null, effort: 'xhigh' },
  { model: 'fable', effort: null },
] as const

test('hydrated: clicking the cyclers through all 30 combinations fits every width', { timeoutMs: 120000 }, async ($, on) => {
  const { store } = engine(on)

  await start($)

  const bands = await mountAll($)
  const driver = bands.get(100)!
  let model: string | null = null
  let effort: string | null = null
  let combos = 0

  for (const nextModel of [...MODEL_CYCLE.slice(1), null]) {
    for (const nextEffort of [...EFFORT_CYCLE.slice(1), null]) {
      store.set('saved', DECOY)

      for (const [columns, ui] of bands) {
        await expectBand(ui, columns, model === null && effort === null ? null : { model, effort }, 'manual')
      }

      combos += 1
      await driver.press({ key: 'default-effort' })
      effort = nextEffort
    }

    await driver.press({ key: 'default-model' })
    model = nextModel
  }

  expect(combos).toBe(30)

  // The same band once the person switches to Auto: the mark moves with it.
  await driver.press({ key: 'mode-auto' })

  for (const [columns, ui] of bands) {
    await expectBand(ui, columns, null, 'auto')
  }

  for (const ui of bands.values()) {
    await ui.unmount()
  }
})

test('the band is sized by the body it draws into, not by a wider viewport', async ($, on) => {
  engine(on, { store: { saved: { model: 'sonnet', effort: 'medium' } } })

  for (let columns = MIN_COLUMNS; columns <= 140; columns += 1) {
    const ui = await mountBand($, columns, 'terminal', false, 200)

    expect(widthOf(await drawn(ui)), `width at ${columns}`).toBeLessThanOrEqual(columns)
    await ui.unmount()
  }
})

test('the mode reads Manual and Auto in full at 60 to 70 columns with no default', async ($, on) => {
  engine(on)
  await start($)

  for (let columns = 60; columns <= 70; columns += 1) {
    const ui = await mountBand($, columns)

    expect(await ui.find({ key: 'mode-manual' }), `at ${columns}`).toMatchObject({ props: { label: '*Manual' } })
    expect(await ui.find({ key: 'mode-auto' })).toMatchObject({ props: { label: 'Auto' } })
    await ui.unmount()
  }
})

test('Manual stays in full for every saved default whenever it fits, and Man is the last resort', async ($, on) => {
  const { store } = engine(on)

  await start($)

  for (const saved of [null, { model: 'sonnet', effort: 'medium' }, { model: 'sonnet', effort: 'xhigh' }, { model: 'fable', effort: 'max' }]) {
    store.set('saved', saved)

    for (let columns = MIN_COLUMNS; columns <= 140; columns += 1) {
      const ui = await mountBand($, columns)
      const label = String((await ui.find({ key: 'mode-manual' }))?.props.label).replace('*', '')

      expect(label === 'Manual' || label === 'Man', `at ${columns}`).toBe(true)

      if (label === 'Man') {
        // Only where not even the smallest full-word layout fits.
        expect(columns, `Man at ${columns}`).toBeLessThan(manualNeed(saved, 'manual'))
      }

      await ui.unmount()
    }
  }
})

// The production path: the session starts and loads the state, then the store
// is overwritten with a decoy, so a band that read the store instead of the
// state would show the decoy.
for (const mode of ['manual', 'auto'] as const) {
  for (const saved of HYDRATED_CASES) {
    test(`hydrated: the ${mode} band fits every width with default ${JSON.stringify(saved)}`, { timeoutMs: 60000 }, async ($, on) => {
      const { store } = engine(on, { store: saved === null ? { mode } : { mode, saved } })

      await start($)
      store.set('saved', DECOY)

      const bands = await mountAll($)

      for (const [columns, ui] of bands) {
        await expectBand(ui, columns, saved, mode)
      }

      for (const ui of bands.values()) {
        await ui.unmount()
      }
    })
  }
}
