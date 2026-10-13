import { test, expect } from 'claude-code/testing'
import { frameRows, SCENE_NAMES, REACTION_NAMES, WANDERS, H, sceneFor, sceneAt, sceneForTool, hold, ACT_FRAMES } from '../hooks/scenes'

const PROBE: Record<string, string> = { think: 'Pondering', cook: 'Cooking', bake: 'Baking', brew: 'Brewing', walk: 'Moseying', run: 'Scampering',
  moonwalk: 'Moonwalking', herd: 'Herding', spin: 'Spinning', magic: 'Conjuring', levitate: 'Levitating', hatch: 'Hatching', grow: 'Sprouting',
  forge: 'Forging', compute: 'Computing', type: 'Xyzzy', talk: 'Xyzzy', dance: 'Vibing', juggle: 'Juggling', honk: 'Honking', sketch: 'Sketching',
  weather: 'Misting', thunder: 'Thundering', dig: 'Burrowing', flow: 'Flowing', kick: 'Kicking', skate: 'Skating', campfire: 'Kindling', chalk: 'Deciphering', disco: 'Boogieing', idle: 'Xyzzy' }
const modeOf = (name: string) => (name === 'type' ? 'tool-use' : name === 'talk' ? 'responding' : 'requesting') as any

const TRAVELS = new Set(['walk', 'run', 'moonwalk', 'herd', 'dig', 'skate', 'chalk'])

test('every scene keeps the stage size; Clawd roams only where its props can come along, and no prop hides its face', { timeoutMs: 60_000 }, () => {
  for (const width of [30, 40, 60])
    for (const name of SCENE_NAMES) {
      expect(sceneFor(PROBE[name], modeOf(name))).toBe(name)
      const columns = new Set<number>()
      for (let t = 0; t < 120; t++) {
        const rows = frameRows(PROBE[name], modeOf(name), t, width).map(r => r.map(x => x.text).join(''))
        expect(rows.length).toBe(H)
        for (const r of rows) expect([...r].length).toBe(width)
        const col = rows.map(r => [...r].indexOf('▐')).find(i => i >= 0) // Clawd's head; the little ones have none
        if (col !== undefined) columns.add(col)
        // each head row reads ▐ + five face cells + ▌, nothing drawn over it
        for (const r of rows) for (const m of r.matchAll(/▐/g)) expect(r.slice(m.index, m.index + 7)).toMatch(/^▐[▛▜█^]{5}▌$/)
      }
      if (!WANDERS.has(name) && !TRAVELS.has(name)) expect(columns.size).toBe(1) // stays by its pot, board, anvil…
      else if (width >= 40) expect(columns.size).toBeGreaterThan(4)
    }
  // the /clawd reactions: same stage, same face, and Clawd stays where it is
  for (const width of [30, 60])
    for (const name of REACTION_NAMES) {
      const columns = new Set<number>()
      for (let t = 0; t < 48; t++) {
        const rows = frameRows('Xyzzy', 'requesting', t, width, name).map(r => r.map(x => x.text).join(''))
        expect(rows.length).toBe(H)
        for (const r of rows) expect([...r].length).toBe(width)
        for (const r of rows) for (const m of r.matchAll(/▐/g)) expect(r.slice(m.index, m.index + 7)).toMatch(/^▐[▛▜█^]{5}▌$/)
        columns.add(rows.map(r => [...r].indexOf('▐')).find(i => i >= 0)!)
      }
      expect(columns.size).toBe(1)
    }
})

test('a turn opens on the running tool or the spinner word, then rotates through every other scene whatever runs', () => {
  for (const seed of [0, 17, 4242]) {
    const cue = (act: number, tool?: string) => ({ word: 'Sauteing', mode: 'thinking' as const, tick: act * ACT_FRAMES + 3, seed, tool })
    expect(sceneAt(cue(0))).toBe('cook')
    const seen = new Set<string>()
    let prev = 'cook'
    for (let act = 1; act <= 60; act++) {
      const s = sceneAt({ ...cue(act), prev })
      expect(s).not.toBe(prev) // every act changes scene
      seen.add(s)
      prev = s
    }
    expect(seen.size).toBe(SCENE_NAMES.length - 3) // all but idle, type and talk
    expect(sceneAt(cue(0, 'Bash'))).toBe('type')
    expect(sceneAt(cue(9, 'Edit'))).toBe(sceneAt(cue(9))) // past the opener a tool changes nothing
    // the next turn picks up the rotation where this one stopped
    expect(sceneAt({ ...cue(1), played: 4 })).toBe(sceneAt(cue(5)))
  }
  expect(sceneForTool('Grep')).toBe('think')
})

test('a scene holds for its whole act, whatever starts or stops meanwhile', () => {
  const cue = (tick: number, extra = {}) => ({ word: 'Sauteing', mode: 'thinking' as const, tick, seed: 5, ...extra })
  let s = hold(undefined, 0, cue(0))
  expect(s.scene).toBe('cook')
  for (const change of [{ tool: 'Bash' }, { word: 'Pondering' }, { mode: 'responding' as const, word: 'Xyzzy' }])
    expect(hold(s, 0, cue(40, change))).toBe(s) // the opener stays
  s = hold(s, 0, cue(ACT_FRAMES + 1))
  const rotated = s.scene
  expect(rotated).not.toBe('cook')
  // a tool that maps to the very scene on stage, or any other, changes nothing mid-act
  for (const tool of ['Read', 'Edit', 'Agent', 'Bash']) expect(hold(s, 0, cue(ACT_FRAMES + 50, { tool })).scene).toBe(rotated)
  expect(hold(s, 0, cue(2 * ACT_FRAMES)).scene).not.toBe(rotated) // the next act moves on
  expect(hold(s, 999, cue(0, { tool: 'Bash' })).scene).toBe('type') // a new turn opens afresh
  expect(sceneForTool('Agent')).toBe('herd')
  expect(sceneForTool('WebFetch')).toBe('weather')
  expect(sceneForTool('mcp__x__y')).toBe('magic')
  expect(sceneForTool('Something')).toBe('forge')
})
