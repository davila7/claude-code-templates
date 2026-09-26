/**
 * jev-vercel-sandbox — Claude Mod (EARLY ACCESS)
 *
 * Every Bash command Claude is about to run is judged by TypeSafe's Jev: a
 * command dangerous enough (destructive, remote code, a change to the machine,
 * data leaving it) never runs on the person's machine. It runs in a Vercel
 * Sandbox, an isolated Linux microVM started when the session starts, and its
 * output comes back as the Bash tool's result, with a note telling Claude
 * where it ran.
 *
 *   session.start  registers /jev-vercel-sandbox, opens the side pane, starts the sandbox
 *   turn.start     records the user's request (the judge's intent)
 *   tool.call      Bash only: plain reads stay local; the rest go to the judge,
 *                  and a dangerous one runs in the sandbox instead of `next`
 *   session.end    stops the sandbox
 *   ui.render      the pane: sandbox state, the judge, the last commands it ran
 *
 * Vercel credentials and Jev keys come from the plugin's options
 * (pluginConfigs["jev-vercel-sandbox@skills-dir"].options in user settings), with
 * VERCEL_TOKEN / VERCEL_OIDC_TOKEN / VERCEL_TEAM_ID / VERCEL_PROJECT_ID as a
 * fallback. Never from this code. Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
 * (Claude Code >= 2.1.259).
 *
 * Privacy: with a Jev key set, the user's latest request and each judged
 * command go to that backend. A sandboxed command goes to Vercel; no local
 * file or environment variable does.
 */
import type { Register } from 'claude-code'
import {
  BUILTIN_LABELS,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  classifyText,
  decide,
  describeJudgement,
  endpoint,
  isPlainRead,
  readJudgement,
  requestBody,
  requestHeaders,
  selectProvider,
  shortCommand,
  stateText,
  verdictReason,
} from './judge.ts'
import type { Judgement, Provider, Verdict } from './judge.ts'
import { DEFAULT_API_URL, client, resolveCredentials } from './vercel.ts'
import type { Client, CreateOptions, Credentials, Fetch, RunResult, SandboxInfo } from './vercel.ts'

const PANE = 'jev-vercel-sandbox'
const COMMAND = 'jev-vercel-sandbox'
const TAG = '[jev-vercel-sandbox]'
const RECENT = 8
// what the Bash tool itself keeps inline
const MAX_OUTPUT = 30_000
// session.start waits this long for the sandbox; past it the session goes on and the start finishes in the background
const START_WAIT_MS = 8_000
const POLL_MS = 500
const POLL_TRIES = 12

type State = 'off' | 'starting' | 'ready' | 'failed' | 'stopped'
type Ran = { command: string; exitCode: number | null; ms: number; reason: string; error?: string }

let state: State = 'off'
let info: SandboxInfo | undefined
let lastError: string | undefined
let starting: Promise<void> | undefined
let intent = ''
let now = 0
let isOpen = false
const recent: Ran[] = []
const judgements = new Map<string, Verdict>()
const tally = { local: 0, sandbox: 0, denied: 0 }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function cap(text: string): string {
  return text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n… (${text.length - MAX_OUTPUT} more characters cut by jev-vercel-sandbox)` : text
}

function minutesLeft(): number | null {
  if (!info || !info.timeout || !info.startedAt || !now) return null
  return Math.max(0, Math.round((info.startedAt + info.timeout - now) / 60_000))
}

function statusLine(): string {
  const where = state === 'ready' ? 'ready' : state === 'starting' ? 'starting…' : state === 'off' ? 'not configured' : state
  return `sandbox · ${where} · ${tally.sandbox} sandboxed · ${tally.local} local${tally.denied ? ` · ${tally.denied} refused` : ''}`
}

function remember(r: Ran): void {
  recent.push(r)
  if (recent.length > RECENT) recent.splice(0, recent.length - RECENT)
}

export const register: Register = (on, options) => {
  const text = (key: string, fallback = '') =>
    typeof options[key] === 'string' && options[key] ? (options[key] as string).trim() : fallback
  const number = (key: string, fallback: number) =>
    typeof options[key] === 'number' && Number.isFinite(options[key]) ? (options[key] as number) : fallback
  const flag = (key: string, fallback: boolean) => (typeof options[key] === 'boolean' ? (options[key] as boolean) : fallback)

  // the judge
  const typesafeKey = text('typesafeApiKey')
  const gatewayKey = text('gatewayApiKey')
  const active: Provider | null = selectProvider(text('provider', 'auto'), typesafeKey, gatewayKey)
  const apiKey = active === 'typesafe' ? typesafeKey : active === 'gateway' ? gatewayKey : ''
  const modelId = !active ? '' : active === 'typesafe' ? text('typesafeModel', DEFAULT_MODEL.typesafe) : text('gatewayModel', DEFAULT_MODEL.gateway)
  const judgeUrl = !active
    ? ''
    : active === 'typesafe'
      ? endpoint('typesafe', text('typesafeBaseUrl', DEFAULT_BASE_URL.typesafe))
      : endpoint('gateway', text('gatewayBaseUrl', DEFAULT_BASE_URL.gateway))
  const backend = active ? `${active} ${modelId}` : 'built-in classifier'
  const threshold = number('threshold', 0.5)
  const severityLine = number('severityThreshold', 2)
  const judgeTimeoutMs = number('judgeTimeoutMs', 2_000)
  const onJudgeError = text('onJudgeError', 'sandbox') === 'local' ? 'local' : 'sandbox'
  const whenUnavailable = text('whenUnavailable', 'deny') === 'local' ? 'local' : 'deny'
  const audit = text('mode', 'enforce') === 'audit'
  const logDecisions = flag('logDecisions', true)

  // the sandbox
  const apiBase = text('vercelApiUrl', DEFAULT_API_URL)
  const createOptions: CreateOptions = {
    timeoutMs: Math.max(1, number('sandboxTimeoutMinutes', 45)) * 60_000,
    image: text('sandboxImage') || undefined,
    vcpus: number('sandboxVcpus', 0) || undefined,
    persistent: flag('persistent', false),
  }
  const commandTimeoutMs = Math.min(600_000, Math.max(1_000, number('commandTimeoutMs', 120_000)))
  const startOnSessionStart = flag('startOnSessionStart', true)
  const openPanel = flag('openPanel', true)
  const columns = Math.min(80, Math.max(28, number('columns', 44)))

  let credentials: Credentials | undefined
  let credentialsKind = ''
  let missing: string[] = []

  /** Starts (or restarts) the sandbox and waits until its session runs. */
  async function start(api: Client, sleep: (ms: number) => Promise<void>): Promise<void> {
    state = 'starting'
    lastError = undefined
    try {
      let s = await api.create(createOptions)
      // kept at once, so a sandbox whose polling fails can still be found and stopped
      info = s
      for (let i = 0; s.status === 'pending' && i < POLL_TRIES; i++) {
        await sleep(POLL_MS)
        s = await api.get(s)
        info = s
      }
      if (s.status === 'running') state = 'ready'
      else {
        state = 'failed'
        lastError = `the sandbox is ${s.status}`
      }
    } catch (err) {
      state = 'failed'
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  /** The running sandbox, started or restarted as needed; throws when it cannot be had. */
  async function ready(api: Client, sleep: (ms: number) => Promise<void>): Promise<SandboxInfo> {
    if (starting) await starting.catch(() => undefined)
    // a start that outlived session.start's wait may have stopped polling while still pending: look again
    if (info && (state === 'starting' || state === 'failed')) {
      const fresh = await api.get(info).catch(() => undefined)
      if (fresh) {
        info = fresh
        if (fresh.status === 'running') {
          state = 'ready'
          lastError = undefined
        }
      }
    }
    const expired = info && info.timeout && now && info.startedAt + info.timeout <= now
    if (!info || state !== 'ready' || expired) {
      // never leave a replaced sandbox running (and billed) behind
      if (info && (info.status === 'running' || info.status === 'pending')) await api.stop(info).catch(() => undefined)
      starting = start(api, sleep)
      await starting
    }
    if (state !== 'ready' || !info) throw new Error(lastError ?? 'the sandbox is not running')
    return info
  }

  async function runThere(api: Client, sleep: (ms: number) => Promise<void>, command: string, timeoutMs: number): Promise<RunResult> {
    const s = await ready(api, sleep)
    try {
      return await api.run(s, command, timeoutMs)
    } catch (err) {
      // the session may have timed out or been stopped from the dashboard: look, restart once, retry
      const fresh = await api.get(s).catch(() => undefined)
      if (fresh?.status === 'running') throw err
      state = 'stopped'
      return api.run(await ready(api, sleep), command, timeoutMs)
    }
  }

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: COMMAND,
        description: 'The Vercel Sandbox that runs dangerous commands (status|open|restart|stop|log)',
        argumentHint: '[status|open|restart|stop|log]',
        immediate: true,
      })
      .catch(err => $.ui.log(`${TAG} /${COMMAND} not registered: ${err}`))

    // a fresh load of the plugin starts from nothing
    info = undefined
    lastError = undefined
    starting = undefined
    recent.length = 0
    judgements.clear()
    tally.local = tally.sandbox = tally.denied = 0

    // env fallbacks, each read by its literal name (the engine lists what a module reads)
    const orEmpty = (v: string | undefined) => v ?? ''
    const token =
      text('vercelToken') ||
      orEmpty(await $.env.get('VERCEL_TOKEN').catch(() => undefined)) ||
      orEmpty(await $.env.get('VERCEL_OIDC_TOKEN').catch(() => undefined))
    const teamId = text('vercelTeamId') || orEmpty(await $.env.get('VERCEL_TEAM_ID').catch(() => undefined))
    const projectId = text('vercelProjectId') || orEmpty(await $.env.get('VERCEL_PROJECT_ID').catch(() => undefined))
    const resolved = resolveCredentials(token, teamId, projectId)
    now = await $.clock.now()
    if (resolved.ok) {
      credentials = resolved.credentials
      credentialsKind = resolved.kind
      state = 'stopped'
    } else {
      missing = resolved.missing
      state = 'off'
    }

    if (openPanel) {
      isOpen = true
      // unasked, the engine keeps it undrawn below 144 columns until the person opens it
      await $.ui.open({ id: PANE, title: 'sandbox', columns }).catch(err => {
        isOpen = false
        $.ui.log(`${TAG} pane not opened: ${err}`, { to: 'debug' })
      })
    }

    if (credentials && startOnSessionStart) {
      const api = client((url, init) => $.http.fetch(url, init), credentials, apiBase)
      starting = start(api, ms => $.clock.sleep(ms))
      await Promise.race([starting, $.clock.sleep(START_WAIT_MS)]).catch(() => undefined)
    }
    now = await $.clock.now()
    // start() moved it while this hook waited
    const after = state as State
    const got = info as SandboxInfo | undefined

    const where = got ? `${got.name} · ${got.region} · ${got.vcpus} vCPU` : after === 'starting' ? 'still starting' : lastError ?? 'starts on the first dangerous command'
    $.ui.log(
      credentials
        ? `${TAG} ${after === 'ready' ? 'sandbox ready' : `sandbox ${after}`}: ${where} · judge ${backend} · threshold ${threshold.toFixed(2)}${audit ? ' · audit' : ''}`
        : `${TAG} not configured: set ${missing.join(', ')} in pluginConfigs["${$.plugin.name}@skills-dir"] (or "${$.plugin.name}" with --plugin-dir); dangerous commands are ${whenUnavailable === 'deny' ? 'refused' : 'run locally'} until then`,
    )
    if (after === 'failed') $.ui.toast(`jev-vercel-sandbox: the sandbox did not start (${lastError})`)
    $.ui.status(statusLine())
    $.ui.invalidate('ui.render')
    return r
  })

  on('turn.start', async ($, e, next) => {
    if (e.text.trim()) intent = e.text
    now = await $.clock.now()
    if (isOpen) $.ui.invalidate('ui.render')
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const command = typeof e.command === 'string' ? e.command : ''
    if (!command.trim()) return next(e)
    const short = shortCommand(command)

    // 1. which way it goes
    let verdict: Verdict | undefined = isPlainRead(command)
      ? { route: 'local', hazard: null, probability: null, bySeverity: false, by: 'read-only' }
      : judgements.get(`${intent}\u0000${command}`)
    if (!verdict) {
      const startedAt = await $.clock.now()
      const state_ = stateText(intent, command, await $.session.cwd().catch(() => ''))
      let judgement: Judgement | null = null
      try {
        if (active) {
          const response = await Promise.race([
            $.http.fetch(judgeUrl, { method: 'POST', headers: requestHeaders(active, apiKey, modelId), body: requestBody(active, state_, modelId) }),
            $.clock.sleep(judgeTimeoutMs),
          ])
          if (response && response.ok) judgement = readJudgement(response.text)
          else $.ui.log(`${TAG} judge: ${response ? `${active} responded ${response.status}` : `no answer in ${judgeTimeoutMs}ms`}`)
          if (judgement) verdict = decide(judgement, threshold, severityLine)
        } else {
          const label = await $.model.classify(classifyText(state_), BUILTIN_LABELS)
          if (label === 'local' || label === 'sandbox') verdict = { route: label, hazard: null, probability: null, bySeverity: false, by: 'built-in' }
        }
      } catch (err) {
        $.ui.log(`${TAG} judge failed: ${String(err)}`)
      }
      const ms = (await $.clock.now()) - startedAt
      if (logDecisions && active) $.ui.log(`${TAG} judge ${short}: ${describeJudgement(judgement, ms)}`)
      if (verdict) {
        judgements.set(`${intent}\u0000${command}`, verdict)
        if (judgements.size > 300) judgements.delete(judgements.keys().next().value as string)
      } else {
        verdict = { route: onJudgeError, hazard: null, probability: null, bySeverity: false, by: 'judge error' }
      }
    }
    const reason = verdictReason(verdict)

    if (verdict.route === 'local' || audit) {
      tally.local += 1
      if (logDecisions && verdict.by !== 'read-only') $.ui.log(`${TAG} ${audit && verdict.route === 'sandbox' ? 'audit: would sandbox' : 'local'} ${short} (${reason})`)
      $.ui.status(statusLine())
      return next(e)
    }

    // 2. dangerous: run it in the sandbox, never here
    if (!credentials) {
      if (whenUnavailable === 'local') {
        tally.local += 1
        $.ui.log(`${TAG} local ${short}: judged dangerous (${reason}) but no sandbox is configured`)
        return next(e)
      }
      tally.denied += 1
      $.ui.status(statusLine())
      return {
        deny: `jev-vercel-sandbox judged this command dangerous (${reason}) and would run it in a Vercel Sandbox, but none is configured (missing ${missing.join(', ')}). It was not run. Tell the user; do not retry it another way.`,
      }
    }

    const api = client((url, init) => $.http.fetch(url, init), credentials, apiBase)
    const sleep = (ms: number) => $.clock.sleep(ms)
    const timeoutMs = Math.min(600_000, typeof e.timeout === 'number' && e.timeout > 0 ? e.timeout : commandTimeoutMs)
    $.ui.status(`sandbox · running ${short}`)
    if (logDecisions) $.ui.log(`${TAG} sandbox ${short} (${reason})`)
    const startedAt = await $.clock.now()
    let result: RunResult
    try {
      result = await runThere(api, sleep, command, timeoutMs)
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err)
      lastError = why
      now = await $.clock.now()
      remember({ command: short, exitCode: null, ms: now - startedAt, reason, error: why })
      $.ui.invalidate('ui.render')
      if (whenUnavailable === 'local') {
        tally.local += 1
        $.ui.log(`${TAG} sandbox unavailable (${why}); ran ${short} locally`)
        $.ui.status(statusLine())
        return next(e)
      }
      tally.denied += 1
      $.ui.log(`${TAG} sandbox unavailable (${why}); refused ${short}`)
      $.ui.status(statusLine())
      return {
        deny: `jev-vercel-sandbox judged this command dangerous (${reason}) and the Vercel Sandbox could not run it (${why}). It was not run on the user's machine either. Tell the user; do not retry it another way.`,
      }
    }
    now = await $.clock.now()
    const ms = Math.round(result.durationMs ?? now - startedAt)
    tally.sandbox += 1
    remember({ command: short, exitCode: result.exitCode, ms, reason, error: result.error })
    $.ui.status(statusLine())
    $.ui.invalidate('ui.render')

    const s = info!
    const exit = result.exitCode === null ? 'no exit code' : `exit ${result.exitCode}`
    const header = `[ran in Vercel Sandbox ${s.name}, not on this machine · ${reason} · ${exit} · ${ms}ms]`
    const stderr = [result.stderr, result.error ? `jev-vercel-sandbox: ${result.error}` : '', result.exitCode ? `Exit code ${result.exitCode}` : '']
      .filter(Boolean)
      .join('\n')
    return {
      result: { stdout: cap(`${header}\n${result.stdout}`), stderr: cap(stderr), interrupted: false },
      context: [
        `This Bash command did not run on the user's machine. jev-vercel-sandbox judged it dangerous (${reason}) and ran it in an isolated Vercel Sandbox (a Linux microVM, working directory ${s.cwd || 'its default'}), ` +
          `which has none of the project's files, the user's environment variables or credentials. Nothing on the user's machine changed. ${exit}. ` +
          (e.run_in_background ? 'It ran in the foreground there, not in the background. ' : '') +
          'Files it wrote exist only in the sandbox, which is stopped when the session ends. If the task needs this to happen on the user\'s machine, tell the user and let them run it themselves.',
      ],
    }
  })

  on('session.end', async ($, e, next) => {
    if (credentials && info && state === 'ready' && flag('stopOnExit', true)) {
      const api = client((url, init) => $.http.fetch(url, init), credentials, apiBase)
      const budget = Math.max(0, Math.min(2_000, next.budget.remainingMs - 500))
      await Promise.race([api.stop(info).catch(() => undefined), $.clock.sleep(budget)]).catch(() => undefined)
      state = 'stopped'
    }
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    now = await $.clock.now()
    const api = credentials ? client((url, init) => $.http.fetch(url, init), credentials, apiBase) : undefined
    if (arg === 'log') {
      if (!recent.length) return { text: 'jev-vercel-sandbox: nothing has run in the sandbox yet' }
      return { text: recent.map(r => `${r.error && r.exitCode === null ? '✗' : r.exitCode === 0 ? '✓' : '!'} ${r.command}  · ${r.exitCode ?? r.error} · ${r.reason}`).join('\n') }
    }
    if (arg === 'restart' || arg === 'start') {
      if (!api) return { text: `jev-vercel-sandbox: not configured (missing ${missing.join(', ')})` }
      if (info && state === 'ready') await api.stop(info).catch(() => undefined)
      starting = start(api, ms => $.clock.sleep(ms))
      await starting
      now = await $.clock.now()
      $.ui.status(statusLine())
      $.ui.invalidate('ui.render')
      return { text: state === 'ready' ? `jev-vercel-sandbox: ${info!.name} ready` : `jev-vercel-sandbox: did not start (${lastError})` }
    }
    if (arg === 'stop') {
      if (api && info && state === 'ready') await api.stop(info).catch(err => $.ui.log(`${TAG} stop failed: ${err}`))
      state = credentials ? 'stopped' : 'off'
      $.ui.status(statusLine())
      $.ui.invalidate('ui.render')
      return { text: 'jev-vercel-sandbox: stopped; the next dangerous command starts a new one' }
    }
    if (arg === 'open' || arg === '') {
      isOpen = true
      await $.ui.open({ id: PANE, title: 'sandbox', focus: true, columns }).catch(() => (isOpen = false))
      $.ui.invalidate('ui.render')
    }
    const left = minutesLeft()
    return {
      text: [
        `jev-vercel-sandbox: ${statusLine()}`,
        credentials
          ? `sandbox: ${info ? `${info.name} · ${info.status} · ${info.region} · ${info.vcpus} vCPU · ${info.memory} MB${left !== null ? ` · stops in ${left}m` : ''}` : 'not started'} (${credentialsKind})`
          : `not configured: missing ${missing.join(', ')}`,
        `judge: ${backend} · threshold ${threshold.toFixed(2)} · severity ${severityLine.toFixed(1)}${audit ? ' · audit (nothing is sandboxed)' : ''}`,
        lastError ? `last error: ${lastError}` : '',
        `/${COMMAND} open · restart · stop · log`,
      ]
        .filter(Boolean)
        .join('\n'),
    }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) isOpen = false
    return next(e)
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== $.plugin.name || e.requestId !== PANE) return next(e)
    const r = await next(e)
    if (e.element === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      isOpen = false
      return r
    }
    if (!credentials) return r
    const api = client((url, init) => $.http.fetch(url, init), credentials, apiBase)
    if (e.element === 'restart') {
      if (info && state === 'ready') await api.stop(info).catch(() => undefined)
      starting = start(api, ms => $.clock.sleep(ms))
      $.ui.invalidate('ui.render')
      await starting
      if (state === 'failed') $.ui.toast(`jev-vercel-sandbox: the sandbox did not start (${lastError})`)
    } else if (e.element === 'stop' && info && state === 'ready') {
      await api.stop(info).catch(err => $.ui.toast(`jev-vercel-sandbox: stop failed: ${err}`))
      state = 'stopped'
    }
    now = await $.clock.now()
    $.ui.status(statusLine())
    $.ui.invalidate('ui.render')
    return r
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = Math.max(20, e.props.bodyColumns - 1)
    const fit = (s: string, w = width) => (s.length > w ? `${s.slice(0, Math.max(1, w - 1))}…` : s)
    const noop = () => {}
    const left = minutesLeft()

    const badge =
      state === 'ready' ? (
        <Text color="green" bold>● ready</Text>
      ) : state === 'starting' ? (
        <Text color="yellow" bold>◌ starting…</Text>
      ) : state === 'failed' ? (
        <Text color="red" bold>✗ failed</Text>
      ) : state === 'stopped' ? (
        <Text color="yellow" bold>○ stopped</Text>
      ) : (
        <Text color="red" bold>– not configured</Text>
      )

    const explain =
      state === 'ready'
        ? 'Ready. Commands Jev judges dangerous run here, in an isolated Linux microVM, instead of on your machine.'
        : state === 'starting'
          ? 'Starting the microVM. Dangerous commands wait for it.'
          : state === 'stopped'
            ? 'Not running. The next dangerous command starts a new one; restart starts it now.'
            : state === 'failed'
              ? `It did not start: ${lastError ?? 'unknown error'}. Dangerous commands are ${whenUnavailable === 'deny' ? 'refused' : 'run locally'} until it does.`
              : `Set ${missing.join(', ')} in the plugin's options (settings.json, pluginConfigs["${$.plugin.name}@skills-dir"].options). Until then dangerous commands are ${whenUnavailable === 'deny' ? 'refused' : 'run locally'}.`

    return (
      <Box flexDirection="column">
        <Text bold>{fit('Vercel Sandbox')}</Text>
        {badge}
        {info ? (
          <Box key="info" flexDirection="column" marginTop={1}>
            <Text>{fit(info.name)}</Text>
            <Text dimColor>{fit(`${info.region} · ${info.vcpus} vCPU · ${info.memory} MB`)}</Text>
            {info.image ? <Text dimColor>{fit(info.image)}</Text> : null}
            {left !== null && state === 'ready' ? <Text dimColor>{fit(`stops in ${left}m`)}</Text> : null}
          </Box>
        ) : null}
        <Box key="explain" marginTop={1}>
          <Text wrap="wrap">{explain}</Text>
        </Box>

        <Box key="judge-head" marginTop={1}>
          <Text bold color="cyan">Judge</Text>
        </Box>
        <Text dimColor>{fit(`${backend}${audit ? ' · audit' : ''}`)}</Text>
        <Text dimColor>{fit(`sandbox at ${threshold.toFixed(2)} · severity ${severityLine.toFixed(1)}`)}</Text>
        <Text dimColor>{fit(`${plural(tally.sandbox, 'sandboxed')} · ${tally.local} local${tally.denied ? ` · ${tally.denied} refused` : ''}`)}</Text>

        <Box key="recent-head" marginTop={1}>
          <Text bold color="cyan">{`Ran in the sandbox (${recent.length})`}</Text>
        </Box>
        {recent.length === 0 ? <Text dimColor>nothing yet</Text> : null}
        {recent
          .slice()
          .reverse()
          .map((r, i) => {
            const ok = r.exitCode === 0
            const mark = r.exitCode === null ? '✗ ' : ok ? '✓ ' : '! '
            const tail = r.exitCode === null ? ' failed' : ` ${r.exitCode}`
            return (
              <Box key={`run:${i}`} flexDirection="row">
                <Text color={r.exitCode === null ? 'red' : ok ? 'green' : 'yellow'}>{mark}</Text>
                <Text>{fit(r.command, width - 2 - tail.length)}</Text>
                <Text dimColor>{tail}</Text>
              </Box>
            )
          })}

        <Box key="toolbar" marginTop={1} flexDirection="row" columnGap={1}>
          {credentials ? <Button key="restart" label={state === 'ready' ? 'restart' : 'start'} hotkey="r" onPress={noop} /> : null}
          {credentials && state === 'ready' ? <Button key="stop" label="stop" onPress={noop} /> : null}
          <Button key="close" label="close" onPress={noop} />
        </Box>
      </Box>
    )
  })
}
