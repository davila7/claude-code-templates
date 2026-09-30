import { expect, test } from 'bun:test'
import { newSnake, step as snakeStep, turn, type Pt } from '../hooks/games/snake.ts'
import { cells, drop, newTetris, rotate, shift, type TetrisGame } from '../hooks/games/tetris.ts'
import { move, slide, type G2048 } from '../hooks/games/twenty48.ts'
import { flag, newMines, reveal } from '../hooks/games/mines.ts'

const zero = () => 0

test('snake', () => {
  const g = newSnake(10, 5, zero)
  expect(g.snake).toEqual([[2, 2], [1, 2], [0, 2]])
  expect(g.food).toEqual([0, 0])
  // one cell per tick, same length
  expect(snakeStep(g, zero).snake).toEqual([[3, 2], [2, 2], [1, 2]])
  // turning back into the neck is ignored; a real turn applies on the next tick
  expect(turn(g, 'left')).toBe(g)
  expect(snakeStep(turn(g, 'up'), zero).snake[0]).toEqual([2, 1])
  // food: grows, scores, and the new food lands on a free cell
  const fed = snakeStep({ ...g, food: [3, 2] }, zero)
  expect(fed.snake.length).toBe(4)
  expect(fed.score).toBe(1)
  expect(fed.food).toEqual([0, 0])
  // a wall ends it
  expect(snakeStep({ ...g, snake: [[9, 2], [8, 2], [7, 2]] }, zero).over).toBe(true)
  // moving into the tail cell being vacated is fine; into the body is not
  const four: Pt[] = [[1, 1], [2, 1], [2, 2], [1, 2]]
  expect(snakeStep({ ...g, snake: four, dir: [0, 1] }, zero).over).toBe(false)
  const five: Pt[] = [[1, 1], [2, 1], [2, 2], [1, 2], [0, 2]]
  expect(snakeStep({ ...g, snake: five, dir: [0, 1] }, zero).over).toBe(true)
})

test('tetris', () => {
  const g = newTetris(10, 20, zero)
  // an I piece spawns centred, flat on the second row of its box
  expect(cells(g.piece)).toEqual([[3, 1], [4, 1], [5, 1], [6, 1]])
  // shifting stops at the wall
  const left = shift(shift(shift(g, -1), -1), -1)
  expect(left.piece.x).toBe(0)
  expect(shift(left, -1)).toBe(left)
  // rotating the I stands it up in its box's third column
  expect(cells(rotate(g).piece)).toEqual([[5, 0], [5, 1], [5, 2], [5, 3]])
  // a hard drop into a bottom row missing exactly the I's four cells clears it: 100 for the line,
  // 2 per row dropped (18)
  const board = g.board.map(row => [...row])
  board[19] = [1, 1, 1, 0, 0, 0, 0, 1, 1, 1]
  const cleared = drop({ ...g, board }, zero)
  expect(cleared.lines).toBe(1)
  expect(cleared.score).toBe(136)
  expect(cleared.board.every(row => row.every(c => c === 0))).toBe(true)
  // the round ends when the next piece has no room
  const tight: TetrisGame = { ...newTetris(10, 2, zero), piece: { kind: 1, rot: 0, x: 4, y: 0 } }
  expect(drop(tight, zero).over).toBe(true)
})

test('2048', () => {
  // equal neighbours merge once each, first pair first
  expect(slide([2, 2, 2, 2])).toEqual({ line: [4, 4, 0, 0], gained: 8 })
  expect(slide([2, 2, 4, 0])).toEqual({ line: [4, 4, 0, 0], gained: 4 })
  expect(slide([4, 0, 4, 8])).toEqual({ line: [8, 8, 0, 0], gained: 8 })
  const empty = Array<number>(16).fill(0)
  // a move that changes nothing returns the same game, with no new tile
  const still: G2048 = { cells: [2, ...empty.slice(1)], score: 0, over: false, won: false }
  expect(move(still, 'left', zero)).toBe(still)
  // a real move merges, scores, and adds a 2 on the first empty cell
  const pair: G2048 = { cells: [2, 2, ...empty.slice(2)], score: 0, over: false, won: false }
  const moved = move(pair, 'right', zero)
  expect(moved.cells.slice(0, 4)).toEqual([2, 0, 0, 4])
  expect(moved.score).toBe(4)
  // filling the last cell into a board with no merges ends the game
  const nearlyFull: G2048 = { cells: [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 0, 4, 2, 4], score: 0, over: false, won: false }
  const final = move(nearlyFull, 'left', zero)
  expect(final.cells.slice(12)).toEqual([4, 2, 4, 2])
  expect(final.over).toBe(true)
})

test('minesweeper', () => {
  // with rand = 0 the mines take the first cells outside the first click's area: 0, 1 and 2
  const g = reveal(newMines(5, 5, 3), 4, 4, zero)
  expect(g.tiles.slice(0, 3).every(t => t.mine)).toBe(true)
  expect(g.tiles[24].mine).toBe(false)
  // (0,1) touches the mines at (0,0) and (1,0)
  expect(g.tiles[5].n).toBe(2)
  // the first click's zero opens everything that is not a mine, which wins this board
  expect(g.tiles.filter(t => t.mine).every(t => !t.open)).toBe(true)
  expect(g.won).toBe(true)
  // a mine ends the round and shows every mine
  const boom = reveal({ ...g, won: false }, 0, 0, zero)
  expect(boom.over).toBe(true)
  expect(boom.tiles.filter(t => t.mine).every(t => t.open)).toBe(true)
  // a flagged cell does not open
  const flagged = flag(newMines(5, 5, 3), 0, 0)
  expect(flagged.tiles[0].flag).toBe(true)
  expect(reveal(flagged, 0, 0, zero)).toBe(flagged)
})
