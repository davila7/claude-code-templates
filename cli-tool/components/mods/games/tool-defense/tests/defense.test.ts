import { expect, test } from 'bun:test'
import { BASE, build, kindOf, newDefense, PATH, spawn, step } from '../hooks/games/defense.ts'

let seed = 7
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648

test('tools become kinds', () => {
  expect(['Bash', 'Edit', 'WebFetch', 'Agent', 'Read'].map(kindOf)).toEqual(['runner', 'tank', 'flyer', 'boss', 'scout'])
  expect(kindOf('mcp__github__list_issues')).toBe('flyer')
})

test('towers cost gold and cannot stand on the road', () => {
  let g = newDefense()
  g = build(g, [3, 2]).game
  g = build(g, [3, 0]).game
  expect(g.towers.length).toBe(2)
  expect(g.gold).toBe(10)
  expect(build(g, PATH[5]!).note).toBe('not on the road')
  expect(build(g, [5, 5]).note).toContain('costs')
})

test('towers kill what walks past them', () => {
  let g = build(newDefense(), [3, 2]).game
  g = spawn(g, 'Bash')
  for (let i = 0; i < 60; i++) g = step(g, rnd)
  expect(g.kills).toBe(1)
})

test('an undefended base falls after ten enemies', () => {
  let g = newDefense()
  for (let i = 0; i < 12; i++) g = spawn(g, 'Bash')
  for (let i = 0; i < 400 && !g.over; i++) g = step(g, () => 0.9)
  expect(g.over).toBe(true)
  expect(BASE).toEqual(PATH[PATH.length - 1]!)
})
