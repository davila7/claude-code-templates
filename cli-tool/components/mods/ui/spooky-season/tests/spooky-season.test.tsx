// Run with: claude plugin test ui/spooky-season
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { drip, pick } from '../hooks/spooky-season.tsx'

const BAND = { hasSurvey: false, isWorking: false, maxRows: 8, bodyColumns: 60 } as never

function stubs(on: On, store: Record<string, unknown> = {}, onRender?: (props: unknown) => void) {
  on('store.get', (_$, e) => ({ value: store[e.key] }))
  on('store.set', (_$, e) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  // what the engine (or another mod) draws when ours passes
  on('ui.render', ($, e) => {
    onRender?.(e.props)
    const { Text } = $.ui.resolve(e)
    return <Text>engine band</Text>
  })
  return store
}

async function band($: Engine, on: On, store: Record<string, unknown> = {}, surface: 'terminal' | 'desktop' = 'terminal') {
  stubs(on, store)
  await $.session.start({ cwd: '/repo', surface, isInteractive: true } as never)
  return $.ui.mount({ plugin: 'spooky-season', surface, component: 'AbovePrompt', props: BAND })
}

describe('helpers', () => {
  test('drip fills exactly the width asked', () => {
    expect(drip(60)).toHaveLength(60)
    expect(drip(200)).toHaveLength(200)
    expect(drip(0)).toBe('')
  })

  test('pick is stable for one seed', () => {
    expect(pick(['a', 'b', 'c'], 'turn-1')).toBe(pick(['a', 'b', 'c'], 'turn-1'))
  })
})

describe('the band', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`draws the drip and the label, with the other band under it (${surface})`, async ($, on) => {
      const ui = await band($, on, {}, surface)
      const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text)
      expect(texts[0]).toMatch(/^[▀█▄]+$/)
      expect(texts.some(t => /spooky season/.test(t ?? ''))).toBe(true)
      expect(texts.at(-1)).toBe('engine band')
      await ui.unmount()
    })
  }

  test('off: only the band beneath shows', async ($, on) => {
    const ui = await band($, on, { off: true })
    const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text)
    expect(texts).toEqual(['engine band'])
    await ui.unmount()
  })
})

describe('the turn line', () => {
  test('swaps the past-tense word, keeps the duration', async ($, on) => {
    let seen: { word: string; durationMs: number } | undefined
    stubs(on, {}, props => {
      seen = props as never
    })
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    const ui = await $.ui.mount({ plugin: 'spooky-season', surface: 'terminal', component: 'TurnDuration', props: { word: 'Baked', durationMs: 4000 } as never })
    expect(seen?.durationMs).toBe(4000)
    expect(['Haunted', 'Brewed', 'Conjured', 'Summoned', 'Carved', 'Cursed', 'Hexed', 'Exhumed']).toContain(seen?.word)
    await ui.unmount()
  })
})

describe('/halloween', () => {
  test('toggles and takes on / off', async ($, on) => {
    const store = stubs(on)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    await $.command.run({ command: 'halloween', args: 'off' } as never)
    expect(store.off).toBe(true)
    await $.command.run({ command: 'halloween', args: '' } as never)
    expect(store.off).toBe(false)
    await $.command.run({ command: 'halloween', args: 'on' } as never)
    expect(store.off).toBe(false)
  })
})
