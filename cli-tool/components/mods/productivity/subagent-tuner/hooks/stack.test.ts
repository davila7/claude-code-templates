// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
// The pure half of stacking the band over the tree a plugin beneath drew: the row estimate, the rows left, the column.
import { expect, test } from 'claude-code/testing'
import { BAND_ROWS, hasRows, isElement, rowsLeft, rowsOf, stacked } from './stack'

type N = { type: string; props?: Record<string, unknown>; children?: unknown[] }
const text = (...children: unknown[]): N => ({ type: 'Text', children })
const box = (flexDirection: string | undefined, ...children: unknown[]): N => ({
  type: 'Box',
  ...(flexDirection === undefined ? {} : { props: { flexDirection } }),
  children,
})
const col = (...children: unknown[]) => box('column', ...children)
const row = (...children: unknown[]) => box('row', ...children)
const button: N = { type: 'Button', props: { key: 'b', label: 'Go' } }

test('rowsOf: a Text is one row plus one per newline, inline Texts and numbers included', () => {
  const cases: [string, unknown, number][] = [
    ['plain Text', text('a'), 1],
    ['empty Text', text(), 1],
    ['two newlines', text('a\nb\nc'), 3],
    ['trailing newline', text('a\n'), 2],
    ['inline Text holding a newline', text('a', text('b\nc')), 2],
    ['a number child', text(7), 1],
    ['a bare string', 'x\ny', 2],
  ]

  for (const [name, tree, rows] of cases) {
    expect([name, rowsOf(tree)]).toEqual([name, rows])
  }
})

test('rowsOf: a column Box sums its children, a row Box takes the tallest, an empty one draws nothing', () => {
  const two = text('a\nb')
  const cases: [string, unknown, number][] = [
    ['column of 1 and 2 rows', col(text('a'), two), 3],
    ['column-reverse sums too', box('column-reverse', text('a'), two), 3],
    ['row of 1 and 2 rows', row(text('a'), two), 2],
    ['no direction is a row', box(undefined, text('a'), two), 2],
    ['a health row: Text then Button', row(text('health 68% '), button), 1],
    ['nested columns', col(col(text('a'), text('b')), col(text('c'))), 3],
    ['column holding bare strings', col('a', 'b\nc'), 3],
    ['a row beside a tall column', row(col(text('a'), text('b'), text('c')), text('x')), 3],
    ['an empty column', col(), 0],
    ['an empty row', row(), 0],
    ['no direction, no children', { type: 'Box' }, 0],
    ['a column of empty Boxes', col(col(), row()), 0],
  ]

  for (const [name, tree, rows] of cases) {
    expect([name, rowsOf(tree)]).toEqual([name, rows])
  }
})

test('rowsOf: any other element, or what is no element, is one row', () => {
  for (const tree of [button, { type: 'Image' }, { type: 'Input', props: { key: 'i' } }, {}, null, undefined, 42, true]) {
    expect(rowsOf(tree)).toBe(1)
  }

  expect(rowsOf(col(button, { type: 'Mystery' }, text('a')))).toBe(3)
})

test('isElement and hasRows: only an object naming a type that draws a row is a tree to stack on', () => {
  for (const x of [undefined, null, 'band', 42, true, {}, { type: 1 }, [], [text('a')]]) {
    expect(isElement(x)).toBe(false)
    expect(hasRows(x)).toBe(false)
  }

  expect(isElement(col())).toBe(true)
  expect(hasRows(col())).toBe(false)
  expect(hasRows(row(col()))).toBe(false)
  expect(hasRows(text('a'))).toBe(true)
  expect(hasRows(button)).toBe(true)
})

test('rowsLeft: the site less the band row, never under one', () => {
  const cases: [number, number][] = [
    [17, 16],
    [3, 2],
    [2, 1],
    [1, 1],
    [0, 1],
    [-4, 1],
  ]

  for (const [maxRows, left] of cases) {
    expect([maxRows, rowsLeft(maxRows)]).toEqual([maxRows, left])
  }

  expect(BAND_ROWS).toBe(1)
})

// A stand-in for the surface's Box constructor: the plain-data element it makes.
const Box = ((props: { children?: unknown[] } & Record<string, unknown>) => {
  const { children, ...rest } = props

  return { type: 'Box', props: rest, children }
}) as never

test('stacked: a column of the band, then the tree beneath; the band itself when there is nothing to draw', () => {
  const band = row(text('Tuner '), button) as never
  const below = row(text('health '), button)

  expect(stacked({ Box }, band, below)).toEqual({ type: 'Box', props: { flexDirection: 'column' }, children: [band, below] })

  for (const nothing of [undefined, null, 'x', 7, {}, col(), row(col())]) {
    expect(stacked({ Box }, band, nothing)).toBe(band)
  }
})
