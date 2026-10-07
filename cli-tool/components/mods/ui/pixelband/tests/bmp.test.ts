import { describe, expect, test, tier } from 'claude-code/testing'
import { decodeBmp, isBmp } from '../hooks/bmp'
import { IMAGES } from './fixtures/images'

tier('user')

describe('bmp', () => {
  test('decodes what macOS sips writes for a JPEG, pixel for pixel', async () => {
    const f = IMAGES.sips_bmp
    const bytes = Uint8Array.fromBase64(f.bmp!)
    expect(isBmp(bytes)).toBe(true)
    const img = decodeBmp(bytes)
    expect([img.width, img.height]).toEqual([f.width, f.height])
    expect(Array.from(img.data)).toEqual(f.rgba)
  })
})
