import { expect, test } from 'bun:test'
import { fire, formation, newInvaders, step, wave } from '../hooks/games/invaders.ts'

test('a formation is two characters of code per alien, blanks left out', () => {
  const f = formation(['export function invaders() {', '  const wave = diff.added', '', '   '])
  expect(f[0]!.glyph).toBe('ex')
  expect(f.every(a => a.glyph.trim() !== '')).toBe(true)
  expect(new Set(f.map(a => a.pos[1])).size).toBe(2)
})

test('a shot straight up takes one alien', () => {
  let g = wave(newInvaders(), ['abcdef'], 'x.ts')
  expect(g.aliens.length).toBe(3)
  g = fire({ ...g, ship: g.aliens[0]!.pos[0] })
  for (let i = 0; i < 12; i++) g = step(g, () => 0.9)
  expect(g.aliens.filter(a => a.alive).length).toBe(2)
  expect(g.score).toBe(10)
})

test('a formation that lands ends the game; a cleared wave waits', () => {
  let g = wave(newInvaders(), ['zzzzzzzzzzzzzzzzzzzzzzzz'], 'z')
  for (let i = 0; i < 2000 && !g.over; i++) g = step(g, () => 0)
  expect(g.over).toBe(true)
  expect(wave(newInvaders(), ['', '  '], 'empty').cleared).toBe(true)
})
