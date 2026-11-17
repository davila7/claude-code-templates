// The stage as an SVG, for the surfaces that draw text in a proportional face with line gaps
// (Desktop, VS Code): block characters are drawn as rects, so rows tile whatever the font does.
import { QUARTERS, type Grid } from './scenes'

export const CELL_W = 4
export const CELL_H = 8
const FALLBACK = '#CCCCCC' // a glyph with no colour of its own
const LOWER: Record<string, number> = { '▁': 1, '▂': 2, '▃': 3, '▅': 5, '▆': 6, '▇': 7 } // eighths filled from the bottom
// where each quarter sits in a cell: [x, y] in halves
const QUARTER_AT: Record<string, [number, number]> = { a: [0, 0], b: [1, 0], c: [0, 1], d: [1, 1] }

const rect = (x: number, y: number, w: number, h: number, fill: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Wide characters (CJK, emoji) are followed by an empty cell; they take its width too. */
const cellsOf = (ch: string, next?: string) => (next === '' ? 2 : 1)

/** One frame's grid as `<svg>` markup, `CELL_W` x `CELL_H` pixels a cell. */
export const gridToSvg = (grid: Grid): string => {
  const cols = grid[0]?.length ?? 0
  const parts: string[] = []
  grid.forEach((row, y) => {
    const top = y * CELL_H
    row.forEach((c, x) => {
      const left = x * CELL_W
      if (c.bg) parts.push(rect(left, top, CELL_W, CELL_H, c.bg))
      const fill = c.color ?? FALLBACK
      const quarters = QUARTERS[c.ch]
      if (quarters) {
        for (const q of quarters) {
          const [qx, qy] = QUARTER_AT[q]
          parts.push(rect(left + (qx * CELL_W) / 2, top + (qy * CELL_H) / 2, CELL_W / 2, CELL_H / 2, fill))
        }
      } else if (LOWER[c.ch]) {
        const h = (LOWER[c.ch] * CELL_H) / 8
        parts.push(rect(left, top + CELL_H - h, CELL_W, h, fill))
      } else if (c.ch.trim() !== '') {
        const span = cellsOf(c.ch, row[x + 1]?.ch)
        parts.push(
          `<text x="${left + (span * CELL_W) / 2}" y="${top + CELL_H * 0.75}" fill="${fill}" font-family="monospace" font-size="${CELL_H * 0.8}" text-anchor="middle">${escape(c.ch)}</text>`,
        )
      }
    })
  })
  const w = cols * CELL_W
  const h = grid.length * CELL_H
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`
}
