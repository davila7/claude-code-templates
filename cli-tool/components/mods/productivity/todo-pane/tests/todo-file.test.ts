import { describe, expect, test } from 'claude-code/testing'

import { add, openCount, parse, remove, setText, toFile, toggle, toLines } from '../hooks/todo-file.ts'

const FILE = [
  '# Todo',
  '',
  '- [ ] buy milk',
  '- [x] pay rent',
  '* [ ] call mum',
  '  - [X] nested done',
  'free text, not a task',
  '- [ ]',
  '- [] not a checkbox',
  '',
].join('\n')

describe('todo-file', () => {
  test('a file round-trips byte for byte', () => {
    expect(toFile(toLines(FILE))).toBe(FILE)
    expect(toFile(toLines('a\r\n- [ ] b\r\n'))).toBe('a\r\n- [ ] b\r\n')
  })

  test('parses checkbox lines and keeps the rest as text', () => {
    const lines = parse(toLines(FILE))
    expect(lines.filter(line => line.kind === 'task').map(line => line.index)).toEqual([2, 3, 4, 5, 7])
    expect(lines[4]).toEqual({ kind: 'task', index: 4, isDone: false, text: 'call mum' })
    expect(lines[5]).toEqual({ kind: 'task', index: 5, isDone: true, text: 'nested done' })
    expect(lines[8]).toEqual({ kind: 'other', index: 8, text: '- [] not a checkbox' })
    expect(lines).toHaveLength(9)
    expect(openCount(toLines(FILE))).toBe(3)
  })

  test('toggle, edit and delete change only the line they touch', () => {
    const lines = toLines(FILE)
    const changedAt = (next: string[]) => next.flatMap((raw, i) => (raw === lines[i] ? [] : [i]))

    expect(toggle(lines, 2)[2]).toBe('- [x] buy milk')
    expect(changedAt(toggle(lines, 2))).toEqual([2])
    expect(toggle(lines, 5)[5]).toBe('  - [ ] nested done')
    expect(toggle(lines, 0)).toEqual(lines)

    expect(setText(lines, 4, 'call dad')[4]).toBe('* [ ] call dad')
    expect(changedAt(setText(lines, 4, 'call dad'))).toEqual([4])
    expect(setText(lines, 7, 'filled')[7]).toBe('- [ ] filled')

    expect(remove(lines, 3)).toEqual([...lines.slice(0, 3), ...lines.slice(4)])
  })

  test('add appends before the final newline, or starts a missing file', () => {
    expect(toFile(add(toLines(FILE), 'new'))).toBe(`${FILE}- [ ] new\n`)
    expect(toFile(add(toLines('# Todo'), 'new'))).toBe('# Todo\n- [ ] new')
    expect(toFile(add(null, 'first'))).toBe('- [ ] first\n')
    expect(toFile(add(toLines(''), 'first'))).toBe('- [ ] first\n')
    expect(toFile(add(toLines('a\r\n'), 'b'))).toBe('a\r\n- [ ] b\r\n')
    expect(toFile(add(toLines('a\r\n- [ ] b'), 'c'))).toBe('a\r\n- [ ] b\r\n- [ ] c')
  })
})
