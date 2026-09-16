import { expect, test } from 'bun:test'
import { pickAuto, pickRandom } from '../hooks/games/auto.ts'

const zero = () => 0

test('random', () => {
  // never the game just played, unless it is the only one
  expect(pickRandom(['snake', 'tetris'], 'snake', zero)).toBe('tetris')
  expect(pickRandom(['snake'], 'snake', zero)).toBe('snake')
  expect(pickRandom(['snake', 'tetris'], undefined, () => 0.99)).toBe('tetris')
})

test('auto', () => {
  // tests that failed in the last five minutes send you to the pet
  expect(pickAuto({ working: true, turnMs: 90_000, lastEvent: 'test-fail', lastEventAgoMs: 60_000 }, zero).game).toBe('pet')
  // an older failure does not
  expect(pickAuto({ working: false, turnMs: 0, lastEvent: 'test-fail', lastEventAgoMs: 10 * 60_000 }, zero).game).toBe('2048')
  // a long turn: a longer game, with the minutes in the reason
  const long = pickAuto({ working: true, turnMs: 125_000 }, zero)
  expect(long.game).toBe('tetris')
  expect(long.reason).toContain('2 min')
  // a short turn: a quick round, not the game just played
  expect(pickAuto({ working: true, turnMs: 20_000 }, zero).game).toBe('flappy')
  expect(pickAuto({ working: true, turnMs: 20_000, lastGame: 'flappy' }, zero).game).toBe('pong')
  // Claude idle: a game you can put down
  expect(['2048', 'minesweeper']).toContain(pickAuto({ working: false, turnMs: 0 }, Math.random).game)
})
