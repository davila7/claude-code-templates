import { expect, test } from 'bun:test'
import { signalsOf } from '../hooks/context.ts'
import type { ContextMessage } from '../hooks/context.ts'
import {
  appendEntry,
  entriesOf,
  MIN_TURNS_TO_SUGGEST,
  reportPrompt,
  suggestions,
  summarize,
} from '../hooks/ledger.ts'
import type { LedgerEntry, TunableConfig } from '../hooks/ledger.ts'

// --- signals ------------------------------------------------------------------------

test('signals count what the prompt names and carries, without quoting it', () => {
  const signals = signalsOf('fix the crash in src/api/orders.ts and db/schema.sql — see the error below:\n```\nTypeError\n```', [])
  expect(signals.files_mentioned).toBe(2)
  expect(signals.has_code_or_error).toBe(true)
  expect(signals.is_question).toBe(false)
  expect(JSON.stringify(signals)).not.toContain('orders')
})

test('a question is recognised by its mark or its opening word', () => {
  expect(signalsOf('why does the build fail', []).is_question).toBe(true)
  expect(signalsOf('the build fails?', []).is_question).toBe(true)
  expect(signalsOf('make the build pass', []).is_question).toBe(false)
  expect(signalsOf('what', []).prompt_chars).toBe(4)
})

test('recent tools are counted by kind over the last window, failures apart', () => {
  const turn = (tools: { tool: string; isError?: true }[]): ContextMessage => ({ role: 'assistant', text: '', toolUses: tools })
  const messages = [
    turn([{ tool: 'Edit' }]), // outside a window of 2
    turn([{ tool: 'Bash', isError: true }, { tool: 'Read' }]),
    turn([{ tool: 'Write' }, { tool: 'Agent' }, { tool: 'SomethingElse' }]),
  ]
  expect(signalsOf('x', messages, 2).recent_tools).toEqual({ edits: 1, commands: 1, reads: 1, subagents: 1, failed: 1 })
  expect(signalsOf('x', messages).recent_tools.edits).toBe(2)
})

// --- ledger -------------------------------------------------------------------------

const config: TunableConfig = { timeoutMs: 800, minDowngradeConfidence: 0.6, effortCloseMargin: 0.15 }

const entry = (patch: Partial<LedgerEntry> = {}): LedgerEntry => ({
  at: Date.UTC(2026, 8, 23),
  answered: true,
  ms: 500,
  tier: 'balanced',
  tierConfidence: 0.9,
  effortLevel: 1,
  effortConfidence: 0.9,
  startedFrom: 'medium',
  started: 'medium',
  raisedTo: null,
  toolCalls: 3,
  failures: 0,
  strategy: null,
  strategyConfidence: null,
  advised: false,
  outcome: 'answer',
  durationMs: 1000,
  outputTokens: 400,
  ...patch,
})

const many = (count: number, patch: Partial<LedgerEntry> = {}) => Array.from({ length: count }, () => entry(patch))

test('the ledger keeps the newest entries, and drops what is not an entry', () => {
  let stored: unknown = 'garbage from an older version'
  for (let index = 0; index < 5; index++) stored = appendEntry(stored, entry({ at: index }), 3)
  expect((stored as LedgerEntry[]).map((item) => item.at)).toEqual([2, 3, 4])
  expect(entriesOf([entry(), { at: 'x' }, null, 7])).toHaveLength(1)
  expect(entriesOf(undefined)).toEqual([])
})

test('no suggestion below the minimum number of turns, whatever they show', () => {
  const struggling = many(MIN_TURNS_TO_SUGGEST - 1, { started: 'low', raisedTo: 'medium', answered: false })
  expect(suggestions(struggling, config)).toEqual([])
  expect(summarize(struggling, config)).toContain(`need at least ${MIN_TURNS_TO_SUGGEST} turns`)
})

test('frequent missed answers suggest a longer timeout, from the latencies seen', () => {
  const entries = [...many(15, { ms: 1100 }), ...many(10, { answered: false, ms: 800 })]
  const [suggestion] = suggestions(entries, config)
  expect(suggestion?.option).toBe('timeoutMs')
  expect(suggestion?.to).toBe(1400)
})

test('cheap starts that keep being raised suggest leaning up', () => {
  const entries = [...many(8, { started: 'low', raisedTo: 'medium' }), ...many(12, { started: 'medium' })]
  const found = suggestions(entries, config)
  expect(found.map((item) => [item.option, item.to])).toEqual([
    ['minDowngradeConfidence', 0.7],
    ['effortCloseMargin', 0.2],
  ])
})

test('costly starts that finish short and clean suggest leaning up less', () => {
  const entries = many(20, { started: 'xhigh', toolCalls: 1 })
  expect(suggestions(entries, config).map((item) => [item.option, item.to])).toEqual([['effortCloseMargin', 0.1]])
})

test('evidence both ways leaves the margin where it is', () => {
  const entries = [...many(10, { started: 'low', raisedTo: 'high' }), ...many(20, { started: 'xhigh', toolCalls: 1 })]
  const margins = suggestions(entries, config).filter((item) => item.option === 'effortCloseMargin')
  expect(margins.map((item) => item.to)).toEqual([0.2])
})

test('a quiet ledger suggests nothing', () => {
  expect(suggestions(many(30), config)).toEqual([])
  expect(summarize(many(30), config)).toContain('No change suggested')
})

test('the report tabulates by starting effort and never contains prompt text', () => {
  const report = summarize([...many(3, { started: 'low' }), entry({ started: 'high', raisedTo: 'xhigh', advised: true, strategy: 'parallel' })], config)
  expect(report).toContain('| low | 3 | 0% |')
  expect(report).toContain('| high | 1 | 100% |')
  expect(report).toContain('parallel 1')
  expect(summarize([], config)).toContain('empty')
})

test('the report prompt only offers an edit when there is one to make', () => {
  expect(reportPrompt('R', '/h/.claude/settings.json', true)).toContain('only after the user says yes')
  expect(reportPrompt('R', '/h/.claude/settings.json', false)).toContain('Do not change any settings')
})
