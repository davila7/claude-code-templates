// Minesweeper: pure game logic, drawn by the Minesweeper module in ../surface.tsx.

export type Tile = { mine: boolean; open: boolean; flag: boolean; n: number }
export type Mines = { w: number; h: number; count: number; tiles: Tile[]; placed: boolean; over: boolean; won: boolean }

export const newMines = (w: number, h: number, count: number): Mines => ({
  w, h, count,
  tiles: Array.from({ length: w * h }, () => ({ mine: false, open: false, flag: false, n: 0 })),
  placed: false, over: false, won: false,
})

const inside = (g: Mines, x: number, y: number) => x >= 0 && y >= 0 && x < g.w && y < g.h

function around(g: Mines, x: number, y: number): number[] {
  const out: number[] = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && inside(g, x + dx, y + dy)) out.push((y + dy) * g.w + x + dx)
  }
  return out
}

// mines go in on the first reveal, never on that cell or next to it, so the first click opens an area
function place(g: Mines, x: number, y: number, rand: () => number): Tile[] {
  const safe = new Set([y * g.w + x, ...around(g, x, y)])
  const spots = g.tiles.map((_, i) => i).filter(i => !safe.has(i))
  const tiles = g.tiles.map(t => ({ ...t }))
  // a partial Fisher-Yates shuffle picks `count` distinct spots
  for (let k = 0; k < Math.min(g.count, spots.length); k++) {
    const j = k + Math.floor(rand() * (spots.length - k))
    ;[spots[k], spots[j]] = [spots[j], spots[k]]
    tiles[spots[k]].mine = true
  }
  tiles.forEach((t, i) => { t.n = around(g, i % g.w, Math.floor(i / g.w)).filter(j => tiles[j].mine).length })
  return tiles
}

// open a cell: a mine ends the round and shows every mine; a zero opens its whole empty area
export function reveal(g: Mines, x: number, y: number, rand = Math.random): Mines {
  if (g.over || g.won || !inside(g, x, y)) return g
  const start = y * g.w + x
  if (g.tiles[start].flag || g.tiles[start].open) return g
  const tiles = g.placed ? g.tiles.map(t => ({ ...t })) : place(g, x, y, rand)
  if (tiles[start].mine) {
    tiles.forEach(t => { if (t.mine) t.open = true })
    return { ...g, tiles, placed: true, over: true }
  }
  const stack = [start]
  while (stack.length) {
    const i = stack.pop()!
    const t = tiles[i]
    if (t.open || t.flag) continue
    t.open = true
    if (t.n === 0) stack.push(...around(g, i % g.w, Math.floor(i / g.w)))
  }
  return { ...g, tiles, placed: true, won: tiles.every(t => t.mine || t.open) }
}

export function flag(g: Mines, x: number, y: number): Mines {
  if (g.over || g.won || !inside(g, x, y) || g.tiles[y * g.w + x].open) return g
  const tiles = g.tiles.map((t, i) => (i === y * g.w + x ? { ...t, flag: !t.flag } : t))
  return { ...g, tiles }
}
