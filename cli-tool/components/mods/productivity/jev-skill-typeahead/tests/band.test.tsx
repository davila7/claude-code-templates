import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { View } from '../types'

const BAND = { hasSurvey: false } as never

const row = (name: string, score: number, isChosen = false, origin: 'user' | 'plugin' | 'agent' = 'user') => ({
  name,
  description: `${name} does a thing`,
  origin,
  score,
  hits: ['pdf'],
  isChosen,
})

const prose = (over: Partial<View> = {}): View => ({
  mode: 'prose',
  draft: 'merge these pdf files',
  rows: [row('pdf', 82, true, 'plugin'), row('xlsx', 31, false, 'plugin')],
  phase: 'decided',
  by: 'jev',
  skills: 24,
  agents: 3,
  ...over,
})

/** The host's `$.state`, in memory: the one value this mod keeps. */
const memory: { view: View | undefined; version: number } = { view: undefined, version: 0 }

function stubs(on: On) {
  memory.view = undefined
  memory.version = 0
  on('state.get', () => ({ value: { value: memory.view, version: memory.version } }) as never)
  on('state.set', (_$, e) => {
    memory.view = (e as { value: View }).value
    memory.version += 1
    return { value: { isSet: true, version: memory.version } } as never
  })
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  on('ui.log', () => ({ value: undefined }))
  // what the engine draws when the mod passes
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine band</Text>
  })
}

async function draw($: Engine, on: On, v: View, surface: 'terminal' | 'desktop' = 'terminal') {
  stubs(on)
  await $.session.start({ cwd: '/repo', surface, isInteractive: true } as never)
  memory.view = v
  return $.ui.mount({ plugin: 'jev-skill-typeahead', surface, component: 'AbovePrompt', props: BAND })
}

describe('the band', () => {
  test('draws nothing while the box is idle', async ($, on) => {
    const ui = await draw($, on, { mode: 'idle', draft: '', rows: [], phase: 'live', by: '', skills: 24, agents: 0 })
    expect(await ui.find({ type: 'Text', text: /Claude may call/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /engine band/ })).toBeDefined()
    await ui.unmount()
  })

  test('a decided prompt marks the skill that will be called, with its probability', async ($, on) => {
    const ui = await draw($, on, prose())
    expect(await ui.find({ type: 'Text', text: /pdf/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /82%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /will be called/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Jev decided/ })).toBeDefined()
    await ui.unmount()
  })

  test('the footer never claims a decision the band does not have', async ($, on) => {
    const ui = await draw($, on, prose({ phase: 'live', rows: [row('pdf', 82), row('xlsx', 31)] }))
    expect(await ui.find({ type: 'Text', text: /Jev decided/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /keyword match/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /will be called/ })).toBeUndefined()
    await ui.unmount()
  })

  test('a score the backend did not report shows a dash, not a number', async ($, on) => {
    const ui = await draw($, on, prose({ rows: [row('pdf', -1, true)], by: 'builtin' }))
    expect(await ui.find({ type: 'Text', text: /—/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Claude Code decided/ })).toBeDefined()
    await ui.unmount()
  })

  test('subagents get their own icon and the header counts both kinds', async ($, on) => {
    const ui = await draw($, on, prose({ rows: [row('code-explorer', 77, true, 'agent'), row('pdf', 10, false, 'plugin')] }))
    expect(await ui.find({ type: 'Text', text: /▣/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /◆/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /24 skills · 3 subagents/ })).toBeDefined()
    await ui.unmount()
  })

  test('a draft that is a command gets no band', async ($, on) => {
    const ui = await draw($, on, { mode: 'idle', draft: '/pd', rows: [], phase: 'live', by: '', skills: 24, agents: 0 })
    expect(await ui.find({ type: 'Text', text: /Claude may call/ })).toBeUndefined()
    await ui.unmount()
  })

  test('a prose draft nothing matches stays quiet until a decision says "no skill needed"', async ($, on) => {
    const quiet = await draw($, on, prose({ rows: [], phase: 'live' }))
    expect(await quiet.find({ type: 'Text', text: /Claude may call/ })).toBeUndefined()
    await quiet.unmount()
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    test(`${surface}: fixed-width cells, and no-break spaces off the terminal so HTML keeps them`, async ($, on) => {
      const ui = await draw($, on, prose(), surface)
      const boxes = await ui.findAll({ type: 'Box' })
      const name = boxes.filter((b) => b.key === 'name')
      expect(name.length).toBe(2)
      for (const b of name) {
        expect(b.props.width).toBe(26)
        expect(b.props.flexShrink).toBe(0)
      }
      const label = await ui.find({ type: 'Text', text: /xlsx/ })
      expect(/\u00a0/.test(String(label?.text))).toBe(surface === 'desktop')
      // The score sits in its own cell, never in the meter's.
      for (const key of ['meter', 'score']) expect(boxes.filter((b) => b.key === key).every((b) => b.props.flexShrink === 0)).toBe(true)
      // Desktop fonts draw block glyphs wider than a cell: the bar is boxes there.
      const glyphs = await ui.findAll({ type: 'Text', text: /[█░]/ })
      expect(glyphs.length > 0).toBe(surface === 'terminal')
      await ui.unmount()
    })
  }
})

describe('submit', () => {
  test('a prompt with no decision for its text is passed on untouched', async ($, on) => {
    stubs(on)
    on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }) as never)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    memory.view = prose()
    const result = (await $.prompt.submit({ text: 'merge these pdf files', origin: { kind: 'composer' } } as never)) as { context?: string[] }
    expect(result.context).toBeUndefined()
    expect(memory.view?.mode).toBe('idle')
  })
})
