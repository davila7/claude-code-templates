import { describe, expect, test, tier } from 'claude-code/testing'
import { decodeAnim, encodeAnim, frameAt, makeAnim, spread } from '../hooks/anim'
import { decodeGif } from '../hooks/gif'
import type { Rgba } from '../hooks/png'
import { GIFS } from './fixtures/gifs'

tier('user')

const framesOf = (name: string) => {
  const out: Rgba[] = []
  decodeGif(Uint8Array.fromBase64(GIFS[name].gif), (c) => out.push({ width: c.width, height: c.height, data: c.data.slice() }))
  return out
}

describe('anim', () => {
  test('frames survive the store: same colours (few enough to keep exactly), same see-through pixels', async () => {
    const frames = framesOf('sprite_disposal2')
    const back = decodeAnim(frames[0].width, frames[0].height, encodeAnim(frames, [100, 100, 100, 100]))
    expect(back.frames.length).toBe(4)
    for (let f = 0; f < 4; f++) {
      for (let i = 0; i < frames[f].data.length; i += 4) {
        const see = frames[f].data[i + 3] < 128
        expect(back.frames[f].data[i + 3] < 128).toBe(see)
        if (!see) expect(Array.from(back.frames[f].data.subarray(i, i + 3))).toEqual(Array.from(frames[f].data.subarray(i, i + 3)))
      }
    }
  })

  test('a byte per pixel: a loop is stored at about a quarter of RGBA', async () => {
    const frames = framesOf('gradient')
    const s = encodeAnim(frames, [40, 40])
    const raw = frames.reduce((n, f) => n + f.data.length, 0)
    expect(Uint8Array.fromBase64(s.frames).length).toBe(raw / 4)
  })

  test('frameAt follows each frame\'s own delay, and loops', async () => {
    const a = makeAnim([], [100, 50, 200])
    expect([0, 99, 100, 149, 150, 349, 350, 450].map((t) => frameAt(a, t))).toEqual([0, 0, 1, 1, 2, 2, 0, 1])
  })

  test('spread picks frames evenly', async () => {
    expect(spread([0, 1, 2, 3, 4, 5, 6, 7], 4)).toEqual([0, 2, 4, 6])
    expect(spread([1, 2], 6)).toEqual([1, 2])
  })
})
