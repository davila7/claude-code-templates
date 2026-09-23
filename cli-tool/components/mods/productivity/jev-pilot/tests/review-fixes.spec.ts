// Regression tests for the review of claude-code-templates#975: one block per finding.
import { expect, test } from 'bun:test'
import { NOT_A_TASK } from '../hooks/context.ts'
import { configKeysOf, reportPrompt, suggestions } from '../hooks/ledger.ts'
import type { LedgerEntry } from '../hooks/ledger.ts'
import { pendingDecisions, readDecision, route } from '../hooks/model-router.policy.ts'
import type { Decision, PolicyConfig } from '../hooks/model-router.policy.ts'
import {
  catalog,
  decide,
  detailOf,
  mergeWide,
  readRerank,
  readWide,
  shortlistOf,
} from '../hooks/skill-suggestion.policy.ts'
import type { Wide } from '../hooks/skill-suggestion.policy.ts'

// --- batch rankings do not compare across batches (#1, #34) ----------------------

const wide = (ranked: [string, number][], gate: number | null = null): Wide => ({
  ranked: ranked.map(([name, probability]) => ({ name, probability })),
  gate,
  gateValues: {},
})

test('every batch leader reaches the shortlist, whatever the other batch scored', () => {
  // Batch A is confident about many skills; batch B spreads thin. By raw score,
  // A's second and third would push B's leader out of a shortlist of 3.
  const a = wide([['a1', 0.5], ['a2', 0.3], ['a3', 0.15]], 0.8)
  const b = wide([['b1', 0.1], ['b2', 0.05]])
  const merged = mergeWide([a, b]) as Wide
  const skills = ['a1', 'a2', 'a3', 'b1', 'b2'].map((name) => ({ name, description: '' }))
  const two = shortlistOf(merged, skills, 2).map((skill) => skill.name)
  expect(two).toContain('a1')
  expect(two).toContain('b1')
  // Within a rank position, the more confident first; the gate is the first batch's.
  expect(merged.ranked.map((entry) => entry.name)).toEqual(['a1', 'b1', 'a2', 'b2', 'a3'])
  expect(merged.gate).toBe(0.8)
})

test('for any batches, position k of every batch comes before position k+1 of any batch', () => {
  const batches = [
    wide([['x1', 0.9], ['x2', 0.05], ['x3', 0.01]]),
    wide([['y1', 0.2], ['y2', 0.19]]),
    wide([['z1', 0.34], ['z2', 0.33], ['z3', 0.32]]),
  ]
  const order = (mergeWide(batches) as Wide).ranked.map((entry) => entry.name)
  const position = (name: string) => Number(name.slice(1)) - 1
  for (let i = 1; i < order.length; i++) {
    expect(position(order[i] as string)).toBeGreaterThanOrEqual(position(order[i - 1] as string))
  }
})

// --- the rerank's pick must itself fit (#9) -------------------------------------

test('a pick with a low fit is refused even when another candidate fits well', () => {
  const skills = ['good', 'weak'].map((name) => ({ name, description: '' }))
  const first = wide([['weak', 0.6], ['good', 0.4]], 0.9)
  const config = { shortlist: 2, gateThreshold: 0.3, fitsThreshold: 0.3 }
  const rerank = { winner: 'weak', confidence: 0.6, fits: { weak: 0.1, good: 0.9 } }
  expect(decide(first, rerank, skills, config, true).name).toBeNull()
  // A missing fit for the pick is no fit.
  expect(decide(first, { ...rerank, fits: { good: 0.9 } }, skills, config, true).name).toBeNull()
  expect(decide(first, { ...rerank, winner: 'good' }, skills, config, true).name).toBe('good')
})

// --- malformed backend answers are no answer, never a throw (#26) ------------------

test('a 2xx body that is valid JSON but not an object reads as no answer', () => {
  for (const body of ['null', '[]', '42', '"x"', '{"answers": null}', '{"answers": []}']) {
    expect(readWide(body)).toBeNull()
    expect(readRerank(body)).toBeNull()
    expect(readDecision(body)).toBeNull()
  }
})

// --- the rerank reads the SKILL.md's own description (#25) --------------------------

test('a non-empty frontmatter description is used even when shorter', () => {
  const markdown = '---\nname: x\ndescription: Short and current.\n---\nBody text.'
  const detail = detailOf({ name: 'x', description: 'A much longer but stale listing description' }, markdown, 100)
  expect(detail.startsWith('Short and current.')).toBe(true)
})

// --- this plugin's own commands are never suggested (#20) ----------------------------

test('jev-pilot:setup and jev-pilot:report never enter the catalog', () => {
  const commands = ['jev-pilot:setup', 'jev-pilot:report', 'pdf'].map((name) => ({ name, description: 'd', source: 'plugin' }))
  expect(catalog(commands, new Set(), new Set()).map((skill) => skill.name)).toEqual(['pdf'])
})

// --- pending decisions: withdrawn and cleared (#11, #5) ------------------------------

test('a withdrawn prompt leaves nothing behind, and a cleared slot holds nothing', () => {
  const pending = pendingDecisions<string>()
  pending.put('dropped')
  pending.withdraw()
  pending.put('real')
  expect(pending.take()).toBe('real')

  pending.put('old session')
  pending.clear()
  expect(pending.take()).toBeNull()

  // With two waiting, a withdrawal cannot tell which remains: still nothing.
  pending.put('a')
  pending.put('b')
  pending.withdraw()
  expect(pending.take()).toBeNull()
})

// --- risk: a floor over the ceiling, and no same-tier swap (#13, #17) -----------------

const config: PolicyConfig = {
  tiers: { fast: 'haiku', balanced: 'sonnet', deep: 'opus' },
  minUpgradeConfidence: 0.3,
  minDowngradeConfidence: 0.6,
}
const risky = (patch: Partial<Decision> = {}): Decision => ({
  tier: 'deep',
  confidence: 0.9,
  risky: 0.95,
  effort: 0,
  effortConfidence: 0.9,
  ...patch,
})

test('risky work gets at least high, even under a maxEffort set lower', () => {
  for (const maxEffort of ['low', 'medium'] as const) {
    expect(route(risky(), { model: 'claude-opus-5-5', effort: 'low' }, { ...config, maxEffort }).effort).toBe('high')
  }
})

test('risk never swaps a model for another of its own tier', () => {
  const routing = route(risky(), { model: 'claude-opus-5-5[1m]', effort: 'high' }, config)
  expect(routing.model).toBeNull()
  // From a lower tier, risk still takes it up.
  expect(route(risky(), { model: 'claude-sonnet-5', effort: 'high' }, config).model).toBe('opus')
})

// --- machine prompts are not tasks (#24) ---------------------------------------------

test('scheduled triggers and Slack pings are not tasks', () => {
  expect(NOT_A_TASK.has('scheduled-trigger')).toBe(true)
  expect(NOT_A_TASK.has('slack-ping')).toBe(true)
})

// --- the report: timeouts and the settings key (#29, #8) --------------------------------

const entry = (patch: Partial<LedgerEntry>): LedgerEntry => ({
  at: 0, answered: true, ms: 500, tier: 'fast', tierConfidence: 0.9, effortLevel: 0, effortConfidence: 0.9,
  startedFrom: 'medium', started: 'low', raisedTo: null, toolCalls: 1, failures: 0, strategy: null,
  strategyConfidence: null, advised: false, outcome: 'answer', durationMs: 1, outputTokens: 1, ...patch,
})
const tunable = { timeoutMs: 800, minDowngradeConfidence: 0.6, effortCloseMargin: 0.15 }

test('keyless turns (no backend asked) never suggest a longer timeout', () => {
  const keyless = Array.from({ length: 30 }, () => entry({ answered: false, ms: null }))
  expect(suggestions(keyless, tunable).filter((item) => item.option === 'timeoutMs')).toEqual([])
})

test('the report edits the settings key jev-pilot actually uses', () => {
  const settings = JSON.stringify({ pluginConfigs: { 'jev-pilot@skills-dir': { options: {} }, other: {}, 'jev-pilotx': {} } })
  expect(configKeysOf(settings)).toEqual(['jev-pilot@skills-dir'])
  expect(configKeysOf('{not json')).toEqual([])
  expect(reportPrompt('R', '/s.json', true, ['jev-pilot@skills-dir'])).toContain('"jev-pilot@skills-dir" entry')
  // None found: the model asks, and learns the three possible keys.
  const none = reportPrompt('R', '/s.json', true, [])
  for (const key of ['jev-pilot@jev-pilot', 'jev-pilot@skills-dir', '"jev-pilot"']) expect(none).toContain(key)
  expect(reportPrompt('R', '/s.json', false, ['jev-pilot'])).toContain('Do not change any settings')
})
