import { expect, test } from 'bun:test'
import {
  batchesOf,
  MAX_CHOICES,
  mergeWide,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
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
  syncedFileCandidates,
  trimListing,
  injectionBlock,
  readSkillSettings,
  setupPlan,
  setupInstructions,
  describeStillListed,
  SETUP_COMMAND,
  setupAborted,
  validBackup,
  commandLike,
  frontmatterName,
  displayIds,
  canonical,
  wideQuestions,
} from '../hooks/skill-suggestion.policy.ts'
import type { Candidate, PolicyConfig, Skill } from '../hooks/skill-suggestion.policy.ts'

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

test('the catalog drops built-ins and excluded names, and narrows to the listing once one was seen', () => {
  const commands = [
    { name: 'help', description: 'Show help', source: 'builtin' },
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
  // A gate with no nouls answered is null and does not block.
  expect(readWide(wideAnswer('commit', undefined))?.gate).toBeNull()
  expect(passesGate(readWide(wideAnswer('commit', undefined))!, config)).toBe(true)
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
  const stray = readRerank(rerankAnswer('made-up', { powerpoint: 0.9 }))
  expect(decide(wide, stray, skills, config).name).toBeNull()
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

test('OpenRouter gets TypeSafe\'s body at its System One route, nouls and all', () => {
  expect(endpoint('openrouter', DEFAULT_BASE_URL.openrouter)).toBe('https://openrouter.ai/api/v1/systemone')
  const wide = wideQuestions('openrouter', skills)
  expect(wide).toEqual(wideQuestions('typesafe', skills))
  const body = JSON.parse(requestBody('openrouter', 'fix the tests', wide, DEFAULT_MODEL.openrouter) as string)
  expect(body).toEqual({
    model: '~typesafe/jev-latest',
    state: { request: 'fix the tests', recent_context: '' },
    questions: wide,
  })
  expect(requestHeaders('openrouter', 'k', DEFAULT_MODEL.openrouter).authorization).toBe('Bearer k')
  expect(requestHeaders('openrouter', 'k', DEFAULT_MODEL.openrouter)['ai-model-id']).toBeUndefined()
  expect(selectProvider('auto', '', 'gw', 'or')).toBe('openrouter')
  expect(selectProvider('openrouter', 'ts', 'gw', '')).toBeNull()
})

test('an OpenRouter answer, with its type tags, is read like a TypeSafe one', () => {
  const [first, second] = skills
  const answers: Record<string, unknown> = {
    which: {
      type: 'choice',
      choice: first!.name,
      confidence: 0.8,
      probabilities: { [first!.name]: 0.8, [second!.name]: 0.2 },
    },
  }
  for (const key of Object.keys(GATE_QUESTIONS)) answers[`gate::${key}`] = { type: 'noul', noul: 0.9 }
  const wide = readWide(JSON.stringify({ model: 'typesafe/jev-1.13', answers, usage: { inputTokens: 1, outputTokens: 0 } }))
  expect(wide?.ranked.map((entry) => entry.name)).toEqual([first!.name, second!.name])
  expect(wide?.gateValues).toEqual(Object.fromEntries(Object.keys(GATE_QUESTIONS).map((key) => [key, 0.9])))
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

test("the injection block carries the skill's body with its frontmatter off and its paths filled in", () => {
  const skill: Skill = { name: 'pptx', description: 'Author a deck' }
  const markdown = '---\nname: pptx\ndescription: Author a deck\n---\nRun ${CLAUDE_SKILL_DIR}/scripts/build.py in ${CLAUDE_PROJECT_DIR}.\n'
  const block = injectionBlock(skill, markdown, '/home/u/.claude/skills/pptx/SKILL.md', '/work/app', false)
  expect(block.startsWith('<skill_relevance>\nRelevant to the current request: pptx.')).toBe(true)
  expect(block).toContain('<skill name="pptx" dir="/home/u/.claude/skills/pptx">')
  expect(block).toContain('Run /home/u/.claude/skills/pptx/scripts/build.py in /work/app.')
  expect(block).not.toContain('name: pptx')
  expect(block).toContain('Do not load it with the Skill tool')
  expect(block.endsWith('</skill_relevance>')).toBe(true)
})

test('an already-injected skill is only named again, and one without a file is suggested by name', () => {
  const skill: Skill = { name: 'pptx', description: 'Author a deck' }
  const again = injectionBlock(skill, 'body', '/x/SKILL.md', '/work', true)
  expect(again).toContain('Skill /pptx is already loaded above; instructions unchanged.')
  expect(again).not.toContain('<skill name=')
  const none = injectionBlock(skill, null, null, '/work', false)
  expect(none).toContain('- pptx: Author a deck')
  expect(none).toContain('Load it with the Skill tool (skill: "pptx")')
})

test('a synced skill is looked for under every account directory, by its unprefixed name', () => {
  expect(syncedFileCandidates('/home/u', ['acc_1', 'acc_2'], 'anthropic-skills:pptx')).toEqual([
    '/home/u/.claude/skills/synced/acc_1/pptx/SKILL.md',
    '/home/u/.claude/skills/synced/acc_2/pptx/SKILL.md',
  ])
  expect(syncedFileCandidates('/home/u', ['../etc'], 'pptx')).toEqual([])
  expect(syncedFileCandidates('/home/u', ['acc'], 'a/b')).toEqual([])
})

test('the skill settings read the two fields the setup touches, and malformed JSON reads as empty', () => {
  const settings = readSkillSettings('{"skillOverrides":{"a":"off","b":3},"disableBundledSkills":true,"model":"x"}')
  expect(settings).toEqual({ skillOverrides: { a: 'off' }, disableBundledSkills: true })
  expect(readSkillSettings('{nope')).toEqual({ skillOverrides: {}, disableBundledSkills: undefined })
  expect(readSkillSettings(null)).toEqual({ skillOverrides: {}, disableBundledSkills: undefined })
})

test('the setup plan hides user skills still on, leaves hidden ones, and reports plugin skills as locked', () => {
  const commands = [
    { name: 'help', source: 'builtin' },
    { name: 'pptx', source: 'user' },
    { name: 'commit', source: 'user' },
    { name: 'deploy', source: 'user' },
    { name: 'eng:debug', source: 'plugin' },
    { name: 'pptx', source: 'user' },
    { name: SETUP_COMMAND, source: 'plugin' },
  ]
  const plan = setupPlan(
    commands,
    { skillOverrides: { commit: 'user-invocable-only', deploy: 'off' }, disableBundledSkills: undefined },
    new Set([SETUP_COMMAND]),
  )
  expect(plan).toEqual({ hide: ['pptx'], alreadyHidden: ['commit', 'deploy'], locked: ['eng:debug'], bundledStillOn: true })
})

test('the setup instructions list every skill, carry the exact edit and the backup, and demand a yes first', () => {
  const settings = { skillOverrides: { commit: 'name-only' }, disableBundledSkills: undefined }
  const plan = setupPlan([{ name: 'pptx', source: 'user' }, { name: 'commit', source: 'user' }, { name: 'eng:debug', source: 'plugin' }], settings, new Set())
  const text = setupInstructions('apply', plan, settings, '/home/u/.claude/settings.json', '/home/u/.claude/backup.json')
  expect(text).toContain('Skills that will be hidden from the model (2):\n- pptx\n- commit')
  expect(text).toContain('- eng:debug')
  expect(text).toContain('Do not edit anything before a clear yes.')
  expect(text).toContain('"pptx": "user-invocable-only"')
  expect(text).toContain('"commit": "user-invocable-only"')
  expect(text).toContain('"disableBundledSkills": true')
  // The backup keeps what was there, so restore can put it back.
  expect(text).toContain('"commit": "name-only"')
  expect(text).toContain('"disableBundledSkills": null')
  expect(text).toContain(`/${SETUP_COMMAND} restore`)
  const restore = setupInstructions('restore', plan, settings, '/s.json', '/b.json')
  expect(restore).toContain('Read /b.json')
  expect(restore).toContain('Only after a clear yes')
  expect(restore).toContain('rm ~/.claude/jev-pilot.skill-overrides.backup.json')
  expect(describeStillListed(1)).toContain('1 skill is still listed')
  expect(describeStillListed(13)).toContain(`run /${SETUP_COMMAND}`)
})

test("a skill named with spaces in its frontmatter is mapped to its directory, which is the engine's id", () => {
  expect(commandLike('pb-api-rules')).toBe(true)
  expect(commandLike('PocketBase API Rules')).toBe(false)
  expect(frontmatterName('---\nname: "PocketBase API Rules"\ndescription: x\n---\nbody')).toBe('PocketBase API Rules')
  expect(frontmatterName('no frontmatter')).toBeNull()
  const ids = displayIds([
    { dir: 'pb-api-rules', markdown: '---\nname: "PocketBase API Rules"\n---\n' },
    { dir: 'commit', markdown: '---\nname: commit\n---\n' },
    { dir: 'other', markdown: '---\nname: "PocketBase API Rules"\n---\n' },
  ])
  expect([...ids]).toEqual([['PocketBase API Rules', 'pb-api-rules']])
  expect(canonical([{ name: 'PocketBase API Rules', source: 'user' }, { name: 'commit', source: 'user' }], ids)).toEqual([
    { name: 'pb-api-rules', source: 'user' },
    { name: 'commit', source: 'user' },
  ])
})

test('a rerun of the setup leaves an existing backup alone, since only it holds the pre-setup values', () => {
  const settings = { skillOverrides: { pptx: 'user-invocable-only' }, disableBundledSkills: true }
  const plan = setupPlan([{ name: 'pptx', source: 'user' }, { name: 'new', source: 'user' }], settings, new Set())
  const fresh = setupInstructions('apply', plan, settings, '/s.json', '/b.json', false)
  expect(fresh).toContain('first write /b.json with exactly this content')
  const rerun = setupInstructions('apply', plan, settings, '/s.json', '/b.json', true)
  expect(rerun).toContain('/b.json already exists from an earlier run')
  expect(rerun).toContain('do NOT overwrite')
  expect(rerun).not.toContain('first write /b.json')
  expect(rerun).toContain('"new": "user-invocable-only"')
})

test('a path with replacement-pattern characters goes into the injected body verbatim', () => {
  const skill: Skill = { name: 'odd', description: 'x' }
  const block = injectionBlock(skill, '---\nname: odd\n---\nsee ${CLAUDE_SKILL_DIR}/a and ${CLAUDE_PROJECT_DIR}/b', '/p/$&/odd/SKILL.md', '/w/$1', false)
  expect(block).toContain('see /p/$&/odd/a and /w/$1/b')
})

test('a setup that cannot be planned tells the model to change nothing', () => {
  const text = setupAborted('the skills could not be listed')
  expect(text).toContain('could not be prepared: the skills could not be listed')
  expect(text).toContain('do not edit any settings file')
})

test('only a file with the backup\'s own shape is treated as a reusable backup', () => {
  expect(validBackup('{"skillOverrides":{"a":"on"},"disableBundledSkills":null}')).toBe(true)
  expect(validBackup('{"skillOverrides":{},"disableBundledSkills":true}')).toBe(true)
  expect(validBackup('{"skillOverrides":{"a":1},"disableBundledSkills":null}')).toBe(false)
  expect(validBackup('{"skillOverrides":[],"disableBundledSkills":null}')).toBe(false)
  expect(validBackup('{"skillOverrides":{}}')).toBe(false)
  expect(validBackup('{nope')).toBe(false)
  expect(validBackup('[]')).toBe(false)
})

// --- more skills than one Choice may carry -------------------------------------------

test('a catalog past the choice limit is split into near-equal batches under it', () => {
  const sizes = (count: number, max?: number) => batchesOf(Array.from({ length: count }, (_, index) => index), max).map((batch) => batch.length)
  expect(sizes(302)).toEqual([151, 151])
  expect(sizes(255)).toEqual([255])
  expect(sizes(256)).toEqual([128, 128])
  expect(sizes(600)).toEqual([200, 200, 200])
  expect(sizes(0)).toEqual([])
  // Order and membership are kept.
  expect(batchesOf([1, 2, 3, 4, 5], 2).flat()).toEqual([1, 2, 3, 4, 5])
  for (const count of [1, 254, 255, 256, 510, 511, 1000]) {
    for (const size of sizes(count)) expect(size).toBeLessThanOrEqual(MAX_CHOICES)
    expect(sizes(count).reduce((a, b) => a + b, 0)).toBe(count)
  }
})

test('only the first batch asks the gate', () => {
  const first = wideQuestions('openrouter', skills, true)
  const later = wideQuestions('openrouter', skills, false)
  expect(Object.keys(first).some((key) => key.startsWith('gate::'))).toBe(true)
  expect(Object.keys(later)).toEqual(['which'])
})

test('batch rankings merge into one shortlist, with the first batch\'s gate', () => {
  const a = { ranked: [{ name: 'a1', probability: 0.6 }, { name: 'a2', probability: 0.1 }], gate: 0.8, gateValues: { g: 0.8 } }
  const b = { ranked: [{ name: 'b1', probability: 0.9 }], gate: null, gateValues: {} }
  const merged = mergeWide([a, b])
  expect(merged?.ranked.map((entry) => entry.name)).toEqual(['b1', 'a1', 'a2'])
  expect(merged?.gate).toBe(0.8)
  expect(mergeWide([a])).toBe(a)
})

test('a batch that did not answer leaves no ranking at all', () => {
  const a = { ranked: [{ name: 'a1', probability: 0.6 }], gate: 0.8, gateValues: {} }
  expect(mergeWide([a, null])).toBeNull()
  expect(mergeWide([])).toBeNull()
})
