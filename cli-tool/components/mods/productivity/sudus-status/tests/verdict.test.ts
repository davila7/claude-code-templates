import { expect, test } from 'bun:test'
import { changesVerdict, expressionOf, parseWake, statusTextOf } from '../hooks/verdict.ts'

const RESOLVABLE = 'verdict: Resolvable\naction: run WTE-001\nreason: no current receipt carries a result for WTE-001\npredicate: a current receipt carries a result for the requirement\nlayout: .cairn (the former name); sudus migrate moves it to .sudus between commitments\n'

test('a Resolvable verdict reads action, target, reason, predicate and the layout line', () => {
  const v = parseWake(RESOLVABLE, 0)
  expect(v).toMatchObject({ kind: 'verdict', verdict: 'Resolvable', action: 'run', target: 'WTE-001', exit: 0 })
  if (v.kind !== 'verdict') throw new Error('kind')
  expect(v.reason).toBe('no current receipt carries a result for WTE-001')
  expect(v.layout).toStartWith('.cairn')
  expect(expressionOf(v, false)).toBe('idle')
  expect(expressionOf(v, true)).toBe('thinking')
  expect(statusTextOf(v, false, true)).toBe('(o_o) Sudus | Resolvable | run WTE-001 | no current receipt carries a result for WTE-001')
  expect(statusTextOf(v, false, false)).toStartWith('Sudus | Resolvable')
})

test('Waiting is sad, or mad with no developer to answer; Done is happy', () => {
  const w = parseWake('verdict: Waiting\nparty: developer\nreason: escalation abc awaits an answer\npredicate: p\n', 0)
  expect(expressionOf(w, false)).toBe('sad')
  expect(statusTextOf(w, false, false)).toBe('Sudus | Waiting for the developer | escalation abc awaits an answer')
  expect(expressionOf(parseWake('verdict: Waiting\nparty: developer\nreason: r\npredicate: p\n', 4), false)).toBe('mad')
  expect(expressionOf(parseWake('verdict: Done\ncommitment: first\nreason: r\npredicate: p\n', 0), false)).toBe('happy')
})

// The exact lines lib/wake.mjs render() prints for Done and for Waiting.
test('Done names its commitment, and Waiting shows the escalation question', () => {
  const d = parseWake('verdict: Done\ncommitment: first\nreason: done record closes first and no backlog item waits\npredicate: a done record names the commitment and final workspace snapshot\n', 0)
  expect(d).toMatchObject({ kind: 'verdict', verdict: 'Done', target: 'first' })
  expect(statusTextOf(d, false, false)).toBe('Sudus | Done | first')
  const w = parseWake('verdict: Waiting\nparty: developer\nreason: escalation 1a2b awaits an answer\nquestion: Raise the bound to 1 ms?\nrecommendation: yes\nbecause: b\nif wrong: w\ninstead: i\npredicate: p\n', 0)
  expect(w).toMatchObject({ question: 'Raise the bound to 1 ms?' })
  expect(statusTextOf(w, false, true)).toBe('(;_;) Sudus | Waiting for the developer | Raise the bound to 1 ms?')
})

test('an exit-3 line and an empty print are sick, and say so', () => {
  const line = parseWake('sudus: outside a project; run /new-project or /existing-project\n', 3)
  expect(line).toMatchObject({ kind: 'line', exit: 3 })
  expect(expressionOf(line, false)).toBe('sick')
  expect(statusTextOf(line, false, true)).toBe('(x_x) Sudus | sudus: outside a project; run /new-project or /existing-project')
  expect(parseWake('', 1)).toMatchObject({ kind: 'missing' })
})

test('a long reason is cut to the status line width', () => {
  const v = parseWake(`verdict: Resolvable\naction: fix gate\nreason: ${'x'.repeat(300)}\npredicate: p\n`, 0)
  const s = statusTextOf(v, false, false)
  expect(s.length).toBe(120)
  expect(s.endsWith('...')).toBe(true)
})

test('a sudus, cairn or history-changing git command refreshes; other commands do not', () => {
  expect(changesVerdict('sudus check WTE-001')).toBe(true)
  expect(changesVerdict('cd app && cairn begin implement X')).toBe(true)
  expect(changesVerdict('git commit -m "x"')).toBe(true)
  expect(changesVerdict('git status')).toBe(false)
  expect(changesVerdict('npm test')).toBe(false)
  expect(changesVerdict('echo sudusness')).toBe(false)
})
