import { describe, expect, test, tier } from 'claude-code/testing'
import { nearest256, to256, XTERM } from '../hooks/palette256'
import { TRANSPARENT } from '../hooks/pixelate'

tier('user')

const hue = (c: number) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return r === g && g === b ? 'grey' : g >= r && g >= b ? 'green' : r >= b ? 'red' : 'blue' }

describe('palette256', () => {
  test('240 colours: the cube and the greys', async () => {
    expect(XTERM.length).toBe(240)
    expect(new Set(XTERM).size).toBe(240)
  })

  test('palette colours map to themselves', async () => {
    for (const c of XTERM) expect(nearest256((c >> 16) & 255, (c >> 8) & 255, c & 255)).toBe(c)
  })

  test('dark saturated colours keep their hue instead of going grey', async () => {
    expect(hue(nearest256(0x30, 0x62, 0x30))).toBe('green')  // Game Boy's dark green: plain rounding makes it grey
    expect(hue(nearest256(0x8b, 0xac, 0x0f))).toBe('green')
    expect(hue(nearest256(0x66, 0x00, 0x00))).toBe('red')
  })

  test('see-through pixels stay see-through', async () => {
    expect(Array.from(to256(Uint32Array.of(TRANSPARENT, 0x123456)))[0]).toBe(TRANSPARENT)
  })
})
