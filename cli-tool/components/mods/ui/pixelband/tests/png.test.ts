import { describe, expect, test, tier } from 'claude-code/testing'
import { decodePng, isPng } from '../hooks/png'
import { IMAGES } from './fixtures/images'

tier('user')

const b64 = (s: string) => Uint8Array.fromBase64(s)

describe('png', () => {
  for (const name of ['rgba8', 'rgb8', 'gray8', 'grayalpha8', 'gray16', 'palette', 'bilevel']) {
    test(`decodes ${name} to the same pixels Pillow reads`, async () => {
      const f = IMAGES[name]
      const img = decodePng(b64(f.png!))
      expect([img.width, img.height]).toEqual([f.width, f.height])
      expect(Array.from(img.data)).toEqual(f.rgba)
    })
  }
  test('refuses interlaced PNGs (the loader falls back to the OS tool)', async () => {
    expect(() => decodePng(b64(IMAGES.interlaced.png!))).toThrow(/interlaced/)
  })
  test('recognises PNG bytes and nothing else', async () => {
    expect(isPng(b64(IMAGES.rgb8.png!))).toBe(true)
    expect(isPng(new Uint8Array([0x42, 0x4d, 1, 2, 3, 4, 5, 6, 7, 8]))).toBe(false)
  })
})
