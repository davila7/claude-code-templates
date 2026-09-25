/**
 * jev-auto-mode — Claude Mod (EARLY ACCESS)
 *
 * A permission layer that decides what Claude may do, from a JSON policy:
 * every tool call (Bash, file edits, web, MCP tools, subagents through the
 * Agent tool, skills through the Skill tool), every slash command or skill
 * the person types, and every skill preloaded into a subagent. Rules decide
 * first (deny beats ask beats allow); what no rule covers goes to the
 * policy's `default`, which can be TypeSafe's Jev judging the action against
 * the user's latest request, like Claude Code's own auto mode does with its
 * classifier, but with thresholds you set.
 *
 *   tool.call     the pipeline: self-protection → rules → default / Jev →
 *                 allow, ask (the mod's dialog, or the engine's), or deny
 *   tool.check    makes the pipeline's verdict the permission decision: an
 *                 allow skips the engine's prompt, an engine deny still wins
 *   command.run   rules over typed /commands and /skills; /jev-auto-mode
 *   skill.prompt  deny rules over a skill's prompt, preloaded ones included
 *   turn.start    records the user's request (the judge's intent) and
 *                 reloads the JSON files when they changed
 *
 * Policy files, merged: ~/.claude/jev-auto-mode.json (yours; the option
 * `configFile` names another) and <project>/.claude/jev-auto-mode.json (the
 * repository's, which can only tighten unless yours sets trustProjectAllow).
 * Claude can never edit either file, nor the mod: that check runs before
 * any rule.
 *
 * Keys come from the plugin's options (typesafeApiKey / gatewayApiKey),
 * never from the JSON files or this code. With no key the engine's own
 * `$.model.classify` judges. Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
 * (Claude Code >= 2.1.259).
 *
 * Privacy: with a key set and `default: "jev"`, the user's latest request and
 * the judged action's input are sent to the backend the key belongs to.
 */
import type { Register } from 'claude-code'
import {
  BUILTIN_LABELS,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  classifyText,
  describeJudgement,
  endpoint,
  readJudgement,
  requestBody,
  requestHeaders,
  rule as ruleOf,
  rulingReason,
  selectProvider,
  stateText,
} from './judge.ts'
import type { Judgement, Provider, Ruling } from './judge.ts'
import {
  CONFIG_NAME,
  DEFAULT_CONFIG,
  describeAction,
  evaluate,
  judged,
  mergeConfigs,
  parseConfig,
  selfProtection,
  toolAction,
} from './rules.ts'
import type { Action, Config, Decision, Fallback, Parsed } from './rules.ts'

const COMMAND = 'jev-auto-mode'
const ALLOW = 'Allow'
const DENY = 'Deny'
const HISTORY = 40

type Entry = { at: number; action: string; decision: Decision | 'passthrough'; by: string; audit: boolean }

let config: Config = DEFAULT_CONFIG
let loadErrors: string[] = []
let loadNotes: string[] = []
let sources: string[] = []
let searched: string[] = []
let stamp = ''
let intent = ''
const verdicts = new Map<string, { decision: 'allow' | 'ask'; reason: string }>()
const judgements = new Map<string, Ruling>()
// skills already let through as a Skill call or a typed /skill: their prompt is not asked about twice
const approvedSkills = new Set<string>()
const history: Entry[] = []
const tally = { allow: 0, ask: 0, deny: 0, passthrough: 0 }

function remember(entry: Entry): void {
  history.push(entry)
  if (history.length > HISTORY) history.splice(0, history.length - HISTORY)
  tally[entry.decision] += 1
}

function statusLine(last?: Entry): string {
  const mode = config.mode === 'audit' ? 'audit' : 'auto'
  const tail = last && last.decision !== 'allow' && last.decision !== 'passthrough' ? ` · ${last.decision} ${last.action}` : ''
  return `${mode} · ${tally.allow}✓ ${tally.ask}? ${tally.deny}✗${tail}`
}

/** Folds freshly read file texts into the active policy. */
function applyLoaded(userText: string | undefined, userPath: string, projectText: string | undefined, projectPath: string): void {
  const empty: Parsed = { config: {}, errors: [] }
  const user = userText === undefined ? empty : parseConfig(userText, 'user')
  const project = projectText === undefined ? empty : parseConfig(projectText, 'project')
  const merged = mergeConfigs(user.config, project.config)
  config = merged.config
  loadErrors = [...user.errors, ...project.errors]
  loadNotes = merged.notes
  sources = [userText !== undefined && userPath, projectText !== undefined && projectPath].filter((s): s is string => !!s)
  searched = [userPath, projectPath].filter(Boolean)
  judgements.clear()
}

function describePolicy(backend: string): string {
  const rules = config.rules.length
  const where = sources.length ? sources.join(' + ') : `no policy file at ${searched.join(' or ')} (defaults)`
  return `${config.mode} · default ${config.default} · ${rules} rule${rules === 1 ? '' : 's'} · ask via ${config.askWith} · judge ${backend} · ${where}`
}

export const register: Register = (on, options) => {
  const text = (key: string, fallback: string) =>
    typeof options[key] === 'string' && options[key] ? (options[key] as string) : fallback
  const typesafeKey = text('typesafeApiKey', '')
  const gatewayKey = text('gatewayApiKey', '')
  const forced = text('provider', 'auto')
  const active: Provider | null = selectProvider(forced, typesafeKey, gatewayKey)
  const apiKey = active === 'typesafe' ? typesafeKey : active === 'gateway' ? gatewayKey : ''
  const modelId = !active ? '' : active === 'typesafe' ? text('typesafeModel', DEFAULT_MODEL.typesafe) : text('gatewayModel', DEFAULT_MODEL.gateway)
  const url = !active
    ? ''
    : active === 'typesafe'
      ? endpoint('typesafe', text('typesafeBaseUrl', DEFAULT_BASE_URL.typesafe))
      : endpoint('gateway', text('gatewayBaseUrl', DEFAULT_BASE_URL.gateway))
  const backend = active ? `${active} ${modelId}` : 'built-in classifier'
  const configFile = text('configFile', '')
  const logLevel = text('logLevel', 'blocked')
  const logs = (d: Decision | 'passthrough') => logLevel === 'all' || (logLevel === 'blocked' && d !== 'allow' && d !== 'passthrough')

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: COMMAND,
        description: 'Show or reload the auto-mode policy (status|reload|log|init)',
        argumentHint: '[status|reload|log|init|init project]',
        immediate: true,
      })
      .catch(err => $.ui.log(`[jev-auto-mode] /${COMMAND} not registered: ${err}`))
    return r
  })

  // The user's words are the judge's intent; each turn also picks up edits to the policy files.
  on('turn.start', async ($, e, next) => {
    if (e.text.trim()) intent = e.text
    const home = await $.env.get('HOME')
    const root = await $.session.root()
    const userPath = configFile || (home ? `${home}/.claude/${CONFIG_NAME}` : '')
    const projectPath = `${root}/.claude/${CONFIG_NAME}`
    // exists first: a missing policy file is normal, not an error for the debug log
    const mtime = async (p: string) =>
      p && (await $.fs.exists(p).catch(() => false)) ? await $.fs.stat(p).then(s => `${s.mtimeMs}`, () => '-') : '-'
    const now = `${userPath}:${await mtime(userPath)}|${projectPath}:${await mtime(projectPath)}`
    if (now !== stamp) {
      const first = stamp === ''
      stamp = now
      const read = async (p: string) =>
        p && (await $.fs.exists(p).catch(() => false)) ? await $.fs.read(p).then(t => t as string, () => undefined) : undefined
      applyLoaded(await read(userPath), userPath, await read(projectPath), projectPath)
      $.ui.log(`[jev-auto-mode] ${first ? 'ready' : 'policy reloaded'}: ${describePolicy(backend)}`)
      for (const line of [...loadErrors, ...loadNotes]) $.ui.log(`[jev-auto-mode] ${line}`)
      if (loadErrors.length) $.ui.toast(`jev-auto-mode: ${loadErrors.length} problem(s) in ${CONFIG_NAME}; see the transcript`)
      $.ui.status(statusLine())
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    // An exception in a hook makes the engine skip it, which would let the call through unchecked:
    // for a permission layer that is fail-open, so any internal error denies instead. (`next(e)` is
    // returned, not awaited, so the tool's own errors never land here.)
    try {
      const { tool, tool_use_id: id, agentId, consent: _consent, ...input } = e as unknown as Record<string, unknown> & {
        tool: string
        tool_use_id?: string
        agentId?: string
        consent?: string
      }
      const a: Action = toolAction(tool, input, agentId)
      const root = await $.session.root()
      const home = await $.env.get('HOME')
      const ctx = { root, home }

      // Before any rule: Claude does not get to rewrite its own leash.
      const guard = selfProtection(a, $.plugin.root, ctx)
      if (guard) {
        const entry: Entry = { at: await $.clock.now(), action: describeAction(a), decision: 'deny', by: 'self-protection', audit: false }
        remember(entry)
        $.ui.log(`[jev-auto-mode] deny ${entry.action} (self-protection)`)
        $.ui.status(statusLine(entry))
        return { deny: guard }
      }

      const verdict = evaluate(config, a, ctx)
      let decision: Decision | 'passthrough'
      let reason: string
      let by: string
      if (verdict.source === 'rule') {
        decision = verdict.decision
        reason = verdict.reason
        by = `rule ${verdict.rule.id}`
      } else if (verdict.fallback === 'jev' && judged(config, a)) {
        const key = `${intent}\u0000${tool}\u0000${JSON.stringify(input)}`
        let ruling = judgements.get(key) ?? null
        if (!ruling) {
          const startedAt = await $.clock.now()
          const state = stateText(intent, a)
          let judgement: Judgement | null = null
          try {
            if (active) {
              const response = await Promise.race([
                $.http.fetch(url, { method: 'POST', headers: requestHeaders(active, apiKey, modelId), body: requestBody(active, state, modelId) }),
                $.clock.sleep(config.jev.timeoutMs),
              ])
              if (response && response.ok) judgement = readJudgement(response.text)
              else $.ui.log(`[jev-auto-mode] judge: ${response ? `${active} responded ${response.status}` : `no answer in ${config.jev.timeoutMs}ms`}`)
              if (judgement) ruling = ruleOf(judgement, config.jev)
            } else {
              const label = await $.model.classify(classifyText(state, config.jev), BUILTIN_LABELS)
              if (label === 'allow' || label === 'ask' || label === 'deny') ruling = { decision: label, hazard: null, probability: null, escalated: false }
            }
          } catch (err) {
            $.ui.log(`[jev-auto-mode] judge failed: ${String(err)}`)
          }
          const ms = (await $.clock.now()) - startedAt
          if (logLevel !== 'off') {
            $.ui.log(`[jev-auto-mode] judge ${describeAction(a)}: ${active ? describeJudgement(judgement, ms) : `built-in → ${ruling?.decision ?? 'no answer'} · ${Math.round(ms)}ms`}`)
          }
          if (ruling) {
            judgements.set(key, ruling)
            if (judgements.size > 300) judgements.delete(judgements.keys().next().value as string)
          }
        }
        if (ruling) {
          decision = ruling.decision
          reason = rulingReason(ruling, active ?? 'built-in')
          by = 'jev'
        } else {
          const fallback: Fallback = config.jev.onError
          decision = fallback === 'jev' ? 'passthrough' : fallback
          reason = `jev-auto-mode: the judge gave no answer (onError: ${fallback})`
          by = 'jev error'
        }
      } else {
        const fallback = verdict.fallback === 'jev' ? 'passthrough' : verdict.fallback
        decision = fallback
        reason = `jev-auto-mode: no rule matched (default: ${fallback})`
        by = 'default'
      }

      const entry: Entry = { at: await $.clock.now(), action: describeAction(a), decision, by, audit: config.mode === 'audit' }
      remember(entry)
      if (logs(decision)) $.ui.log(`[jev-auto-mode] ${entry.audit ? 'audit: would ' : ''}${decision} ${entry.action} (${by})`)
      $.ui.status(statusLine(entry))

      if (a.skill && decision !== 'deny') approvedSkills.add(a.skill)
      if (entry.audit || decision === 'passthrough') return next(e)
      if (decision === 'deny') return { deny: reason }
      if (decision === 'allow') {
        if (id) verdicts.set(id, { decision: 'allow', reason })
        return next(e)
      }

      // ask
      if (config.askWith === 'engine') {
        if (id) verdicts.set(id, { decision: 'ask', reason })
        return next(e)
      }
      const surfaces = await $.session.surfaces().then(s => s.length, () => 0)
      if (surfaces === 0) {
        if (config.headless === 'deny') return { deny: `${reason} (asked, but no one is here to answer: headless runs deny)` }
        if (id) verdicts.set(id, { decision: 'allow', reason })
        return next(e)
      }
      const who = agentId ? 'a subagent' : 'Claude'
      const answer = await $.ui
        .ask(`${reason.replace(/[.\s]+$/, '')}. Allow ${who} to run ${entry.action}?`, { options: [ALLOW, DENY], header: 'auto mode' })
        .catch(() => DENY)
      if (answer !== ALLOW) {
        $.ui.log(`[jev-auto-mode] you denied ${entry.action}`)
        return { deny: `The user declined this action (${reason}). Do not retry it; ask the user how to proceed.` }
      }
      if (id) verdicts.set(id, { decision: 'allow', reason: 'approved by the user' })
      return next(e)
    } catch (err) {
      $.ui.log(`[jev-auto-mode] internal error, denied ${e.tool}: ${String(err)}`)
      return { deny: `jev-auto-mode could not evaluate this call (${String(err)}); denied to be safe. Tell the user.` }
    }
  })

  // The pipeline's verdict becomes the permission decision; an engine deny (a settings rule, plan mode) still stands.
  on('tool.check', async ($, e, next) => {
    const mine = e.tool_use_id ? verdicts.get(e.tool_use_id) : undefined
    if (!mine) return next(e)
    verdicts.delete(e.tool_use_id!)
    const engine = await next(e)
    if (engine.decision === 'deny') return engine
    return { decision: mine.decision, reason: mine.reason }
  })

  // Typed slash commands and skills: rules only (the person typed them; there is nothing to judge).
  on('command.run', async ($, e, next) => {
    if (e.command === COMMAND) {
      const arg = e.args.trim().toLowerCase()
      if (arg === 'log') {
        if (!history.length) return { text: 'jev-auto-mode: no decisions yet' }
        return {
          text: history
            .slice(-15)
            .map(h => `${h.audit ? '(audit) ' : ''}${h.decision.padEnd(11)} ${h.action}  · ${h.by}`)
            .join('\n'),
        }
      }
      if (arg === 'init' || arg === 'init project') {
        const home = await $.env.get('HOME')
        const target =
          arg === 'init project' ? `${await $.session.root()}/.claude/${CONFIG_NAME}` : configFile || `${home ?? '~'}/.claude/${CONFIG_NAME}`
        if (await $.fs.exists(target)) return { text: `jev-auto-mode: ${target} already exists; not overwritten` }
        const example = await $.fs.read(`${$.plugin.root}/examples/${CONFIG_NAME}`)
        await $.fs.write(target, example as string)
        stamp = ''
        return { text: `jev-auto-mode: wrote ${target}; it loads on your next prompt` }
      }
      if (arg === 'reload') stamp = ''
      const problems = [...loadErrors, ...loadNotes]
      return {
        text: [
          `jev-auto-mode: ${describePolicy(backend)}`,
          `decisions: ${tally.allow} allowed · ${tally.ask} asked · ${tally.deny} denied · ${tally.passthrough} left to the engine`,
          ...problems.map(p => `  ! ${p}`),
          arg === 'reload' ? 'the policy files are re-read on your next prompt' : '/jev-auto-mode log · reload · init (your file) · init project',
        ].join('\n'),
      }
    }

    const a: Action = { kind: 'command', tool: `/${e.command}`, command: e.command, skill: e.command, input: { args: e.args } }
    const verdict = evaluate(config, a, { root: await $.session.root(), home: await $.env.get('HOME') })
    if (verdict.source !== 'rule' || verdict.decision === 'allow') {
      approvedSkills.add(e.command)
      return next(e)
    }
    const entry: Entry = { at: await $.clock.now(), action: describeAction(a), decision: verdict.decision, by: `rule ${verdict.rule.id}`, audit: config.mode === 'audit' }
    remember(entry)
    $.ui.log(`[jev-auto-mode] ${entry.audit ? 'audit: would ' : ''}${verdict.decision} ${entry.action} (${entry.by})`)
    $.ui.status(statusLine(entry))
    if (entry.audit) return next(e)
    if (verdict.decision === 'deny') return { text: `⛔ jev-auto-mode blocked /${e.command}: ${verdict.reason}` }
    const answer = await $.ui
      .ask(`${verdict.reason.replace(/[.\s]+$/, '')}. Run /${e.command}?`, { options: [ALLOW, DENY], header: 'auto mode' })
      .catch(() => DENY)
    if (answer !== ALLOW) return { text: `jev-auto-mode: /${e.command} not run` }
    approvedSkills.add(e.command)
    return next(e)
  })

  // A skill's prompt, however it arrives (typed, Skill tool, preloaded into a subagent): deny rules replace it,
  // ask rules ask unless the Skill call or the typed /skill was just let through.
  on('skill.prompt', async ($, e, next) => {
    const a: Action = { kind: 'skill', tool: 'Skill', skill: e.skill, input: { skill: e.skill } }
    const verdict = evaluate(config, a, { root: await $.session.root(), home: await $.env.get('HOME') })
    const approved = approvedSkills.delete(e.skill)
    if (verdict.source !== 'rule' || verdict.decision === 'allow' || config.mode === 'audit') return next(e)
    const blocked = (why: string) => ({
      text: `The skill "${e.skill}" is blocked by the user's jev-auto-mode policy: ${why}. Do not follow or reconstruct its instructions; tell the user it is blocked.`,
    })
    if (verdict.decision === 'deny') {
      $.ui.log(`[jev-auto-mode] deny skill ${e.skill} (rule ${verdict.rule.id})`)
      return blocked(verdict.reason)
    }
    if (approved) return next(e)
    const surfaces = await $.session.surfaces().then(list => list.length, () => 0)
    if (surfaces === 0) return config.headless === 'deny' ? blocked(`${verdict.reason} (no one to ask)`) : next(e)
    const answer = await $.ui
      .ask(`${verdict.reason.replace(/[.\s]+$/, '')}. Load the skill ${e.skill}?`, { options: [ALLOW, DENY], header: 'auto mode' })
      .catch(() => DENY)
    return answer === ALLOW ? next(e) : blocked('the user declined it')
  })
}
