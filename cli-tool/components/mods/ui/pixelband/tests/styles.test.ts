import { describe, expect, test, tier } from 'claude-code/testing'
import { TRANSPARENT } from '../hooks/pixelate'
import { STYLES, stylize } from '../hooks/styles'

tier('user')

const W = 16, H = 8
const data = new Uint8Array(W * H * 4)
for (let i = 0; i < W * H; i++) data.set([(i * 29) % 256, (i * 53) % 256, (i * 97) % 256, i % 9 === 0 ? 0 : 255], i * 4)
const small = { width: W, height: H, data }
const hex = (c: number) => c.toString(16).padStart(6, '0')

describe('styles', () => {
  test('every style keeps transparent pixels transparent', async () => {
    for (const s of STYLES) {
      const art = stylize(small, s, 16)
      for (let i = 0; i < W * H; i++) expect(art.px[i] === TRANSPARENT).toBe(i % 9 === 0)
    }
  })

  test('palette styles only ever use their palette', async () => {
    const allowed: Record<string, string[]> = {
      gameboy: ['0f380f', '306230', '8bac0f', '9bbc0f'],
      mono: ['141416', '5a5a60', 'a8a8ac', 'f0f0ec'],
    }
    for (const [s, pal] of Object.entries(allowed)) {
      const used = new Set(Array.from(stylize(small, s as any, 16).px).filter((c) => c !== TRANSPARENT).map(hex))
      for (const c of used) expect(pal).toContain(c)
    }
    const pico = new Set(Array.from(stylize(small, 'pico8', 16).px).filter((c) => c !== TRANSPARENT))
    expect(pico.size).toBeLessThanOrEqual(16)
  })

  test('original respects the colour count; sepia stays warm and small', async () => {
    const orig = new Set(Array.from(stylize(small, 'original', 6).px).filter((c) => c !== TRANSPARENT))
    expect(orig.size).toBeLessThanOrEqual(6)
    const sepia = Array.from(stylize(small, 'sepia', 16).px).filter((c) => c !== TRANSPARENT)
    expect(new Set(sepia).size).toBeLessThanOrEqual(8)
    for (const c of sepia) expect((c >> 16) & 255).toBeGreaterThanOrEqual(c & 255) // red >= blue: warm
  })

  test('dithering is deterministic', async () => {
    expect(Array.from(stylize(small, 'gameboy', 4).px)).toEqual(Array.from(stylize(small, 'gameboy', 4).px))
  })
})
