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

function stubs(on: On, isStateBroken = false, opened: string[] = []) {
  memory.view = undefined
  memory.version = 0
  on('state.get', () => ({ value: { value: memory.view, version: memory.version } }) as never)
  on('state.set', (_$, e) => {
    if (isStateBroken) throw new Error('state unavailable')
    memory.view = (e as { value: View }).value
    memory.version += 1
    return { value: { isSet: true, version: memory.version } } as never
  })
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  on('ui.log', () => ({ value: undefined }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', (_$, e) => {
    opened.push((e as { id: string }).id)
    return { value: undefined } as never
  })
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
  test('an empty box keeps the band, saying none yet and how many there are', async ($, on) => {
    const ui = await draw($, on, { mode: 'idle', draft: '', rows: [], phase: 'live', by: '', skills: 24, agents: 3 })
    expect(await ui.find({ type: 'Text', text: /Claude may call/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /0 of 24 skills · 0 of 3 subagents/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /type a prompt/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /engine band/ })).toBeUndefined()
    await ui.unmount()
  })

  test('the session start fills the counts, so the band shows before anything is typed', async ($, on) => {
    stubs(on)
    on('command.list', () => ({ value: [
      { name: 'help', description: 'Help', source: 'builtin' },
      { name: 'pdf', description: 'PDF files', source: 'plugin' },
      { name: 'commit', description: 'Commit', source: 'user' },
    ] }) as never)
    on('clock.now', () => ({ value: 1000 }) as never)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    expect(memory.view?.mode).toBe('idle')
    expect(memory.view?.skills).toBe(2)
    const ui = await $.ui.mount({ plugin: 'jev-skill-typeahead', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ type: 'Text', text: /0 of 2 skills/ })).toBeDefined()
    await ui.unmount()
  })

  test('names are shown whole: the name column fits the longest one', async ($, on) => {
    const long = 'anthropic-skills:skill-creator'
    const ui = await draw($, on, prose({ rows: [row(long, 63, true, 'plugin'), row('pdf', 12, false, 'plugin')] }), 'desktop')
    expect(await ui.find({ type: 'Text', text: new RegExp(long) })).toBeDefined()
    const boxes = await ui.findAll({ type: 'Box' })
    const cell = boxes.find((b) => b.key === 'name')
    expect(Number(cell?.props.width)).toBeGreaterThan(long.length)
    const detail = boxes.find((b) => b.key === 'detail')
    expect(detail?.props.overflow).toBe('hidden')
    await ui.unmount()
  })

  test('the band points at the details pane', async ($, on) => {
    const ui = await draw($, on, prose())
    expect(await ui.find({ type: 'Text', text: /\/jev-skill-typeahead/ })).toBeDefined()
    await ui.unmount()
  })

  test('a session with nothing to offer says so', async ($, on) => {
    const ui = await draw($, on, { mode: 'idle', draft: '', rows: [], phase: 'live', by: '', skills: 0, agents: 0 })
    expect(await ui.find({ type: 'Text', text: /no skills or subagents are offered/ })).toBeDefined()
    await ui.unmount()
  })

  test('a survey above the prompt wins: the engine draws its own', async ($, on) => {
    stubs(on)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    memory.view = prose()
    const ui = await $.ui.mount({ plugin: 'jev-skill-typeahead', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: true } as never })
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
    expect(await ui.find({ type: 'Text', text: /1 of 24 skills · 1 of 3 subagents/ })).toBeDefined()
    await ui.unmount()
  })

  test('a draft that is a command gets no rows: commands run as typed', async ($, on) => {
    const ui = await draw($, on, { mode: 'idle', draft: '/pd', rows: [], phase: 'live', by: '', skills: 24, agents: 0 })
    expect(await ui.find({ type: 'Text', text: /commands run as typed/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /pdf/ })).toBeUndefined()
    await ui.unmount()
  })

  test('a prose draft nothing matches says so until a decision says "no skill needed"', async ($, on) => {
    const quiet = await draw($, on, prose({ rows: [], phase: 'live' }))
    expect(await quiet.find({ type: 'Text', text: /no skill or subagent matches yet/ })).toBeDefined()
    expect(await quiet.find({ type: 'Text', text: /0 of 24 skills/ })).toBeDefined()
    await quiet.unmount()
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    test(`${surface}: fixed-width cells, and no-break spaces off the terminal so HTML keeps them`, async ($, on) => {
      const ui = await draw($, on, prose(), surface)
      const boxes = await ui.findAll({ type: 'Box' })
      const name = boxes.filter((b) => b.key === 'name')
      expect(name.length).toBe(2)
      for (const b of name) {
        expect(b.props.width).toBe(name[0].props.width)
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

  test('a failure inside the mod never stops the prompt: it goes through as typed', async ($, on) => {
    stubs(on, true)
    on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }) as never)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    const result = (await $.prompt.submit({ text: 'merge these pdf files', origin: { kind: 'composer' } } as never)) as { text?: string; context?: string[] }
    expect(result.text).toBe('merge these pdf files')
    expect(result.context).toBeUndefined()
  })
})

describe('the details pane', () => {
  test('the command opens it', async ($, on) => {
    const opened: string[] = []
    stubs(on, false, opened)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    const result = (await $.command.run({ command: 'jev-skill-typeahead', args: '', origin: { kind: 'composer' } } as never)) as { text?: string }
    expect(opened).toEqual(['jev-skill-typeahead'])
    expect(String(result.text)).toMatch(/opened/)
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    test(`${surface}: every row kept, with whole names and descriptions`, async ($, on) => {
      stubs(on)
      await $.session.start({ cwd: '/repo', surface, isInteractive: true } as never)
      const long = 'Guided setup — install role-matched plugins, connect your tools, and pick what Claude should know about your work'
      memory.view = prose({
        rows: [
          { ...row('anthropic-skills:skill-creator', 63, true, 'plugin'), description: 'Create new skills' },
          { ...row('anthropic-skills:setup-cowork', 12, false, 'plugin'), description: long },
          row('engineering:system-design', 7, false, 'plugin'),
          row('anthropic-skills:docs', 6, false, 'plugin'),
          row('code-explorer', 5, false, 'agent'),
        ],
      })
      const ui = await $.ui.mount({ plugin: 'jev-skill-typeahead', surface, component: 'Pane', requestId: 'jev-skill-typeahead', props: {} as never })
      expect(await ui.find({ type: 'Text', text: /^anthropic-skills:setup-cowork$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: long })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /code-explorer/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /merge these pdf files/ })).toBeDefined()
      await ui.unmount()
    })
  }
})
