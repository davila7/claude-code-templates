import { describe, expect, test, tier } from 'claude-code/testing'
import { inflateRaw, inflateZlib } from '../hooks/inflate'
import { ZLIB } from './fixtures/images'

tier('user')

const b64 = (s: string) => Uint8Array.fromBase64(s)

describe('inflate', () => {
  for (const [name, c] of Object.entries(ZLIB)) {
    test(`inflates a ${name} zlib stream exactly`, async () => {
      expect(Array.from(inflateZlib(b64(c.z)))).toEqual(Array.from(b64(c.raw)))
    })
  }
  test('rejects a stream that is not zlib', async () => {
    expect(() => inflateZlib(new Uint8Array([1, 2, 3, 4]))).toThrow()
  })
  test('rejects a truncated stream instead of hanging', async () => {
    const z = b64(ZLIB.dynamic.z)
    expect(() => inflateZlib(z.subarray(0, z.length >> 1))).toThrow()
  })

  test('output past the limit is refused, so a tiny file cannot claim gigabytes', async () => {
    // One stored (uncompressed) block of 5000 bytes: fine with room, refused with a 100-byte limit.
    const block = new Uint8Array(5 + 5000)
    block[0] = 1; block[1] = 5000 & 255; block[2] = 5000 >> 8; block[3] = ~5000 & 255; block[4] = (~5000 >> 8) & 255
    expect(inflateRaw(block).length).toBe(5000)
    expect(() => inflateRaw(block, 0, 0, 100)).toThrow(/larger than expected/)
  })
})
