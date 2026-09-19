import { expect, test } from 'bun:test'
import {
  GATE_QUESTIONS,
  NONE,
  builtinWide,
  catalog,
  classifyText,
  decide,
  describeRerank,
  describeSetup,
  describeStatus,
  describeWide,
  detailOf,
  modelInvocable,
  endpoint,
  installPathsOf,
  parseListing,
  parseNames,
  passesGate,
  pluginFileCandidates,
  readRerank,
  readWide,
  rerankQuestions,
  requestBody,
  requestHeaders,
  selectProvider,
  shortlistOf,
  skillFileCandidates,
  suggestionBlock,
  trimListing,
  wideQuestions,
} from '../hooks/policy.ts'
import type { Candidate, PolicyConfig, Skill } from '../hooks/policy.ts'

const config: PolicyConfig = { shortlist: 3, gateThreshold: 0.3, fitsThreshold: 0.3 }

const LISTING = [
  'The following skills are available for use with the Skill tool:',
  '',
  '- commit: Create a git commit from the staged changes',
  '- engineering:code-review: Review code changes for security, performance, and correctness.',
  '  Trigger with a PR URL or diff.',
  '- pdf',
  '- deploy-checklist: Pre-deployment verification checklist',
].join('\n')

const skills: Skill[] = [
  { name: 'commit', description: 'Create a git commit from the staged changes' },
  { name: 'pptx-author', description: 'Build PowerPoint decks headless with python-pptx' },
  { name: 'powerpoint', description: 'Create, read, edit .pptx decks, slides, notes, templates' },
  { name: 'pdf', description: '' },
]

/** A TypeSafe-shaped answer to the first request. */
const wideAnswer = (
  choice: string,
  probabilities: Record<string, number> | undefined,
  gate: Partial<Record<keyof typeof GATE_QUESTIONS, number>> = {},
) => {
  const answers: Record<string, unknown> = {
    which: { type: 'choice', choice, ...(probabilities ? { probabilities } : {}), confidence: 0.9 },
  }
  for (const [key, value] of Object.entries(gate)) answers[`gate::${key}`] = { type: 'noul', noul: value }
  return JSON.stringify({ answers })
}

/** A Gateway-shaped answer to the second request: `boolean` + `probability`. */
const rerankAnswer = (winner: string, fits: Record<string, number>) => {
  const answers: Record<string, unknown> = { which: { type: 'choice', choice: winner } }
  for (const [name, value] of Object.entries(fits))
    answers[`fits::${name}`] = { type: 'boolean', probability: value }
  return JSON.stringify({ answers })
}

const DECK = { powerpoint: 0.7, 'pptx-author': 0.3, commit: 0, pdf: 0 }
const ACTION = { acts_on_user_system: 0.8, would_follow_documented_procedure: 0.9, prose_suffices: 0.1 }
const PROSE = { acts_on_user_system: 0.05, would_follow_documented_procedure: 0.2, prose_suffices: 0.95 }

test('the listing parses one skill per entry, keeps a name with a colon whole, and joins wrapped lines', () => {
  const parsed = parseListing(LISTING)
  expect(parsed.map((skill) => skill.name)).toEqual([
    'commit',
    'engineering:code-review',
    'pdf',
    'deploy-checklist',
  ])
  expect(parsed[1]?.description).toBe(
    'Review code changes for security, performance, and correctness. Trigger with a PR URL or diff.',
  )
  expect(parsed[2]?.description).toBe('')
})

test('trimming the listing keeps only the named skills under the original header, or nothing', () => {
  expect(trimListing(LISTING, parseNames('pdf, commit'))).toBe(
    [
      'The following skills are available for use with the Skill tool:',
      '',
      '- commit: Create a git commit from the staged changes',
      '- pdf',
    ].join('\n'),
  )
  expect(trimListing(LISTING, new Set())).toBeNull()
  expect(trimListing(LISTING, parseNames('nope'))).toBeNull()
})

test('the catalog keeps only plugin and user skills, drops excluded names, and narrows to the listing once one was seen', () => {
  const commands = [
    { name: 'help', description: 'Show help', source: 'builtin' },
    { name: 'summarize', description: 'An MCP prompt', source: 'mcp' },
    { name: 'commit', description: 'Create a git commit', source: 'plugin' },
    { name: 'commit', description: 'duplicate', source: 'user' },
    { name: 'lint', description: 'Python Linter', source: 'user' },
  ]
  expect(catalog(commands, new Set(), new Set()).map((s) => s.name)).toEqual(['commit', 'lint'])
  expect(catalog(commands, new Set(), parseNames('lint')).map((s) => s.name)).toEqual(['commit'])
  expect(catalog(commands, new Set(['lint']), new Set()).map((s) => s.name)).toEqual(['lint'])
})

test('the first request ranks every skill and asks the three gate nouls, boolean on the Gateway', () => {
  const typesafe = wideQuestions('typesafe', skills) as Record<
    string,
    { type: string; criteria?: Record<string, string> }
  >
  expect(Object.keys(typesafe)).toEqual([
    'which',
    'gate::acts_on_user_system',
    'gate::would_follow_documented_procedure',
    'gate::prose_suffices',
  ])
  expect(Object.keys(typesafe.which?.criteria ?? {})).toEqual(['commit', 'pptx-author', 'powerpoint', 'pdf'])
  expect(typesafe.which?.criteria?.pdf).toContain('pdf')
  expect(typesafe['gate::prose_suffices']?.type).toBe('noul')
  const gateway = wideQuestions('gateway', skills) as Record<string, { type: string }>
  expect(gateway['gate::prose_suffices']?.type).toBe('boolean')
})

test('the gate is the mean of the oriented nouls: an action passes, a prose question does not', () => {
  const action = readWide(wideAnswer('powerpoint', DECK, ACTION))
  expect(action?.gate).toBeCloseTo((0.8 + 0.9 + 0.9) / 3)
  expect(passesGate(action!, config)).toBe(true)
  const prose = readWide(wideAnswer('commit', { commit: 0.6, pdf: 0.4 }, PROSE))
  expect(prose?.gate).toBeCloseTo((0.05 + 0.2 + 0.05) / 3)
  expect(passesGate(prose!, config)).toBe(false)
  expect(decide(prose, null, skills, config)).toEqual({ name: null, reason: 'needs a skill 0.10 < 0.3' })
})

test('the ranking is the distribution, surest first; without one the named choice stands alone', () => {
  const wide = readWide(wideAnswer('powerpoint', DECK, ACTION))
  expect(wide?.ranked.slice(0, 2).map((e) => e.name)).toEqual(['powerpoint', 'pptx-author'])
  expect(shortlistOf(wide!, skills, 3).map((s) => s.name)).toEqual(['powerpoint', 'pptx-author', 'commit'])
  const bare = readWide(wideAnswer('commit', undefined, ACTION))
  expect(bare?.ranked).toEqual([{ name: 'commit', probability: 0.9 }])
  // A backend answer missing any gate noul is incomplete: null gate, fails closed.
  const partial = readWide(wideAnswer('commit', undefined, { acts_on_user_system: 0.9 }))
  expect(partial?.gate).toBeNull()
  expect(passesGate(partial!, config)).toBe(false)
  expect(decide(partial, null, skills, config)).toEqual({
    name: null,
    reason: 'gate not answered; no suggestion',
  })
  // The built-in classifier never asks the gate and passes by design.
  expect(passesGate(builtinWide('commit')!, config)).toBe(true)
})

test('the rerank can flip the winner, and its fits nouls can reject the whole shortlist', () => {
  const wide = readWide(wideAnswer('powerpoint', DECK, ACTION))
  const flipped = readRerank(
    rerankAnswer('pptx-author', { powerpoint: 0.73, 'pptx-author': 0.38, commit: 0.02 }),
  )
  expect(decide(wide, flipped, skills, config)).toEqual({
    name: 'pptx-author',
    reason: 'rerank of 3, fits 0.38',
  })
  const rejected = readRerank(
    rerankAnswer('powerpoint', { powerpoint: 0.2, 'pptx-author': 0.1, commit: 0.0 }),
  )
  expect(decide(wide, rejected, skills, config)).toEqual({
    name: null,
    reason: 'nothing fits, best 0.20 < 0.3',
  })
  // A winner that was never on the shortlist is not trusted.
  const stray = readRerank(rerankAnswer('made-up', { powerpoint: 0.9, 'pptx-author': 0.1, commit: 0 }))
  expect(decide(wide, stray, skills, config).name).toBeNull()
  // An answer that leaves out any candidate's fits is incomplete.
  const partial = readRerank(rerankAnswer('powerpoint', { powerpoint: 0.9 }))
  expect(decide(wide, partial, skills, config)).toEqual({
    name: null,
    reason: 'rerank left out fits for pptx-author, commit; no suggestion',
  })
  expect(decide(wide, readRerank(rerankAnswer('powerpoint', {})), skills, config).name).toBeNull()
})

test('with the rerank off the top of the ranking is suggested; with it attempted and failed, nothing is', () => {
  const wide = readWide(wideAnswer('powerpoint', DECK, ACTION))
  expect(decide(wide, null, skills, config)).toEqual({
    name: 'powerpoint',
    reason: 'top of 4 (0.70), no rerank',
  })
  expect(decide(wide, null, skills, config, true)).toEqual({
    name: null,
    reason: 'rerank gave no answer; no suggestion',
  })
  expect(decide(null, null, skills, config)).toEqual({ name: null, reason: 'no answer' })
})

test('the built-in classifier gives one label and no gate; none means nothing', () => {
  expect(decide(builtinWide('commit'), null, skills, config).name).toBe('commit')
  expect(decide(builtinWide(NONE), null, skills, config)).toEqual({ name: null, reason: 'nothing ranked' })
  expect(builtinWide(undefined)).toBeNull()
  const asked = classifyText('review this diff', skills)
  expect(asked).toContain('- commit: Create a git commit from the staged changes')
  expect(asked).toContain(`- ${NONE}:`)
})

test("the second request reads each candidate's detail and asks one fits noul per candidate", () => {
  const candidates: Candidate[] = [
    {
      name: 'powerpoint',
      description: 'Create, read, edit .pptx',
      detail: 'Create, read, edit .pptx — # PowerPoint\nEdit decks…',
    },
    { name: 'pptx-author', description: 'Build decks', detail: 'Build decks — # Author\nHeadless…' },
  ]
  const questions = rerankQuestions('typesafe', candidates) as Record<
    string,
    { type: string; instructions: string; criteria?: Record<string, string> }
  >
  expect(Object.keys(questions)).toEqual(['which', 'fits::powerpoint', 'fits::pptx-author'])
  expect(questions.which?.criteria?.powerpoint).toBe(candidates[0]?.detail)
  expect(questions['fits::pptx-author']?.instructions).toContain("'pptx-author'")
  expect(questions['fits::pptx-author']?.type).toBe('noul')
})

test("a skill's detail is its frontmatter description plus the opening of its body, frontmatter stripped", () => {
  const markdown =
    '---\nname: pptx-author\ndescription: "Build PowerPoint decks headless with python-pptx, from an outline or a template"\n---\n# pptx-author\n\nUse python-pptx…'
  const skill = skills[1] as Skill
  expect(detailOf(skill, markdown, 20)).toBe(
    'Build PowerPoint decks headless with python-pptx, from an outline or a template — # pptx-author\n\nUse p',
  )
  // The frontmatter's description is canonical even when the typeahead's line is longer.
  expect(detailOf(skill, '---\ndescription: Decks.\n---\nbody', 700)).toBe('Decks. — body')
  expect(detailOf(skill, '---\ndescription:\n---\nbody', 700)).toBe(`${skill.description} — body`)
  expect(detailOf(skill, null, 700)).toBe(skill.description)
  expect(detailOf({ name: 'pdf', description: '' }, null, 700)).toBe('A skill named pdf.')
  expect(detailOf({ name: 'pdf', description: '' }, 'no frontmatter here', 700)).toBe('no frontmatter here')
})

test('a skill whose frontmatter disables model invocation is never invocable; anything else is', () => {
  expect(modelInvocable('---\nname: x\ndisable-model-invocation: true\n---\n# x')).toBe(false)
  expect(modelInvocable('---\nname: x\ndisable-model-invocation: false\n---\n# x')).toBe(true)
  expect(modelInvocable('---\nname: x\n---\ndisable-model-invocation: true')).toBe(true)
  expect(modelInvocable('# no frontmatter')).toBe(true)
  expect(modelInvocable(null)).toBe(true)
})

test('skill bodies are looked for where Claude Code lays skills out', () => {
  expect(skillFileCandidates('commit')).toEqual([
    '.claude/skills/commit/SKILL.md',
    '.claude/commands/commit.md',
    '.claude/skills/commit/SKILL.md',
  ])
  expect(skillFileCandidates('engineering:code-review', 'engineering')).toContain(
    '.claude/skills/engineering/skills/code-review/SKILL.md',
  )
  expect(
    pluginFileCandidates('/x/cache/engineering/1.0.0/', 'engineering:code-review', 'engineering'),
  ).toEqual([
    '/x/cache/engineering/1.0.0/skills/code-review/SKILL.md',
    '/x/cache/engineering/1.0.0/commands/code-review.md',
  ])
  const installed = JSON.stringify({
    version: 2,
    plugins: {
      'engineering@claude-plugins-official': [{ installPath: '/x/cache/engineering/1.0.0' }],
      'other@m': [{ installPath: '/x/other' }],
    },
  })
  expect(installPathsOf(installed, 'engineering')).toEqual(['/x/cache/engineering/1.0.0'])
  expect(installPathsOf('not json', 'engineering')).toEqual([])
  // A name that is not a plain basename is never spliced into a path.
  expect(skillFileCandidates('../etc/passwd')).toEqual([])
  expect(skillFileCandidates('x', '..')).toEqual([])
  expect(pluginFileCandidates('/x', 'a/b', 'p')).toEqual([])
})

test('the request carries the prompt as state and the model where each backend expects it', () => {
  const questions = wideQuestions('typesafe', skills)
  const typesafe = JSON.parse(requestBody('typesafe', 'fix the tests', questions, 'jev-latest'))
  expect(typesafe.model).toBe('jev-latest')
  expect(typesafe.state).toEqual({ request: 'fix the tests', recent_context: '' })
  const gateway = JSON.parse(requestBody('gateway', 'fix the tests', questions, 'typesafe-ai/jev'))
  expect(gateway.model).toBeUndefined()
  expect(requestHeaders('gateway', 'k', 'typesafe-ai/jev')['ai-model-id']).toBe('typesafe-ai/jev')
  expect(requestHeaders('typesafe', 'k', 'jev-latest').authorization).toBe('Bearer k')
})

test('provider selection prefers TypeSafe, and a forced backend without its key is null', () => {
  expect(selectProvider('auto', 'ts', 'gw')).toBe('typesafe')
  expect(selectProvider('auto', '', 'gw')).toBe('gateway')
  expect(selectProvider('auto', '', '')).toBeNull()
  expect(selectProvider('gateway', 'ts', '')).toBeNull()
  expect(selectProvider('builtin', 'ts', 'gw')).toBeNull()
  expect(endpoint('typesafe', 'https://api.typesafe.ai/')).toBe('https://api.typesafe.ai/v1/systemone')
  expect(endpoint('gateway', 'https://ai-gateway.vercel.sh/v4/ai')).toBe(
    'https://ai-gateway.vercel.sh/v4/ai/evaluation-model',
  )
})

test('the suggestion block uses the cookbook\'s words, and says "nothing" only while the listing is in place', () => {
  const hidden = suggestionBlock(skills[1] as Skill, true)
  expect(hidden).toContain('Relevant to the current request: pptx-author. Ignore this if it does not fit')
  expect(hidden).toContain('- pptx-author: Build PowerPoint decks headless with python-pptx')
  expect(hidden).toContain('Skill tool')
  const shown = suggestionBlock(skills[1] as Skill, false)
  expect(shown).not.toContain('Skill tool')
  expect(suggestionBlock(null, true)).toBeNull()
  expect(suggestionBlock(null, false)).toContain('No skill in the roster appears relevant')
})

test('the log lines name the backend, the gate, the ranking, the rerank and the pick', () => {
  expect(describeSetup(null, '', true)).toBe(
    'ready on the built-in classifier, no key set; withholding the skill listing',
  )
  expect(describeSetup(null, '', false, true)).toBe(
    'ready on the built-in classifier, by choice; leaving the skill listing in place',
  )
  const wide = readWide(wideAnswer('powerpoint', DECK, ACTION))
  expect(describeWide(wide, 4, 160)).toBe(
    'needs a skill 0.87 · top of 4: powerpoint (0.70), pptx-author (0.30), commit (0.00) · 160ms',
  )
  expect(describeWide(null, 4, null)).toBe('no answer from 4 candidates')
  const rerank = readRerank(rerankAnswer('pptx-author', { powerpoint: 0.73, 'pptx-author': 0.38 }))
  expect(describeRerank(rerank, 90)).toBe(
    'rerank → pptx-author (n/d) · fits powerpoint 0.73, pptx-author 0.38 · 90ms',
  )
  expect(describeStatus('pptx-author')).toBe('jev · skill: pptx-author')
  expect(describeStatus(null)).toBe('jev · no skill')
})
