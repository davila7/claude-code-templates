// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
// The band over a plugin beneath it at AbovePrompt (a stand-in for the owner's health band): the site draws
// one tree, so ours goes above and theirs stays visible.
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { RenderSurface } from 'claude-code'
import { PLUGIN, drawn, engine, mountBand, start } from './harness'
import type { Node } from './harness'
import { BAND_ROWS } from './stack'

const HEALTH = 'health ██████░░░░ 68% weakest: context'

// One row: a label and a Button, as the health band is.
const healthRow = () =>
  h(
    'Box',
    {},
    h('Text', {}, HEALTH),
    h('Button', { key: 'health-expand', label: 'expand', onPress: () => undefined } as never),
  )
const tall = (n: number) =>
  h('Box', { flexDirection: 'column' }, ...Array.from({ length: n }, (_, i) => h('Text', {}, `below ${i + 1}`)))

const kids = (node: Node) => (typeof node === 'string' ? [] : (node.children ?? []))
const strings = (node: Node): string[] =>
  typeof node === 'string' ? [node] : kids(node).flatMap(strings)

// Each draw hands its Buttons new press handles, and Claude Code 2.1.300 and later mark a tree with the
// plugin that owns it (`part`); the shape is what two draws are compared by, without either.
const shape = (node: Node): Node =>
  typeof node === 'string'
    ? node
    : (JSON.parse(
        JSON.stringify(node, (key, value: unknown) => (key === 'press' || key === 'part' ? undefined : value)),
      ) as Node)

// The band as drawn alone: the reference for "identical to today".
async function alone($: Engine, columns = 100, surface: 'terminal' | 'desktop' = 'terminal') {
  const ui = await mountBand($, columns, surface)
  const root = shape(await drawn(ui))

  await ui.unmount()

  return root
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a one-row plugin beneath: both trees are drawn, ours on top, and both are live (${surface})`, async ($, on) => {
    const { beneath, store } = engine(on)

    await start($)

    const reference = await alone($, 100, surface)

    beneath.draw = healthRow

    const ui = await mountBand($, 100, surface)
    const root = await drawn(ui)

    expect(root).toMatchObject({ type: 'Box', props: { flexDirection: 'column' } })
    expect(kids(root)).toHaveLength(2)
    // The band is the first child and is the tree it is alone; theirs is the second.
    expect(shape(kids(root)[0]!)).toEqual(reference)
    expect(strings(kids(root)[1]!)).toEqual([HEALTH])
    expect(kids(kids(root)[0]!).length).toBeGreaterThan(0)
    expect(await ui.find({ key: 'mode-manual' })).toBeDefined()
    expect(await ui.find({ key: 'health-expand' })).toBeDefined()

    await ui.press({ key: 'mode-auto' })
    expect(store.get('mode')).toBe('auto')
    await ui.unmount()
  })
}

test('a tall plugin beneath: ours stays on top and theirs keeps its rows in order', async ($, on) => {
  const { beneath } = engine(on)

  await start($)
  beneath.draw = () => tall(4)

  const ui = await mountBand($, 100)
  const root = await drawn(ui)

  expect(strings(kids(root)[1]!)).toEqual(['below 1', 'below 2', 'below 3', 'below 4'])
  expect(await ui.find({ key: 'mode-manual' })).toBeDefined()
  await ui.unmount()
})

test('the band is the row the stacking budgets for', async ($, on) => {
  engine(on)
  await start($)

  expect(await alone($)).toMatchObject({ props: { height: BAND_ROWS } })
})

// Nothing to draw beneath comes in several shapes; each leaves exactly today's band. (A hook that returns
// nothing at all, or null, is refused by the engine: `next(e)` then throws, which the next tests cover.)
const NOTHING = {
  'an empty Box (the engine stand-in)': undefined,
  'an empty column': () => h('Box', { flexDirection: 'column' }),
  'a Box of empty Boxes': () => h('Box', { flexDirection: 'column' }, h('Box', {}), h('Box', {})),
} as const

for (const [name, draw] of Object.entries(NOTHING)) {
  test(`nothing beneath (${name}): the band alone, as today`, async ($, on) => {
    const { beneath, toasts, diagnostics } = engine(on)

    await start($)

    const reference = await alone($)

    if (draw !== undefined) {
      beneath.draw = draw
    }

    const ui = await mountBand($, 100)
    const root = shape(await drawn(ui))

    expect(root).toEqual(reference)
    expect(root).toMatchObject({ props: { height: 1 } })
    expect(root).not.toMatchObject({ props: { flexDirection: 'column' } })
    expect(toasts).toEqual([])
    expect(diagnostics).toEqual([])
    await ui.unmount()
  })
}

test('a plugin beneath that throws costs the band nothing: the band alone, no toast', async ($, on) => {
  const { beneath, toasts, diagnostics, clock } = engine(on)

  await start($)

  const reference = await alone($)

  beneath.draw = () => {
    throw new Error('the plugin beneath failed')
  }

  const ui = await mountBand($, 100)
  const root = shape(await drawn(ui))

  await clock.advance(5000)
  expect(root).toEqual(reference)
  expect(await ui.find({ key: 'mode-manual' })).toBeDefined()
  expect(toasts).toEqual([])
  expect(diagnostics).toEqual([])

  // The band still works while the plugin beneath fails.
  await ui.press({ key: 'mode-auto' })
  expect(await ui.find({ key: 'mode-auto' })).toMatchObject({ props: { label: '*Auto' } })
  await ui.unmount()
})

test('a plugin beneath that rejects late costs the band nothing either', async ($, on) => {
  const { beneath, toasts } = engine(on)

  await start($)
  beneath.draw = () => Promise.reject(new Error('late'))

  const ui = await mountBand($, 100)

  expect(await ui.find({ key: 'mode-manual' })).toBeDefined()
  expect(await drawn(ui)).toMatchObject({ props: { height: 1 } })
  expect(toasts).toEqual([])
  await ui.unmount()
})

test('a survey holds the site: the engine line comes through unchanged, no band, props passed on as they came', async ($, on) => {
  const { beneath } = engine(on)

  await start($)

  const ui = await mountBand($, 100, 'terminal', true)

  expect(await ui.find({ key: 'mode-manual' })).toBeUndefined()
  expect(await drawn(ui)).toMatchObject({ type: 'Text' })
  expect(strings(await drawn(ui))).toEqual(['engine band'])
  expect(beneath.props.at(-1)).toMatchObject({ maxRows: 3, hasSurvey: true })
  await ui.unmount()
})

test('narrower than the smallest layout the tree beneath comes through unchanged, with the rows it was given', async ($, on) => {
  const { beneath } = engine(on)

  await start($)
  beneath.draw = healthRow

  const ui = await mountBand($, 30)

  expect(await ui.find({ key: 'mode-manual' })).toBeUndefined()
  expect(strings(await drawn(ui))).toEqual([HEALTH])
  expect(beneath.props.at(-1)).toMatchObject({ maxRows: 3, bodyColumns: 30 })
  await ui.unmount()
})

for (const surface of ['mobile', 'vscode'] as const satisfies readonly RenderSurface[]) {
  test(`on ${surface} the tree beneath comes through unchanged, with the rows it was given`, async ($, on) => {
    const { beneath } = engine(on)

    await start($)
    beneath.draw = healthRow

    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 100, scroll: { offset: 0, bodyRows: 3 }, view: {} },
      viewport: { columns: 100, rows: 30 },
    } as never)

    expect(await ui.find({ key: 'mode-manual' })).toBeUndefined()
    expect(strings((await ui.drawn()) as unknown as Node)).toEqual([HEALTH])
    expect(beneath.props.at(-1)).toMatchObject({ maxRows: 3 })
    await ui.unmount()
  })
}

const mountWith = (ui: Engine['ui'], maxRows: number) =>
  ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: true, maxRows, bodyColumns: 100, scroll: { offset: 0, bodyRows: maxRows }, view: {} },
    viewport: { columns: 100, rows: 30 },
  })

test('the plugin beneath is sized to the rows the band leaves, the other props passed on as they came', async ($, on) => {
  const { beneath } = engine(on)

  await start($)

  const cases: [number, number][] = [
    [17, 16],
    [3, 2],
    [2, 1],
    [1, 1],
  ]

  for (const [maxRows, left] of cases) {
    const ui = await mountWith($.ui, maxRows)

    expect([maxRows, beneath.props.at(-1)?.maxRows]).toEqual([maxRows, left])
    expect(beneath.props.at(-1)).toMatchObject({ hasSurvey: false, isWorking: true, bodyColumns: 100, view: {} })
    await ui.unmount()
  }
})
