// 2048: pure game logic, drawn by the Twenty48 module in ../surface.tsx.

export const SIZE = 4
export type G2048 = { cells: number[]; score: number; over: boolean; won: boolean }

// slide one line toward its start: equal neighbours merge once each, first pair first
export function slide(line: number[]): { line: number[]; gained: number } {
  const tiles = line.filter(v => v !== 0)
  const out: number[] = []
  let gained = 0
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2)
      gained += tiles[i] * 2
      i++
    } else {
      out.push(tiles[i])
    }
  }
  while (out.length < line.length) out.push(0)
  return { line: out, gained }
}

// the cell indices of every line, each listed from the edge the tiles slide toward
function linesFor(dir: string): number[][] {
  const r = [...Array(SIZE).keys()]
  switch (dir) {
    case 'left': return r.map(y => r.map(x => y * SIZE + x))
    case 'right': return r.map(y => r.map(x => y * SIZE + (SIZE - 1 - x)))
    case 'up': return r.map(x => r.map(y => y * SIZE + x))
    case 'down': return r.map(x => r.map(y => (SIZE - 1 - y) * SIZE + x))
    default: return []
  }
}

// a 2 (nine times in ten) or a 4 on a random empty cell
function addTile(cells: number[], rand: () => number): number[] {
  const empty = cells.flatMap((v, i) => (v ? [] : [i]))
  if (!empty.length) return cells
  const next = [...cells]
  next[empty[Math.floor(rand() * empty.length)]] = rand() < 0.9 ? 2 : 4
  return next
}

const canMove = (cells: number[]) =>
  cells.some((v, i) => v === 0 || (i % SIZE < SIZE - 1 && v === cells[i + 1]) || (i + SIZE < cells.length && v === cells[i + SIZE]))

export function new2048(rand = Math.random): G2048 {
  return { cells: addTile(addTile(Array<number>(SIZE * SIZE).fill(0), rand), rand), score: 0, over: false, won: false }
}

// a move that changes nothing is not a move: no new tile, same game back
export function move(g: G2048, dir: string, rand = Math.random): G2048 {
  const lines = linesFor(dir)
  if (g.over || !lines.length) return g
  const cells = [...g.cells]
  let gained = 0
  for (const idx of lines) {
    const slid = slide(idx.map(i => g.cells[i]))
    idx.forEach((i, k) => { cells[i] = slid.line[k] })
    gained += slid.gained
  }
  if (cells.every((v, i) => v === g.cells[i])) return g
  const next = addTile(cells, rand)
  return { cells: next, score: g.score + gained, won: g.won || next.includes(2048), over: !canMove(next) }
}
