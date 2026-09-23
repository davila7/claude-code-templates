import { expect, test } from 'bun:test'
import {
  describeFeatures,
  feature,
  FEATURES,
  featureOverrides,
  initFeatures,
  loadFeatureOverrides,
  parseJevCommand,
  setFeature,
} from '../hooks/features.ts'
import { type Act, actOfTool, BODY_W, CANVAS_H, PALETTE, SCARF_CYCLE, CANVAS_W, PLAY_FRAMES, PLAYS, scenePixels, sceneRows, turnSpeech } from '../hooks/pet-art.ts'

const allOn = { effort: true, raise: true, subagents: true, skills: true, strategy: true, model: false, pet: true }

// --- the switches ------------------------------------------------------------------

test('everything is on by default except the main model switch', () => {
  initFeatures(allOn)
  for (const name of FEATURES) expect(feature(name)).toBe(name !== 'model')
})

test('/jev parses one switch, all of them, the pet shortcut and reset', () => {
  expect(parseJevCommand('')).toEqual({ kind: 'status' })
  expect(parseJevCommand('skills off')).toEqual({ kind: 'set', features: ['skills'], on: false })
  expect(parseJevCommand('  Effort   ON ')).toEqual({ kind: 'set', features: ['effort'], on: true })
  expect(parseJevCommand('all off')).toEqual({ kind: 'set', features: [...FEATURES], on: false })
  expect(parseJevCommand('off')).toEqual({ kind: 'set', features: ['pet'], on: false })
  expect(parseJevCommand('reset')).toEqual({ kind: 'reset' })
  expect(parseJevCommand('skills maybe').kind).toBe('unknown')
  expect(parseJevCommand('turbo on').kind).toBe('unknown')
})

test('only changes from the defaults are kept, and they survive a reload', () => {
  initFeatures(allOn)
  setFeature('skills', false)
  setFeature('effort', true) // already the default: nothing to keep
  expect(featureOverrides()).toEqual({ skills: false })
  const saved = JSON.parse(JSON.stringify(featureOverrides()))
  initFeatures(allOn)
  loadFeatureOverrides(saved)
  expect(feature('skills')).toBe(false)
  // Garbage in the store is ignored, never trusted.
  loadFeatureOverrides({ skills: 'no', bogus: false, effort: false })
  expect(feature('skills')).toBe(true)
  expect(feature('effort')).toBe(false)
  loadFeatureOverrides(null)
  expect(featureOverrides()).toEqual({})
})

test('/jev lists every switch with its state', () => {
  initFeatures(allOn)
  setFeature('strategy', false)
  const text = describeFeatures()
  for (const name of FEATURES) expect(text).toContain(name)
  expect(text).toMatch(/off\s+strategy/)
  expect(text).toMatch(/on\s+skills/)
  initFeatures(allOn)
})

// --- the pet ---------------------------------------------------------------------

const ACTS: Act[] = ['think', 'read', 'search', 'write', 'run', 'fly', 'rest', 'rope', 'wave', 'look']

test('the pet is Claude the pilot: goggles, eyes, scarf, flames; no flames while jumping rope', () => {
  const rest = scenePixels('rest').join('\n')
  expect(rest).toContain('LL') // goggle lenses
  expect(rest).toMatch(/E/) // open eyes
  expect(rest).toContain('SSSS') // scarf
  expect(rest).toMatch(/[Ff]/) // hovering on its jets
  expect(scenePixels('fly').join('')).toMatch(/[Ff]/)
  for (let beat = 0; beat < 4; beat++) expect(scenePixels('rope', beat).join('')).not.toMatch(/[Ff]/)
})

test('the scarf end mostly hangs still, dipping one wind step in five', () => {
  const at = (wind: number) => scenePixels('rest', 0, false, wind)
  const still = at(0)
  for (let wind = 1; wind < SCARF_CYCLE - 1; wind++) expect(at(wind)).toEqual(still)
  const dipped = at(SCARF_CYCLE - 1)
  expect(dipped).not.toEqual(still)
  expect(at(SCARF_CYCLE)).toEqual(still)
  // Only the scarf's end moves: the same count of scarf pixels.
  const count = (pixels: string[]) => (pixels.join('').match(/S/g) ?? []).length
  expect(count(dipped)).toBe(count(still))
})

test('the flames hold their colors: resting they never change, flying only their length does', () => {
  const flames = (pixels: string[]) => pixels.slice(-2).join('\n')
  expect(flames(scenePixels('rest', 1, false, 1))).toBe(flames(scenePixels('rest', 0, false, 0)))
  const long = scenePixels('fly', 0)
  const short = scenePixels('fly', 1)
  // The short flame is the long one's top row, the same colors.
  expect(short[CANVAS_H - 1]).toBe(long[CANVAS_H - 2])
})

test('every frame of every act is the same size, six lines tall', () => {
  for (const act of ACTS) {
    for (let frame = 0; frame < 8; frame++) {
      for (const blink of [false, true]) {
        const pixels = scenePixels(act, frame, blink)
        expect(pixels).toHaveLength(CANVAS_H)
        expect(pixels.every((row) => row.length === CANVAS_W)).toBe(true)
        const rows = sceneRows(act, frame, blink)
        expect(rows).toHaveLength(CANVAS_H / 2)
        expect(rows.every((row) => row.length === CANVAS_W)).toBe(true)
      }
    }
  }
})

test('each act moves: its frames differ within a loop and repeat after it', () => {
  // A loop runs until the act and the scarf's flap line up again
  // (flying: the streaks take 6 steps down the canvas).
  const lcm = (a: number, b: number): number => (a * b) / (function gcd(x: number, y: number): number { return y ? gcd(y, x % y) : x })(a, b)
  const loops: Record<string, number> = { fly: 6, think: 8, read: 6, search: 4, write: 12, run: 10, ...PLAY_FRAMES }
  for (const act of ['fly', 'think', 'read', 'search', 'write', 'run', ...PLAYS] as Act[]) {
    const n = lcm(loops[act] as number, SCARF_CYCLE)
    const frames = Array.from({ length: n }, (_, f) => scenePixels(act, f).join('\n'))
    expect(new Set(frames).size).toBeGreaterThan(1)
    expect(scenePixels(act, n)).toEqual(scenePixels(act, 0))
  }
})

test('jump rope: the rope goes overhead, then under the pilot while it is in the air', () => {
  const overhead = scenePixels('rope', 0)
  const under = scenePixels('rope', 2)
  expect(overhead[0]).toMatch(/R{5,}/)
  expect(under[CANVAS_H - 1]).toMatch(/R{5,}/)
  // In the air: the feet are off the bottom lines.
  expect(under.slice(-2).join('')).not.toMatch(/C/)
  expect(overhead[CANVAS_H - 1]).toMatch(/C/)
})

test('each tool shows as what it does', () => {
  expect(actOfTool('Read')).toBe('read')
  expect(actOfTool('WebFetch')).toBe('read')
  expect(actOfTool('Grep')).toBe('search')
  expect(actOfTool('Glob')).toBe('search')
  expect(actOfTool('WebSearch')).toBe('search')
  expect(actOfTool('Edit')).toBe('write')
  expect(actOfTool('Write')).toBe('write')
  expect(actOfTool('Bash')).toBe('run')
  expect(actOfTool('Agent')).toBe('fly')
  expect(actOfTool('mcp__github__create_issue')).toBe('fly')
})

test('the working poses hold something different beside the pilot: a book, a magnifier, paper, a terminal', () => {
  expect(scenePixels('read', 0).join('')).toMatch(/B/)
  expect(scenePixels('search', 0).join('')).toMatch(/l/)
  expect(scenePixels('write', 3).join('')).toMatch(/P/)
  expect(scenePixels('run', 0).join('')).toMatch(/K/)
  // The pilot itself stays whole: its part of the canvas is the resting pilot's,
  // bar the eyes (turned to the prop) and the arm that holds it.
  const body = (pixels: string[]) => pixels.map((row) => row.slice(0, BODY_W - 2).replace(/E/g, 'C')).join('\n')
  for (const act of ['read', 'search', 'write', 'run'] as Act[]) expect(body(scenePixels(act, 0))).toBe(body(scenePixels('rest', 0)))
  // Thinking: a thought cloud, its "..." filling in over the beats.
  expect(scenePixels('think', 0).join('')).toMatch(/RRRR/)
  const inCloud = (frame: number) => (scenePixels('think', frame).slice(0, 6).join('').match(/k/g) ?? []).length
  expect(inCloud(0)).toBe(0)
  expect(inCloud(6)).toBeGreaterThan(inCloud(2))
})

test('every pixel of every frame has a color: nothing drawn comes out blank', () => {
  for (const act of ACTS) {
    for (let frame = 0; frame < 12; frame++) {
      for (const pixel of scenePixels(act, frame, false, frame).join('')) {
        if (pixel !== '.') expect(PALETTE[pixel]).toBeDefined()
      }
    }
  }
})

test('blinking closes the eyes in every act', () => {
  for (const act of ACTS) expect(scenePixels(act, 0, true).join('')).not.toContain('E')
})

test('the bubble says the effort, the skill and how sure', () => {
  const base = { answered: true, current: 'high', wanted: 'low', confidence: 0.89, advised: null }
  expect(turnSpeech({ ...base, applied: 'low', skill: null }).text).toBe('low · no skill · 89% sure')
  expect(turnSpeech({ ...base, applied: 'xhigh', skill: 'systematic-debugging', advised: 'parallel' }).text).toBe(
    'xhigh · /systematic-debugging · parallel · 89% sure',
  )
  expect(turnSpeech({ ...base, applied: null, skill: undefined, confidence: 0.42 }).text).toBe('high kept · wanted low · 42% sure')
  expect(turnSpeech({ ...base, answered: false, applied: null, skill: null }).mood).toBe('alert')
})
