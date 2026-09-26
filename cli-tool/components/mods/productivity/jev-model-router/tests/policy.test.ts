import { expect, test } from 'bun:test'
import {
  effortLevel,
  effortRank,
  endpoint,
  questions,
  describeDecision,
  describeSetup,
  describeStatus,
  pendingDecisions,
  rankOf,
  readDecision,
  requestBody,
  requestHeaders,
  requestModelId,
  route,
  selectProvider,
  bareCommand,
} from '../hooks/policy.ts'
import type { Decision, PolicyConfig } from '../hooks/policy.ts'

const config: PolicyConfig = {
  tiers: { fast: 'haiku', balanced: 'sonnet', deep: 'opus' },
  minUpgradeConfidence: 0.3,
  minDowngradeConfidence: 0.6,
}

const gatewayAnswer = (
  tier: string,
  probabilities?: Record<string, number>,
  risky = 0.01,
  effort = 1.4,
) =>
  JSON.stringify({
    answers: {
      tier: { type: 'choice', choice: tier, ...(probabilities ? { probabilities } : {}) },
      effort: { type: 'score', score: effort, probabilities: { '1': 0.9 } },
      risky: { type: 'boolean', probability: risky },
    },
    usage: { inputTokens: 120, outputTokens: 0 },
  })

/** The current state of a request, as turn.step hands it over. */
const on = (model: string, effort?: string) => ({ model, effort })

test('confidence is the highest probability, since the Gateway sends no confidence field', () => {
  const decision = readDecision(gatewayAnswer('balanced', { fast: 0.1, balanced: 0.85, deep: 0.05 }))
  expect(decision?.tier).toBe('balanced')
  expect(decision?.confidence).toBeCloseTo(0.85)
  expect(decision?.effort).toBeCloseTo(1.4)
})

test('a distribution is optional in the response schema, so confidence may be absent', () => {
  const decision = readDecision(gatewayAnswer('deep'))
  expect(decision?.tier).toBe('deep')
  expect(decision?.confidence).toBeNull()
})

test('malformed or unexpected payloads read as no decision rather than throwing', () => {
  expect(readDecision('not json')).toBeNull()
  expect(readDecision('{}')).toBeNull()
  expect(readDecision(JSON.stringify({ answers: { tier: { type: 'choice', choice: 'cheap' } } }))).toBeNull()
})

test('spending less needs the high bar; the same confidence is enough to spend more', () => {
  // 0.51 sits between the two bars: too low to downgrade, high enough to upgrade.
  const down = readDecision(gatewayAnswer('fast', { fast: 0.51, balanced: 0.4, deep: 0.09 }))
  expect(route(down, on('claude-sonnet-5'), config).model).toBeNull()

  const up = readDecision(gatewayAnswer('deep', { deep: 0.51, balanced: 0.4, fast: 0.09 }))
  expect(route(up, on('claude-sonnet-5'), config).model).toBe('opus')
})

test('both directions are available once the bar is cleared', () => {
  const down = readDecision(gatewayAnswer('fast', { fast: 0.95, balanced: 0.04, deep: 0.01 }))
  expect(route(down, on('claude-opus-5'), config).model).toBe('haiku')

  const up = readDecision(gatewayAnswer('deep', { deep: 0.9, balanced: 0.08, fast: 0.02 }))
  expect(route(up, on('claude-haiku-4-5-20251001'), config).model).toBe('opus')
})

test('effort moves in both directions too, on its own confidence', () => {
  const low = readDecision(gatewayAnswer('fast', { fast: 0.95 }, 0.01, 0.1))
  expect(route(low, on('claude-haiku-4-5-20251001', 'high'), config).effort).toBe('low')

  const high = readDecision(gatewayAnswer('deep', { deep: 0.95 }, 0.01, 2.8))
  expect(route(high, on('claude-opus-5', 'low'), config).effort).toBe('xhigh')
})

test('a numeric effort is the caller\'s own scale and is left alone', () => {
  const decision = readDecision(gatewayAnswer('deep', { deep: 0.95 }, 0.01, 2.8))
  expect(route(decision, { model: 'claude-opus-5', effort: 4000 }, config).effort).toBeNull()
})

test('the rubric score maps onto the reasoning ladder', () => {
  expect(effortLevel(0)).toBe('low')
  expect(effortLevel(0.4)).toBe('low')
  expect(effortLevel(1.4)).toBe('medium')
  expect(effortLevel(2.04)).toBe('high')
  expect(effortLevel(3)).toBe('xhigh')
  expect(effortLevel(99)).toBe('xhigh')
})

test('a risky task takes the deep tier and real reasoning, past both thresholds', () => {
  const decision = readDecision(gatewayAnswer('fast', { fast: 0.97, balanced: 0.02, deep: 0.01 }, 0.93))
  const routing = route(decision, on('claude-sonnet-5', 'low'), config)
  expect(routing.model).toBe('opus')
  expect(routing.effort).toBe('high')
  expect(routing.reason).toContain('risk')
})

test('no decision, and a decision that changes nothing, both leave the request as it is', () => {
  expect(route(null, on('claude-sonnet-5'), config).model).toBeNull()
  const same = readDecision(gatewayAnswer('balanced', { balanced: 0.9 }, 0.01, 1.4))
  const routing = route(same, on('sonnet', 'medium'), config)
  expect(routing.model).toBeNull()
  expect(routing.effort).toBeNull()
})

test('without a confidence a change may only go up, never down', () => {
  // The Gateway may omit the distribution, and the built-in classifier has none.
  const noDistribution = readDecision(
    JSON.stringify({ answers: { tier: { type: 'choice', choice: 'fast' } } }),
  )
  expect(route(noDistribution, on('claude-opus-5'), config).model).toBeNull()

  const up = readDecision(JSON.stringify({ answers: { tier: { type: 'choice', choice: 'deep' } } }))
  expect(route(up, on('claude-haiku-4-5-20251001'), config).model).toBe('opus')
})

test('an unrecognised model id is treated as an upgrade, not guessed at', () => {
  expect(rankOf('some-other-vendor-model', config.tiers)).toBeNull()
  const decision = readDecision(gatewayAnswer('fast', { fast: 0.35, balanced: 0.4, deep: 0.25 }))
  // 0.35 clears the upgrade bar only; an undecidable direction gets that one.
  expect(route(decision, on('some-other-vendor-model'), config).model).toBe('haiku')
})

test('the Gateway request carries the model id and spec version it matches on', () => {
  const headers = requestHeaders('gateway', 'key-under-test', 'typesafe-ai/jev')
  expect(headers['ai-model-id']).toBe('typesafe-ai/jev')
  expect(headers['ai-evaluation-model-specification-version']).toBe('4')
  expect(headers.authorization).toBe('Bearer key-under-test')
})

// Omitting this one is not a degraded request, it is a rejected one: the
// Gateway answers 400 "Unsupported gateway protocol version" before it looks
// at anything else, so the whole backend silently falls back to routing
// nothing.
test('the Gateway request names the protocol version, without which it is refused', () => {
  const headers = requestHeaders('gateway', 'k', 'typesafe-ai/jev')
  expect(headers['ai-gateway-protocol-version']).toBe('0.0.1')
})

test('the protocol version is a Gateway header and is never sent to TypeSafe', () => {
  const headers = requestHeaders('typesafe', 'k', 'jev-latest')
  expect(headers['ai-gateway-protocol-version']).toBeUndefined()
})

// --- TypeSafe's own API ------------------------------------------------------
//
// Same model, different wire shape: a yes/no question is a `noul` rather than a
// `boolean`, every answer reports its own `confidence`, and the model rides in
// the body instead of a header.

const typesafeAnswer = (tier: string, confidence: number, noul = 0.01) =>
  JSON.stringify({
    model: 'jev-1.13',
    answers: {
      tier: { type: 'choice', choice: tier, confidence, probabilities: { [tier]: confidence } },
      effort: { type: 'score', score: 2.1, confidence: 0.8 },
      risky: { type: 'noul', noul },
    },
    usage: { input_tokens: 120, output_tokens: 0 },
  })

test('a TypeSafe answer is read from its own confidence and noul fields', () => {
  const decision = readDecision(typesafeAnswer('deep', 0.91, 0.04))
  expect(decision?.tier).toBe('deep')
  expect(decision?.confidence).toBeCloseTo(0.91)
  expect(decision?.effort).toBeCloseTo(2.1)
  expect(decision?.risky).toBeCloseTo(0.04)
})

test('a low-confidence TypeSafe downgrade is refused, like the Gateway path', () => {
  expect(route(readDecision(typesafeAnswer('fast', 0.42)), on('claude-sonnet-5'), config).model).toBeNull()
})

test('a risky TypeSafe answer forces the deep tier through the noul field', () => {
  const decision = readDecision(typesafeAnswer('fast', 0.98, 0.88))
  expect(route(decision, on('claude-sonnet-5'), config).model).toBe('opus')
})

test('each backend gets its own endpoint, question type and model placement', () => {
  expect(endpoint('typesafe', 'https://api.typesafe.ai/')).toBe('https://api.typesafe.ai/v1/systemone')
  expect(endpoint('gateway', 'https://ai-gateway.vercel.sh/v4/ai')).toBe(
    'https://ai-gateway.vercel.sh/v4/ai/evaluation-model',
  )

  expect((questions('typesafe').risky as { type: string }).type).toBe('noul')
  expect((questions('gateway').risky as { type: string }).type).toBe('boolean')

  const typesafeBody = JSON.parse(requestBody('typesafe', { prompt: 'x' }, 'jev-latest'))
  expect(typesafeBody.model).toBe('jev-latest')
  expect(JSON.parse(requestBody('gateway', { prompt: 'x' }, 'typesafe-ai/jev')).model).toBeUndefined()

  expect(requestHeaders('typesafe', 'k', 'jev-latest')['ai-model-id']).toBeUndefined()
})

// --- backend selection -------------------------------------------------------

test('auto prefers TypeSafe, since it is the only backend that reports a confidence', () => {
  expect(selectProvider('auto', 'ts-key', 'gw-key')).toBe('typesafe')
  expect(selectProvider('auto', '', 'gw-key')).toBe('gateway')
  expect(selectProvider('auto', '', '')).toBeNull()
})

test('a forced backend without its own key falls back to the built-in classifier, never to the other key', () => {
  expect(selectProvider('typesafe', '', 'gw-key')).toBeNull()
  expect(selectProvider('gateway', 'ts-key', '')).toBeNull()
})

test('builtin ignores both keys', () => {
  expect(selectProvider('builtin', 'ts-key', 'gw-key')).toBeNull()
})

// --- the two ways a downgrade could have slipped the bar ---------------------

test('risk raises the effort floor but never lowers one', () => {
  // A prod deletion: risky, but mechanically simple, so its own effort is low.
  const decision = readDecision(gatewayAnswer('fast', { fast: 0.99 }, 0.95, 0))
  // Forcing skips the thresholds, so without a clamp this would pull xhigh
  // down to high with no confidence check at all.
  expect(route(decision, on('claude-opus-5', 'xhigh'), config).effort).toBeNull()
  expect(route(decision, on('claude-opus-5', 'max'), config).effort).toBeNull()
  // It still raises a session that is below the floor.
  expect(route(decision, on('claude-opus-5', 'low'), config).effort).toBe('high')
})

test('max ranks above every rung the rubric can produce', () => {
  expect(effortRank('max')).toBeGreaterThan(effortRank('xhigh') as number)
  // Leaving max is a downgrade, so it needs the high bar, not the lenient one.
  const decision = readDecision(gatewayAnswer('fast', { fast: 0.9 }, 0.01, 0))
  const barelyConfident = { ...(decision as NonNullable<typeof decision>), effortConfidence: 0.35 }
  expect(route(barelyConfident, on('claude-sonnet-5', 'max'), config).effort).toBeNull()

  const sure = { ...(decision as NonNullable<typeof decision>), effortConfidence: 0.8 }
  expect(route(sure, on('claude-sonnet-5', 'max'), config).effort).toBe('low')
})

// A prompt classified while another one is still waiting: the turn that
// starts next cannot be tied to either, so neither decision is applied.
const deepDecision: Decision = {
  tier: 'deep',
  confidence: 0.99,
  risky: null,
  effort: null,
  effortConfidence: null,
}
const fastDecision: Decision = { ...deepDecision, tier: 'fast' }

test('a decision is handed to the turn that follows its prompt', () => {
  const pending = pendingDecisions()
  pending.put(deepDecision)
  expect(pending.take()).toEqual(deepDecision)
})

test('two prompts waiting at once yield no decision instead of the wrong one', () => {
  const pending = pendingDecisions()
  pending.put(fastDecision)
  pending.put(deepDecision)
  expect(pending.take()).toBeNull()
})

test('a prompt that failed to classify still shields the next prompt', () => {
  const pending = pendingDecisions()
  pending.put(null)
  pending.put(deepDecision)
  expect(pending.take()).toBeNull()
})

test('the slot empties on take, so a later turn never reuses a decision', () => {
  const pending = pendingDecisions()
  pending.put(deepDecision)
  pending.take()
  expect(pending.take()).toBeNull()
})

test('the slot recovers after an ambiguous round', () => {
  const pending = pendingDecisions()
  pending.put(fastDecision)
  pending.put(deepDecision)
  expect(pending.take()).toBeNull()
  pending.put(deepDecision)
  expect(pending.take()).toEqual(deepDecision)
})

// A turn the router leaves alone still has to say so: a silent no-op and a mod
// that never loaded look identical in the transcript otherwise.
test('a no-change decision reports what it wanted and what it kept', () => {
  const decision: Decision = {
    tier: 'fast',
    confidence: 0.41,
    risky: null,
    effort: 0,
    effortConfidence: 0.41,
  }
  const routing = route(decision, { model: 'sonnet', effort: 'medium' }, config)
  expect(routing.model).toBeNull()
  expect(routing.effort).toBeNull()
  expect(routing.reason).toBe('kept sonnet/medium, wanted haiku/low (confidence 0.41)')
})

test('a no-change decision without a confidence says so rather than going quiet', () => {
  const decision: Decision = {
    tier: 'fast',
    confidence: null,
    risky: null,
    effort: 0,
    effortConfidence: null,
  }
  const routing = route(decision, { model: 'sonnet', effort: 'medium' }, config)
  expect(routing.reason).toBe('kept sonnet/medium, wanted haiku/low (confidence n/d)')
})

test('no classification at all is its own reason, not a no-change', () => {
  expect(route(null, { model: 'sonnet', effort: 'medium' }, config).reason).toBe('no decision')
})

// The transcript is the only place a mod's work is visible, so the lines it
// writes are a contract, not decoration.
test('the setup line names the backend and which switches are on', () => {
  expect(
    describeSetup('typesafe', 'https://api.typesafe.ai/v1/systemone', {
      subagentModel: true,
      mainEffort: true,
      mainModel: false,
    }),
  ).toBe(
    'ready on typesafe (https://api.typesafe.ai/v1/systemone); routing subagent model, main effort',
  )
})

test('the setup line says so when there is no backend and when nothing routes', () => {
  expect(
    describeSetup(null, '', { subagentModel: false, mainEffort: false, mainModel: false }),
  ).toBe('ready on the built-in classifier, no key set; routing nothing, every switch is off')
})

// `provider: "builtin"` is a deliberate choice; reporting it as a missing key
// sends someone looking for a credential they meant to leave out.
test('choosing the built-in classifier is not reported as a missing key', () => {
  expect(
    describeSetup(null, '', { subagentModel: true, mainEffort: true, mainModel: false }, true),
  ).toBe('ready on the built-in classifier, by choice; routing subagent model, main effort')
})

test('the decision line carries every answer and the latency', () => {
  const decision = readDecision(gatewayAnswer('deep', { deep: 0.95 }, 0.01, 2.8))
  expect(describeDecision(decision, 249.4)).toBe(
    'tier deep (0.95) · effort 2.8 → xhigh (0.90) · risky 0.01 · 249ms',
  )
})

test('a classification that never answered says that, not nothing', () => {
  expect(describeDecision(null, 800)).toBe('no answer · 800ms')
})

test('the status line distinguishes a change from a deliberate no-change', () => {
  const decision = readDecision(gatewayAnswer('fast', { fast: 0.87 }))
  expect(describeStatus(decision, { model: 'haiku', effort: 'low' })).toBe(
    'jev · fast 0.87 → haiku/low',
  )
  expect(describeStatus(decision, null)).toBe('jev · fast 0.87 · unchanged')
  expect(describeStatus(null, null)).toBe('jev · no answer')
})

// `turn.step`'s `model` goes to the API as written, so a family alias has to
// become an id there; the engine refuses "haiku" on a request.
test('a family alias resolves to a full id for the main loop', () => {
  expect(requestModelId('haiku')).toBe('claude-haiku-4-5-20251001')
  expect(requestModelId('Sonnet')).toBe('claude-sonnet-5')
  expect(requestModelId('opus')).toBe('claude-opus-5')
})

test('a full id or an unknown name is passed through unchanged', () => {
  expect(requestModelId('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5-20251001')
  expect(requestModelId('claude-opus-5[1m]')).toBe('claude-opus-5[1m]')
  expect(requestModelId('my-org/custom')).toBe('my-org/custom')
})

// Staying in the same tier is not a change, so a session on `claude-opus-5[1m]`
// keeps its 1M-context id when the decision is `deep`.
test('a decision for the tier the session already runs keeps its exact id', () => {
  const decision = readDecision(gatewayAnswer('deep', { deep: 0.95 }))
  const routing = route(decision, { model: 'claude-opus-5[1m]', effort: 'medium' }, config)
  expect(routing.model).toBeNull()
})

test('a slash command alone is not a task; with text after it, it is', () => {
  for (const text of ['/simplify', ' /run ', '/code-review\n']) expect(bareCommand(text)).toBe(true)
  for (const text of ['/code-review high', '/simplify the retry loop', '/tmp/log.txt', '/', 'fix /api', 'rename foo'])
    expect(bareCommand(text)).toBe(false)
})
