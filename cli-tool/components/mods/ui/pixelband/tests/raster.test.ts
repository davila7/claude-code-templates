import { describe, expect, test, tier } from 'claude-code/testing'
import { TRANSPARENT } from '../hooks/pixelate'
import { cellsFor, DEFAULT, quadCellsFor, rowsFor } from '../hooks/raster'

tier('user')

const decode = (b64: string) => Array.from(new Uint32Array(Uint8Array.fromBase64(b64).buffer))

describe('raster', () => {
  test('two pixels per cell: top as the upper-half block, bottom as its background', async () => {
    const art = { w: 1, h: 2, px: Uint32Array.of(0xff0000, 0x0000ff) }
    expect(decode(cellsFor(art))).toEqual([0x2580, 0xff0000, 0x0000ff])
  })

  test('transparent pixels show the terminal behind them', async () => {
    const art = { w: 3, h: 2, px: Uint32Array.of(TRANSPARENT, 0x00ff00, TRANSPARENT, 0x00ff00, TRANSPARENT, TRANSPARENT) }
    expect(decode(cellsFor(art))).toEqual([
      0x2584, 0x00ff00, DEFAULT,   // only the bottom is drawn: lower-half block
      0x2580, 0x00ff00, DEFAULT,   // only the top is drawn: upper-half block
      0x20, DEFAULT, DEFAULT,      // nothing: a plain space
    ])
  })

  test('an odd number of pixel rows leaves the last cell half empty', async () => {
    expect(rowsFor(5)).toBe(3)
    const art = { w: 1, h: 3, px: Uint32Array.of(1, 2, 3) }
    expect(decode(cellsFor(art)).slice(3)).toEqual([0x2580, 3, DEFAULT])
  })
})

describe('quadCellsFor', () => {
  const R = 0xff0000, B = 0x0000ff, G = 0x00ff00
  const decode = (b64: string) => Array.from(new Uint32Array(Uint8Array.fromBase64(b64).buffer))

  test('four pixels per cell: a diagonal becomes one quadrant glyph', async () => {
    // TL=R TR=B / BL=B BR=R -> the red diagonal is TL+BR (mask 9, '▚'), blue behind it
    expect(decode(quadCellsFor({ w: 2, h: 2, px: Uint32Array.of(R, B, B, R) }))).toEqual([0x259a, R, B])
  })

  test('three colours in a cell: the odd one out joins the closest group', async () => {
    const [glyph, fg, bg] = decode(quadCellsFor({ w: 2, h: 2, px: Uint32Array.of(R, R, B, 0x0000ee) }))
    expect([glyph, fg]).toEqual([0x2580, R])                  // top half red...
    expect([B, 0x0000ee]).toContain(bg)                       // ...over one of the blues, a colour the art has
  })

  test('see-through pixels go to the background and show the terminal', async () => {
    expect(decode(quadCellsFor({ w: 2, h: 2, px: Uint32Array.of(G, TRANSPARENT, TRANSPARENT, TRANSPARENT) }))).toEqual([0x2598, G, DEFAULT])
    expect(decode(quadCellsFor({ w: 2, h: 2, px: new Uint32Array(4).fill(TRANSPARENT) }))).toEqual([0x20, DEFAULT, DEFAULT])
  })

  test('columns are half the pixel width, rows half the height', async () => {
    expect(decode(quadCellsFor({ w: 6, h: 4, px: new Uint32Array(24).fill(R) })).length).toBe(3 * 2 * 3)
  })
})
