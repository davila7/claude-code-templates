/**
 * prompt-cache-control — Claude Mod
 *
 * A prompt-cache meter for Claude Code. Every main-loop request reports how
 * many prompt tokens the cache served (`cache_read_input_tokens`), wrote
 * (`cache_creation_input_tokens`) and sent uncached (`input_tokens`); this mod
 * keeps those per request and per turn, counts down to the moment the cache
 * lapses, and says what to do about it: keep going, /compact or /clear.
 *
 *   - `turn.step` reads each main-loop request's usage (subagents have their
 *     own prefixes and are left out)
 *   - `$.clock.every(1000)` redraws the countdown, and only while its text
 *     changes: an idle, expired session costs nothing
 *   - a row above the prompt (the AbovePrompt component), an optional status
 *     line entry, and `/cache`, a pane with one row per turn
 *
 * The lifetime is counted from the start of the request that last wrote or read
 * the cache, as Anthropic documents it. Which lifetime Claude Code asked for
 * follows its documented rules (see decideTtl in ./cache.ts): FORCE_PROMPT_CACHING_5M,
 * CLAUDE_CODE_PROMPT_CACHE_TTL, the promptCacheTtl setting, ENABLE_PROMPT_CACHING_1H,
 * then the account (1 hour on a Claude subscription, 5 minutes otherwise). The
 * API names the TTL of a write but the mod API passes on only the token counts,
 * so the mod also watches the gaps between requests (a hit after more than 5
 * minutes proves 1 hour; see observeTtl). `ttl: "5m" | "1h"` pins it.
 *
 * Needs Claude Code >= 2.1.287.
 *
 * Options (pluginConfigs["prompt-cache-control@skills-dir"].options):
 *   ttl: "auto" | "5m" | "1h"   cache lifetime (default auto)
 *   warnSeconds: number         countdown threshold for the warning (default 60)
 *   compactAtTokens: number     prompt size that makes an expired cache suggest /compact (default 100000)
 *   band: boolean               row above the prompt (default true)
 *   status: boolean             entry under the prompt (default false)
 *   toast: boolean              toasts near expiry: at warnSeconds, then 10, 3, 2 and 1 s (default true)
 */
import type { BoxProps, ButtonProps, ElementConstructor, EngineInterface, InputProps, ModelForkResult, ModelUsage, Register, RenderSurface, TurnStepResult, UiInputArgument } from 'claude-code'
import {
  advise,
  COUNTDOWN_MARKS,
  bar,
  byTurn,
  fit,
  fmtClock,
  fmtTokens,
  hitRatio,
  isCachingDisabled,
  accountOf,
  decideTtl,
  observeTtl,
  lifeColor,
  lifeRatio,
  nextToastMark,
  positive,
  promptTokens,
  remainingMs,
  rowRatio,
  segments,
} from './cache.ts'
import type { Account, Advice, CacheEnv, Sample, Ttl } from './cache.ts'
import {
  FIELD_SUBMIT,
  FORK_PROMPT,
  briefCost,
  clearVariant,
  extractBrief,
  fieldHint,
  forkFailure,
  handoffBlock,
  handoffMessage,
  isBriefWhole,
  logParts,
  phaseLine,
  promptSource,
  turnBlock,
} from './handoff.ts'
import type { HandoffPhase, TurnGate } from './handoff.ts'

const PANE = 'cache'
const COMMAND = 'cache'
const KEEP = 200
// below this a lapsed cache costs too little to interrupt anyone about
const TOAST_MIN_TOKENS = 20_000
const CANCEL_GRACE_MS = 1_000
const PROBLEM_TOAST_MS = 10_000
const FIELD_KEY = 'handoff-note'
const TERMINAL_LOG_LIMIT = 2_000
const REMOTE_LOG_LIMIT = 10_000
const NOT_SENT = 'prompt-cache-control: clear cache: your message was not sent:'
const CANCELLED = 'handoff cancelled, nothing was cleared'
const COMPOSE_CANCELLED = 'cancelled, nothing was cleared'
const CANCEL_GAP = 3

let samples: Sample[] = []
let ttl: Ttl = '5m'
let baseTtl: Ttl = '5m'
let pinned = false
let observed: Ttl | undefined
let setting: unknown
let account: Account = 'other'
let ttlSource = 'default'
let envSource = 'default'
let env: CacheEnv = {}
let timer: { cancel: () => void } | undefined
let lastKey = ''
let toastedFor = 0
let toastLevel = Infinity
let isPaneOpen = false
let handoff: HandoffPhase = 'idle'
let handoffRun = 0
let isTurnRunning = false
let isLastTurnCut = false
let sawClear = false
let isBriefStale = false
let isFreshTaken = false
let lastStepStop: TurnStepResult['stopReason'] | undefined
let writingSince = 0
let isCancelArmed = false
let toastQuietUntil = 0
let lastPress: Press | undefined
let handoffSurface: RenderSurface | undefined
let followUpDraft = ''
let followUpConfirmed = ''
let heldDraft = ''
let draftSite: string | undefined

type Press = { surface: RenderSurface; requestId: string }

type PendingHandoff = { run: number; brief: string; sessionId: string; contextTokens: string; usage: ModelUsage; surface?: RenderSurface }

type Held = { text: string; surface?: RenderSurface }

type Kept = { run: number; text: string; why: string; isCleared: boolean; surface?: RenderSurface; inBox?: string; hasFollowUp: boolean }

const PRESS_KEYS = new Set(['clear-cache', 'cancel-handoff', 'close'])

function takePress(): Press | undefined {
  const press = lastPress
  lastPress = undefined
  return press
}

type Policy = { warnMs: number; compactAtTokens: number }

function current(policy: Policy, now: number) {
  const last = samples[samples.length - 1]
  const prev = samples[samples.length - 2]
  const disabled = last ? isCachingDisabled(last.model, env) : isCachingDisabled('', env)
  const advice: Advice = advise(last, prev, { ttl, ...policy }, now, disabled)
  const left = last ? remainingMs(last, ttl, now) : 0
  return { last, advice, left }
}

const COLOR: Record<Advice['kind'], string | undefined> = {
  warm: 'green',
  soon: 'yellow',
  expired: 'red',
  miss: 'red',
  off: undefined,
  cold: undefined,
  uncached: undefined,
}

function shortLine(policy: Policy, now: number): string {
  const { last, advice, left } = current(policy, now)
  if (!last || advice.kind === 'off') return `cache: ${advice.text}`
  const clock = left > 0 ? ` · ${fmtClock(left)}` : ''
  return `cache ${Math.round(hitRatio(last) * 100)}%${clock}`
}

// the promptCacheTtl setting, from the settings files that can carry it (local over project over user)
async function readSetting($: EngineInterface): Promise<unknown> {
  const home = await $.env.get('HOME').catch(() => undefined)
  const cwd = await $.session.cwd().catch(() => undefined)
  const files = [cwd && `${cwd}/.claude/settings.local.json`, cwd && `${cwd}/.claude/settings.json`, home && `${home}/.claude/settings.json`]
  for (const file of files) {
    if (!file) continue
    try {
      const value = JSON.parse(await $.fs.read(file)).promptCacheTtl
      if (value === '5m' || value === '1h') return value
    } catch {
      // missing or unreadable: the next file
    }
  }
  return undefined
}

function setHandoff($: EngineInterface, phase: HandoffPhase) {
  handoff = phase
  lastKey = ''
  $.ui.invalidate('ui.render')
}

function isComposing(): boolean {
  return handoff === 'composing'
}

function isStoppable(): boolean {
  return handoff === 'composing' || handoff === 'writing'
}

function heldFollowUp(): string {
  return followUpDraft.trim() || heldDraft || followUpConfirmed
}

function pendingText(site: string, hasField: boolean): string {
  const live = followUpDraft.trim()
  if (live === '') return heldDraft
  return hasField && site === draftSite ? '' : live
}

function heldLine(site: string, hasField: boolean): string | undefined {
  const held = pendingText(site, hasField)
  return isComposing() && held !== '' ? `message: ${held}` : undefined
}

function detachDraft() {
  const live = followUpDraft.trim()
  if (live !== '') heldDraft = live
  followUpDraft = ''
  draftSite = undefined
}

function resetFollowUp() {
  followUpDraft = ''
  followUpConfirmed = ''
  heldDraft = ''
  draftSite = undefined
}

function closeHandoff($: EngineInterface): Held {
  const held = { text: heldFollowUp(), surface: handoffSurface }
  handoffRun += 1
  resetFollowUp()
  setHandoff($, 'idle')
  return held
}

function say($: EngineInterface, note: string, isProblem: boolean) {
  if (!isProblem) return $.ui.toast(`clear cache: ${note}`)
  toastQuietUntil = Date.now() + PROBLEM_TOAST_MS
  $.ui.toast(`clear cache: ${note}`, { timeoutMs: PROBLEM_TOAST_MS })
  $.ui.log(`prompt-cache-control: clear cache: ${note}`)
}

function endHandoff($: EngineInterface, note: string, isProblem = false) {
  closeHandoff($)
  say($, note, isProblem)
}

function logWhole($: EngineInterface, header: string, text: string, surface?: RenderSurface) {
  $.ui.log(header)
  for (const part of logParts(text, surface === 'terminal' ? TERMINAL_LOG_LIMIT : REMOTE_LOG_LIMIT)) $.ui.log(part)
}

async function giveBack($: EngineInterface, held: Held, canCopy: boolean): Promise<string> {
  if (await textToBox($, held.text)) return 'your message is back in the prompt box'
  if (canCopy && (await textToClipboard($, held.text, held.surface))) return 'your message is on the clipboard'
  logWhole($, NOT_SENT, held.text, held.surface)
  return 'your message is in the transcript'
}

async function reportStop($: EngineInterface, note: string, isProblem: boolean, held: Held, canCopy = true) {
  if (held.text === '') return say($, note, isProblem)
  const where = await giveBack($, held, canCopy)
  say($, `${note}; ${where}`, isProblem)
}

async function stopHandoff($: EngineInterface, note: string, isProblem = false) {
  await reportStop($, note, isProblem, closeHandoff($))
}

function dropHandoff($: EngineInterface, note: string) {
  const held = closeHandoff($)
  if (held.text === '') return say($, note, true)
  logWhole($, NOT_SENT, held.text, held.surface)
  say($, `${note}; your message is in the transcript`, true)
}

function stopping(): string {
  return isComposing() ? 'while the message field was open' : 'while the brief was being written'
}

async function cancelHandoff($: EngineInterface) {
  if (isComposing()) return stopHandoff($, COMPOSE_CANCELLED)
  if (handoff !== 'writing') return
  const run = handoffRun
  const now = await $.clock.now().catch(() => Number.POSITIVE_INFINITY)
  if (run !== handoffRun || handoff !== 'writing') return
  if (!isCancelArmed && now - writingSince < CANCEL_GRACE_MS) {
    isCancelArmed = true
    return $.ui.toast('clear cache: still starting the brief, press cancel again to stop it')
  }
  await stopHandoff($, CANCELLED)
}

function pressCancel($: EngineInterface) {
  cancelHandoff($).catch(() => undefined)
}

function markClearing() {
  if (sawClear) isFreshTaken = true
  else isBriefStale = true
}

async function textToBox($: EngineInterface, text: string): Promise<boolean> {
  const draft = await $.prompt.read().catch(() => ({ text: '', cursor: 0 }))
  const filled = await $.prompt
    .fill(draft.text.trim() === '' ? { text } : { text: `\n\n${text}`, mode: 'append' })
    .catch(() => undefined)
  return filled?.isFilled === true
}

async function textToClipboard($: EngineInterface, text: string, surface?: RenderSurface): Promise<boolean> {
  const copied = await $.ui.copy(surface ? { text, surface } : { text }).catch(() => undefined)
  return copied?.isCopied === true
}

async function keepBrief($: EngineInterface, kept: Kept) {
  const { run, text, why, isCleared, surface } = kept
  const what = kept.hasFollowUp ? 'the handoff brief with your message' : 'the handoff brief'
  const isInBox = isCleared && (await textToBox($, text))
  const isOnClipboard = !isInBox && (await textToClipboard($, text, surface))
  if (run !== handoffRun) {
    if (isOnClipboard) $.ui.log('prompt-cache-control: clear cache: the handoff brief is on the clipboard')
    return
  }
  if (isInBox) return endHandoff($, `${why}; ${what} is in the prompt box, ${kept.inBox ?? 'press Enter to send it'}`, true)
  if (!isCleared) {
    const note = isOnClipboard ? `${why}, nothing was cleared; ${what} is on the clipboard` : `${why}, nothing was cleared`
    return reportStop($, note, true, closeHandoff($), !isOnClipboard)
  }
  if (isOnClipboard) return endHandoff($, `${why}; ${what} is on the clipboard`, true)
  logWhole($, 'prompt-cache-control: clear cache: the handoff brief, to copy into the prompt box and send:', text, surface)
  endHandoff($, `${why}; ${what} is in the transcript, copy it into the prompt box to send it; /resume returns to the previous conversation`, true)
}

function composeHandoff(pending: PendingHandoff): string {
  return handoffMessage({ brief: pending.brief, sessionId: pending.sessionId, contextTokens: pending.contextTokens, followUp: followUpConfirmed })
}

function focusField($: EngineInterface, site: string) {
  $.ui.log(`prompt-cache-control: clear cache: focus asked for the message field ${FIELD_KEY} in ${site}`, { to: 'debug' })
  const note = (why: string) => $.ui.log(`prompt-cache-control: clear cache: the message field ${FIELD_KEY} in ${site} took no focus (${why})`, { to: 'debug' })
  $.ui
    .focus({ requestId: site, key: FIELD_KEY })
    .then(
      moved => (moved.deny === undefined ? undefined : note(moved.deny)),
      (err: unknown) => note(String(err)),
    )
    .catch(() => undefined)
}

function turnGate(isWorking: boolean): TurnGate {
  return { isTurnRunning: isTurnRunning || isWorking, isLastTurnCut, hasRequest: samples.length > 0 }
}

function pressClear($: EngineInterface, press: Press | undefined, isWorking: boolean, canCompose: boolean) {
  const blocked = handoffBlock({ ...turnGate(isWorking), phase: handoff })
  if (blocked !== undefined) {
    $.ui.toast(`clear cache: ${blocked}`)
    return
  }
  if (!canCompose) return startHandoff($, press?.surface, '')
  handoffRun += 1
  resetFollowUp()
  handoffSurface = press?.surface
  setHandoff($, 'composing')
  if (press !== undefined) focusField($, press.requestId)
}

async function handOff($: EngineInterface, surface: RenderSurface | undefined, followUp: string) {
  const last = samples[samples.length - 1]
  const run = ++handoffRun
  const contextTokens = last ? fmtTokens(promptTokens(last)) : 'unknown'
  handoffSurface = surface
  resetFollowUp()
  followUpConfirmed = followUp
  setHandoff($, 'writing')
  writingSince = Number.POSITIVE_INFINITY
  isCancelArmed = false
  const [since, sessionId] = await Promise.all([$.clock.now().catch(() => 0), $.session.id().catch(() => '')])
  if (run !== handoffRun) return
  writingSince = since
  let reply: ModelForkResult
  try {
    reply = await $.model.fork({ prompt: FORK_PROMPT })
  } catch (err) {
    if (run === handoffRun) await stopHandoff($, `the brief could not be requested (${String(err)}), nothing was cleared`, true)
    return
  }
  if (run !== handoffRun) return
  if (!reply.isAnswered) return stopHandoff($, `${forkFailure(reply)}, nothing was cleared`, true)
  const brief = extractBrief(reply.text)
  if (brief === undefined) {
    $.ui.log(`prompt-cache-control: clear cache: the reply began: ${fit(reply.text.trim().replace(/\s+/g, ' '), 300)}`)
    $.ui.log(`prompt-cache-control: clear cache: the whole rejected reply:\n${reply.text}`, { to: 'debug' })
    return stopHandoff($, 'the reply was not a handoff brief (no ## Goal and ## Next steps headings), nothing was cleared', true)
  }
  const pending: PendingHandoff = { run, brief, sessionId, contextTokens, usage: reply.usage, surface }
  if (!isBriefWhole(brief)) {
    const why = 'the brief looks cut off (it has no Chat-only material section)'
    return keepBrief($, { run, text: composeHandoff(pending), why, isCleared: false, surface, hasFollowUp: followUpConfirmed !== '' })
  }
  await clearAndSend($, pending)
}

async function clearAndSend($: EngineInterface, pending: PendingHandoff) {
  const { run, sessionId, surface } = pending
  const hasFollowUp = followUpConfirmed !== ''
  const text = composeHandoff(pending)
  sawClear = false
  isBriefStale = false
  isFreshTaken = false
  setHandoff($, 'clearing')
  const failure = await $.command.run({ command: 'clear' }).then(
    () => undefined,
    (err: unknown) => String(err),
  )
  const fresh = await $.session.id().catch(() => '')
  const isCleared = sessionId !== '' && fresh !== '' ? fresh !== sessionId : sawClear
  const kept = { run, text, surface, hasFollowUp }
  if (!isCleared) return keepBrief($, { ...kept, why: failure === undefined ? '/clear did not start a new conversation' : `/clear did not run (${failure})`, isCleared: false })
  if (isBriefStale) return keepBrief($, { ...kept, why: 'a turn started while /clear was pending, so the brief may not cover it', isCleared: true, inBox: 'read it before you send it; /resume returns to the previous conversation' })
  if (isFreshTaken) return keepBrief($, { ...kept, why: 'a prompt reached the fresh conversation first', isCleared: true, inBox: 'send it when that turn ends' })
  setHandoff($, 'sending')
  try {
    const submitted = { text, asUser: true as const }
    const sent = await $.prompt.submit(submitted)
    if (sent.drop !== undefined) return keepBrief($, { ...kept, why: `the brief was not sent (${sent.drop})`, isCleared: true })
  } catch (err) {
    return keepBrief($, { ...kept, why: `the brief was not sent (${String(err)})`, isCleared: true })
  }
  endHandoff($, `cleared and handed off${hasFollowUp ? ' with your message' : ''} (the brief: ${briefCost(pending.usage)})`)
}

function startHandoff($: EngineInterface, surface: RenderSurface | undefined, followUp: string) {
  handOff($, surface, followUp)
    .catch((err: unknown) => stopHandoff($, `the handoff stopped (${String(err)})`, true))
    .catch(() => undefined)
}

function typeFollowUp(run: number, value: string, site: string) {
  if (run !== handoffRun || !isComposing()) return
  followUpDraft = value
  draftSite = site
}

function submitFollowUp($: EngineInterface, run: number, value: string, input: UiInputArgument, isWorking: boolean) {
  if (run !== handoffRun || !isComposing()) return
  const typed = value.trim()
  const followUp = typed !== '' ? typed : pendingText(input.requestId, true)
  const blocked = turnBlock(turnGate(isWorking))
  if (blocked !== undefined) {
    followUpDraft = followUp
    stopHandoff($, blocked, true).catch(() => undefined)
    return
  }
  startHandoff($, typeof input.surface === 'string' ? input.surface : handoffSurface, followUp)
}

type RowElements = { Box: ElementConstructor<BoxProps>; Button: ElementConstructor<ButtonProps>; Input: ElementConstructor<InputProps> }

function messageRow($: EngineInterface, elements: RowElements, room: number, isWorking: boolean) {
  const { Box, Button, Input } = elements
  const run = handoffRun
  return (
    <Box key="message-row" flexDirection="row" marginTop={1}>
      <Box flexDirection="row" flexGrow={1} flexShrink={1} minWidth={0}>
        <Input
          key={FIELD_KEY}
          label="message"
          placeholder={fieldHint(room)}
          submitLabel={FIELD_SUBMIT}
          autoFocus
          onInput={(value, input) => typeFollowUp(run, value, input.requestId)}
          onSubmit={(value, input) => submitFollowUp($, run, value, input, isWorking)}
        />
      </Box>
      <Box flexShrink={0} marginLeft={CANCEL_GAP}>
        <Button key="cancel-handoff" label="cancel" onPress={() => pressCancel($)} />
      </Box>
    </Box>
  )
}

async function paneClosed($: EngineInterface, canBandCompose: boolean) {
  if (draftSite === PANE) detachDraft()
  if (!isPaneOpen) return
  isPaneOpen = false
  if (!canBandCompose && isComposing()) return stopHandoff($, COMPOSE_CANCELLED)
  $.ui.invalidate('ui.render')
}

export const register: Register = (on, options) => {
  const policy: Policy = {
    warnMs: positive(options.warnSeconds, 60) * 1000,
    compactAtTokens: positive(options.compactAtTokens, 100_000),
  }
  const showBand = options.band !== false
  const showStatus = options.status === true
  const wantToast = options.toast !== false
  const showClear = options.clearButton !== false
  const askMessage = options.clearMessage !== false

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    samples = []
    lastKey = ''
    toastedFor = 0
    const none = () => undefined
    env = {
      enable1h: await $.env.get('ENABLE_PROMPT_CACHING_1H').catch(none),
      force5m: await $.env.get('FORCE_PROMPT_CACHING_5M').catch(none),
      ttlVar: await $.env.get('CLAUDE_CODE_PROMPT_CACHE_TTL').catch(none),
      disableAll: await $.env.get('DISABLE_PROMPT_CACHING').catch(none),
      disableHaiku: await $.env.get('DISABLE_PROMPT_CACHING_HAIKU').catch(none),
      disableSonnet: await $.env.get('DISABLE_PROMPT_CACHING_SONNET').catch(none),
      disableOpus: await $.env.get('DISABLE_PROMPT_CACHING_OPUS').catch(none),
    }
    pinned = options.ttl === '5m' || options.ttl === '1h'
    observed = undefined
    setting = await readSetting($)
    account = accountOf((await $.session.usage().catch(() => undefined))?.rateLimits ?? [])
    const choice = decideTtl(options.ttl, env, setting, account)
    baseTtl = choice.ttl
    ttl = baseTtl
    envSource = choice.source
    ttlSource = envSource

    await $.command
      .register({
        name: COMMAND,
        description: 'Prompt-cache usage per turn and the time left before it lapses (stop closes)',
        argumentHint: '[stop]',
        immediate: true,
      })
      .catch(err => $.ui.log(`prompt-cache-control: /${COMMAND} not registered: ${err}`))
    $.ui.log(`prompt-cache-control loaded: ${ttl} cache (${ttlSource}), /${COMMAND} opens the table`, { to: 'debug' })

    timer?.cancel()
    timer = $.clock.every(1000, () => {
      const now = Date.now()
      const { last, advice, left } = current(policy, now)
      const key = `${advice.kind}|${advice.text}|${left > 0 ? fmtClock(left) : ''}`
      if (key !== lastKey && handoff === 'idle') {
        lastKey = key
        if (showStatus) $.ui.status(shortLine(policy, now))
        $.ui.invalidate('ui.render')
      }
      if (wantToast && handoff === 'idle' && Date.now() >= toastQuietUntil && last && left > 0 && promptTokens(last) >= TOAST_MIN_TOKENS) {
        if (toastedFor !== last.startedAt) {
          toastedFor = last.startedAt
          toastLevel = Infinity
        }
        // the first toast comes at warnSeconds, then 10, 3, 2 and 1 seconds; a late tick skips to the newest one
        const secs = Math.ceil(left / 1000)
        const mark = nextToastMark(secs, policy.warnMs / 1000, toastLevel)
        if (mark !== undefined) {
          toastLevel = mark
          const tail = secs <= COUNTDOWN_MARKS[0] ? 'send a message now' : `send a message to keep ${fmtTokens(promptTokens(last))} tokens warm`
          $.ui.toast(`cache expires in ${secs >= 60 ? fmtClock(left) : `${secs}s`}: ${tail}`)
        }
      }
    })
    return r
  })

  on('session.end', async ($, e, next) => {
    isTurnRunning = false
    isLastTurnCut = false
    if (handoff === 'clearing' && e.reason === 'clear') sawClear = true
    if (isStoppable()) {
      const note = `the conversation changed ${stopping()}, nothing was sent`
      if (e.reason === 'clear' || e.reason === 'resume') await stopHandoff($, note, true)
      else dropHandoff($, note)
    }
    // /clear starts a new conversation in the same process: its cache is a new one
    if (e.reason === 'clear') {
      samples = []
      lastKey = ''
      toastedFor = 0
      observed = undefined
      ttl = baseTtl
      ttlSource = envSource
      $.ui.invalidate('ui.render')
      return next(e)
    }
    timer?.cancel()
    timer = undefined
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    isTurnRunning = true
    lastStepStop = undefined
    if (isStoppable()) await stopHandoff($, `a turn started ${stopping()}, nothing was cleared`, true)
    if (handoff === 'clearing') markClearing()
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      isTurnRunning = false
      isLastTurnCut = e.reason !== 'answer' || lastStepStop === 'tool_use'
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (isStoppable()) {
      const note = `${promptSource(e.origin)} ${stopping()}, nothing was cleared`
      const held = closeHandoff($)
      try {
        return await next(e)
      } finally {
        await reportStop($, note, true, held)
      }
    }
    if (handoff === 'clearing') markClearing()
    return next(e)
  })

  // each main-loop request: what the cache did with it
  on('turn.step', async function* ($, e, next) {
    if (e.agentId) return yield* next(e)
    isTurnRunning = true
    const startedAt = Date.now()
    const r = yield* next(e)
    lastStepStop = r.stopReason
    if (r.usage) {
      samples.push({
        turnId: e.turnId,
        index: e.index,
        model: r.usage.model || e.model,
        startedAt,
        read: r.usage.cache_read_input_tokens,
        write: r.usage.cache_creation_input_tokens,
        fresh: r.usage.input_tokens,
        output: r.usage.output_tokens,
      })
      if (samples.length > KEEP) samples = samples.slice(-KEEP)
      if (!pinned) {
        // the account can change under a session: a subscription running out of plan usage moves to usage credits
        account = accountOf((await $.session.usage().catch(() => undefined))?.rateLimits ?? [])
        const choice = decideTtl(options.ttl, env, setting, account)
        baseTtl = choice.ttl
        envSource = choice.source
        if (observed === undefined) {
          ttl = baseTtl
          ttlSource = envSource
        }
        const seen = observeTtl(samples[samples.length - 2], samples[samples.length - 1], observed)
        if (seen !== observed) {
          observed = seen
          ttl = seen ?? baseTtl
          ttlSource = `observed from request timing; ${envSource} said ${baseTtl}`
          $.ui.log(`prompt-cache-control: cache lifetime is ${ttl} (${ttlSource})`, { to: 'debug' })
        }
      }
      lastKey = ''
      if (showStatus) $.ui.status(shortLine(policy, Date.now()))
      $.ui.invalidate('ui.render')
    }
    return r
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    if (e.args.trim().toLowerCase() === 'stop') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      await paneClosed($, showBand).catch(() => undefined)
      return { text: 'cache table closed' }
    }
    isPaneOpen = true
    if (draftSite !== PANE) detachDraft()
    await $.ui.open({ id: PANE, title: 'cache', focus: true })
    $.ui.invalidate('ui.render')
    const { advice } = current(policy, Date.now())
    return { text: `${ttl} cache (${ttlSource}) · ${advice.text} · /${COMMAND} stop closes` }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id !== PANE) return next(e)
    await paneClosed($, showBand).catch(() => undefined)
    return next(e)
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== $.plugin.name) return next(e)
    if (PRESS_KEYS.has(e.element)) lastPress = { surface: e.surface, requestId: e.requestId }
    if (e.requestId === PANE && e.element === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      await paneClosed($, showBand).catch(() => undefined)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!showBand || e.props.hasSurvey || isPaneOpen) {
      if (draftSite === e.requestId) detachDraft()
      return next(e)
    }
    const { last, advice, left } = current(policy, Date.now())
    if (!last && advice.kind !== 'off' && handoff === 'idle') return next(e)
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    const Input = 'Input' in elements && e.surface !== 'mobile' ? elements.Input : undefined
    const isWorking = e.props.isWorking === true
    const columns = e.viewport?.columns ?? 100
    const room = e.props.bodyColumns ?? columns
    const color = COLOR[advice.kind]
    // The band is one instance: whatever the plugins beneath draw (another mod's band) stays, under this line.
    const below = await next(e)
    const stack = (own: ReturnType<typeof Text>) => (
      <Box flexDirection="column">
        {own}
        {below}
      </Box>
    )

    if (handoff !== 'idle') {
      const row = isComposing() && Input !== undefined ? messageRow($, { Box, Button, Input }, room, isWorking) : null
      const held = heldLine(e.requestId, Input !== undefined)
      return stack(
        <Box flexDirection="column">
          <Box flexDirection="row" columnGap={1}>
            <Box flexDirection="row" columnGap={1} flexShrink={0}>
              <Text bold color="yellow">✎</Text>
              <Text bold color="cyan">cache</Text>
            </Box>
            <Box flexShrink={1} minWidth={0}>
              <Text color="yellow" wrap="truncate-end">{phaseLine(handoff, followUpConfirmed !== '', room, Input !== undefined)}</Text>
            </Box>
            {isStoppable() && row === null ? (
              <Box flexShrink={0}>
                <Button key="cancel-handoff" label="cancel" onPress={() => pressCancel($)} />
              </Box>
            ) : null}
          </Box>
          {row}
          {held === undefined ? null : <Text dimColor wrap="truncate-end">{fit(held, room)}</Text>}
        </Box>,
      )
    }

    if (!last) return stack(<Text dimColor>{fit(`cache: ${advice.text}`, columns)}</Text>)

    const ratio = hitRatio(last)
    const wide = columns >= 90
    const tight = !wide && room < 64
    return stack(
      <Box flexDirection="row" columnGap={1}>
        <Box flexDirection="row" columnGap={1} flexShrink={0}>
          <Text bold color={color}>{advice.kind === 'warm' ? '●' : advice.kind === 'soon' ? '▲' : advice.kind === 'off' || advice.kind === 'cold' || advice.kind === 'uncached' ? '○' : '✖'}</Text>
          <Text bold color="cyan">cache</Text>
          {tight ? null : <Text color={color}>{bar(ratio, wide ? 10 : 6)}</Text>}
          <Text bold>{`${Math.round(ratio * 100)}%`}</Text>
          {wide ? (
            <Box flexDirection="row" columnGap={1}>
              <Text color="green">{`read ${fmtTokens(last.read)}`}</Text>
              <Text color="yellow">{`wrote ${fmtTokens(last.write)}`}</Text>
              <Text color="cyan">{`new ${fmtTokens(last.fresh)}`}</Text>
            </Box>
          ) : tight ? null : (
            <Text dimColor>{`${fmtTokens(promptTokens(last))} tok`}</Text>
          )}
          {advice.kind !== 'uncached' && advice.kind !== 'off' && (
            <Text bold color={left > 0 ? lifeColor(left, ttl, policy.warnMs) : 'red'}>{left > 0 ? `⏱ ${fmtClock(left)}` : '⏱ 0:00'}</Text>
          )}
        </Box>
        <Box flexShrink={1} minWidth={0}>
          <Text dimColor wrap="truncate-end">{`${ttl} · ${advice.text}`}</Text>
        </Box>
        {showClear ? (
          <Box flexShrink={0}>
            <Button
              key="clear-cache"
              label={room >= 100 ? 'clear cache' : 'clear'}
              variant={clearVariant(advice, last, policy.compactAtTokens)}
              dimColor={isWorking}
              onPress={() => pressClear($, takePress(), isWorking, askMessage && Input !== undefined)}
            />
          </Box>
        ) : null}
      </Box>,
    )
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    const Input = 'Input' in elements && e.surface !== 'mobile' ? elements.Input : undefined
    const width = Math.max(30, e.props.bodyColumns - 1)
    const held = heldLine(e.requestId, Input !== undefined)
    const row = isComposing() && Input !== undefined ? messageRow($, { Box, Button, Input }, e.props.bodyColumns, false) : null
    // HTML collapses runs of spaces and trims a text's ends; a no-break space keeps them
    const sp = (t: string) => (e.surface === 'terminal' ? t : t.replace(/ /g, ' '))
    const now = Date.now()
    const { last, advice, left } = current(policy, now)
    const all = byTurn(samples)
    const counting = !!last && advice.kind !== 'uncached' && advice.kind !== 'off'
    // the countdown goes green, then yellow, then red as the cache runs out
    const clockColor = counting ? lifeColor(left, ttl, policy.warnMs) : undefined
    const stateColor = advice.kind === 'expired' || advice.kind === 'miss' ? 'red' : (clockColor ?? COLOR[advice.kind])
    const hitColor = (pct: number) => (pct >= 80 ? 'green' : pct >= 40 ? 'yellow' : 'red')
    // solid bars are filled Boxes, not block characters, so HTML draws no seams between cells
    const solid = (key: string, parts: [number, string | undefined][]) => (
      <Box key={key} flexDirection="row" height={1} flexShrink={0}>
        {parts.map(([w, c], i) => (w > 0 ? <Box key={`${key}:${i}`} width={w} height={1} flexShrink={0} backgroundColor={c} /> : null))}
      </Box>
    )
    const cell = (key: string, w: number, text: string, c?: string, bold = false) => (
      <Box key={key} width={w} flexShrink={0} justifyContent="flex-end">
        <Text color={c} bold={bold} dimColor={!c}>{sp(text)}</Text>
      </Box>
    )

    const barW = Math.min(width, 40)
    const life = lifeRatio(left, ttl)
    const lifeFilled = Math.round(life * barW)
    const [sr, sw, sn] = last ? segments(last.read, last.write, last.fresh, barW) : [0, 0, 0]
    const rows = all.slice(-Math.max(3, (e.viewport?.rows ?? 24) - 16))
    const icon = advice.kind === 'warm' ? '●' : advice.kind === 'soon' ? '▲' : advice.kind === 'expired' || advice.kind === 'miss' ? '✖' : '○'

    return (
      <Box flexDirection="column">
        <Box key="title" flexDirection="row" columnGap={1}>
          <Text bold color="cyan">{sp('⚡ PROMPT CACHE')}</Text>
          <Text dimColor>{sp(`· ${ttl} lifetime (${ttlSource})`)}</Text>
        </Box>

        <Box key="clock" flexDirection="column" marginTop={1}>
          <Text bold color={clockColor}>{sp(counting ? `⏱ ${left > 0 ? fmtClock(left) : '0:00'}` : '⏱ --:--')}</Text>
          {counting ? (
            <Box flexDirection="row" columnGap={1}>
              {solid('life', [[lifeFilled, clockColor], [barW - lifeFilled, 'gray']])}
              <Text dimColor>{sp(`${Math.round(life * 100)}%`)}</Text>
            </Box>
          ) : null}
        </Box>

        <Box key="advice" marginTop={1} flexDirection="column">
          <Text bold color={stateColor}>{sp(`${icon} ${advice.text}`)}</Text>
          {last ? <Text dimColor>{sp(fit(`${last.model} · prompt ${fmtTokens(promptTokens(last))} tokens`, width))}</Text> : null}
        </Box>

        {last ? (
          <Box key="stack" flexDirection="column" marginTop={1}>
            <Box flexDirection="row" columnGap={1}>
              {solid('stack', [[sr, 'green'], [sw, 'yellow'], [sn, 'cyan']])}
              <Text bold color={hitColor(Math.round(hitRatio(last) * 100))}>{sp(`${Math.round(hitRatio(last) * 100)}% hit`)}</Text>
            </Box>
            <Box flexDirection="row" columnGap={2}>
              <Text color="green">{sp(`■ read ${fmtTokens(last.read)}`)}</Text>
              <Text color="yellow">{sp(`■ wrote ${fmtTokens(last.write)}`)}</Text>
              <Text color="cyan">{sp(`■ new ${fmtTokens(last.fresh)}`)}</Text>
            </Box>
          </Box>
        ) : null}

        <Box key="table" flexDirection="column" marginTop={1}>
          <Box key="head" flexDirection="row" columnGap={1}>
            {cell('h:turn', 4, 'turn', 'cyan', true)}
            {cell('h:steps', 5, 'steps', 'cyan', true)}
            {cell('h:read', 6, 'read', 'green', true)}
            {cell('h:wrote', 6, 'wrote', 'yellow', true)}
            {cell('h:new', 5, 'new', 'cyan', true)}
            {cell('h:hit', 4, 'hit', 'magenta', true)}
          </Box>
          {rows.length === 0 ? <Text dimColor>{sp('no requests yet')}</Text> : null}
          {rows.map((row, i) => {
            const n = all.length - rows.length + i + 1
            const pct = Math.round(rowRatio(row) * 100)
            return (
              <Box key={`t:${row.turnId}`} flexDirection="row" columnGap={1}>
                {cell(`c:turn:${row.turnId}`, 4, String(n))}
                {cell(`c:steps:${row.turnId}`, 5, String(row.steps))}
                {cell(`c:read:${row.turnId}`, 6, fmtTokens(row.read), 'green')}
                {cell(`c:wrote:${row.turnId}`, 6, fmtTokens(row.write), 'yellow')}
                {cell(`c:new:${row.turnId}`, 5, fmtTokens(row.fresh), 'cyan')}
                {cell(`c:hit:${row.turnId}`, 4, `${pct}%`, hitColor(pct), true)}
              </Box>
            )
          })}
        </Box>

        <Box key="foot" marginTop={1} flexDirection="column">
          {handoff !== 'idle' ? <Text bold color="yellow">{sp(`✎ ${phaseLine(handoff, followUpConfirmed !== '', e.props.bodyColumns, Input !== undefined)}`)}</Text> : null}
          {row}
          {held === undefined ? null : <Text dimColor>{sp(fit(held, width))}</Text>}
          <Box key="actions" flexDirection="row" columnGap={2} marginTop={row === null ? 0 : 1}>
            <Button key="close" label="close" onPress={() => {}} />
            {showClear && handoff === 'idle' && last ? (
              <Button key="clear-cache" label="clear cache" dimColor={isTurnRunning} onPress={() => pressClear($, takePress(), false, askMessage && Input !== undefined)} />
            ) : null}
            {isStoppable() && row === null ? <Button key="cancel-handoff" label="cancel" onPress={() => pressCancel($)} /> : null}
          </Box>
          <Box key="legend" marginTop={1} flexDirection="column">
            <Text color="green">{sp('■ read: served by the cache')}</Text>
            <Text color="yellow">{sp('■ wrote: new cache entry')}</Text>
            <Text color="cyan">{sp('■ new: sent uncached')}</Text>
          </Box>
        </Box>
      </Box>
    )
  })
}
