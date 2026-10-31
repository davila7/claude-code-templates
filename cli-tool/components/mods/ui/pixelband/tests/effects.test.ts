import { describe, expect, test, tier } from 'claude-code/testing'
import { DURATION, frame } from '../hooks/effects'
import { TRANSPARENT } from '../hooks/pixelate'

tier('user')

const W = 12, H = 6
const px = new Uint32Array(W * H).map((_, i) => (i % 5 === 0 ? TRANSPARENT : 0x204060 + i * 0x010101))
const art = { w: W, h: H, px }
const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255)

describe('effects', () => {
  test('idle is the art itself', async () => {
    expect(Array.from(frame(art, 'idle', 12345))).toEqual(Array.from(px))
  })

  test('intro starts empty and ends with every pixel revealed', async () => {
    expect(frame(art, 'intro', 0).every((c) => c === TRANSPARENT)).toBe(true)
    const end = frame(art, 'intro', DURATION.intro)
    expect(Array.from(end).every((c, i) => (c === TRANSPARENT) === (px[i] === TRANSPARENT))).toBe(true)
  })

  test('working only ever brightens, and loops', async () => {
    const f = frame(art, 'working', 400)
    let brighter = 0
    f.forEach((c, i) => {
      if (px[i] === TRANSPARENT) { expect(c).toBe(TRANSPARENT); return }
      expect(lum(c)).toBeGreaterThanOrEqual(lum(px[i]))
      if (lum(c) > lum(px[i])) brighter++
    })
    expect(brighter).toBeGreaterThan(0)
    expect(Array.from(frame(art, 'working', 400 + 1100))).toEqual(Array.from(f))
  })

  test('done flashes bright, then settles back to the art exactly', async () => {
    const start = frame(art, 'done', 0)
    expect(lum(start[1])).toBeGreaterThan(lum(px[1]))
    expect(Array.from(frame(art, 'done', DURATION.done))).toEqual(Array.from(px))
  })

  test('error glitches, then settles back to the art exactly', async () => {
    expect(Array.from(frame(art, 'error', 0))).not.toEqual(Array.from(px))
    expect(Array.from(frame(art, 'error', DURATION.error))).toEqual(Array.from(px))
  })

  test('frames are deterministic', async () => {
    expect(Array.from(frame(art, 'error', 240))).toEqual(Array.from(frame(art, 'error', 240)))
  })
})
