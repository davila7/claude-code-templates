// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
// The tuner's band over the tree a plugin beneath drew for the same site. Pure: no `$`.
//
// The AbovePrompt site draws one tree, so a hook that never calls `next(e)` hides every plugin beneath it.
// `next(e)` resolves to what those draw; the band is returned above it. (Adapted from session-healthbar's
// hooks/pure/stack.ts: plugins cannot import each other, so the few lines needed are copied here.)
import type { Elements, RenderElement } from 'claude-code'

type Els = Pick<Elements['terminal'] | Elements['desktop'], 'Box'>

/** The rows the band takes: it is one row (`height={1}` in view.tsx, held to it by a test). */
export const BAND_ROWS = 1

/** What `next(e)` gave, when it is a tree we can stack on: an object that names an element type. */
export const isElement = (x: unknown): x is RenderElement =>
  typeof x === 'object' && x !== null && typeof (x as { type?: unknown }).type === 'string'

const childrenOf = (el: RenderElement): readonly unknown[] => {
  const kids = (el as { children?: unknown }).children

  return Array.isArray(kids) ? kids.flat(Infinity) : []
}

const lineCount = (s: string): number => s.split('\n').length

/** The text a Text node holds: its strings, and the strings of the inline elements inside it. */
const textOf = (n: unknown): string => {
  if (typeof n === 'string') return n
  if (typeof n === 'number') return String(n)

  return isElement(n) ? childrenOf(n).map(textOf).join('') : ''
}

/**
 * How many rows a tree takes, estimated from its shape alone: a Text is one row plus one per newline; a
 * column Box the sum of its children, a row Box the tallest; any other element (a Button, an Input) one row.
 * Borders, padding and wrapping are not counted, so this can undercount.
 */
export const rowsOf = (tree: unknown): number => {
  if (typeof tree === 'string') return lineCount(tree)
  if (typeof tree === 'number') return 1
  if (!isElement(tree)) return 1
  if (tree.type === 'Text') return lineCount(textOf(tree))
  if (tree.type !== 'Box') return 1

  const rows = childrenOf(tree).map(rowsOf)
  const direction = String((tree.props as { flexDirection?: unknown } | undefined)?.flexDirection)
  const isColumn = direction === 'column' || direction === 'column-reverse'

  return isColumn ? rows.reduce((a, b) => a + b, 0) : Math.max(0, ...rows)
}

/** Whether `next(e)` gave a tree with something to draw: an empty Box is as good as nothing. */
export const hasRows = (below: unknown): below is RenderElement => isElement(below) && rowsOf(below) > 0

/** The rows the plugins beneath may take: what the site has, less the band's own; at least one. */
export const rowsLeft = (maxRows: number): number => Math.max(1, maxRows - BAND_ROWS)

/** The band over the tree beneath, one column; the band alone when nothing to draw came back. */
export const stacked = ({ Box }: Els, band: RenderElement, below: unknown): RenderElement =>
  hasRows(below) ? Box({ flexDirection: 'column', children: [band, below] }) : band
