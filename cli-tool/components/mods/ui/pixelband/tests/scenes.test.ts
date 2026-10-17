import { describe, expect, test, tier } from 'claude-code/testing'
import { TRANSPARENT } from '../hooks/pixelate'
import { makeScene, SCENES } from '../hooks/scenes'

tier('user')

const at = (t: number, energy = 0, flash: number | null = null) => ({ t, energy, flash })
const same = (a: Uint32Array, b: Uint32Array) => a.length === b.length && a.every((v, i) => v === b[i])

describe('scenes', () => {
  test('every scene fills the band, at any size', async () => {
    for (const name of SCENES) {
      for (const [w, h] of [[80, 24], [10, 4], [250, 48], [1, 2]]) {
        expect(makeScene(name, w, h)(at(500)).length).toBe(w * h)
      }
    }
  })

  test('the same moment draws the same frame', async () => {
    for (const name of SCENES) expect(same(makeScene(name, 60, 20)(at(1234)), makeScene(name, 60, 20)(at(1234)))).toBe(true)
  })

  test('scenes move', async () => {
    for (const name of SCENES) {
      const r = makeScene(name, 60, 20)
      expect(same(r(at(1000)), r(at(1400)))).toBe(false)
    }
  })

  test('Claude working changes every scene (more rain, warp, brighter lights, taller flames)', async () => {
    for (const name of SCENES) {
      const idle = makeScene(name, 60, 20), busy = makeScene(name, 60, 20)
      let a: Uint32Array = new Uint32Array(), b: Uint32Array = new Uint32Array()
      for (let t = 0; t <= 2000; t += 80) { a = idle(at(t, 0)); b = busy(at(t, 1)) }
      expect(same(a, b)).toBe(false)
    }
  })

  test('a finished turn gets its flourish', async () => {
    for (const name of SCENES) {
      const plain = makeScene(name, 60, 20), flashed = makeScene(name, 60, 20)
      let a: Uint32Array = new Uint32Array(), b: Uint32Array = new Uint32Array()
      for (let t = 0; t <= 800; t += 80) { a = plain(at(t)); b = flashed(at(t, 0, t >= 400 ? t - 400 : null)) }
      expect(same(a, b)).toBe(false)
    }
  })

  test('fire burns over the terminal background: the sky above it is see-through', async () => {
    const r = makeScene('fire', 40, 24)
    const px = r(at(3000))
    expect(Array.from(px.subarray(0, 40 * 4)).filter((c) => c === TRANSPARENT).length).toBeGreaterThan(40 * 3)
    expect(Array.from(px.subarray(40 * 23)).every((c) => c !== TRANSPARENT)).toBe(true)
  })
})
