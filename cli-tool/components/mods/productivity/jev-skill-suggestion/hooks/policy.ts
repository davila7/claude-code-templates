/**
 * jev-skill-suggestion — pure decision logic.
 *
 * No `$` and no I/O here: this module reads the engine's skill listing, builds
 * the two requests the decision API takes, reads their answers, and turns them
 * into at most one skill name and the text that suggests it. The hooks module
 * does every call on `$` at its own call site.
 *
 * The shape follows TypeSafe's "Skill suggestion" cookbook
 * (https://docs.typesafe.ai/cookbooks/skill_suggestion):
 *
 *   request 1  rank every skill (`which`, a Choice with each skill's one-line
 *              description as its criterion) and ask three Nouls about the
 *              request itself — whether it wants an action taken rather than
 *              an explanation given. Their mean is the gate.
 *   request 2  re-read the top few (`which` again, now with each skill's full
 *              description and the opening of its SKILL.md) and ask one Noul
 *              per candidate: does this skill do the specific thing asked?
 *              Every `fits` may come back low, and then nothing is suggested.
 *
 * Two backends speak to the same model with different wire shapes:
 *
 *   typesafe  POST https://api.typesafe.ai/v1/systemone
 *             `{ model, state, questions }`; a yes/no question is a `noul`
 *             and every answer carries its own `confidence`.
 *   gateway   POST https://ai-gateway.vercel.sh/v4/ai/evaluation-model
 *             `{ state, questions }` with the model in a header; a yes/no
 *             question is a `boolean` answered as `probability`.
 *
 * The Gateway shape is not documented publicly; it was read from
 * @ai-sdk/gateway and @ai-sdk/provider.
 */

export type Provider = 'typesafe' | 'gateway'

/** One skill as the model could be told about it: its name and one line. */
export interface Skill {
  name: string
  description: string
}

/** A shortlisted skill with the longer text the second request reads. */
export interface Candidate extends Skill {
  /** The full description and the opening of the skill's body, joined. */
  detail: string
}

/** What the first request answered. */
export interface Wide {
  /** Every skill with the probability it was given, surest first. */
  ranked: { name: string; probability: number | null }[]
  /** The mean of the oriented gate nouls, or null when none was answered. */
  gate: number | null
  /** Each gate noul as answered, for the log. */
  gateValues: Record<string, number>
  /** True when the built-in classifier answered: one label, no gate by design. */
  builtin?: true
}

/** What the second request answered. */
export interface Rerank {
  /** The candidate the Choice named. */
  winner: string
  /** Confidence in that choice, or null when the backend reported none. */
  confidence: number | null
  /** P(true) per candidate that it does the specific thing asked. */
  fits: Record<string, number>
}

/** The label the built-in classifier answers when no skill applies. */
export const NONE = 'none'

export const DEFAULT_BASE_URL: Record<Provider, string> = {
  typesafe: 'https://api.typesafe.ai',
  gateway: 'https://ai-gateway.vercel.sh/v4/ai',
}

export const DEFAULT_MODEL: Record<Provider, string> = {
  typesafe: 'jev-latest',
  gateway: 'typesafe-ai/jev',
}

/**
 * Which backend a configuration asks for, or null for the built-in
 * classifier. `auto` prefers TypeSafe, since it is the only one that reports
 * a calibrated confidence; a forced backend whose key is missing resolves to
 * null rather than falling through to the other one's key.
 */
export function selectProvider(forced: string, typesafeKey: string, gatewayKey: string): Provider | null {
  if (forced === 'builtin') return null
  if (forced === 'typesafe') return typesafeKey ? 'typesafe' : null
  if (forced === 'gateway') return gatewayKey ? 'gateway' : null
  if (typesafeKey) return 'typesafe'
  if (gatewayKey) return 'gateway'
  return null
}

/** The full endpoint a backend posts to. */
export function endpoint(provider: Provider, baseUrl: string): string {
  const root = baseUrl.replace(/\/+$/, '')
  return provider === 'typesafe' ? `${root}/v1/systemone` : `${root}/evaluation-model`
}

/** A comma-separated option as a set of trimmed, non-empty names. */
export function parseNames(option: string): Set<string> {
  return new Set(
    option
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  )
}

/**
 * Reads the engine's `skill_listing` attachment: a header line, then one
 * `- name: description` per skill. A description may run over several lines,
 * and an entry the engine trimmed to fit its budget has no description at
 * all. Anything before the first entry is the header and is skipped.
 */
export function parseListing(text: string): Skill[] {
  const skills: Skill[] = []
  let current: Skill | null = null
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    // A name has no spaces, so it runs up to the first `: `; a name that
    // itself contains `:` (`engineering:code-review`) is kept whole.
    const entry = /^- (\S+?)(?::\s(.*))?$/.exec(line)
    if (entry) {
      current = { name: entry[1] as string, description: (entry[2] ?? '').trim() }
      skills.push(current)
    } else if (current && line.trim()) {
      current.description = `${current.description} ${line.trim()}`.trim()
    }
  }
  return skills
}

/**
 * The skills the decision model is offered: every plugin or user skill the
 * person can run, less the names configured out. When the engine's listing has been seen, only skills
 * it listed are offered: the listing is the engine's word on which skills the
 * model is allowed to invoke.
 */
export function catalog(
  commands: readonly { name: string; description: string; source: string }[],
  listed: ReadonlySet<string>,
  excluded: ReadonlySet<string>,
): Skill[] {
  const seen = new Set<string>()
  const skills: Skill[] = []
  for (const command of commands) {
    // Only what the Skill tool can load: a plugin's or the person's own
    // skill. A built-in (`/help`) and an MCP server's prompt are commands
    // too, and a suggestion naming one would send the model to a load that
    // fails.
    if (command.source !== 'plugin' && command.source !== 'user') continue
    if (listed.size > 0 && !listed.has(command.name)) continue
    if (excluded.has(command.name) || seen.has(command.name)) continue
    seen.add(command.name)
    skills.push({ name: command.name, description: command.description.trim() })
  }
  return skills
}

/**
 * The listing with only `keep` left in it, or null when nothing is kept: what
 * the model reads in place of the engine's full listing.
 */
export function trimListing(text: string, keep: ReadonlySet<string>): string | null {
  if (keep.size === 0) return null
  const kept = parseListing(text).filter((skill) => keep.has(skill.name))
  if (kept.length === 0) return null
  const header = text.split('\n').find((line) => line.trim() && !line.startsWith('- ')) ?? ''
  return [header.trim(), '', ...kept.map(line)].join('\n')
}

function line(skill: Skill): string {
  return skill.description ? `- ${skill.name}: ${skill.description}` : `- ${skill.name}`
}

/**
 * Whether a skill or plugin name may be spliced into a path: the engine's
 * names are directory basenames, so anything with a path separator or a
 * `..` segment is refused rather than resolved.
 */
function safeName(name: string): boolean {
  return name.length > 0 && !name.includes('/') && !name.includes('\\') && !name.split(':').includes('..')
}

/**
 * The relative files a skill's body may live in, project or user level, by
 * how Claude Code lays skills and commands out. A plugin's are under its
 * install path instead, with the plugin prefix taken off the name.
 */
export function skillFileCandidates(name: string, plugin?: string): string[] {
  if (!safeName(name) || (plugin !== undefined && !safeName(plugin))) return []
  const short = plugin && name.startsWith(`${plugin}:`) ? name.slice(plugin.length + 1) : name
  const asPath = short.replace(/:/g, '/')
  const files = [
    `.claude/skills/${short}/SKILL.md`,
    `.claude/commands/${asPath}.md`,
    `.claude/skills/${asPath}/SKILL.md`,
  ]
  if (plugin) {
    // A plugin auto-loaded from a skills dir keeps its own `skills/` inside.
    files.push(`.claude/skills/${plugin}/skills/${short}/SKILL.md`)
    files.push(`.claude/skills/${plugin}/commands/${asPath}.md`)
  }
  return files
}

/**
 * The same files under a plugin's install path, as
 * `~/.claude/plugins/installed_plugins.json` records it.
 */
export function pluginFileCandidates(installPath: string, name: string, plugin: string): string[] {
  if (!safeName(name) || !safeName(plugin)) return []
  const short = name.startsWith(`${plugin}:`) ? name.slice(plugin.length + 1) : name
  const root = installPath.replace(/\/+$/, '')
  return [`${root}/skills/${short}/SKILL.md`, `${root}/commands/${short.replace(/:/g, '/')}.md`]
}

/**
 * The install paths `installed_plugins.json` records for a plugin name, any
 * marketplace: the keys are `name@marketplace`.
 */
export function installPathsOf(installedJson: string, plugin: string): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(installedJson)
  } catch {
    return []
  }
  const plugins = (parsed as { plugins?: Record<string, { installPath?: string }[]> }).plugins
  if (!plugins) return []
  const paths: string[] = []
  for (const [key, entries] of Object.entries(plugins)) {
    if (key !== plugin && !key.startsWith(`${plugin}@`)) continue
    for (const entry of entries ?? []) {
      if (typeof entry?.installPath === 'string') paths.push(entry.installPath)
    }
  }
  return paths
}

/**
 * What the second request reads for one skill: its full frontmatter
 * description, then the opening of its body with the frontmatter taken off.
 * With no file found, the one-line description alone.
 */
export function detailOf(skill: Skill, markdown: string | null, excerptChars: number): string {
  if (!markdown) return skill.description || `A skill named ${skill.name}.`
  let body = markdown
  let description = skill.description
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown)
  if (frontmatter) {
    body = markdown.slice(frontmatter[0].length)
    const field = /^description:\s*(.*)$/m.exec(frontmatter[1] as string)
    if (field) {
      // The skill's own frontmatter is the canonical text; the typeahead's
      // one-liner only stands in when the file has none.
      const value = (field[1] as string).trim().replace(/^["']|["']$/g, '')
      if (value) description = value
    }
  }
  const excerpt = body.trim().slice(0, Math.max(0, excerptChars))
  if (!excerpt) return description || `A skill named ${skill.name}.`
  return description ? `${description} — ${excerpt}` : excerpt
}

/**
 * Whether a skill's own frontmatter lets the model invoke it. A skill with
 * `disable-model-invocation: true` is left out of the engine's listing and
 * refused by the Skill tool, so it must never be suggested; before the
 * listing has been seen, this is the only way to tell. No file, or no such
 * field, reads as invocable.
 */
export function modelInvocable(markdown: string | null): boolean {
  if (!markdown) return true
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)
  if (!frontmatter) return true
  return !/^disable-model-invocation:\s*true\s*$/m.test(frontmatter[1] as string)
}

/**
 * The three questions about the request, each asking a different way whether
 * it wants an action taken rather than an explanation given. Questions about
 * subject matter would not separate "explain what a monad is" from a task
 * that needs a skill, since both are software.
 */
export const GATE_QUESTIONS: Record<string, string> = {
  acts_on_user_system:
    "Is the assistant being asked to act on the user's files, accounts, devices, or online services, rather than only to explain or advise?",
  would_follow_documented_procedure:
    'Would a careful expert answering this consult a specific documented procedure or set of commands, rather than answering from general understanding?',
  prose_suffices:
    "Could a knowledgeable generalist fully satisfy this request in prose, with no tools, no documentation, and no access to the user's files or accounts?",
}

/** Gate questions where a yes points away from needing a skill. */
const INVERTED = new Set(['prose_suffices'])

/** The same yes/no question under two names. */
function yesNo(provider: Provider, instructions: string): Record<string, unknown> {
  return { type: provider === 'typesafe' ? 'noul' : 'boolean', instructions }
}

/** The first request's `questions`: the ranking and the gate. */
export function wideQuestions(provider: Provider, skills: readonly Skill[]): Record<string, unknown> {
  const criteria: Record<string, string> = {}
  for (const skill of skills) criteria[skill.name] = skill.description || `A skill named ${skill.name}.`
  const questions: Record<string, unknown> = {
    which: {
      type: 'choice',
      instructions:
        "Which of these skills, if any, is the right one to load to help with the user's latest request?",
      criteria,
    },
  }
  for (const [key, text] of Object.entries(GATE_QUESTIONS)) {
    questions[`gate::${key}`] = yesNo(provider, text)
  }
  return questions
}

/** The second request's `questions`: the shortlist re-read, one `fits` each. */
export function rerankQuestions(
  provider: Provider,
  candidates: readonly Candidate[],
): Record<string, unknown> {
  const criteria: Record<string, string> = {}
  for (const candidate of candidates) criteria[candidate.name] = candidate.detail
  const questions: Record<string, unknown> = {
    which: {
      type: 'choice',
      instructions:
        "Exactly one of these skills is the right one to load for the user's latest request. Which one? Read what each actually does, not just its name.",
      criteria,
    },
  }
  for (const candidate of candidates) {
    questions[`fits::${candidate.name}`] = yesNo(
      provider,
      `Does the skill '${candidate.name}' do the specific thing the user's request asks for? It is described as: ${candidate.description || candidate.detail}`,
    )
  }
  return questions
}

/** A request body. The Gateway carries the model in a header instead. */
export function requestBody(
  provider: Provider,
  prompt: string,
  questions: Record<string, unknown>,
  model: string,
): string {
  const state = { request: prompt, recent_context: '' }
  const body = provider === 'typesafe' ? { model, state, questions } : { state, questions }
  return JSON.stringify(body)
}

/** The request headers. */
export function requestHeaders(provider: Provider, apiKey: string, model: string): Record<string, string> {
  const common = { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }
  if (provider === 'typesafe') return common
  return {
    ...common,
    'ai-gateway-auth-method': 'api-key',
    'ai-model-id': model,
    'ai-evaluation-model-specification-version': '4',
  }
}

type Answers = Record<string, Record<string, unknown>>

function answersOf(responseText: string): Answers | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(responseText)
  } catch {
    return null
  }
  const answers = (parsed as { answers?: Answers }).answers
  return answers && typeof answers === 'object' ? answers : null
}

/** P(true) of a yes/no answer: `noul` on TypeSafe, `probability` on the Gateway. */
function yesNoOf(answer: Record<string, unknown> | undefined): number | null {
  if (!answer) return null
  if (typeof answer.noul === 'number') return answer.noul
  if (typeof answer.probability === 'number') return answer.probability
  return null
}

/**
 * Reads the first request's answer. The ranking is the Choice's probability
 * distribution, surest first; a backend that sends none ranks the named
 * choice alone, at the reported confidence or none. The gate is the mean of
 * the oriented nouls, or null when any of the three is missing: a backend
 * answer with the gate left out is incomplete, and `passesGate` fails it.
 */
export function readWide(responseText: string): Wide | null {
  const answers = answersOf(responseText)
  const which = answers?.which
  if (!answers || !which || typeof which.choice !== 'string') return null

  const probabilities = which.probabilities as Record<string, number> | undefined
  const ranked: Wide['ranked'] = []
  if (probabilities) {
    for (const [name, probability] of Object.entries(probabilities)) {
      if (typeof probability === 'number') ranked.push({ name, probability })
    }
    ranked.sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
  }
  if (ranked.length === 0) {
    ranked.push({
      name: which.choice,
      probability: typeof which.confidence === 'number' ? which.confidence : null,
    })
  }

  const gateValues: Record<string, number> = {}
  const oriented: number[] = []
  for (const key of Object.keys(GATE_QUESTIONS)) {
    const value = yesNoOf(answers[`gate::${key}`])
    if (value === null) continue
    gateValues[key] = value
    oriented.push(INVERTED.has(key) ? 1 - value : value)
  }
  const complete = oriented.length === Object.keys(GATE_QUESTIONS).length
  const gate = complete ? oriented.reduce((a, b) => a + b, 0) / oriented.length : null
  return { ranked, gate, gateValues }
}

/** Reads the second request's answer. */
export function readRerank(responseText: string): Rerank | null {
  const answers = answersOf(responseText)
  const which = answers?.which
  if (!answers || !which || typeof which.choice !== 'string') return null
  const fits: Record<string, number> = {}
  for (const [key, answer] of Object.entries(answers)) {
    if (!key.startsWith('fits::')) continue
    const value = yesNoOf(answer)
    if (value !== null) fits[key.slice('fits::'.length)] = value
  }
  return {
    winner: which.choice,
    confidence: typeof which.confidence === 'number' ? which.confidence : null,
    fits,
  }
}

/** The first request's answer as the built-in classifier can give it: one label, no gate. */
export function builtinWide(label: string | undefined): Wide | null {
  if (!label) return null
  return {
    ranked: label === NONE ? [] : [{ name: label, probability: null }],
    gate: null,
    gateValues: {},
    builtin: true,
  }
}

/**
 * The text the built-in classifier reads: the prompt and the catalog it must
 * choose from, since `$.model.classify` takes bare labels and the descriptions
 * are the whole point.
 */
export function classifyText(prompt: string, skills: readonly Skill[]): string {
  return [
    'Which skill, going by its description, should be loaded before working on the prompt below? Answer "none" unless the prompt is clearly the kind of task a description names.',
    '',
    'Skills:',
    ...skills.map(line),
    `- ${NONE}: no listed skill is about this prompt`,
    '',
    'Prompt:',
    prompt,
  ].join('\n')
}

export interface PolicyConfig {
  /** How many of the ranking the second request re-reads. */
  shortlist: number
  /** The gate mean under which nothing is suggested. */
  gateThreshold: number
  /** The best `fits` under which the whole shortlist is dropped. */
  fitsThreshold: number
}

/** The shortlist the second request reads: the top of the ranking, by name. */
export function shortlistOf(wide: Wide, skills: readonly Skill[], count: number): Skill[] {
  const byName = new Map(skills.map((skill) => [skill.name, skill]))
  const picked: Skill[] = []
  for (const entry of wide.ranked) {
    const skill = byName.get(entry.name)
    if (skill) picked.push(skill)
    if (picked.length >= count) break
  }
  return picked
}

/**
 * Whether the first request's answer is worth a second look at all. A
 * backend answer with no gate is incomplete and fails closed; the built-in
 * classifier never asks the gate, and passes by design.
 */
export function passesGate(wide: Wide, config: PolicyConfig): boolean {
  if (wide.gate === null) return wide.builtin === true
  return wide.gate >= config.gateThreshold
}

export interface Suggestion {
  /** The one skill to suggest, or null for "nothing here applies". */
  name: string | null
  /** Why, for the log line. */
  reason: string
}

/**
 * At most one skill name for a request. With the second request switched
 * off, the top of the ranking stands, which is what the first request alone
 * can say; a second request that was attempted and failed suggests nothing.
 */
export function decide(
  wide: Wide | null,
  rerank: Rerank | null,
  skills: readonly Skill[],
  config: PolicyConfig,
  /**
   * Whether a second request was made: with one attempted and no answer,
   * nothing is suggested, since the first request's winner has not had its
   * false-positive check. Off means the second request was never meant to
   * run, and the top of the ranking is the whole answer.
   */
  rerankAttempted = false,
): Suggestion {
  if (!wide) return { name: null, reason: 'no answer' }
  if (!passesGate(wide, config)) {
    return {
      name: null,
      reason:
        wide.gate === null
          ? 'gate not answered; no suggestion'
          : `needs a skill ${wide.gate.toFixed(2)} < ${config.gateThreshold}`,
    }
  }
  const shortlist = shortlistOf(wide, skills, config.shortlist)
  if (shortlist.length === 0) return { name: null, reason: 'nothing ranked' }

  if (!rerank && rerankAttempted) return { name: null, reason: 'rerank gave no answer; no suggestion' }

  if (rerank) {
    // Every candidate's `fits` is the false-positive check; an answer that
    // leaves any out is incomplete and is not trusted.
    const missing = shortlist.filter((skill) => rerank.fits[skill.name] === undefined)
    if (missing.length > 0) {
      return {
        name: null,
        reason: `rerank left out fits for ${missing.map((s) => s.name).join(', ')}; no suggestion`,
      }
    }
    const best = Math.max(...shortlist.map((skill) => rerank.fits[skill.name] as number))
    if (best < config.fitsThreshold) {
      return { name: null, reason: `nothing fits, best ${best.toFixed(2)} < ${config.fitsThreshold}` }
    }
    if (shortlist.some((skill) => skill.name === rerank.winner)) {
      const fit = rerank.fits[rerank.winner]
      return {
        name: rerank.winner,
        reason: `rerank of ${shortlist.length}${fit === undefined ? '' : `, fits ${fit.toFixed(2)}`}`,
      }
    }
    return { name: null, reason: `rerank named ${rerank.winner}, not on the shortlist` }
  }

  const top = shortlist[0] as Skill
  const probability = wide.ranked.find((entry) => entry.name === top.name)?.probability ?? null
  return {
    name: top.name,
    reason: `top of ${wide.ranked.length}${probability === null ? '' : ` (${probability.toFixed(2)})`}, no rerank`,
  }
}

/**
 * The block attached to the prompt, in the cookbook's words. It can be
 * ignored, because pushing harder wins compliance on wrong suggestions too.
 * When the listing is still in place, a turn with nothing to suggest says so:
 * sending nothing would leave "err on the side of loading" unopposed. With
 * the listing withheld there is nothing to oppose, so nothing is sent.
 */
export function suggestionBlock(suggested: Skill | null, hidden: boolean): string | null {
  if (!suggested) {
    return hidden
      ? null
      : '<skill_relevance>\nNo skill in the roster appears relevant to this request.\n</skill_relevance>'
  }
  const lines = [
    '<skill_relevance>',
    `Relevant to the current request: ${suggested.name}. Ignore this if it does not fit what the user actually asked for.`,
  ]
  if (hidden) {
    // The model has no listing to look the name up in, so the line it would
    // have found there and the way to load it come along.
    lines.push(
      `${line(suggested)}`,
      'Load it with the Skill tool (skill: "' +
        suggested.name +
        '") before you start. The full skill listing is withheld from your context; the user can invoke any skill by typing /name.',
    )
  }
  lines.push('</skill_relevance>')
  return lines.join('\n')
}

/** A number for the log, or `n/d` when the backend reported none. */
function reported(value: number | null): string {
  return value === null ? 'n/d' : value.toFixed(2)
}

/**
 * The one-time line that says the mod is alive, which backend answers it,
 * and whether the listing is being withheld.
 */
export function describeSetup(
  provider: Provider | null,
  url: string,
  hideListing: boolean,
  builtinByChoice = false,
): string {
  const backend = provider
    ? `${provider} (${url})`
    : builtinByChoice
      ? 'the built-in classifier, by choice'
      : 'the built-in classifier, no key set'
  const listing = hideListing ? 'withholding the skill listing' : 'leaving the skill listing in place'
  return `ready on ${backend}; ${listing}`
}

/** What the first request answered: the gate and the top of the ranking. */
export function describeWide(wide: Wide | null, candidates: number, ms: number | null): string {
  const took = ms === null ? '' : ` · ${Math.round(ms)}ms`
  if (!wide) return `no answer from ${candidates} candidates${took}`
  const top = wide.ranked
    .slice(0, 3)
    .map((entry) => `${entry.name} (${reported(entry.probability)})`)
    .join(', ')
  return `needs a skill ${reported(wide.gate)} · top of ${candidates}: ${top || 'none'}${took}`
}

/** What the second request answered: the winner and every `fits`. */
export function describeRerank(rerank: Rerank | null, ms: number | null): string {
  const took = ms === null ? '' : ` · ${Math.round(ms)}ms`
  if (!rerank) return `rerank: no answer${took}`
  const fits = Object.entries(rerank.fits)
    .map(([name, value]) => `${name} ${value.toFixed(2)}`)
    .join(', ')
  return `rerank → ${rerank.winner} (${reported(rerank.confidence)}) · fits ${fits || 'n/d'}${took}`
}

/**
 * The persistent status line: the last thing the mod did, short enough to
 * sit on screen beside the engine's own notices.
 */
export function describeStatus(suggested: string | null): string {
  return suggested ? `jev · skill: ${suggested}` : 'jev · no skill'
}
