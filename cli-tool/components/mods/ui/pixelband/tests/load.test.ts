import { describe, expect, test, tier } from 'claude-code/testing'
import { cleanPath, loadGif, loadImage, MAX_FRAMES, type Io } from '../hooks/load'
import { GIFS } from './fixtures/gifs'
import { IMAGES } from './fixtures/images'

tier('user')

/** A pretend filesystem and PATH: `tool` decides what running a program does. */
function fakeIo(files: Record<string, string>, tool?: (argv: string[]) => number) {
  const runs: string[][] = []
  const reads: string[] = []
  const io: Io = {
    readBase64: async (p) => { reads.push(p); if (!(p in files)) throw new Error('ENOENT'); return { base64: files[p] } },
    tmpdir: async () => '/tmp/',
    run: async (argv) => {
      runs.push(argv)
      const code = argv[0] === 'rm' ? 0 : tool ? tool(argv) : 127
      if (code === 0 && argv[0] === 'sips') files[argv[argv.length - 1]] = IMAGES.sips_bmp.bmp!
      return { exitCode: code, stdout: '', stderr: '' }
    },
  }
  return { io, runs, reads }
}

const JPEG = btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70))

describe('load', () => {
  test('cleanPath handles quotes, drag-and-drop escapes, and ~', async () => {
    expect(cleanPath('  "/a b/c.png" ')).toBe('/a b/c.png')
    expect(cleanPath('/Users/me/My\\ Pics/cat.png')).toBe('/Users/me/My Pics/cat.png')
    expect(cleanPath('~/cat.png', '/Users/me/')).toBe('/Users/me/cat.png')
    expect(cleanPath("'~/x.png'", '/h')).toBe('/h/x.png')
  })

  test('a PNG is decoded right here, without running anything', async () => {
    const { io, runs } = fakeIo({ '/a.png': IMAGES.rgba8.png! })
    const r = await loadImage(io, '/a.png')
    expect([r.via, r.image.width, r.image.height]).toEqual(['png', 7, 5])
    expect(runs).toEqual([])
  })

  test('a JPEG goes through sips without being read into the mod, and the temp file is cleaned up', async () => {
    const { io, runs, reads } = fakeIo({ '/photo.jpg': JPEG }, (argv) => (argv[0] === 'sips' ? 0 : 127))
    const r = await loadImage(io, '/photo.jpg')
    expect(r.via).toBe('sips')
    expect(reads.includes('/photo.jpg')).toBe(false)
    expect([r.image.width, r.image.height]).toEqual([IMAGES.sips_bmp.width, IMAGES.sips_bmp.height])
    expect(runs[0].slice(0, 5)).toEqual(['sips', '-s', 'format', 'bmp', '--resampleHeightWidthMax'])
    expect(runs[0][runs[0].length - 1].startsWith('/tmp/pixelband-')).toBe(true)
    expect(runs.some((a) => a[0] === 'rm')).toBe(true)
  })

  test('with no image tool, a non-PNG gets a clear message instead of a crash', async () => {
    const { io } = fakeIo({ '/photo.jpg': JPEG })
    await expect(loadImage(io, '/photo.jpg')).rejects.toThrow(/Try a PNG/)
  })

  test('a missing file says so', async () => {
    const { io } = fakeIo({})
    await expect(loadImage(io, '/nope.png')).rejects.toThrow(/couldn't read \/nope.png/)
  })

  test('a PNG saved with a .jpg name still loads when no tool is around', async () => {
    const { io } = fakeIo({ '/odd.jpg': IMAGES.rgb8.png! })
    expect((await loadImage(io, '/odd.jpg')).via).toBe('png')
  })

  test('an interlaced PNG falls back to the OS tool', async () => {
    const { io } = fakeIo({ '/i.png': IMAGES.interlaced.png! }, (argv) => (argv[0] === 'sips' ? 0 : 127))
    expect((await loadImage(io, '/i.png')).via).toBe('sips')
  })

  test('an animated GIF is decoded here, every frame with its timing, and nothing is run', async () => {
    const { io, runs } = fakeIo({ '/Users/me/loop.gif': GIFS.bounce.gif })
    const r = await loadImage(io, '/Users/me/loop.gif')
    expect([r.via, r.frames?.length, r.delays]).toEqual(['gif', 6, [80, 80, 120, 120, 100, 50]])
    expect(runs).toEqual([])
  })

  test('a one-frame GIF is just a still', async () => {
    const { io } = fakeIo({ '/s.gif': GIFS.still.gif })
    const r = await loadImage(io, '/s.gif')
    expect([r.via, r.frames, r.image.width]).toEqual(['gif', undefined, 24])
  })

  test('a long GIF keeps every nth frame, and the loop takes as long as before', async () => {
    // Build a GIF with more frames than we keep by repeating the bounce's frame blocks.
    const src = Uint8Array.fromBase64(GIFS.bounce.gif)
    const header = src.subarray(0, 13 + 3 * (1 << ((src[10] & 7) + 1)))
    const body = src.subarray(header.length, src.length - 1)
    const copies = Math.ceil((MAX_FRAMES * 2 + 5) / 6)
    const big = new Uint8Array(header.length + body.length * copies + 1)
    big.set(header)
    for (let i = 0; i < copies; i++) big.set(body, header.length + i * body.length)
    big[big.length - 1] = 0x3b
    const r = loadGif(big)
    expect(r.frames!.length).toBeLessThanOrEqual(MAX_FRAMES)
    expect(r.delays!.reduce((a, b) => a + b, 0)).toBe(550 * copies)
  })

  test('a GIF over 4 MB (more than one read allows) is read in pieces with split, and the pieces are removed', async () => {
    const src = Uint8Array.fromBase64(GIFS.bounce.gif)
    const header = src.subarray(0, 13 + 3 * (1 << ((src[10] & 7) + 1)))
    const body = src.subarray(header.length, src.length - 1)
    const copies = Math.ceil((4.3 * 1024 * 1024) / body.length)
    const big = new Uint8Array(header.length + body.length * copies + 1)
    big.set(header)
    for (let i = 0; i < copies; i++) big.set(body, header.length + i * body.length)
    big[big.length - 1] = 0x3b
    const files: Record<string, string> = {}
    const runs: string[][] = []
    const io: Io = {
      readBase64: async (p) => { if (!(p in files) && p !== '/big.gif') throw new Error('ENOENT'); if (p === '/big.gif') throw new Error('over 4 MiB'); return { base64: files[p] } },
      tmpdir: async () => '/tmp',
      size: async () => big.length,
      run: async (argv) => {
        runs.push(argv)
        if (argv[0] === 'split') {
          const n = Number(argv[2]), prefix = argv[4]
          for (let i = 0, k = 0; i < big.length; i += n, k++) files[prefix + String.fromCharCode(97 + Math.floor(k / 26), 97 + (k % 26))] = big.subarray(i, i + n).toBase64()
        }
        if (argv[0] === 'rm') for (const f of argv.slice(2)) delete files[f]
        return { exitCode: 0, stdout: '', stderr: '' }
      },
    }
    const r = await loadImage(io, '/big.gif')
    expect(r.via).toBe('gif')
    expect(r.frames!.length).toBeGreaterThan(1)
    expect(runs.map((a) => a[0])).toEqual(['split', 'rm'])
    expect(Object.keys(files)).toEqual([])                      // every piece deleted
  })

  test('a still over 4 MB goes straight to the OS tool, which reads it itself', async () => {
    const { io, runs } = fakeIo({}, () => 0)
    io.size = async () => 9 * 1024 * 1024
    const r = await loadImage(io, '/huge.png')
    expect(r.via).toBe('sips')
    expect(runs[0][0]).toBe('sips')
  })
})
