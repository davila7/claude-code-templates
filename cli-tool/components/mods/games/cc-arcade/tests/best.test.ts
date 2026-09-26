import { expect, test } from 'bun:test'
import { isBetter } from '../hooks/games/best.ts'

test('best scores', () => {
  // higher wins, and the first real score always counts
  expect(isBetter(10, undefined)).toBe(true)
  expect(isBetter(10, 5)).toBe(true)
  expect(isBetter(5, 10)).toBe(false)
  expect(isBetter(10, 10)).toBe(false)
  // minesweeper: the fastest clear wins
  expect(isBetter(30, undefined, true)).toBe(true)
  expect(isBetter(20, 30, true)).toBe(true)
  expect(isBetter(40, 30, true)).toBe(false)
  // a zero (a board cleared by its first click) never counts, and never locks the best
  expect(isBetter(0, undefined, true)).toBe(false)
  expect(isBetter(12, 0, true)).toBe(true)
  // a lost Pong match posts a negative margin
  expect(isBetter(-3, undefined)).toBe(false)
  expect(isBetter(-3, 2)).toBe(false)
})
