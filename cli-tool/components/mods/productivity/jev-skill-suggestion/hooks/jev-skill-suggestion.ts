/**
 * jev-skill-suggestion — Claude Mod (EARLY ACCESS)
 *
 * Takes the skill listing out of the context window and has TypeSafe's Jev,
 * a System One decision model, suggest at most one skill per prompt, going
 * by the skills' descriptions. The skills stay installed and loadable; what
 * goes away is the listing the engine sends the model every session, one
 * line per skill, whether the prompt has anything to do with any of them.
 *
 * The decision follows TypeSafe's "Skill suggestion" cookbook: two requests
 * per prompt, one to rank every skill and ask whether the prompt needs a
 * skill at all, one to re-read the top few with their full text and let each
 * be rejected on its own. Either may come back empty-handed.
 *
 * Three hooks:
 *   prompt.attachment  — the engine's `skill_listing` attachment is answered
 *                        with `{ text: null }` (left out) or trimmed to the
 *                        names in `alwaysListed`. Its names are remembered:
 *                        they are the engine's word on which skills the model
 *                        may invoke.
 *   prompt.submit      — the two requests run, and the winner (if any) is
 *                        attached to the prompt as a `<skill_relevance>`
 *                        block the model can act on with the Skill tool.
 *   skill.prompt       — observation only: whether the model took the
 *                        suggestion, or loaded a skill on its own.
 *
 * Jev is reached one of two ways, whichever key is configured: TypeSafe's
 * own API (`typesafeApiKey`), which reports a calibrated confidence, or the
 * Vercel AI Gateway (`gatewayApiKey`), which does not. With neither, the
 * engine's own `$.model.classify` stands in with a single request and no
 * gate, so the mod is useful without any account.
 *
 * The candidates come from `$.command.list()`, not from the listing: the
 * listing is only rendered at the turn's first request, after `prompt.submit`
 * has run, so the first prompt of a session would otherwise have nothing to
 * choose from. The listing, once seen, narrows the candidates to what the
 * engine itself would have shown.
 *
 * The second request reads the opening of each shortlisted skill's SKILL.md,
 * found on disk by how Claude Code lays skills out (project and user
 * `.claude/skills` and `.claude/commands`, a plugin's install path from
 * `~/.claude/plugins/installed_plugins.json`). A body that cannot be found
 * leaves that skill with its one-line description; nothing fails over it.
 *
 * Only the main conversation is handled. A subagent's own listing is left as
 * the engine renders it: its prompt is a tool call's argument, not a
 * `prompt.submit`, so nothing here could suggest for it.
 *
 * Every failure path is fail-open: a request that errors or runs past the
 * latency budget lets the prompt through with no suggestion, and the listing
 * hook always answers the same way, so the model's prompt cache holds.
 *
 * The API key comes from the plugin's options (userConfig "typesafeApiKey"
 * or "gatewayApiKey"). Never hardcode it in this file.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 and Claude Code >= 2.1.278: the
 * `prompt.attachment` event is that release's. Typed against Anthropic's
 * declarations: https://github.com/anthropics/claude-code/tree/main/mods
 *
 * Privacy: with a key set, the prompt text, every candidate skill's name and
 * description, and the opening of each shortlisted skill's SKILL.md are sent
 * to whichever backend the key belongs to.
 */
import type { Register } from 'claude-code'
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
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
  endpoint,
  installPathsOf,
  parseListing,
  parseNames,
  passesGate,
  pluginFileCandidates,
  readRerank,
  modelInvocable,
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
} from './policy.ts'
import type { Candidate, PolicyConfig, Provider, Rerank, Skill, Wide } from './policy.ts'

/** Prompt origins that are not a task of the person's: nothing to suggest for. */
const NOT_A_TASK = new Set([
  'task-notification',
  'peer',
  'peer-send-message',
  'projects-relay',
  'observer',
  'observer-activity',
])

export const register: Register = (on, options) => {
  const text = (key: string, fallback: string) =>
    typeof options[key] === 'string' && options[key] ? (options[key] as string) : fallback
  const number = (key: string, fallback: number) =>
    typeof options[key] === 'number' ? (options[key] as number) : fallback
  const flag = (key: string, fallback: boolean) =>
    typeof options[key] === 'boolean' ? (options[key] as boolean) : fallback

  // TypeSafe's own API is preferred when both keys are set: it is the only
  // one that reports a calibrated confidence. `provider` forces one,
  // including "builtin" to use neither.
  const typesafeKey = text('typesafeApiKey', '')
  const gatewayKey = text('gatewayApiKey', '')
  const forced = text('provider', 'auto')
  const active: Provider | null = selectProvider(forced, typesafeKey, gatewayKey)

  // Each backend keeps its own URL and model, so an override written for one
  // can never be sent to the other when `auto` picks differently than expected.
  const apiKey = active === 'typesafe' ? typesafeKey : active === 'gateway' ? gatewayKey : ''
  const modelId = !active
    ? ''
    : active === 'typesafe'
      ? text('typesafeModel', DEFAULT_MODEL.typesafe)
      : text('gatewayModel', DEFAULT_MODEL.gateway)
  const url = !active
    ? ''
    : active === 'typesafe'
      ? endpoint('typesafe', text('typesafeBaseUrl', DEFAULT_BASE_URL.typesafe))
      : endpoint('gateway', text('gatewayBaseUrl', DEFAULT_BASE_URL.gateway))

  // A backend named in the options but missing its key degrades to the
  // built-in classifier, which is silent; say so once, when a hook first runs.
  let unusableReported = forced === 'auto' || forced === 'builtin' || active !== null

  const hideListing = flag('hideListing', true)
  const alwaysListed = parseNames(text('alwaysListed', ''))
  const neverSuggested = parseNames(text('neverSuggested', ''))
  const rerankEnabled = flag('rerank', true)
  const excerptChars = number('excerptChars', 700)
  const timeoutMs = number('timeoutMs', 800)
  const logDecisions = flag('logDecisions', true)
  const policy: PolicyConfig = {
    shortlist: Math.max(1, Math.round(number('shortlist', 3))),
    gateThreshold: number('gateThreshold', 0.3),
    fitsThreshold: number('fitsThreshold', 0.3),
  }

  // The names every skill_listing attachment carried so far. Once non-empty,
  // only these are offered to the decision model: the listing is the engine's
  // word on which skills the model is allowed to invoke, and `$.command.list()`
  // also names commands the model may not.
  const listed = new Set<string>()
  // The skills suggested for the last few prompts, newest first, so a
  // skill.prompt that loads one can be told apart from one the model reached
  // for on its own. `skill.prompt` carries no turn id, and a prompt queued
  // while a turn still runs is classified before that turn's loads, so a
  // single slot would misattribute them; a short window does not.
  const recent: string[] = []
  // Each skill's SKILL.md as first found, or null when nowhere: read once per
  // session, since the second request wants it on every prompt it is on.
  const bodies = new Map<string, string | null>()
  // Said once, the first time a hook runs. A mod that loaded and one that
  // never loaded are otherwise told apart only by the absence of later lines,
  // and absence is not evidence: with the listing gone, silence is the norm.
  let announced = false

  on('prompt.attachment', { type: 'skill_listing' }, async ($, e, next) => {
    if (!announced) {
      announced = true
      if (logDecisions) {
        $.ui.log(`[jev-skill-suggestion] ${describeSetup(active, url, hideListing, forced === 'builtin')}`)
      }
    }

    // A subagent's listing is not ours: its roster is its own, nothing here
    // suggests for a subagent, and hiding its listing would leave it with no
    // skills at all. Only the main conversation's names are recorded.
    if (e.agentId) return next(e)
    const skills = parseListing(e.text)
    for (const skill of skills) listed.add(skill.name)
    if (!hideListing) return next(e)

    const kept = trimListing(e.text, alwaysListed)
    if (logDecisions) {
      const keptNames = kept
        ? parseListing(kept)
            .map((skill) => skill.name)
            .join(', ')
        : 'none'
      $.ui.log(
        `[jev-skill-suggestion] withheld the skill listing (${skills.length} skills, ${e.text.length} characters); kept listed: ${keptNames}`,
      )
    }
    // Answered without `next`: the engine's text never reaches the model.
    return { text: kept }
  })

  on('prompt.submit', async ($, e, next) => {
    if (!announced) {
      announced = true
      if (logDecisions) {
        $.ui.log(`[jev-skill-suggestion] ${describeSetup(active, url, hideListing, forced === 'builtin')}`)
      }
    }
    // Notifications and peer messages are not tasks; a typed `/name` already
    // names its skill. Neither gets a suggestion.
    if (!e.text.trim() || /^\/\S/.test(e.text.trim())) return next(e)
    if (e.origin && NOT_A_TASK.has(e.origin.kind)) return next(e)

    /** One request to the active backend, or null on timeout, error or a non-2xx. */
    const ask = async (
      prompt: string,
      questions: Record<string, unknown>,
      what: string,
    ): Promise<string | null> => {
      if (!active) return null
      try {
        const response = await Promise.race([
          $.http.fetch(url, {
            method: 'POST',
            headers: requestHeaders(active, apiKey, modelId),
            body: requestBody(active, prompt, questions, modelId),
          }),
          $.clock.sleep(timeoutMs),
        ])
        if (response && response.ok) return response.text
        if (response) $.ui.log(`[jev-skill-suggestion] ${active} responded ${response.status} to the ${what}`)
        else $.ui.log(`[jev-skill-suggestion] ${what} passed ${timeoutMs}ms; no suggestion`)
      } catch (error) {
        $.ui.log(`[jev-skill-suggestion] ${what} failed: ${String(error)}`)
      }
      return null
    }

    /** The opening of a skill's body, found on disk by Claude Code's layout, or null. */
    const bodyOf = async (skill: Skill, plugin: string | undefined): Promise<string | null> => {
      const cached = bodies.get(skill.name)
      if (cached !== undefined) return cached
      let found: string | null = null
      try {
        const home = (await $.env.get('HOME')) ?? ''
        const relative = skillFileCandidates(skill.name, plugin)
        const files = [...relative, ...(home ? relative.map((file) => `${home}/${file}`) : [])]
        if (plugin && home) {
          const installed = `${home}/.claude/plugins/installed_plugins.json`
          if (await $.fs.exists(installed)) {
            for (const path of installPathsOf(await $.fs.read(installed), plugin)) {
              files.push(...pluginFileCandidates(path, skill.name, plugin))
            }
          }
        }
        for (const file of files) {
          if (await $.fs.exists(file)) {
            found = await $.fs.read(file)
            break
          }
        }
      } catch (error) {
        $.ui.log(`[jev-skill-suggestion] could not read /${skill.name}: ${String(error)}`)
      }
      bodies.set(skill.name, found)
      return found
    }

    if (!unusableReported) {
      unusableReported = true
      $.ui.log(`[jev-skill-suggestion] provider "${forced}" has no key set; using the built-in classifier`)
    }

    let commands: Awaited<ReturnType<typeof $.command.list>>
    try {
      commands = await $.command.list()
    } catch (error) {
      $.ui.log(`[jev-skill-suggestion] could not list the skills: ${String(error)}`)
      return next(e)
    }
    const skills = catalog(commands, listed, neverSuggested)
    if (skills.length === 0) {
      if (logDecisions) $.ui.log('[jev-skill-suggestion] no candidate skills; nothing to suggest')
      return next(e)
    }
    const pluginOf = new Map(commands.map((command) => [command.name, command.plugin]))

    // Request 1: rank everything, and ask whether the prompt wants a skill at all.
    const startedAt = await $.clock.now()
    let wide: Wide | null = null
    if (active) {
      const answer = await ask(e.text, wideQuestions(active, skills), 'ranking')
      if (answer) wide = readWide(answer)
    } else {
      // No backend: the engine's own small-model classifier answers the same
      // question, with the descriptions folded into the text it reads. One
      // label, no gate, no rerank.
      try {
        const label = await $.model.classify(classifyText(e.text, skills), [
          NONE,
          ...skills.map((skill) => skill.name),
        ])
        wide = builtinWide(label)
      } catch (error) {
        $.ui.log(`[jev-skill-suggestion] built-in classifier failed: ${String(error)}`)
      }
    }
    // What the decision model actually answered, whatever the policy then
    // does with it. This is the line that proves the ranking ran.
    if (logDecisions) {
      const ms = (await $.clock.now()) - startedAt
      $.ui.log(`[jev-skill-suggestion] jev: ${describeWide(wide, skills.length, ms)}`)
    }

    // Request 2: re-read the shortlist with each skill's full text, and let
    // every candidate be rejected on its own.
    let rerank: Rerank | null = null
    let rerankAttempted = false
    // Before the listing has been seen, `$.command.list()` may name a skill
    // the model is not allowed to invoke; its own frontmatter tells.
    const barred: string[] = []
    let offered = skills
    if (active && rerankEnabled && wide && passesGate(wide, policy)) {
      // The shortlist is re-drawn without a barred skill, so the candidates
      // the second request reads are exactly the shortlist `decide` checks
      // the `fits` answers against.
      let candidates: Candidate[] = []
      for (;;) {
        candidates = []
        let redraw = false
        for (const skill of shortlistOf(wide, offered, policy.shortlist)) {
          const body = await bodyOf(skill, pluginOf.get(skill.name))
          if (!modelInvocable(body)) {
            barred.push(skill.name)
            redraw = true
            continue
          }
          candidates.push({ ...skill, detail: detailOf(skill, body, excerptChars) })
        }
        if (!redraw) break
        offered = offered.filter((skill) => !barred.includes(skill.name))
      }
      if (candidates.length > 0) {
        const rerankStartedAt = await $.clock.now()
        rerankAttempted = true
        const answer = await ask(e.text, rerankQuestions(active, candidates), 'rerank')
        if (answer) rerank = readRerank(answer)
        if (logDecisions) {
          const ms = (await $.clock.now()) - rerankStartedAt
          const read = candidates.filter((candidate) => bodies.get(candidate.name)).length
          $.ui.log(
            `[jev-skill-suggestion] jev: ${describeRerank(rerank, ms)} · ${read}/${candidates.length} bodies read`,
          )
        }
      }
    }

    let decision = decide(wide, rerank, offered, policy, rerankAttempted)
    let pick = decision.name ? (skills.find((skill) => skill.name === decision.name) ?? null) : null
    // The winner's own frontmatter has the last word, whichever path picked it.
    if (pick && !barred.includes(pick.name) && !modelInvocable(await bodyOf(pick, pluginOf.get(pick.name)))) {
      barred.push(pick.name)
      decision = { name: null, reason: `/${pick.name} has disable-model-invocation` }
      pick = null
    }
    if (logDecisions && barred.length > 0) {
      $.ui.log(
        `[jev-skill-suggestion] not model-invocable, left out: ${barred.map((name) => `/${name}`).join(', ')}`,
      )
    }
    // A row in the transcript scrolls away; this line stays on screen.
    if (logDecisions) $.ui.status(describeStatus(pick?.name ?? null))
    if (logDecisions) {
      $.ui.log(
        pick
          ? `[jev-skill-suggestion] suggesting /${pick.name}: ${decision.reason}`
          : `[jev-skill-suggestion] no suggestion: ${decision.reason}`,
      )
    }

    if (pick) recent.unshift(pick.name)
    if (recent.length > 3) recent.length = 3
    const block = suggestionBlock(pick, hideListing)
    if (!block) return next(e)
    // Attached on the way down: one block after the prompt as typed, read by
    // the model and never shown to the person.
    return next({ ...e, context: [...(e.context ?? []), block] })
  })

  on('skill.prompt', async ($, e, next) => {
    // Observation only: whether the model took the suggestion, or reached for
    // a skill it was never told about, is the one measure of this mod's worth.
    if (logDecisions) {
      const how =
        recent[0] === e.skill
          ? 'as suggested'
          : recent.includes(e.skill)
            ? 'suggested for an earlier prompt'
            : recent[0]
              ? `last suggestion was /${recent[0]}`
              : 'nothing was suggested'
      $.ui.log(`[jev-skill-suggestion] skill /${e.skill} loaded (${how})`)
    }
    return next(e)
  })
}
