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
 *   openrouter  POST https://openrouter.ai/api/v1/systemone
 *             OpenRouter's System One route, "compatible with the TypeSafe
 *             SDKs": the same model (`~typesafe/jev-latest`) in TypeSafe's own
 *             wire shape, `{ model, state, questions }`, `noul`, a
 *             `confidence` per answer.
 *
 * The Gateway shape is not documented publicly; it was read from
 * @ai-sdk/gateway and @ai-sdk/provider.
 */

export type Provider = 'typesafe' | 'gateway' | 'openrouter'

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
  openrouter: 'https://openrouter.ai/api',
}

export const DEFAULT_MODEL: Record<Provider, string> = {
  typesafe: 'jev-latest',
  gateway: 'typesafe-ai/jev',
  openrouter: '~typesafe/jev-latest',
}

/**
 * Which backend a configuration asks for, or null for the built-in
 * classifier. `auto` prefers the backends that report a calibrated
 * confidence — TypeSafe's own API, then OpenRouter — over the Gateway, which
 * does not; a forced backend whose key is missing resolves to
 * null rather than falling through to the other one's key.
 */
export function selectProvider(
  forced: string,
  typesafeKey: string,
  gatewayKey: string,
  openrouterKey = '',
): Provider | null {
  if (forced === 'builtin') return null
  if (forced === 'typesafe') return typesafeKey ? 'typesafe' : null
  if (forced === 'gateway') return gatewayKey ? 'gateway' : null
  if (forced === 'openrouter') return openrouterKey ? 'openrouter' : null
  if (typesafeKey) return 'typesafe'
  if (openrouterKey) return 'openrouter'
  if (gatewayKey) return 'gateway'
  return null
}

/** The full endpoint a backend posts to. */
export function endpoint(provider: Provider, baseUrl: string): string {
  const root = baseUrl.replace(/\/+$/, '')
  // OpenRouter serves TypeSafe's own route under its API root.
  return provider === 'gateway' ? `${root}/evaluation-model` : `${root}/v1/systemone`
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
 * The skills the decision model is offered: every command the person can run
 * that the model may also call, less the built-ins (`/help`, `/clear`) and the
 * names configured out. When the engine's listing has been seen, only skills
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
    if (command.source === 'builtin') continue
    if (listed.size > 0 && !listed.has(command.name)) continue
    if (excluded.has(command.name) || seen.has(command.name)) continue
    // This plugin's own commands (setup, report) are the person's to run.
    if (command.name.startsWith(OWN_COMMANDS)) continue
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

/** Whether a name is one the engine would run as `/name`: no whitespace. */
export function commandLike(name: string): boolean {
  return name.length > 0 && !/\s/.test(name)
}

/** The `name:` a SKILL.md's frontmatter declares, or null. */
export function frontmatterName(markdown: string): string | null {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)
  if (!frontmatter) return null
  const field = /^name:\s*(.*)$/m.exec(frontmatter[1] as string)
  if (!field) return null
  const value = (field[1] as string).trim().replace(/^["']|["']$/g, '')
  return value || null
}

/**
 * Display name → directory name, from the skills found on disk: only the
 * ones whose frontmatter `name:` differs from their directory, since those
 * are the ones `$.command.list()` reports under a name the engine will not
 * run, list or override. First found wins.
 */
export function displayIds(found: readonly { dir: string; markdown: string }[]): Map<string, string> {
  const ids = new Map<string, string>()
  for (const { dir, markdown } of found) {
    const declared = frontmatterName(markdown)
    if (declared && declared !== dir && !ids.has(declared)) ids.set(declared, dir)
  }
  return ids
}

/** Commands with every display name replaced by the engine's id. */
export function canonical<T extends { name: string }>(commands: readonly T[], ids: ReadonlyMap<string, string>): T[] {
  if (ids.size === 0) return [...commands]
  return commands.map((command) => (ids.has(command.name) ? { ...command, name: ids.get(command.name) as string } : command))
}

/**
 * A claude.ai-synced skill's file: Claude Code keeps them under
 * `~/.claude/skills/synced/<account>/<skill>/SKILL.md`, listed to the model
 * with a prefix (`anthropic-skills:pptx`) that is not on disk.
 */
export function syncedFileCandidates(home: string, accounts: readonly string[], name: string): string[] {
  if (!safeName(name)) return []
  const short = name.includes(':') ? name.slice(name.lastIndexOf(':') + 1) : name
  return accounts.filter(safeName).map((account) => `${home}/.claude/skills/synced/${account}/${short}/SKILL.md`)
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
/** A skill's body with its frontmatter taken off. */
export function bodyOf(markdown: string): string {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown)
  return (frontmatter ? markdown.slice(frontmatter[0].length) : markdown).trim()
}

/** The directory a skill file lives in, for `${CLAUDE_SKILL_DIR}`. */
export function dirOf(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut > 0 ? path.slice(0, cut) : '.'
}

/**
 * The block attached to the prompt when the mod loads the skill itself: the
 * cookbook's line, then the skill's instructions as the engine would have
 * rendered them, with the paths the engine substitutes. The Skill tool is
 * not needed, and may refuse the skill when it is `user-invocable-only`, so
 * the model is told not to reach for it. A skill already injected earlier in
 * the session is only named again: the engine does the same on a byte-identical
 * re-invocation.
 */
export function injectionBlock(
  suggested: Skill,
  markdown: string | null,
  path: string | null,
  projectDir: string,
  alreadyLoaded: boolean,
): string {
  const lines = [
    '<skill_relevance>',
    `Relevant to the current request: ${suggested.name}. Ignore this if it does not fit what the user actually asked for.`,
  ]
  if (alreadyLoaded) {
    lines.push(`Skill /${suggested.name} is already loaded above; instructions unchanged.`)
  } else if (markdown && path) {
    const dir = dirOf(path)
    // Callbacks, so a path holding `$&` or `$1` goes in verbatim.
    const body = bodyOf(markdown)
      .replace(/\$\{CLAUDE_SKILL_DIR\}/g, () => dir)
      .replace(/\$\{CLAUDE_PROJECT_DIR\}/g, () => projectDir)
    lines.push(
      `Its instructions follow: follow them now, including any setup steps. Do not load it with the Skill tool (it is already loaded here, and the tool may refuse it). Its files are in ${dir}.`,
      `<skill name="${suggested.name}" dir="${dir}">`,
      body,
      '</skill>',
    )
  } else {
    // No file on disk (a synced or bundled skill the mod cannot read): the
    // name and the way to load it are all there is.
    lines.push(
      `${line(suggested)}`,
      `Load it with the Skill tool (skill: "${suggested.name}") before you start; if the tool refuses it, tell the user to type /${suggested.name}.`,
    )
  }
  lines.push('</skill_relevance>')
  return lines.join('\n')
}

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

/** The same yes/no question under two names: `boolean` on the Gateway, `noul` elsewhere. */
function yesNo(provider: Provider, instructions: string): Record<string, unknown> {
  return { type: provider === 'gateway' ? 'boolean' : 'noul', instructions }
}

/**
 * The most options one Choice may carry. The API refuses more with a 400
 * ("Too many choices. Must have at most 255 choices."), measured against
 * OpenRouter's System One route on 2026-09-23.
 */
export const MAX_CHOICES = 255

/**
 * The catalog split into as few near-equal batches as fit under `max`, in
 * order: 302 skills become two batches of 151, not 255 and 47, so neither
 * ranking is squeezed into a handful of options.
 */
export function batchesOf<T>(items: readonly T[], max = MAX_CHOICES): T[][] {
  if (items.length === 0) return []
  const count = Math.ceil(items.length / Math.max(1, max))
  const size = Math.ceil(items.length / count)
  const batches: T[][] = []
  for (let start = 0; start < items.length; start += size) batches.push(items.slice(start, start + size))
  return batches
}

/**
 * The first requests' answers, one per batch, as one ranking. Every batch
 * must have answered: a ranking missing a batch would shortlist from part of
 * the catalog as if it were all of it. Each batch's probabilities are its own
 * distribution, so the merged order is only a shortlist: the second request
 * re-reads the top few together and makes the actual pick. The gate is the
 * first batch's, the only one asked it.
 */
export function mergeWide(parts: readonly (Wide | null)[]): Wide | null {
  if (parts.length === 0 || parts.some((part) => part === null)) return null
  const answered = parts as readonly Wide[]
  if (answered.length === 1) return answered[0] as Wide
  // Each batch's probabilities sum to one on their own, so they do not
  // compare across batches. The merge goes by rank: every batch's first,
  // then every batch's second, and so on; within a rank, by probability.
  const ranked: Wide['ranked'] = []
  const depth = Math.max(...answered.map((part) => part.ranked.length))
  for (let position = 0; position < depth; position++) {
    const row = answered.flatMap((part) => {
      const entry = part.ranked[position]
      return entry ? [entry] : []
    })
    row.sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
    ranked.push(...row)
  }
  const first = answered[0] as Wide
  return { ranked, gate: first.gate, gateValues: first.gateValues }
}

/**
 * The first request's `questions`: the ranking and, unless `withGate` is
 * off (every batch after the first), the gate.
 */
export function wideQuestions(provider: Provider, skills: readonly Skill[], withGate = true): Record<string, unknown> {
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
  if (withGate) {
    for (const [key, text] of Object.entries(GATE_QUESTIONS)) {
      questions[`gate::${key}`] = yesNo(provider, text)
    }
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

/**
 * A request body. The Gateway carries the model in a header instead.
 * `recent` is the conversation before the prompt (context.ts), '' for none.
 */
export function requestBody(
  provider: Provider,
  prompt: string,
  questions: Record<string, unknown>,
  model: string,
  recent = '',
): string {
  const state = { request: prompt, recent_context: recent }
  const body = provider !== 'gateway' ? { model, state, questions } : { state, questions }
  return JSON.stringify(body)
}

/** How jev-pilot names itself to OpenRouter. */
export const OPENROUTER_APP = {
  'http-referer': 'https://github.com/Akramovic1/jev-pilot',
  'x-openrouter-title': 'jev-pilot',
  'x-title': 'jev-pilot',
}

/** The request headers. */
export function requestHeaders(provider: Provider, apiKey: string, model: string): Record<string, string> {
  const common = { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }
  if (provider === 'typesafe') return common
  // Optional on OpenRouter; names the app in its dashboard and logs.
  // OpenRouter attributes requests to an app by these (its app rankings,
  // the model page's "top apps"); both title spellings are accepted.
  if (provider === 'openrouter') return { ...common, ...OPENROUTER_APP }
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
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const answers = (parsed as { answers?: unknown }).answers
  return answers && typeof answers === 'object' && !Array.isArray(answers) ? (answers as Answers) : null
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
 * the oriented nouls that were answered, or null when none was.
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
  const gate = oriented.length > 0 ? oriented.reduce((a, b) => a + b, 0) / oriented.length : null
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

/** Whether the first request's answer is worth a second look at all. */
export function passesGate(wide: Wide, config: PolicyConfig): boolean {
  return wide.gate === null || wide.gate >= config.gateThreshold
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
      reason: `needs a skill ${(wide.gate as number).toFixed(2)} < ${config.gateThreshold}`,
    }
  }
  const shortlist = shortlistOf(wide, skills, config.shortlist)
  if (shortlist.length === 0) return { name: null, reason: 'nothing ranked' }

  if (!rerank && rerankAttempted) return { name: null, reason: 'rerank gave no answer; no suggestion' }

  if (rerank) {
    const values = Object.values(rerank.fits)
    const best = values.length > 0 ? Math.max(...values) : null
    if (best !== null && best < config.fitsThreshold) {
      return { name: null, reason: `nothing fits, best ${best.toFixed(2)} < ${config.fitsThreshold}` }
    }
    if (shortlist.some((skill) => skill.name === rerank.winner)) {
      // The pick itself must fit: another candidate fitting well says
      // nothing for the one the Choice named.
      const fit = rerank.fits[rerank.winner]
      if (fit === undefined || fit < config.fitsThreshold) {
        return {
          name: null,
          reason: `rerank named ${rerank.winner}, which fits ${fit === undefined ? 'n/d' : fit.toFixed(2)} < ${config.fitsThreshold}`,
        }
      }
      return { name: rerank.winner, reason: `rerank of ${shortlist.length}, fits ${fit.toFixed(2)}` }
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

/** The name of the plugin's own setup command, as the engine runs it. */
export const SETUP_COMMAND = 'jev-pilot:setup'

/** The prefix of this plugin's own commands, never offered as a skill. */
export const OWN_COMMANDS = 'jev-pilot:'

/** A user settings file's parts the setup touches. */
export interface SkillSettings {
  skillOverrides: Record<string, string>
  disableBundledSkills: boolean | undefined
  /** The file exists but is not a JSON object: nothing may be planned on it. */
  invalid?: true
}

/** Reads the two fields from `~/.claude/settings.json`; malformed reads as empty. */
export function readSkillSettings(json: string | null): SkillSettings {
  let parsed: unknown = null
  if (json && json.trim()) {
    try {
      parsed = JSON.parse(json)
    } catch {
      return { skillOverrides: {}, disableBundledSkills: undefined, invalid: true }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { skillOverrides: {}, disableBundledSkills: undefined, invalid: true }
    }
  }
  const settings = (parsed ?? {}) as { skillOverrides?: unknown; disableBundledSkills?: unknown }
  const overrides: Record<string, string> = {}
  if (settings.skillOverrides && typeof settings.skillOverrides === 'object') {
    for (const [name, value] of Object.entries(settings.skillOverrides as Record<string, unknown>)) {
      if (typeof value === 'string') overrides[name] = value
    }
  }
  return {
    skillOverrides: overrides,
    disableBundledSkills: typeof settings.disableBundledSkills === 'boolean' ? settings.disableBundledSkills : undefined,
  }
}

/**
 * Whether a file is this mod's backup: `skillOverrides` an object of
 * strings and `disableBundledSkills` a boolean or null. Anything else is
 * not something `restore` could apply, so a setup must not build on it.
 */
export function validBackup(json: string): boolean {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return false
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false
  const { skillOverrides, disableBundledSkills } = parsed as Record<string, unknown>
  if (!skillOverrides || typeof skillOverrides !== 'object' || Array.isArray(skillOverrides)) return false
  if (!Object.values(skillOverrides as Record<string, unknown>).every((value) => typeof value === 'string')) return false
  return disableBundledSkills === null || typeof disableBundledSkills === 'boolean'
}

export interface SetupPlan {
  /** User and project skills the setup hides from the model (`user-invocable-only`). */
  hide: string[]
  /** Of those, the ones already hidden or off: nothing to change. */
  alreadyHidden: string[]
  /** A plugin's skills: `skillOverrides` cannot touch them, only `/plugin` can. */
  locked: string[]
  /** Whether bundled skills still need `disableBundledSkills`. */
  bundledStillOn: boolean
}

/**
 * What the setup has to change, from the roster and the settings as they
 * are. Every user-level command is listed, so the person sees the whole set
 * before anything is written.
 */
export function setupPlan(
  commands: readonly { name: string; source: string }[],
  settings: SkillSettings,
  excluded: ReadonlySet<string>,
): SetupPlan {
  const hide: string[] = []
  const alreadyHidden: string[] = []
  const locked: string[] = []
  const seen = new Set<string>()
  for (const command of commands) {
    if (seen.has(command.name) || excluded.has(command.name)) continue
    seen.add(command.name)
    if (command.source === 'plugin') locked.push(command.name)
    else if (command.source === 'user') {
      const state = settings.skillOverrides[command.name] ?? 'on'
      if (state === 'user-invocable-only' || state === 'off') alreadyHidden.push(command.name)
      else hide.push(command.name)
    }
  }
  return { hide, alreadyHidden, locked, bundledStillOn: settings.disableBundledSkills !== true }
}

/**
 * The prompt the model reads for `/jev-pilot:setup`: the plan in
 * full, the exact edit, and the rule that nothing is written before the
 * person has seen the list and said yes. The model edits the file with its
 * own tools, so the change shows as a diff and asks permission like any edit.
 */
export function setupInstructions(
  mode: 'apply' | 'restore',
  plan: SetupPlan,
  settings: SkillSettings,
  settingsPath: string,
  backupPath: string,
  /**
   * Whether a backup from an earlier run is already there. It holds the
   * values from before the first run, which the current settings no longer
   * do, so a rerun must leave it alone.
   */
  backupExists = false,
): string {
  const lines: string[] = ['<jev_skill_suggestion_setup>']
  if (mode === 'restore') {
    lines.push(
      `The user asked to undo jev-skill-suggestion's setup: put their skills back the way they were before it ran.`,
      `1. Read ${backupPath}. It holds {"skillOverrides": {...}, "disableBundledSkills": ...} as they were before the setup.`,
      `   If it does not exist, say so and stop: there is nothing to restore.`,
      `2. Show the user what will change in ${settingsPath}: the "skillOverrides" entries that go back to their saved value (an entry not in the backup is removed), and "disableBundledSkills" back to its saved value (removed when the backup says null).`,
      `3. Ask the user to confirm. Only after a clear yes, edit ${settingsPath} with the Edit tool, changing nothing else in the file, then remove the backup by running exactly this command with the Bash tool: rm ~/.claude/jev-pilot.skill-overrides.backup.json`,
      `4. Tell the user to restart Claude Code for /skills and /context to show the change.`,
      '</jev_skill_suggestion_setup>',
    )
    return lines.join('\n')
  }
  const overrides: Record<string, string> = { ...settings.skillOverrides }
  for (const name of plan.hide) overrides[name] = 'user-invocable-only'
  const after = JSON.stringify({ skillOverrides: overrides, disableBundledSkills: true }, null, 2)
  const backup = JSON.stringify(
    { skillOverrides: settings.skillOverrides, disableBundledSkills: settings.disableBundledSkills ?? null },
    null,
    2,
  )
  lines.push(
    `The user asked jev-skill-suggestion to take over skill selection: every skill is hidden from the model's listing (state "user-invocable-only": the user can still type /name) and the mod injects the one skill each prompt needs. Nothing here is written until the user has seen the list and said yes.`,
    '',
    `Skills that will be hidden from the model (${plan.hide.length}):`,
    ...(plan.hide.length > 0 ? plan.hide.map((name) => `- ${name}`) : ['- (none)']),
  )
  if (plan.alreadyHidden.length > 0) {
    lines.push('', `Already hidden, left as they are (${plan.alreadyHidden.length}):`, ...plan.alreadyHidden.map((name) => `- ${name}`))
  }
  lines.push(
    '',
    plan.bundledStillOn
      ? `Claude Code's bundled skills (simplify, loop, init, ...) will be hidden too, by setting "disableBundledSkills": true.`
      : `Claude Code's bundled skills are already disabled ("disableBundledSkills": true).`,
  )
  if (plan.locked.length > 0) {
    lines.push(
      '',
      `Plugin skills cannot be hidden by skillOverrides; they stay listed unless the plugin is disabled in /plugin (${plan.locked.length}):`,
      ...plan.locked.map((name) => `- ${name}`),
    )
  }
  lines.push(
    '',
    'Steps:',
    `1. Show the user the lists above, in their language, and say the change goes to ${settingsPath} (their user settings) and can be undone with /${SETUP_COMMAND} restore.`,
    '2. Ask them to confirm. Do not edit anything before a clear yes.',
    ...(backupExists
      ? [
          `3. ${backupPath} already exists from an earlier run and holds the values from before the first setup: do NOT overwrite or modify it.`,
        ]
      : [`3. After the yes, first write ${backupPath} with exactly this content (it is what restore reads):`, backup]),
    `4. Then edit ${settingsPath} with the Edit tool (read it first; create it as {} if it does not exist) so that its top-level "skillOverrides" and "disableBundledSkills" become exactly:`,
    after,
    '   Change nothing else in the file. Keep every other top-level key as it is.',
    '5. Tell the user to restart Claude Code: /skills will then show these skills as user-only and /context will count them at 0, while the mod keeps injecting the one skill a prompt needs.',
    '</jev_skill_suggestion_setup>',
  )
  return lines.join('\n')
}

/**
 * What the model reads when the setup cannot be planned: the roster or the
 * settings could not be read, so no edit is proposed — an edit planned from
 * a partial roster or empty settings would hide too little or back up the
 * wrong values.
 */
export function setupAborted(reason: string): string {
  return [
    '<jev_skill_suggestion_setup>',
    `The jev-skill-suggestion setup could not be prepared: ${reason}.`,
    'Tell the user, and do not edit any settings file. They can fix the cause and run the command again.',
    '</jev_skill_suggestion_setup>',
  ].join('\n')
}

/** The hint logged while skills are still listed and the mod is meant to be the only source of them. */
export function describeStillListed(count: number): string {
  return `${count} skill${count === 1 ? ' is' : 's are'} still listed for the model (withheld here, but /context counts them); run /${SETUP_COMMAND} to hand their selection to the mod for good`
}
