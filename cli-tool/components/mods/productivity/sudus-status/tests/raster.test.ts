import { expect, test } from 'bun:test'
import { SUDUS_SVG, EXPRESSIONS } from '../hooks/faces.ts'
import { base64Of, polygonsOfPath, rasterOf, shapesOf } from '../hooks/raster.ts'

test('a path with M, C and Z becomes one closed polygon', () => {
  const polys = polygonsOfPath('M10 10C20 10 20 20 10 20Z')
  expect(polys.length).toBe(1)
  expect(polys[0]!.length).toBeGreaterThan(4)
})

test('the six faces each hold the background, the body, two blobs and two eyes', () => {
  for (const x of EXPRESSIONS) {
    const { shapes, size } = shapesOf(SUDUS_SVG[x])
    expect(size).toBe(100)
    expect(shapes.length).toBeGreaterThanOrEqual(5)
    expect(shapes[0]!.fill).toEqual([0xee, 0xf6, 0xf1])
  }
})

test('the raster is opaque where the squircle is and the body is green in the middle', () => {
  const r = rasterOf(SUDUS_SVG.idle, 48)
  expect(r.width).toBe(48)
  const bytes = Uint8Array.from(atob(r.rgba), c => c.charCodeAt(0))
  expect(bytes.length).toBe(48 * 48 * 4)
  const at = (x: number, y: number) => Array.from(bytes.subarray((y * 48 + x) * 4, (y * 48 + x) * 4 + 4))
  expect(at(24, 24).slice(0, 3)).toEqual([0x9f, 0xe3, 0xbe])
  expect(at(24, 24)[3]).toBe(255)
  expect(at(0, 0)[3]).toBe(0)
})

test('base64 matches the platform encoder', () => {
  const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 253])
  expect(base64Of(bytes)).toBe(btoa(String.fromCharCode(...bytes)))
})
