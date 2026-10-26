import { expect, test } from 'bun:test'
import { NOT_A_TASK, recentContext } from '../hooks/context.ts'
import type { ContextMessage } from '../hooks/context.ts'
import {
  adviseStrategy,
  EFFORT_ORDER,
  effortLevel,
  effortScoreOf,
  escalate,
  questions,
  readDecision,
  requestBody,
  route,
  STRATEGY_ORDER,
  SUBAGENT_EFFORT_INSTRUCTIONS,
  EFFORT_INSTRUCTIONS,
  isFollowUp,
} from '../hooks/model-router.policy.ts'
import type { Decision, PolicyConfig, Strategy, StrategyConfig } from '../hooks/model-router.policy.ts'
import { requestBody as skillRequestBody, wideQuestions } from '../hooks/skill-suggestion.policy.ts'

const user = (text: string, toolResults?: { isError: boolean }[]): ContextMessage => ({ role: 'user', text, toolResults })
const assistant = (text: string, toolUses: { tool: string; isError?: true }[] = []): ContextMessage => ({
  role: 'assistant',
  text,
  toolUses,
})

// --- recent context -------------------------------------------------------------

test('a follow-up carries the conversation it continues, newest last', () => {
  const messages = [
    user('migrate the orders table to the new schema'),
    assistant('Plan: add columns, backfill, swap reads. Shall I start?'),
  ]
  const recent = recentContext(messages, 'yes do it', { messages: 4, chars: 2000 })
  expect(recent.split('\n')).toEqual([
    'user: migrate the orders table to the new schema',
    'assistant: Plan: add columns, backfill, swap reads. Shall I start?',
  ])
})

test('the prompt itself is not repeated when the transcript already holds it', () => {
  const messages = [assistant('Done.'), user('yes do it')]
  expect(recentContext(messages, 'yes do it', { messages: 4, chars: 2000 })).toBe('assistant: Done.')
})

test('tool names travel with their failure, never their input or output', () => {
  const messages = [
    assistant('Running the tests.', [{ tool: 'Bash' }, { tool: 'Edit', isError: true }]),
    user('', [{ isError: false }, { isError: true }]),
  ]
  const recent = recentContext(messages, 'why', { messages: 4, chars: 2000 })
  expect(recent).toBe('assistant: Running the tests. [tools: Bash, Edit (failed)]')
})

test('the message count and the character budget both hold, newest kept first', () => {
  const messages = Array.from({ length: 10 }, (_, index) => user(`message ${index} ${'x'.repeat(300)}`))
  const byCount = recentContext(messages, 'p', { messages: 3, chars: 100_000 })
  expect(byCount.split('\n').map((line) => line.split(' ')[2])).toEqual(['7', '8', '9'])
  const byBudget = recentContext(messages, 'p', { messages: 10, chars: 700 })
  expect(byBudget.length).toBeLessThanOrEqual(700)
  expect(byBudget.endsWith('…')).toBe(true)
  expect(byBudget).toContain('message 9')
})

test('zero messages or zero characters sends nothing', () => {
  const messages = [user('a'), assistant('b')]
  expect(recentContext(messages, 'p', { messages: 0, chars: 2000 })).toBe('')
  expect(recentContext(messages, 'p', { messages: 4, chars: 0 })).toBe('')
  expect(recentContext([], 'p', { messages: 4, chars: 2000 })).toBe('')
})

test('a budget smaller than one message still sends the newest message, cut to fit', () => {
  const messages = [user('older'), user('x'.repeat(1000))]
  for (const limits of [
    { messages: 1, chars: 300 },
    { messages: 4, chars: 150 },
  ]) {
    const recent = recentContext(messages, 'p', limits)
    expect(recent.startsWith('user: xxx')).toBe(true)
    expect(recent.length).toBeLessThanOrEqual(limits.chars)
  }
})

test('notifications and peer messages are not tasks', () => {
  expect(NOT_A_TASK.has('task-notification')).toBe(true)
  expect(NOT_A_TASK.has('peer')).toBe(true)
})

// --- effort ladder and ceiling --------------------------------------------------

const config: PolicyConfig = {
  tiers: { fast: 'haiku', balanced: 'sonnet', deep: 'opus' },
  minUpgradeConfidence: 0.3,
  minDowngradeConfidence: 0.6,
}

const decided = (patch: Partial<Decision>): Decision => ({
  tier: 'deep',
  confidence: 0.9,
  risky: 0.01,
  effort: 2,
  effortConfidence: 0.9,
  strategy: null,
  strategyConfidence: null,
  ...patch,
})

test('the rubric reaches max, and every rung is reachable from its own score', () => {
  expect(EFFORT_ORDER).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
  EFFORT_ORDER.forEach((level, score) => expect(effortLevel(score)).toBe(level))
  // Effort is asked as a choice: one named option per rung, low to max.
  const options = (questions('typesafe').effort as { type: string; criteria: Record<string, string> })
  expect(options.type).toBe('choice')
  expect(Object.keys(options.criteria)).toEqual([...EFFORT_ORDER])
})

test('the ceiling caps what the router asks for', () => {
  const hardest = decided({ effort: 4 })
  expect(route(hardest, { model: 'claude-opus-5-5', effort: 'low' }, config).effort).toBe('max')
  expect(route(hardest, { model: 'claude-opus-5-5', effort: 'low' }, { ...config, maxEffort: 'high' }).effort).toBe('high')
})

test('the ceiling never pulls down an effort the person set above it', () => {
  const easy = decided({ effort: 0, effortConfidence: 0.99 })
  expect(route(easy, { model: 'claude-opus-5-5', effort: 'max' }, { ...config, maxEffort: 'high' }).effort).toBeNull()
})

// --- escalation -----------------------------------------------------------------

test('trouble raises effort at least one rung, and a fresh reading may raise it further', () => {
  for (const [index, level] of EFFORT_ORDER.slice(0, -1).entries()) {
    expect(escalate(level, 2, 2, null, {})).toBe(EFFORT_ORDER[index + 1])
  }
  expect(escalate('medium', 3, 2, 4, {})).toBe('max')
  // A reading below the next rung does not hold the raise back.
  expect(escalate('high', 2, 2, 0, {})).toBe('xhigh')
})

test('no raise below the threshold, at the ceiling, for a numeric effort, or when switched off', () => {
  expect(escalate('medium', 1, 2, 4, {})).toBeNull()
  expect(escalate('max', 5, 2, 4, {})).toBeNull()
  expect(escalate('high', 5, 2, 4, { maxEffort: 'high' })).toBeNull()
  expect(escalate(8000, 5, 2, 4, {})).toBeNull()
  expect(escalate('medium', 5, 0, 4, {})).toBeNull()
  expect(escalate('medium', 5, 2, 4, { maxEffort: 'xhigh' })).toBe('xhigh')
})

test('an unset effort is raised from the middle of the ladder', () => {
  expect(escalate(undefined, 2, 2, null, {})).toBe('high')
})

// --- strategy -------------------------------------------------------------------

const strategyConfig: StrategyConfig = { minConfidence: 0.6, minGraphConfidence: 0.8, graphSkill: '' }

test('the strategy is asked only for the main conversation', () => {
  expect(questions('openrouter', true).strategy).toBeDefined()
  expect(questions('openrouter').strategy).toBeUndefined()
  const asked = JSON.parse(requestBody('openrouter', { prompt: 'x' }, 'm', true)).questions.strategy
  expect(Object.keys(asked.criteria)).toEqual([...STRATEGY_ORDER])
  expect(JSON.parse(requestBody('openrouter', { prompt: 'x' }, 'm')).questions.strategy).toBeUndefined()
})

test('a strategy answer is read with its confidence; a missing or unknown one is null', () => {
  const body = (strategy: unknown) =>
    JSON.stringify({
      answers: {
        tier: { choice: 'deep', confidence: 0.9 },
        strategy: { choice: strategy, confidence: 0.7 },
      },
    })
  const read = readDecision(body('parallel'))
  expect(read?.strategy).toBe('parallel')
  expect(read?.strategyConfidence).toBe(0.7)
  // An unknown strategy does not throw away the rest of the decision.
  expect(readDecision(body('swarm'))?.tier).toBe('deep')
  expect(readDecision(body('swarm'))?.strategy).toBeNull()
  expect(readDecision(JSON.stringify({ answers: { tier: { choice: 'fast' } } }))?.strategy).toBeNull()
})

test('direct, no answer, and an unmeasured answer all attach nothing', () => {
  expect(adviseStrategy(null, strategyConfig).block).toBeNull()
  expect(adviseStrategy(decided({ strategy: 'direct', strategyConfidence: 0.99 }), strategyConfig).block).toBeNull()
  for (const strategy of STRATEGY_ORDER) {
    expect(adviseStrategy(decided({ strategy, strategyConfidence: null }), strategyConfig).block).toBeNull()
  }
})

test('each strategy clears its own bar, and graph the higher one', () => {
  const at = (strategy: Strategy, strategyConfidence: number) =>
    adviseStrategy(decided({ strategy, strategyConfidence }), strategyConfig).block
  for (const strategy of ['delegate', 'parallel'] as const) {
    expect(at(strategy, 0.59)).toBeNull()
    expect(at(strategy, 0.6)).toContain(`carried out as: ${strategy}`)
  }
  expect(at('graph', 0.79)).toBeNull()
  expect(at('graph', 0.8)).toContain('carried out as: graph')
})

test('a split must agree with the tier: no parallel for mechanical work, no graph short of deep', () => {
  const advise = (strategy: Strategy, tier: Decision['tier']) =>
    adviseStrategy(decided({ strategy, strategyConfidence: 0.95, tier }), strategyConfig).block
  expect(advise('parallel', 'fast')).toBeNull()
  expect(advise('parallel', 'balanced')).not.toBeNull()
  expect(advise('graph', 'balanced')).toBeNull()
  expect(advise('graph', 'deep')).not.toBeNull()
  expect(advise('delegate', 'fast')).not.toBeNull()
})

test('the graph advice is plain subagent waves unless a graph skill is named', () => {
  const graph = decided({ strategy: 'graph', strategyConfidence: 0.9 })
  const plain = adviseStrategy(graph, strategyConfig).block as string
  expect(plain).toContain('wave')
  expect(plain).not.toContain('skill')
  const named = adviseStrategy(graph, { ...strategyConfig, graphSkill: 'agentic-graph-skill' }).block as string
  expect(named).toContain('`agentic-graph-skill`')
  expect(named).toContain('prefer the plain version')
})

test('the advice is a tagged block that says it may be ignored', () => {
  const block = adviseStrategy(decided({ strategy: 'delegate', strategyConfidence: 0.7 }), strategyConfig).block as string
  expect(block.startsWith('<execution_strategy>')).toBe(true)
  expect(block.endsWith('</execution_strategy>')).toBe(true)
  expect(block).toContain('ignore this')
})

// --- the skill suggester reads the same context ----------------------------------

test('the skill request carries the recent context as its state', () => {
  const asked = wideQuestions('openrouter', [{ name: 'a', description: 'b' }])
  expect(JSON.parse(skillRequestBody('openrouter', 'do it', asked, 'm', 'user: plan X')).state).toEqual({
    request: 'do it',
    recent_context: 'user: plan X',
  })
  expect(JSON.parse(skillRequestBody('openrouter', 'do it', asked, 'm')).state.recent_context).toBe('')
})

// --- two ceilings: where a turn starts, how far trouble raises it ---------------

test('a turn starts no higher than xhigh, and trouble can still take it to max', () => {
  const start: PolicyConfig = { ...config, maxEffort: 'xhigh' }
  // Jev reads the task as needing everything: the turn still starts at xhigh.
  expect(route(decided({ effort: 4 }), { model: 'claude-opus-5-5', effort: 'medium' }, start).effort).toBe('xhigh')
  // Two failures later, the raise has its own ceiling.
  expect(escalate('xhigh', 2, 2, 4, { maxEffort: 'max' })).toBe('max')
  // With the raise capped at xhigh too, a turn already there stays.
  expect(escalate('xhigh', 2, 2, 4, { maxEffort: 'xhigh' })).toBeNull()
})

// --- close calls lean up ----------------------------------------------------------

// The shapes below are TypeSafe's documented Score answers: probabilities keyed
// "0".."N-1" by level, the score their weighted mean.
test('a near tie between two levels takes the higher one', () => {
  const answer = (probabilities: Record<string, number>, effort: number) => ({ effort, effortProbabilities: probabilities })
  // 57% level 1, 43% level 2: within 0.15, so level 2.
  expect(effortScoreOf(answer({ '0': 0, '1': 0.57, '2': 0.43 }, 1.43), 0.15)).toBe(2)
  // 74% level 1, 26% level 2: a clear call stays at 1.
  expect(effortScoreOf(answer({ '0': 0, '1': 0.74, '2': 0.26 }, 1.26), 0.15)).toBe(1)
  // A near tie with a LOWER runner-up never pulls down.
  expect(effortScoreOf(answer({ '2': 0.55, '1': 0.45 }, 1.55), 0.15)).toBe(2)
  // Margin 0 is the plain top of the distribution.
  expect(effortScoreOf(answer({ '1': 0.57, '2': 0.43 }, 1.43), 0)).toBe(1)
})

test('without a distribution, a bare score rounds up from 0.5 - margin', () => {
  const bare = (effort: number | null) => ({ effort, effortProbabilities: null })
  expect(effortScoreOf(bare(1.34), 0.15)).toBe(1)
  expect(effortScoreOf(bare(1.35), 0.15)).toBe(2)
  expect(effortScoreOf(bare(1.49), 0)).toBe(1)
  expect(effortScoreOf(bare(1.5), 0)).toBe(2)
  expect(effortScoreOf(bare(9), 0.15)).toBe(4)
  expect(effortScoreOf(bare(-1), 0.15)).toBe(0)
  expect(effortScoreOf(bare(null), 0.15)).toBeNull()
})

test('keys off the rubric, or non-numbers, are ignored rather than guessed at', () => {
  const odd = { effort: 1.2, effortProbabilities: { casual: 0.9, '7': 0.8, '-1': 0.9, '1': Number.NaN } }
  // Nothing usable in the distribution: the score decides.
  expect(effortScoreOf(odd, 0.15)).toBe(1)
})

test('the route acts on the leaned level', () => {
  const tied = decided({ effort: 1.43, effortProbabilities: { '1': 0.57, '2': 0.43 }, effortConfidence: 0.9 })
  expect(route(tied, { model: 'claude-opus-5-5', effort: 'low' }, { ...config, closeMargin: 0.15 }).effort).toBe('high')
  expect(route(tied, { model: 'claude-opus-5-5', effort: 'low' }, config).effort).toBe('medium')
})

// --- the questions themselves ------------------------------------------------------

test('every effort option says when to choose it, one per rung', () => {
  const options = (questions('openrouter').effort as { criteria: Record<string, string> }).criteria
  expect(Object.keys(options)).toEqual([...EFFORT_ORDER])
  for (const when of Object.values(options)) expect(when.length).toBeGreaterThan(40)
})

test('every model option names its model and says when to choose it; Sonnet has its own place', () => {
  const tiers = (questions('openrouter').tier as { type: string; criteria: Record<string, string> }).criteria
  expect(tiers.fast).toMatch(/^Haiku\. Choose when there is no logic/)
  expect(tiers.balanced).toMatch(/^Sonnet\. Choose when the logic is ordinary or already written down/)
  expect(tiers.deep).toMatch(/^Opus\. Choose when the work needs real judgment/)
})

test('an effort answer given as a choice reads as probabilities by rung, with their mean as the score', () => {
  const text = JSON.stringify({
    answers: {
      tier: { type: 'choice', choice: 'balanced', probabilities: { fast: 0.1, balanced: 0.8, deep: 0.1 }, confidence: 0.8 },
      effort: { type: 'choice', choice: 'high', probabilities: { low: 0, medium: 0.2, high: 0.7, xhigh: 0.1, max: 0 }, confidence: 0.7 },
      risky: { type: 'noul', noul: 0.05 },
    },
  })
  const decision = readDecision(text)
  expect(decision?.effortProbabilities).toEqual({ '0': 0, '1': 0.2, '2': 0.7, '3': 0.1, '4': 0 })
  expect(decision?.effort).toBeCloseTo(1.9)
  expect(decision?.effortConfidence).toBe(0.7)
  expect(effortScoreOf(decision as Decision, 0.15)).toBe(2)
})

test('the risk question says what true and false look like, where the schema takes it', () => {
  const noul = questions('openrouter').risky as { type: string; criteria?: { true: string; false: string } }
  expect(noul.type).toBe('noul')
  expect(noul.criteria?.true).toContain('deploying')
  expect(noul.criteria?.false).toContain('locally')
  const gateway = questions('gateway').risky as { type: string; criteria?: unknown }
  expect(gateway.type).toBe('boolean')
  expect(gateway.criteria).toBeUndefined()
})

// ---- above high, the bar is how sure the model is --------------------------------
// Distributions below are Jev's real answers for subagent briefs of 2026-09-24.

const dist = (probabilities: Record<string, number>, effort: number) => ({ effort, effortProbabilities: probabilities })
const bareScore = (effort: number) => ({ effort, effortProbabilities: null })

test('the lean on close calls stops at high: a near split with xhigh stays high', () => {
  // "Accept slow successful heartbeats": high 52, xhigh 45, max 1.
  expect(effortScoreOf(dist({ '2': 0.52, '3': 0.45, '4': 0.01 }, 2.47), 0.15)).toBe(2)
  // "Build plan 3 tasks 1-4": xhigh 51 on top, but xhigh and max hold 57 in all.
  expect(effortScoreOf(dist({ '2': 0.42, '3': 0.51, '4': 0.06 }, 2.63), 0.15)).toBe(2)
})

test('xhigh when the model is at least 60% sure the task is very hard, even with high on top', () => {
  // "Fix plan-3 Codex findings": xhigh 84, max 14.
  expect(effortScoreOf(dist({ '2': 0.02, '3': 0.84, '4': 0.14 }, 3.12), 0.15)).toBe(3)
  // high came top, but xhigh and max together hold 60.
  expect(effortScoreOf(dist({ '2': 0.4, '3': 0.35, '4': 0.25 }, 2.85), 0.15)).toBe(3)
  // The bar is adjustable.
  expect(effortScoreOf(dist({ '2': 0.42, '3': 0.51, '4': 0.06 }, 2.63), 0.15, 0.5)).toBe(3)
})

test('a bare score leans up only as far as high', () => {
  expect(effortScoreOf(bareScore(1.4), 0.15)).toBe(2)
  expect(effortScoreOf(bareScore(2.4), 0.15)).toBe(2)
  expect(effortScoreOf(bareScore(2.5), 0.15)).toBe(3)
})

test('a subagent is asked about carrying out its brief, on the same rubric', () => {
  const general = questions('openrouter') as Record<string, { instructions: string; criteria: string[] }>
  const subagent = questions('openrouter', false, true) as Record<string, { instructions: string; criteria: string[] }>
  expect(subagent.effort?.instructions).toBe(SUBAGENT_EFFORT_INSTRUCTIONS)
  expect(general.effort?.instructions).not.toBe(SUBAGENT_EFFORT_INSTRUCTIONS)
  expect(subagent.effort?.criteria).toEqual(general.effort?.criteria)
  expect(JSON.parse(requestBody('openrouter', { prompt: 'x' }, 'm', false, true)).questions.effort.instructions).toBe(SUBAGENT_EFFORT_INSTRUCTIONS)
})

// ---- the graph blueprint: nodes, edges, shared state, a reviewer, bounds ------------

test('graph advice is a small blueprint: real nodes, parallel waves, one plan file, a separate reviewer, bounds', () => {
  const graph = adviseStrategy(
    { tier: 'deep', confidence: 0.9, risky: 0, effort: 3, effortConfidence: 0.8, strategy: 'graph', strategyConfidence: 0.95 },
    { minConfidence: 0.6, minGraphConfidence: 0.8, graphSkill: '' },
  ).block as string
  expect(graph).toContain('A step you could do inline is not a node')
  expect(graph).toContain('in one message, in the background')
  expect(graph).toContain('one plan file')
  expect(graph).toContain('separate read-only reviewer')
  expect(graph).toContain('at most 4 subagents at a time')
  expect(graph).toContain('one breath')
})

test('parallel advice fans out in the background and joins once', () => {
  const parallel = adviseStrategy(
    { tier: 'balanced', confidence: 0.9, risky: 0, effort: 2, effortConfidence: 0.8, strategy: 'parallel', strategyConfidence: 0.9 },
    { minConfidence: 0.6, minGraphConfidence: 0.8, graphSkill: '' },
  ).block as string
  expect(parallel).toContain('Fan out, then join')
  expect(parallel).toContain('in the background')
  expect(parallel).toContain('Two pieces that touch the same file are one piece')
})

// ---- measured fixes (76 labelled real requests, 2026-09-24) ------------------------

test('a short reply that is not a question is a follow-up; a question is not', () => {
  for (const reply of ['fix all and continue', 'ok go ahead with the iam update', '1', 'yes do it', 'the limit already reset']) {
    expect(isFollowUp(reply)).toBe(true)
  }
  for (const other of ['what status?', 'is it finish', 'why does the build fail', 'rename getUser to fetchUser across the api, its callers, the tests and the docs please']) {
    expect(isFollowUp(other)).toBe(false)
  }
})

test('a follow-up may raise the effort, never lower it', () => {
  const lowAnswer = { tier: 'fast' as const, confidence: 0.95, risky: 0, effort: 0, effortConfidence: 0.95, effortProbabilities: { '0': 0.95, '1': 0.05 } }
  expect(route(lowAnswer, { model: 'claude-opus-5-5', effort: 'medium' }, config).effort).toBe('low')
  expect(route(lowAnswer, { model: 'claude-opus-5-5', effort: 'medium' }, config, { noLowering: true }).effort).toBeNull()
  const highAnswer = { ...lowAnswer, effort: 2, effortProbabilities: { '2': 0.9, '1': 0.1 } }
  expect(route(highAnswer, { model: 'claude-opus-5-5', effort: 'medium' }, config, { noLowering: true }).effort).toBe('high')
})

test('the conversation question rates the work, not the topic', () => {
  expect((questions('openrouter') as Record<string, { instructions: string }>).effort?.instructions).toBe(EFFORT_INSTRUCTIONS)
  expect(EFFORT_INSTRUCTIONS).toContain('Rate the work, not how important the topic sounds')
  expect(SUBAGENT_EFFORT_INSTRUCTIONS).toContain('Rate the work, not how important the topic sounds')
})

test('the newest assistant message keeps its beginning and its end: where it asks what a short reply answers', () => {
  const report = `Plan 1 is merged. ${'The tests pass and the typecheck is clean. '.repeat(40)}Should I start writing plan 2?`
  const recent = recentContext([user('build plan 1'), assistant(report)], 'ok do it', { messages: 4, chars: 2000 })
  expect(recent).toContain('Plan 1 is merged.')
  expect(recent).toContain('Should I start writing plan 2?')
  expect(recent.length).toBeLessThanOrEqual(2000)
})
