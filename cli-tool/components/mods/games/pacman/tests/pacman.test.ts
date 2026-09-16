import { expect, test } from 'bun:test'
import { MAZE, newPacman, step, turn } from '../hooks/games/pacman.ts'

let seed = 42
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648

test('the maze is 19 wide, 126 pellets and 4 power pellets', () => {
  expect(MAZE.every(r => r.length === 19)).toBe(true)
  const g = newPacman()
  expect(g.pellets.size).toBe(126)
  expect(g.power.size).toBe(4)
})

test('walking left eats pellets and the ghosts leave the pen', () => {
  let g = turn(newPacman(), 'left')
  for (let i = 0; i < 6; i++) g = step(g, rnd)
  expect(g.score).toBeGreaterThan(0)
  expect(g.ghosts.filter(gh => MAZE[gh.pos[1]]![gh.pos[0]] !== 'G').length).toBeGreaterThanOrEqual(2)
})

test('the tunnel row wraps', () => {
  let g = newPacman()
  g = step({ ...g, pac: [0, 7], dir: 'left', wanted: 'left' }, rnd)
  expect(g.pac).toEqual([18, 7])
})

test('a random walk eventually loses its lives', () => {
  let g = newPacman()
  for (let i = 0; i < 4000 && !g.over; i++) g = step(turn(g, ['up', 'down', 'left', 'right'][Math.floor(rnd() * 4)]!), rnd)
  expect(g.over).toBe(true)
  expect(g.lives).toBe(0)
})
