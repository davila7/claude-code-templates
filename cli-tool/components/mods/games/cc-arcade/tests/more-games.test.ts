import { expect, test } from 'bun:test'
import { BIRD_X, flap, gapSize, newFlappy, tick as flappyTick } from '../hooks/games/flappy.ts'
import { newPong, nudge, place, tick as pongTick, WIN } from '../hooks/games/pong.ts'
import { accuracy, LINES, newTyping, press, wpm } from '../hooks/games/typing.ts'

const zero = () => 0

test('flappy', () => {
  const g = newFlappy(40, 12, zero)
  expect(g.y).toBe(6)
  expect(g.pipes).toEqual([{ x: 39, gap: 1 }])
  expect(gapSize(12)).toBe(4)
  // gravity pulls down; the pipes move a column left
  const fell = flappyTick(g, zero)
  expect(fell.y).toBeCloseTo(6.15)
  expect(fell.pipes[0].x).toBe(38)
  expect(fell.over).toBe(false)
  // a flap sends it up
  expect(flappyTick(flap(g), zero).y).toBeCloseTo(5.25)
  // the floor ends it; the ceiling only stops the bird
  expect(flappyTick({ ...g, y: 11.4, vy: 0.8 }, zero).over).toBe(true)
  const ceiling = flappyTick({ ...g, y: 0.2, vy: -0.9 }, zero)
  expect(ceiling).toMatchObject({ y: 0, vy: 0, over: false })
  // a pipe reaching the bird's column with the bird outside its opening ends it
  expect(flappyTick({ ...g, vy: -0.3, pipes: [{ x: BIRD_X + 1, gap: 0 }] }, zero).over).toBe(true)
  // through the opening: alive, and a point once the pipe is behind the bird
  const inGap = flappyTick({ ...g, vy: -0.3, pipes: [{ x: BIRD_X + 1, gap: 5 }] }, zero)
  expect(inGap.over).toBe(false)
  const passed = flappyTick({ ...inGap, vy: -0.3 }, zero)
  expect(passed.score).toBe(1)
  // a new pipe comes in once the last one is far enough left
  expect(flappyTick({ ...g, pipes: [{ x: 28, gap: 3 }] }, zero).pipes).toHaveLength(2)
})

test('pong', () => {
  const g = newPong(40, 12, zero)
  expect(g.pad).toBe(3)
  expect(g.you).toBe(4)
  expect(g.ball).toEqual({ x: 20, y: 6, dx: 1, dy: -0.5 })
  // the ball moves; the computer follows it while it comes its way, at most 0.6 rows a tick
  const moved = pongTick(g, zero)
  expect(moved.ball.x).toBe(21)
  expect(moved.ball.y).toBe(5.5)
  expect(moved.cpu).toBeCloseTo(4.5)
  // the top wall reflects
  const wall = pongTick({ ...g, ball: { x: 10, y: 0.2, dx: 1, dy: -0.5 } }, zero)
  expect(wall.ball.y).toBeCloseTo(0.3)
  expect(wall.ball.dy).toBe(0.5)
  // your paddle sends it back
  const hit = pongTick({ ...g, you: 4, ball: { x: 1, y: 5, dx: -1, dy: 0 } }, zero)
  expect(hit.ball.dx).toBe(1)
  expect(hit.scoreCpu).toBe(0)
  // a miss is a point for the computer, and the last point ends the match
  const miss = { ...g, you: 0, ball: { x: 1, y: 10, dx: -1, dy: 0 } }
  expect(pongTick(miss, zero).scoreCpu).toBe(1)
  expect(pongTick({ ...miss, scoreCpu: WIN - 1 }, zero).over).toBe(true)
  // the paddle stays on the board
  expect(place(g, 0).you).toBe(0)
  expect(place(g, 100).you).toBe(9)
  expect(nudge(g, -10).you).toBe(0)
})

test('typing', () => {
  const g = newTyping(zero)
  expect(g.text).toBe(LINES[0])
  // right and wrong characters; a wrong one stays until backspaced
  const right = press(g, g.text[0])
  expect(right).toEqual({ ...g, typed: g.text[0] })
  const wrong = press(right, '#')
  expect(wrong.errors).toBe(1)
  expect(press(wrong, 'backspace').typed).toBe(g.text[0])
  // special keys and anything past the end are ignored
  expect(press(g, 'tab')).toBe(g)
  const short = { text: 'ab', typed: '', errors: 0, done: false }
  expect(press(press(short, 'a'), 'b').done).toBe(true)
  expect(press({ ...short, typed: 'ab', done: false }, 'c').typed).toBe('ab')
  // five characters a word
  expect(wpm(50, 60_000)).toBe(10)
  expect(accuracy({ ...short, typed: 'ab', errors: 0 })).toBe(100)
  expect(accuracy({ ...short, typed: 'ab', errors: 2 })).toBe(50)
  // a line is chosen to fit the width when one does
  expect(newTyping(zero, 56).text.length).toBeLessThanOrEqual(56)
})
