// Run with: claude plugin test productivity/jev-skill-typeahead
import { describe, expect, test } from 'claude-code/testing'
import {
  buildIndex,
  keyOf,
  parseListing,
  parseNames,
  rankProse,
  readDraft,
  rosterOf,
  skillsFromCommands,
  stem,
  termsOf,
  toRow,
} from '../hooks/policy.ts'
import type { Skill } from '../hooks/policy.ts'
import {
  classifyText,
  endpoint,
  questions,
  readDecision,
  requestBody,
  requestHeaders,
  selectProvider,
  verdictOf,
} from '../hooks/jev.ts'

const SKILLS: Skill[] = [
  { name: 'commit', description: 'Create a git commit with a good message from the staged changes', origin: 'user' },
  { name: 'pdf', description: 'Read, merge, split and fill PDF files', origin: 'plugin' },
  { name: 'pptx', description: 'Create and edit PowerPoint presentations and slide decks', origin: 'plugin' },
  { name: 'xlsx', description: 'Create and edit Excel spreadsheets, formulas and charts', origin: 'plugin' },
  { name: 'security-review', description: 'Review the pending changes for security vulnerabilities', origin: 'user' },
  { name: 'code-review', description: 'Review a pull request for correctness bugs and style', origin: 'user' },
  { name: 'deploy-checklist', description: 'Pre-deployment verification checklist before shipping a release', origin: 'plugin' },
  { name: 'code-explorer', description: 'Explores a codebase to answer questions about how it works', origin: 'agent' },
]

describe('what the draft is', () => {
  test('empty, commands, shell lines and memory notes get no band', () => {
    for (const t of ['', '   ', '/commit fix the typo', '/', '!ls -la', '#remember this', 'ok']) expect(readDraft(t).mode).toBe('idle')
  })

  test('prose needs two content words, or enough characters', () => {
    expect(readDraft('make me a').mode).toBe('idle')
    expect(readDraft('review the code').mode).toBe('prose')
    expect(readDraft('revisa el código').mode).toBe('prose')
    expect(readDraft('quiero que me ayudes a entender esto por favor').mode).toBe('prose')
  })

  test('fenced code and URLs are not what the person is asking for', () => {
    const d = readDraft('fix this ```const pdf = merge()``` please https://example.com/pdf/deck')
    expect(d.prose).not.toContain('merge()')
    expect(d.prose).not.toContain('example.com')
  })
})

describe('prose ranking', () => {
  const index = buildIndex(SKILLS)
  const top = (prose: string) => rankProse(index, prose, 3).map((h) => h.skill.name)

  test('English prompts find their skill', () => {
    expect(top('merge these two pdf files')[0]).toBe('pdf')
    expect(top('commit my staged changes')[0]).toBe('commit')
    expect(top('build a slide deck for the board')[0]).toBe('pptx')
  })

  test('Spanish prompts reach English descriptions through the aliases', () => {
    expect(top('hazme una presentación con diapositivas')[0]).toBe('pptx')
    expect(top('revisa la seguridad de estos cambios')[0]).toBe('security-review')
    expect(top('quiero una hoja de cálculo con fórmulas')[0]).toBe('xlsx')
  })

  test('the word still being typed matches as a prefix', () => {
    expect(top('edit a spreadsh')[0]).toBe('xlsx')
    expect(termsOf('edit a spreadsh').find((t) => t.stem === 'spreadsh')?.isPartial).toBe(true)
    expect(termsOf('edit a spreadsh ').find((t) => t.stem === 'spreadsh')?.isPartial).toBe(false)
  })

  test('naming the skill outright wins', () => {
    expect(top('use the code-review skill on this')[0]).toBe('code-review')
  })

  test('subagents compete with skills on the same footing', () => {
    expect(top('explore the codebase and explain how it works')[0]).toBe('code-explorer')
    expect(keyOf(SKILLS.find((x) => x.origin === 'agent')!)).toBe('agent:code-explorer')
    expect(keyOf(SKILLS[0])).toBe('commit')
  })

  test('nothing matches nothing', () => {
    expect(top('what is the capital of France')).toEqual([])
  })

  test('the score is a percentage and the hits are the words that matched', () => {
    const [hit] = rankProse(index, 'merge pdf files', 1)
    expect(hit.score).toBeGreaterThan(40)
    expect(hit.score).toBeLessThanOrEqual(100)
    expect(hit.hits).toContain('pdf')
  })

  test('stems are shared by the draft and the skills', () => {
    expect(stem('presentations')).toBe(stem('presentation'))
    expect(stem('reviewing')).toBe(stem('review'))
  })
})

describe('the roster', () => {
  const LISTING = [
    'The following skills are available for use with the Skill tool:',
    '',
    '- commit: Create a git commit',
    '  with a good message',
    '- engineering:code-review: Review code changes for security and performance',
    '- bare',
  ].join('\n')

  test("the engine's skill listing is read: multi-line descriptions, plugin prefixes, bare names", () => {
    const skills = parseListing(LISTING)
    expect(skills.map((x) => [x.name, x.origin])).toEqual([['commit', 'user'], ['engineering:code-review', 'plugin'], ['bare', 'user']])
    expect(skills[0].description).toBe('Create a git commit with a good message')
  })

  test('before the listing, commands stand in: built-ins and names with spaces are left out', () => {
    const skills = skillsFromCommands([
      { name: 'help', description: 'Help', source: 'builtin' },
      { name: 'commit', description: ' Commit ', source: 'user' },
      { name: 'pdf', description: 'PDF', source: 'plugin' },
      { name: 'odd name', description: 'x', source: 'user' },
    ])
    expect(skills.map((x) => [x.name, x.origin])).toEqual([['commit', 'user'], ['pdf', 'plugin']])
  })

  test('skills and subagents are merged; a skill and an agent may share a name; excluded names go', () => {
    const roster = rosterOf(
      [{ name: 'review', description: 'a', origin: 'user' }, { name: 'x', description: 'a', origin: 'user' }, { name: 'review', description: 'dup', origin: 'plugin' }],
      [{ name: 'review', description: 'b', origin: 'agent' }],
      parseNames('/x, '),
    )
    expect(roster.map(keyOf)).toEqual(['review', 'agent:review'])
  })

  test('rows cut long descriptions', () => {
    const row = toRow({ skill: { name: 'a', description: 'x'.repeat(400), origin: 'user' }, score: 50, hits: ['a', 'b', 'c', 'd', 'e'] }, true)
    expect(row.description.length).toBe(140)
    expect(row.hits.length).toBe(4)
    expect(row.isChosen).toBe(true)
  })
})

describe('Jev', () => {
  test('a key selects the backend; TypeSafe first; keywords and builtin never take a key', () => {
    expect(selectProvider('auto', 'a', 'b')).toBe('typesafe')
    expect(selectProvider('auto', '', 'b')).toBe('gateway')
    expect(selectProvider('auto', '', '')).toBeNull()
    expect(selectProvider('gateway', 'a', '')).toBeNull()
    expect(selectProvider('builtin', 'a', 'b')).toBeNull()
    expect(selectProvider('keywords', 'a', 'b')).toBeNull()
  })

  test('endpoints, bodies and headers per backend', () => {
    expect(endpoint('typesafe', 'https://api.typesafe.ai/')).toBe('https://api.typesafe.ai/v1/systemone')
    expect(endpoint('gateway', 'https://ai-gateway.vercel.sh/v4/ai')).toBe('https://ai-gateway.vercel.sh/v4/ai/evaluation-model')
    const qs = questions('typesafe', SKILLS)
    const criteria = (qs.which as { criteria: Record<string, string> }).criteria
    expect(Object.keys(criteria)).toHaveLength(SKILLS.length)
    expect(criteria['agent:code-explorer']).toContain('Explores a codebase')
    expect(JSON.parse(requestBody('typesafe', 'hi', qs, 'jev-latest')).model).toBe('jev-latest')
    expect(JSON.parse(requestBody('gateway', 'hi', questions('gateway', SKILLS), 'm')).model).toBeUndefined()
    expect(requestHeaders('gateway', 'k', 'typesafe-ai/jev')['ai-model-id']).toBe('typesafe-ai/jev')
    expect(requestHeaders('typesafe', 'k', 'x').authorization).toBe('Bearer k')
  })

  const answer = (probabilities: Record<string, number>, gates: [number, number, number]) =>
    JSON.stringify({
      answers: {
        which: { choice: Object.keys(probabilities)[0], confidence: Object.values(probabilities)[0], probabilities },
        'gate::acts': { noul: gates[0] },
        'gate::procedure': { noul: gates[1] },
        'gate::prose': { noul: gates[2] },
      },
    })
  const known = new Set(SKILLS.map(keyOf))
  const limits = { gate: 0.3, confidence: 0.35 }

  test('the answer is read: ranking surest first, gate oriented', () => {
    const d = readDecision(answer({ commit: 0.2, pdf: 0.7 }, [0.9, 0.9, 0.1]))!
    expect(d.ranked[0]).toEqual({ name: 'pdf', probability: 0.7 })
    expect(Math.abs((d.gate ?? 0) - 0.9)).toBeLessThan(1e-9)
    expect(readDecision('not json')).toBeNull()
    expect(readDecision('{"answers":{}}')).toBeNull()
  })

  test('the verdict: a confident choice passes the gate; prose-only drafts and unsure choices decide none', () => {
    expect(verdictOf(readDecision(answer({ pdf: 0.8, commit: 0.1 }, [0.9, 0.8, 0.1]))!, known, limits)).toBe('pdf')
    expect(verdictOf(readDecision(answer({ 'agent:code-explorer': 0.8 }, [0.9, 0.8, 0.1]))!, known, limits)).toBe('agent:code-explorer')
    expect(verdictOf(readDecision(answer({ pdf: 0.8 }, [0.05, 0.1, 0.95]))!, known, limits)).toBeNull()
    expect(verdictOf(readDecision(answer({ pdf: 0.2, commit: 0.19 }, [0.9, 0.9, 0.1]))!, known, limits)).toBeNull()
    expect(verdictOf(readDecision(answer({ invented: 0.9 }, [0.9, 0.9, 0.1]))!, known, limits)).toBeNull()
  })

  test('the built-in classifier text carries the catalog and the none label', () => {
    const text = classifyText('merge pdfs', SKILLS)
    expect(text).toContain('- pdf: Read, merge, split')
    expect(text).toContain('- agent:code-explorer:')
    expect(text).toContain('- none:')
    expect(text.endsWith('merge pdfs')).toBe(true)
  })
})
