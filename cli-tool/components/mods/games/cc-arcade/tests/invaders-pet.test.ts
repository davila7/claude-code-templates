import { expect, test } from 'bun:test'
import { fire, newInvaders, shift, tick, type InvadersGame } from '../hooks/games/invaders.ts'
import { feed, feeling, level, moodAt, newPet, petEvent, stage } from '../hooks/games/pet.ts'

// rand ≥ 0.12 never drops a bomb
const calm = () => 0.99

test('invaders', () => {
  const g = newInvaders(30, 14)
  expect(g.aliens).toHaveLength(24)
  expect(g.aliens[0]).toEqual([7, 1])
  expect(g.ship).toBe(15)
  // the ship stays on the board; one shot at a time, fired from just above the ship
  expect(shift(g, -100).ship).toBe(0)
  expect(fire(fire(g)).shots).toEqual([[15, 12]])
  // a shot moving into an alien removes both and scores 10
  const hit = tick({ ...g, shots: [[7, 4]] }, calm)
  expect(hit.aliens).toHaveLength(23)
  expect(hit.score).toBe(10)
  expect(hit.shots).toEqual([])
  // on its step tick (every 8 ticks with 24 aliens) the formation moves a cell toward its direction
  expect(tick({ ...g, ticks: 7 }, calm).aliens[0]).toEqual([8, 1])
  // at an edge it drops a row and turns around
  const atEdge: InvadersGame = { ...g, ticks: 7, aliens: [[29, 1], [27, 1]] }
  const turned = tick(atEdge, () => 0.5)
  expect(turned.aliens[0]).toEqual([29, 2])
  expect(turned.dir).toBe(-1)
  // a bomb landing on the ship costs a life and clears the bombs; the last life ends the round
  const bombed = tick({ ...g, bombs: [[15, 12]] }, calm)
  expect(bombed.lives).toBe(2)
  expect(bombed.bombs).toEqual([])
  expect(tick({ ...g, lives: 1, bombs: [[15, 12]] }, calm).over).toBe(true)
  // aliens reaching the ship's row end it
  expect(tick({ ...g, aliens: [[3, 13]] }, calm).over).toBe(true)
  // shooting the last alien brings the next wave, a row lower
  const cleared = tick({ ...g, aliens: [[7, 3]], shots: [[7, 4]] }, calm)
  expect(cleared.wave).toBe(2)
  expect(cleared.aliens).toHaveLength(24)
  expect(cleared.aliens[0]).toEqual([7, 2])
})

test('pet events', () => {
  expect(petEvent('Bash', 'bun test', true)).toBe('test-pass')
  expect(petEvent('Bash', 'bun test', false)).toBe('test-fail')
  expect(petEvent('Bash', 'npx vitest run src', true)).toBe('test-pass')
  expect(petEvent('Bash', 'go test ./...', false)).toBe('test-fail')
  expect(petEvent('Bash', './gradlew test --info', true)).toBe('test-pass')
  expect(petEvent('Bash', 'git commit -m "fix: retry"', true)).toBe('commit')
  expect(petEvent('Bash', 'git commit -m "fix: retry"', false)).toBeUndefined()
  expect(petEvent('Bash', 'git commit --dry-run', true)).toBeUndefined()
  expect(petEvent('Bash', 'ls -la', true)).toBeUndefined()
  expect(petEvent('Edit', undefined, true)).toBe('edit')
  expect(petEvent('Edit', undefined, false)).toBeUndefined()
  // a denied call feeds nothing
  expect(petEvent('Bash', 'bun test', undefined)).toBeUndefined()
})

test('pet growth and mood', () => {
  const egg = newPet(0)
  expect(stage(egg.xp)).toBe('egg')
  const fed = feed(egg, 'test-pass', 0)
  expect(fed).toMatchObject({ xp: 10, mood: 78, tests: 1, last: 'test-pass' })
  expect(stage(fed.xp)).toBe('baby')
  expect(feed(fed, 'test-fail', 0)).toMatchObject({ mood: 66, fails: 1 })
  // level n needs 10·n² xp
  expect(level(39)).toBe(1)
  expect(level(40)).toBe(2)
  expect(stage(90)).toBe('kid')
  expect(stage(360)).toBe('adult')
  expect(stage(1000)).toBe('legend')
  // idle mood sinks a point every ten minutes, to bored (30) and no lower
  expect(moodAt({ ...egg, mood: 80 }, 60 * 60_000)).toBe(74)
  expect(moodAt({ ...egg, mood: 35 }, 10 * 60 * 60_000)).toBe(30)
  expect(moodAt({ ...egg, mood: 20 }, 10 * 60 * 60_000)).toBe(20)
  expect(feeling(78)).toBe('happy')
  expect(feeling(50)).toBe('okay')
  expect(feeling(20)).toBe('sad')
})
