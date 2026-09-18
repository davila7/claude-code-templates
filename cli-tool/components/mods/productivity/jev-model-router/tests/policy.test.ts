import { expect, test } from 'bun:test'
import { rankOf, readDecision, requestHeaders, route } from '../hooks/policy.ts'
import type { PolicyConfig } from '../hooks/policy.ts'

const config: PolicyConfig = {
  tiers: { fast: 'haiku', balanced: 'sonnet', deep: 'opus' },
  minConfidence: 0.6,
  pinModelFloor: true,
}

const gatewayAnswer = (tier: string, probabilities?: Record<string, number>, risky = 0.01) =>
  JSON.stringify({
    answers: {
      tier: { type: 'choice', choice: tier, ...(probabilities ? { probabilities } : {}) },
      effort: { type: 'score', score: 1.4 },
      risky: { type: 'boolean', probability: risky },
    },
    usage: { inputTokens: 120, outputTokens: 0 },
  })

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

test('a decision below the confidence threshold leaves the model alone', () => {
  const decision = readDecision(gatewayAnswer('fast', { fast: 0.51, balanced: 0.4, deep: 0.09 }))
  expect(route(decision, 'claude-sonnet-5', config).model).toBeNull()
})

test('the floor blocks a downgrade and lets an upgrade through', () => {
  const down = readDecision(gatewayAnswer('fast', { fast: 0.95, balanced: 0.04, deep: 0.01 }))
  expect(route(down, 'claude-opus-5', config).model).toBeNull()
  expect(route(down, 'claude-opus-5', { ...config, pinModelFloor: false }).model).toBe('haiku')

  const up = readDecision(gatewayAnswer('deep', { fast: 0.02, balanced: 0.08, deep: 0.9 }))
  expect(route(up, 'claude-haiku-4-5-20251001', config).model).toBe('opus')
})

test('a risky task is never routed down, whatever the tier says', () => {
  const decision = readDecision(gatewayAnswer('fast', { fast: 0.97, balanced: 0.02, deep: 0.01 }, 0.93))
  expect(route(decision, 'claude-sonnet-5', { ...config, pinModelFloor: false }).model).toBe('opus')
})

test('no decision, and a decision that changes nothing, both leave the request as it is', () => {
  expect(route(null, 'claude-sonnet-5', config).model).toBeNull()
  const same = readDecision(gatewayAnswer('balanced', { fast: 0.05, balanced: 0.9, deep: 0.05 }))
  expect(route(same, 'sonnet', config).model).toBeNull()
})

test('an unrecognised model id disables the floor instead of guessing its tier', () => {
  expect(rankOf('some-other-vendor-model', config.tiers)).toBeNull()
  const down = readDecision(gatewayAnswer('fast', { fast: 0.95, balanced: 0.04, deep: 0.01 }))
  expect(route(down, 'some-other-vendor-model', config).model).toBe('haiku')
})

test('the request carries the model id and spec version the Gateway matches on', () => {
  const headers = requestHeaders('key-under-test', 'typesafe-ai/jev')
  expect(headers['ai-model-id']).toBe('typesafe-ai/jev')
  expect(headers['ai-evaluation-model-specification-version']).toBe('4')
  expect(headers.authorization).toBe('Bearer key-under-test')
})
