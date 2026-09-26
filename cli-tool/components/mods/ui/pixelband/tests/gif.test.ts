import { describe, expect, test, tier } from 'claude-code/testing'
import { countGifFrames, decodeGif, isGif } from '../hooks/gif'
import { GIFS } from './fixtures/gifs'

tier('user')

function decodeAll(name: string) {
  const frames: { data: Uint8Array; delay: number }[] = []
  const info = decodeGif(Uint8Array.fromBase64(GIFS[name].gif), (c, delay) => frames.push({ data: c.data.slice(), delay }))
  return { info, frames }
}

/** Same pixels as Pillow: identical where opaque, and see-through in the same places. */
function samePixels(ours: Uint8Array, pillow: Uint8Array) {
  expect(ours.length).toBe(pillow.length)
  let bad = 0
  for (let i = 0; i < ours.length; i += 4) {
    const a = ours[i + 3] >= 128, b = pillow[i + 3] >= 128
    if (a !== b || (a && (ours[i] !== pillow[i] || ours[i + 1] !== pillow[i + 1] || ours[i + 2] !== pillow[i + 2]))) bad++
  }
  expect(bad).toBe(0)
}

describe('gif', () => {
  for (const name of Object.keys(GIFS)) {
    test(`${name}: every frame matches Pillow's`, async () => {
      const g = GIFS[name]
      const { info, frames } = decodeAll(name)
      expect([info.width, info.height, info.frames]).toEqual([g.width, g.height, g.frames.length])
      frames.forEach((f, i) => samePixels(f.data, Uint8Array.fromBase64(g.frames[i])))
    })
  }

  test('frame counts come from the block structure alone', async () => {
    for (const [name, g] of Object.entries(GIFS)) expect([name, countGifFrames(Uint8Array.fromBase64(g.gif))]).toEqual([name, g.frames.length])
  })

  test('delays: as written, except 0 and 10 ms play at 100 ms like browsers', async () => {
    expect(decodeAll('bounce').frames.map((f) => f.delay)).toEqual([80, 80, 120, 120, 100, 50])
  })

  test('isGif checks the signature', async () => {
    expect(isGif(Uint8Array.fromBase64(GIFS.still.gif))).toBe(true)
    expect(isGif(new TextEncoder().encode('GIF is a nice format'))).toBe(false)
  })

  test('a frame claiming to be vastly bigger than its canvas is refused, not allocated', async () => {
    const b = Uint8Array.fromBase64(GIFS.still.gif).slice()
    let p = 13 + (b[10] & 0x80 ? 3 * (1 << ((b[10] & 7) + 1)) : 0)
    while (b[p] === 0x21) { p += 2; while (b[p] !== 0) p += b[p] + 1; p++ }
    expect(b[p]).toBe(0x2c)
    b[p + 5] = 0xff; b[p + 6] = 0xff; b[p + 7] = 0xff; b[p + 8] = 0xff   // width and height 65535
    expect(() => decodeGif(b, () => {})).toThrow(/far bigger than its/)
  })
})
