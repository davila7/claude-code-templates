import { test, expect } from 'claude-code/testing'
import { frameGrid, SCENE_NAMES, W } from '../hooks/scenes'
import { CELL_H, CELL_W, gridToSvg } from '../hooks/svg'

test('a block cell becomes rects tiling its quarters, with no text', () => {
  const svg = gridToSvg([[{ ch: '▛', color: '#fff' }]])
  expect((svg.match(/<rect/g) ?? []).length).toBe(3)
  expect(svg).not.toContain('<text')
  expect(svg).toContain(`width="${CELL_W}" height="${CELL_H}"`)
})

test('other glyphs are escaped text, a wide one centred over its two cells', () => {
  const svg = gridToSvg([[{ ch: '閃', color: 'red' }, { ch: '' }, { ch: '<', color: 'red' }]])
  expect(svg).toContain(`x="${CELL_W}"`)
  expect(svg).toContain('&lt;')
})

test('every scene draws to well-formed svg at the stage size', () => {
  for (const name of SCENE_NAMES) {
    const svg = gridToSvg(frameGrid('Xyzzy', 'requesting', 3, W, name))
    expect(svg.startsWith('<svg') && svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain(`width="${W * CELL_W}"`)
  }
})
