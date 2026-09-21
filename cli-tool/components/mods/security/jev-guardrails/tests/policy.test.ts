import { expect, test } from 'bun:test'
import {
  BUILTIN_LABELS,
  HAZARD_ACTION,
  INPUT_BATTERY,
  OUTPUT_BATTERY,
  POLICIES,
  blockReason,
  builtinRouting,
  classifyText,
  contextBlock,
  describeRouting,
  describeScreen,
  describeSetup,
  describeStatus,
  endpoint,
  hazardsOf,
  isPolicyName,
  questions,
  readScreen,
  requestBody,
  requestHeaders,
  resolvePolicy,
  reviewQuestion,
  route,
  selectProvider,
} from '../hooks/policy.ts'
import type { Screen } from '../hooks/policy.ts'

const none = new Set<string>()
const strict = POLICIES.strict!
const permissive = POLICIES.permissive!

/** A TypeSafe answer: one `noul` per hazard and a `score` for severity. */
const typesafeAnswer = (nouls: Record<string, number>, severity: number) =>
  JSON.stringify({
    answers: {
      ...Object.fromEntries(
        Object.entries(nouls).map(([hazard, p]) => [hazard, { type: 'noul', noul: p, confidence: 0.9 }]),
      ),
      severity: { type: 'score', score: severity },
    },
  })

/** The same on the Gateway: `probability` instead of `noul`. */
const gatewayAnswer = (nouls: Record<string, number>, severity: number) =>
  JSON.stringify({
    answers: {
      ...Object.fromEntries(
        Object.entries(nouls).map(([hazard, p]) => [hazard, { type: 'boolean', probability: p }]),
      ),
      severity: { type: 'score', score: severity },
    },
  })

// --- the cookbook's published rows, under strict ---------------------------

const screen = (nouls: Record<string, number>, severity: number): Screen => ({ nouls, severity })

test('an ordinary prompt passes', () => {
  const r = route(screen({ jailbreak: 0.02, harmful_request: 0.01, medical_advice: 0.01, self_harm: 0.01 }, 0.0), strict)
  expect(r.action).toBe('pass')
  expect(r.hazard).toBeNull()
})

test('melatonin_dose: a mild dosage question goes to review, not to a block', () => {
  const r = route(screen({ jailbreak: 0.02, harmful_request: 0.01, medical_advice: 0.55, self_harm: 0.02 }, 0.3), strict)
  expect(r.action).toBe('review')
  expect(r.hazard).toBe('medical_advice')
  expect(r.escalated).toBe(false)
})

test('dosage_request: severity 2.0 turns a medical review into a block', () => {
  const r = route(screen({ jailbreak: 0.02, harmful_request: 0.03, medical_advice: 0.95, self_harm: 0.02 }, 2.0), strict)
  // medical_advice at 0.95 fires its own action, which is review; severity
  // escalates that review to a block. That is the one row severity decides.
  expect(r.action).toBe('block')
  expect(r.hazard).toBe('medical_advice')
  expect(r.escalated).toBe(true)
})

test('lockpick_burglary: a harmful request blocks', () => {
  const r = route(screen({ jailbreak: 0.05, harmful_request: 0.95, medical_advice: 0.01, self_harm: 0.02 }, 2.4), strict)
  expect(r.action).toBe('block')
  expect(r.hazard).toBe('harmful_request')
})

test('self_harm goes to support, and support outranks a block on the same message', () => {
  const r = route(screen({ jailbreak: 0.02, harmful_request: 0.8, medical_advice: 0.1, self_harm: 0.96 }, 2.4), strict)
  expect(r.action).toBe('support')
  expect(r.hazard).toBe('self_harm')
})

test('novelist_poison: violent subject matter alone does not fire anything', () => {
  const r = route(screen({ jailbreak: 0.05, harmful_request: 0.2, medical_advice: 0.01, self_harm: 0.01 }, 0.8), strict)
  expect(r.action).toBe('pass')
})

test('neurosemantical: the same probabilities block under strict and review under permissive', () => {
  const s = screen({ jailbreak: 0.74, harmful_request: 0.01, medical_advice: 0.02, self_harm: 0.04 }, 0.51)
  expect(route(s, strict).action).toBe('block')
  expect(route(s, permissive).action).toBe('review')
  expect(route(s, permissive).hazard).toBe('jailbreak')
})

test('severity escalates only reviews: a message with nothing near the review line stays a pass', () => {
  const r = route(screen({ jailbreak: 0.1, harmful_request: 0.1, medical_advice: 0.1, self_harm: 0.1 }, 2.9), strict)
  expect(r.action).toBe('pass')
})

test('the surest hazard among those agreeing on the action is the one named', () => {
  const r = route(screen({ jailbreak: 0.72, harmful_request: 0.9, medical_advice: 0.01, self_harm: 0.01 }, 1.0), strict)
  expect(r.action).toBe('block')
  expect(r.hazard).toBe('harmful_request')
  expect(r.probability).toBeCloseTo(0.9)
})

test('output side: a jailbroken reply blocks on broke_policy', () => {
  const r = route(screen({ broke_policy: 0.94, harmful_request: 0.3, medical_advice: 0.02, self_harm: 0.01 }, 2.3), strict)
  expect(r.action).toBe('block')
  expect(r.hazard).toBe('broke_policy')
})

test('a null severity never escalates', () => {
  const r = route({ nouls: { medical_advice: 0.5 }, severity: null }, strict)
  expect(r.action).toBe('review')
  expect(r.escalated).toBe(false)
})

// --- policies ---------------------------------------------------------------

test('resolvePolicy overrides one number and keeps the rest; an unknown name reads as strict', () => {
  expect(resolvePolicy('permissive', { severityBlock: 1.5 })).toEqual({
    reviewThreshold: 0.35,
    actionThreshold: 0.85,
    severityBlock: 1.5,
  })
  expect(resolvePolicy('nope', {})).toEqual(strict)
  // An inherited name is not a policy: every threshold would be undefined and everything would pass.
  expect(resolvePolicy('toString', {})).toEqual(strict)
  expect(isPolicyName('toString')).toBe(false)
  expect(isPolicyName('permissive')).toBe(true)
})

// --- reading both wire shapes -----------------------------------------------

test('a TypeSafe answer reads noul per hazard and score for severity', () => {
  const s = readScreen(typesafeAnswer({ jailbreak: 0.98, harmful_request: 0.1, medical_advice: 0.02, self_harm: 0.03 }, 1.1), 'input', none)
  expect(s?.nouls.jailbreak).toBeCloseTo(0.98)
  expect(s?.severity).toBeCloseTo(1.1)
})

test('a Gateway answer reads probability per hazard', () => {
  const s = readScreen(gatewayAnswer({ broke_policy: 0.9, harmful_request: 0.2, medical_advice: 0.1, self_harm: 0.0 }, 2.0), 'output', none)
  expect(s?.nouls.broke_policy).toBeCloseTo(0.9)
  expect(s?.nouls.jailbreak).toBeUndefined()
})

test('a battery with a hole in it is no screening; a disabled hazard is neither required nor read', () => {
  // jailbreak missing: the hole could be the one question that matters.
  expect(readScreen(typesafeAnswer({ harmful_request: 0.1, medical_advice: 0.1, self_harm: 0.1 }, 0), 'input', none)).toBeNull()
  const s = readScreen(
    typesafeAnswer({ jailbreak: 0.9, harmful_request: 0.1, self_harm: 0.1 }, 0),
    'input',
    new Set(['medical_advice']),
  )
  expect(Object.keys(s?.nouls ?? {})).toEqual(['jailbreak', 'harmful_request', 'self_harm'])
})

test('malformed or empty payloads read as no screening rather than throwing', () => {
  expect(readScreen('not json', 'input', none)).toBeNull()
  expect(readScreen('null', 'input', none)).toBeNull()
  expect(readScreen('42', 'input', none)).toBeNull()
  expect(readScreen('{}', 'input', none)).toBeNull()
  expect(readScreen(JSON.stringify({ answers: { severity: { score: 1 } } }), 'input', none)).toBeNull()
})

// --- requests ---------------------------------------------------------------

test('the input battery asks the cookbook\'s four hazards and severity, in that order', () => {
  expect(hazardsOf('input', none)).toEqual(['jailbreak', 'harmful_request', 'medical_advice', 'self_harm'])
  expect(hazardsOf('output', none)).toEqual(['broke_policy', 'harmful_request', 'medical_advice', 'self_harm'])
  expect(Object.keys(questions('typesafe', 'input', none))).toEqual([...hazardsOf('input', none), 'severity'])
  expect(Object.keys(INPUT_BATTERY).every((h) => h in HAZARD_ACTION)).toBe(true)
  expect(Object.keys(OUTPUT_BATTERY).every((h) => h in HAZARD_ACTION)).toBe(true)
})

test('a TypeSafe noul carries the cookbook criteria; a Gateway boolean folds them into the question', () => {
  const ts = questions('typesafe', 'input', none).jailbreak as Record<string, unknown>
  expect(ts.type).toBe('noul')
  expect(ts.criteria).toEqual({ true: INPUT_BATTERY.jailbreak.yes, false: INPUT_BATTERY.jailbreak.no })
  const gw = questions('gateway', 'input', none).jailbreak as Record<string, unknown>
  expect(gw.type).toBe('boolean')
  expect(gw.criteria).toBeUndefined()
  expect(String(gw.instructions)).toContain(INPUT_BATTERY.jailbreak.yes)
})

test('disabledHazards leaves a question out of the request', () => {
  const q = questions('typesafe', 'input', new Set(['medical_advice']))
  expect(q.medical_advice).toBeUndefined()
  expect(q.severity).toBeDefined()
})

test('the request body is the message as state, with the model only on TypeSafe', () => {
  const ts = JSON.parse(requestBody('typesafe', 'hello', 'input', none, 'jev-1.12'))
  expect(ts.state).toBe('hello')
  expect(ts.model).toBe('jev-1.12')
  const gw = JSON.parse(requestBody('gateway', 'hello', 'output', none, 'typesafe-ai/jev'))
  expect(gw.model).toBeUndefined()
  expect(Object.keys(gw.questions)).toContain('broke_policy')
})

test('headers: the Gateway names the model and the protocol version', () => {
  expect(requestHeaders('typesafe', 'k', 'jev-latest')).toEqual({
    'content-type': 'application/json',
    authorization: 'Bearer k',
  })
  const gw = requestHeaders('gateway', 'k', 'typesafe-ai/jev')
  expect(gw['ai-model-id']).toBe('typesafe-ai/jev')
  expect(gw['ai-gateway-protocol-version']).toBe('0.0.1')
})

test('provider selection prefers TypeSafe and never borrows the other key', () => {
  expect(selectProvider('auto', 'a', 'b')).toBe('typesafe')
  expect(selectProvider('auto', '', 'b')).toBe('gateway')
  expect(selectProvider('auto', '', '')).toBeNull()
  expect(selectProvider('gateway', 'a', '')).toBeNull()
  expect(selectProvider('builtin', 'a', 'b')).toBeNull()
  expect(endpoint('typesafe', 'https://api.typesafe.ai/')).toBe('https://api.typesafe.ai/v1/systemone')
})

// --- the built-in classifier ------------------------------------------------

test('the built-in label is the action; anything else is no routing', () => {
  expect(builtinRouting('block')?.action).toBe('block')
  expect(builtinRouting('block')?.probability).toBeNull()
  expect(builtinRouting('maybe')).toBeNull()
  expect(builtinRouting(undefined)).toBeNull()
  expect(BUILTIN_LABELS).toEqual(['pass', 'review', 'block', 'support'])
})

test('the classifier text names every enabled hazard and its action', () => {
  const t = classifyText('hi', 'output', new Set(['self_harm']))
  expect(t).toContain('broke_policy → block')
  expect(t).not.toContain('self_harm')
  expect(t).toContain('2 = Serious')
  expect(t).toContain('severity is 2 or more')
  expect(t.endsWith('hi')).toBe(true)
})

// --- what people read -------------------------------------------------------

test('the block reason names the hazard, its probability and the policy', () => {
  const r = route(screen({ jailbreak: 0.98, harmful_request: 0.1, medical_advice: 0.1, self_harm: 0.1 }, 1.1), strict)
  expect(blockReason('input', r, 'strict')).toBe('jev-guardrails blocked this prompt (policy strict): jailbreak at 0.98.')
  const b = builtinRouting('block')!
  expect(blockReason('output', b, 'strict')).toContain('built-in classifier')
})

test('the review question and the context blocks carry the hazard', () => {
  const r = route(screen({ jailbreak: 0.1, harmful_request: 0.1, medical_advice: 0.55, self_harm: 0.1 }, 0.3), strict)
  expect(reviewQuestion(r)).toBe('jev-guardrails: this prompt was flagged for medical advice at 0.55. Send it anyway?')
  expect(contextBlock('review', r)).toContain('medical advice (0.55)')
  const s = route(screen({ jailbreak: 0.1, harmful_request: 0.1, medical_advice: 0.1, self_harm: 0.96 }, 2.4), strict)
  expect(contextBlock('support', s)).toContain('self_harm 0.96')
  expect(contextBlock('support', s).startsWith('<guardrail>')).toBe(true)
})

test('the log lines say what was answered and what was decided', () => {
  const s = screen({ jailbreak: 0.74, self_harm: 0.04, medical_advice: 0.02, harmful_request: 0.01 }, 0.51)
  expect(describeScreen(s, 312)).toBe('jailbreak 0.74 · self_harm 0.04 · medical_advice 0.02 · harmful_request 0.01 · severity 0.5 · 312ms')
  expect(describeScreen(null, null)).toBe('no answer')
  expect(describeRouting(route(s, strict))).toBe('BLOCK (jailbreak 0.74)')
  expect(describeRouting(null)).toBe('no answer; passed')
  expect(describeStatus('input', route(s, strict))).toBe('guard · in: block (jailbreak)')
  expect(describeStatus('output', null)).toBe('guard · out: no answer')
})

test('the setup line names the backend, the policy and the sides', () => {
  expect(describeSetup('typesafe', 'https://api.typesafe.ai/v1/systemone', 'strict', { input: true, output: 'block' })).toBe(
    'ready on typesafe (https://api.typesafe.ai/v1/systemone); policy strict; screening input, output (block)',
  )
  expect(describeSetup(null, '', 'permissive', { input: false, output: 'off' }, true)).toBe(
    'ready on the built-in classifier, by choice; policy permissive; screening nothing, both sides are off',
  )
})
