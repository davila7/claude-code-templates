/**
 * jev-vercel-sandbox — Claude Mod (EARLY ACCESS)
 *
 * Every Bash command Claude is about to run is judged by TypeSafe's Jev: a
 * command dangerous enough (destructive, remote code, a change to the machine,
 * data leaving it) never runs on the person's machine. It runs in a Vercel
 * Sandbox, an isolated Linux microVM holding a copy of the project, and its
 * output comes back as the Bash tool's result, with a note telling Claude
 * where it ran and which files it changed there.
 *
 * The sandbox starts only when the person runs /jev-vercel-sandbox: the side
 * pane opens with the start's progress (the microVM, packing the project,
 * uploading it), then says Jev now runs dangerous commands in the sandbox and
 * logs each one live. Until then a dangerous command is refused.
 *
 *   session.start  registers /jev-vercel-sandbox, reads the credentials; starts nothing
 *   command.run    /jev-vercel-sandbox: opens the pane and starts the sandbox (status|open|restart|stop|log|approve)
 *   turn.start     records the user's request (the judge's intent)
 *   tool.call      Bash only: plain reads stay local; the rest go to the judge,
 *                  and a dangerous one runs in the sandbox instead of `next`
 *   session.end    stops the sandbox
 *   ui.render      the pane: the start's progress, then the sandbox and its command log
 *
 * Vercel credentials and Jev keys come from the plugin's options
 * (pluginConfigs["jev-vercel-sandbox@skills-dir"].options in user settings), with
 * VERCEL_TOKEN / VERCEL_OIDC_TOKEN / VERCEL_TEAM_ID / VERCEL_PROJECT_ID as a
 * fallback. Never from this code. Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
 * (Claude Code >= 2.1.259).
 *
 * Privacy: with a Jev key set, the user's latest request and each judged
 * command go to that backend. /jev-vercel-sandbox uploads the project's files
 * (what git tracks, minus .env*, keys and credentials; untracked files only with
 * uploadUntracked) to
 * Vercel; no environment variable goes.
 */
import type { ProcessRunInit, ProcessRunResult, Register } from 'claude-code'
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
import {
  APPEND_SCRIPT,
  CHANGES_SCRIPT,
  EXTRACT_SCRIPT,
  PART_BYTES,
  TRUNCATE_SCRIPT,
  UPLOAD_FILE,
  describeChanges,
  filesToUpload,
  folderName,
  megabytes,
  nulList,
  readChanges,
  relativeCwd,
  uploadBatches,
} from './workspace.ts'
import type { Change } from './workspace.ts'

const PANE = 'jev-vercel-sandbox'
const COMMAND = 'jev-vercel-sandbox'
const TAG = '[jev-vercel-sandbox]'
const RECENT = 12
// what the Bash tool itself keeps inline
const MAX_OUTPUT = 30_000
// a dangerous command that arrives while the sandbox starts waits at most this long, then is refused
const START_WAIT_MS = 6_000
const POLL_MS = 500
const POLL_TRIES = 12
const STEP_TIMEOUT_MS = 120_000

type State = 'off' | 'idle' | 'starting' | 'ready' | 'failed' | 'stopped'
type StepKey = 'vm' | 'pack' | 'upload' | 'prepare'
type Step = { key: StepKey; label: string; state: 'wait' | 'run' | 'done' | 'fail' | 'skip'; detail: string }
type Ran = {
  command: string
  short: string
  state: 'running' | 'done' | 'error'
  exitCode: number | null
  ms: number
  reason: string
  error?: string
  changes?: Change[]
}
type Workspace = { dir: string; cwd: string; files: number; excluded: number; bytes: number; git: boolean }

/** What the start needs from `$`, handed in as closures so it can run after the command's hook returned. */
type Host = {
  fetch: Fetch
  sleep: (ms: number) => Promise<void>
  now: () => Promise<number>
  run: (argv: readonly string[], init?: ProcessRunInit) => Promise<ProcessRunResult>
  readBase64: (path: string) => Promise<string>
  size: (path: string) => Promise<number>
  list: (path: string) => Promise<string[]>
  cwd: () => Promise<string>
  log: (text: string) => void
  toast: (text: string) => void
  status: (text: string) => void
  redraw: () => void
}

let state: State = 'off'
let info: SandboxInfo | undefined
let workspace: Workspace | undefined
let lastError: string | undefined
let starting: Promise<void> | undefined
let steps: Step[] = []
let intent = ''
let now = 0
let isOpen = false
const recent: Ran[] = []
const approved = new Set<string>()
const judgements = new Map<string, Verdict>()
const tally = { local: 0, sandbox: 0, denied: 0 }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err))

function cap(text: string): string {
  return text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n… (${text.length - MAX_OUTPUT} more characters cut by jev-vercel-sandbox)` : text
}

function minutesLeft(): number | null {
  if (!info || !info.timeout || !info.startedAt || !now) return null
  return Math.max(0, Math.round((info.startedAt + info.timeout - now) / 60_000))
}

function statusLine(): string {
  const where =
    state === 'ready' ? 'ready' : state === 'starting' ? 'starting…' : state === 'off' ? 'not configured' : state === 'idle' ? `/${COMMAND} to start` : state
  return `sandbox · ${where} · ${tally.sandbox} sandboxed · ${tally.local} local${tally.denied ? ` · ${tally.denied} refused` : ''}`
}

function freshSteps(upload: boolean): Step[] {
  return [
    { key: 'vm', label: 'Starting the microVM', state: 'wait', detail: '' },
    { key: 'pack', label: 'Packing the project', state: upload ? 'wait' : 'skip', detail: upload ? '' : 'off (uploadWorkspace)' },
    { key: 'upload', label: 'Uploading it', state: upload ? 'wait' : 'skip', detail: '' },
    { key: 'prepare', label: 'Unpacking in the sandbox', state: upload ? 'wait' : 'skip', detail: '' },
  ]
}

function step(key: StepKey, s: Step['state'], detail?: string): void {
  // a failed start's other half may still be running: its progress no longer shows
  if (state === 'failed') return
  const found = steps.find(x => x.key === key)
  if (!found) return
  found.state = s
  if (detail !== undefined) found.detail = detail
}

function remember(r: Ran): Ran {
  recent.push(r)
  if (recent.length > RECENT) recent.splice(0, recent.length - RECENT)
  return r
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
  const uploadWorkspace = flag('uploadWorkspace', true)
  // untracked files are anything lying in the folder: never sent unless asked for
  const uploadUntracked = flag('uploadUntracked', false)
  const maxMB = Math.max(1, number('workspaceMaxMB', 10))
  const columns = Math.min(80, Math.max(28, number('columns', 44)))

  let credentials: Credentials | undefined
  let credentialsKind = ''
  let missing: string[] = []

  const notRunning = () =>
    state === 'starting'
      ? 'the Vercel Sandbox is still starting'
      : state === 'failed'
        ? `the Vercel Sandbox did not start (${lastError ?? 'unknown error'})`
        : `no Vercel Sandbox is running; the user starts one with /${COMMAND}`

  /** The microVM: create, then poll while it is pending. */
  async function startVm(h: Host, api: Client): Promise<SandboxInfo> {
    step('vm', 'run')
    h.redraw()
    let s = await api.create(createOptions)
    // kept at once, so a sandbox whose polling fails can still be found and stopped
    info = s
    for (let i = 0; s.status === 'pending' && i < POLL_TRIES; i++) {
      await h.sleep(POLL_MS)
      s = await api.get(s)
      info = s
    }
    if (s.status !== 'running') throw new Error(`the sandbox is ${s.status}`)
    step('vm', 'done', `${s.name} · ${s.region} · ${s.vcpus} vCPU`)
    h.redraw()
    return s
  }

  /** The project as one base64 gzip tar: git's file list minus secrets, packed by the local `tar`. */
  async function pack(h: Host, root: string): Promise<{ base64: string; files: number; excluded: number; bytes: number }> {
    step('pack', 'run', 'listing files')
    h.redraw()
    let listed: string[]
    let deleted: string[] = []
    const listing = uploadUntracked ? ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'] : ['git', 'ls-files', '-z', '--cached']
    const git = await h.run(listing, { cwd: root, timeoutMs: 60_000 }).catch(() => undefined)
    if (git && git.exitCode === 0) {
      // every entry ends in NUL: output cut at the limit ends mid-path
      if (git.stdout && !git.stdout.endsWith('\0')) throw new Error('the file list was cut short; the project is too large to copy')
      listed = nulList(git.stdout)
      const gone = await h.run(['git', 'ls-files', '-z', '--deleted'], { cwd: root, timeoutMs: 60_000 }).catch(() => undefined)
      if (gone?.exitCode === 0) deleted = nulList(gone.stdout)
    } else {
      // outside git every file is untracked
      if (!uploadUntracked) throw new Error('the folder is not a git repository; set uploadUntracked to copy its files, or uploadWorkspace to false for an empty sandbox')
      const found = await h.run(['find', '.', '-type', 'f', '-not', '-path', './.git/*', '-not', '-path', '*/node_modules/*', '-print0'], { cwd: root, timeoutMs: 60_000 })
      if (found.exitCode !== 0) throw new Error(`listing the project failed: ${found.stderr.trim().slice(0, 200)}`)
      if (found.stdout && !found.stdout.endsWith('\0')) throw new Error('the file list was cut short; the project is too large to copy')
      listed = nulList(found.stdout)
    }
    const { files, excluded } = filesToUpload(listed, deleted)
    if (!files.length) throw new Error('the project has no files to copy')
    step('pack', 'run', `${plural(files.length, 'file')}, compressing`)
    h.redraw()

    const tmp = (await h.run(['mktemp', '-d'])).stdout.trim()
    if (!tmp) throw new Error('mktemp -d gave no folder')
    try {
      const archive = `${tmp}/workspace.tgz`
      const tar = await h.run(['tar', '-czf', archive, '--null', '-T', '-'], {
        cwd: root,
        stdin: `${files.join('\0')}\0`,
        // macOS tar would add ._ AppleDouble files
        env: { COPYFILE_DISABLE: '1' },
        timeoutMs: STEP_TIMEOUT_MS,
      })
      if (tar.exitCode !== 0) throw new Error(`tar failed: ${tar.stderr.trim().slice(0, 200)}`)
      const bytes = await h.size(archive)
      if (bytes > maxMB * 1_048_576) throw new Error(`the project is ${megabytes(bytes)} compressed, over workspaceMaxMB (${maxMB} MB)`)
      let parts = [archive]
      if (bytes > PART_BYTES) {
        const split = await h.run(['split', '-b', String(PART_BYTES), archive, `${tmp}/part.`], { timeoutMs: 60_000 })
        if (split.exitCode !== 0) throw new Error(`split failed: ${split.stderr.trim().slice(0, 200)}`)
        parts = (await h.list(tmp)).filter(n => n.startsWith('part.')).sort().map(n => `${tmp}/${n}`)
      }
      let base64 = ''
      for (const p of parts) base64 += await h.readBase64(p)
      step('pack', 'done', `${plural(files.length, 'file')} · ${megabytes(bytes)}${excluded.length ? ` · ${excluded.length} credential file${excluded.length === 1 ? '' : 's'} left out` : ''}`)
      h.redraw()
      return { base64, files: files.length, excluded: excluded.length, bytes }
    } finally {
      await h.run(['rm', '-rf', tmp]).catch(() => undefined)
    }
  }

  /** The base64 into the sandbox, a few arguments per call, then unpacked with a git baseline. */
  async function upload(h: Host, api: Client, s: SandboxInfo, base64: string, dir: string): Promise<boolean> {
    const must = (r: RunResult, what: string) => {
      if (r.exitCode !== 0) throw new Error(`${what} failed in the sandbox: ${(r.error || r.stderr || `exit ${r.exitCode}`).trim().slice(0, 200)}`)
      return r
    }
    const batches = uploadBatches(base64)
    step('upload', 'run', `0/${batches.length}`)
    h.redraw()
    must(await api.script(s, TRUNCATE_SCRIPT, [UPLOAD_FILE], 30_000), 'preparing the upload')
    for (let i = 0; i < batches.length; i++) {
      must(await api.script(s, APPEND_SCRIPT, [UPLOAD_FILE, ...batches[i]!], 60_000), 'uploading')
      step('upload', 'run', `${i + 1}/${batches.length}`)
      h.redraw()
    }
    step('upload', 'done', `${batches.length} request${batches.length === 1 ? '' : 's'}`)
    step('prepare', 'run', dir)
    h.redraw()
    const r = must(await api.script(s, EXTRACT_SCRIPT, [UPLOAD_FILE, dir], STEP_TIMEOUT_MS), 'unpacking')
    const git = r.stdout.trim().endsWith('git') && !r.stdout.trim().endsWith('no-git')
    step('prepare', 'done', git ? dir : `${dir} · no git there, changed files are not listed`)
    h.redraw()
    return git
  }

  /** The whole start, run after /jev-vercel-sandbox answered; the pane follows every step. */
  async function boot(h: Host, creds: Credentials): Promise<void> {
    const api = client(h.fetch, creds, apiBase)
    state = 'starting'
    info = undefined
    workspace = undefined
    lastError = undefined
    steps = freshSteps(uploadWorkspace)
    h.status(statusLine())
    h.redraw()
    try {
      let root = ''
      let cwd = ''
      if (uploadWorkspace) {
        cwd = await h.cwd()
        const top = await h.run(['git', 'rev-parse', '--show-toplevel'], { cwd, timeoutMs: 10_000 }).catch(() => undefined)
        root = top && top.exitCode === 0 && top.stdout.trim() ? top.stdout.trim() : cwd
      }
      // the microVM boots while the project is packed
      const failing = (key: StepKey) => (err: unknown) => {
        step(key, 'fail', messageOf(err))
        throw err
      }
      const vm = startVm(h, api).catch(failing('vm'))
      const packing = uploadWorkspace ? pack(h, root).catch(failing('pack')) : undefined
      // when one half fails the other runs on unobserved
      vm.catch(() => undefined)
      packing?.catch(() => undefined)
      const [s, packed] = await Promise.all([vm, packing])
      if (packed) {
        const dir = `${(s.cwd || '/vercel/sandbox').replace(/\/+$/, '')}/${folderName(root)}`
        const git = await upload(h, api, s, packed.base64, dir)
        const rel = relativeCwd(root, cwd)
        workspace = { dir, cwd: rel ? `${dir}/${rel}` : dir, files: packed.files, excluded: packed.excluded, bytes: packed.bytes, git }
      }
      state = 'ready'
      now = await h.now()
      h.log(
        `${TAG} sandbox ready: ${s.name} · ${s.region}${workspace ? ` · ${plural(workspace.files, 'file')} in ${workspace.dir}` : ''}. ` +
          `Jev will now run the commands it judges dangerous in the sandbox (judge ${backend}, threshold ${threshold.toFixed(2)}${audit ? ', audit: nothing is sandboxed' : ''})`,
      )
      h.toast('jev-vercel-sandbox: sandbox ready, Jev runs dangerous commands there now')
    } catch (err) {
      lastError = messageOf(err)
      if (!steps.some(x => x.state === 'fail')) {
        const running = steps.find(x => x.state === 'run')
        step(running ? running.key : 'vm', 'fail', lastError)
      }
      state = 'failed'
      h.log(`${TAG} the sandbox did not start: ${lastError}`)
      h.toast(`jev-vercel-sandbox: the sandbox did not start (${lastError})`)
      // never leave a half-started microVM running (and billed)
      if (info) await api.stop(info).catch(() => undefined)
    }
    h.status(statusLine())
    h.redraw()
  }

  /** The files a command changed, and a new baseline; undefined when that cannot be told. */
  async function changesAfter(api: Client, s: SandboxInfo): Promise<Change[] | undefined> {
    if (!workspace?.git) return undefined
    const r = await api.script(s, CHANGES_SCRIPT, [workspace.dir], 60_000).catch(() => undefined)
    return r && r.exitCode === 0 ? readChanges(r.stdout) : undefined
  }

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: COMMAND,
        description: 'Start the Vercel Sandbox that runs dangerous commands, and show it (status|open|restart|stop|log|approve)',
        argumentHint: '[status|open|restart|stop|log|approve]',
        immediate: true,
      })
      .catch(err => $.ui.log(`${TAG} /${COMMAND} not registered: ${err}`))

    // a fresh load of the plugin starts from nothing
    info = undefined
    workspace = undefined
    lastError = undefined
    starting = undefined
    steps = []
    recent.length = 0
    approved.clear()
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
      state = 'idle'
    } else {
      credentials = undefined
      missing = resolved.missing
      state = 'off'
    }
    const refused = whenUnavailable === 'deny' ? 'refused' : 'run locally'
    $.ui.log(
      credentials
        ? `${TAG} configured (${credentialsKind}); run /${COMMAND} to start the sandbox. Until then dangerous commands are ${refused}`
        : `${TAG} not configured: set ${missing.join(', ')} in pluginConfigs["${$.plugin.name}@skills-dir"] (or "${$.plugin.name}" with --plugin-dir); dangerous commands are ${refused} until then`,
    )
    $.ui.status(statusLine())
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

    // the person approved this exact command for their machine, once
    if (approved.delete(command)) {
      tally.local += 1
      $.ui.log(`${TAG} local ${short} (approved by the user)`)
      $.ui.status(statusLine())
      return next(e)
    }

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

    // 2. dangerous: in the sandbox or nowhere
    if (state === 'starting' && starting) {
      // the wait is this hook's own time: keep clear of its budget
      const wait = Math.max(0, Math.min(START_WAIT_MS, next.budget.remainingMs - 1_500))
      await Promise.race([starting, $.clock.sleep(wait)]).catch(() => undefined)
    }
    const current = state as State
    const s = info
    if (!credentials || current !== 'ready' || !s) {
      const why = credentials ? notRunning() : `no Vercel Sandbox is configured (missing ${missing.join(', ')})`
      if (whenUnavailable === 'local') {
        tally.local += 1
        $.ui.log(`${TAG} local ${short}: judged dangerous (${reason}) but ${why}`)
        $.ui.status(statusLine())
        return next(e)
      }
      tally.denied += 1
      $.ui.log(`${TAG} refused ${short}: ${why}`)
      $.ui.status(statusLine())
      const hint = !credentials
        ? 'The user sets the Vercel credentials in the plugin options.'
        : current === 'starting'
          ? 'Wait for the sandbox pane to say it is ready, then run the command again.'
          : `The user can start the sandbox by typing /${COMMAND}; after that, run the command again.`
      return {
        deny: `jev-vercel-sandbox judged this command dangerous (${reason}) and runs such commands only in a Vercel Sandbox, but ${why}. It was not run. ${hint} Tell the user; do not retry it another way.`,
      }
    }

    const api = client((url, init) => $.http.fetch(url, init), credentials, apiBase)
    const timeoutMs = Math.min(600_000, typeof e.timeout === 'number' && e.timeout > 0 ? e.timeout : commandTimeoutMs)
    const cwd = workspace?.cwd
    $.ui.status(`sandbox · running ${short}`)
    if (logDecisions) $.ui.log(`${TAG} sandbox ${short} (${reason})`)
    const entry = remember({ command, short, state: 'running', exitCode: null, ms: 0, reason })
    $.ui.invalidate('ui.render')
    const startedAt = await $.clock.now()
    let result: RunResult
    try {
      result = await api.run(s, command, timeoutMs, cwd)
    } catch (err) {
      const why = messageOf(err)
      // the session may have timed out or been stopped from the dashboard
      const fresh = await api.get(s).catch(() => undefined)
      if (fresh && fresh.status !== 'running') {
        info = fresh
        state = 'stopped'
      }
      lastError = why
      now = await $.clock.now()
      entry.state = 'error'
      entry.error = why
      entry.ms = now - startedAt
      tally.denied += 1
      $.ui.log(`${TAG} sandbox could not run ${short}: ${why}`)
      $.ui.status(statusLine())
      $.ui.invalidate('ui.render')
      const again = state === 'stopped' ? ` The sandbox has stopped; the user restarts it with /${COMMAND}.` : ''
      return {
        deny: `jev-vercel-sandbox judged this command dangerous (${reason}) and the Vercel Sandbox could not run it (${why}). It was not run on the user's machine either.${again} Tell the user; do not retry it another way.`,
      }
    }
    const changes = await changesAfter(api, s)
    now = await $.clock.now()
    const ms = Math.round(result.durationMs ?? now - startedAt)
    tally.sandbox += 1
    entry.state = 'done'
    entry.exitCode = result.exitCode
    entry.ms = ms
    entry.error = result.error
    entry.changes = changes
    const exit = result.exitCode === null ? 'no exit code' : `exit ${result.exitCode}`
    const changed = changes ? describeChanges(changes) : ''
    if (logDecisions) $.ui.log(`${TAG} sandbox ${short}: ${exit} · ${ms}ms${changed ? ` · ${changed}` : ''}`)
    $.ui.status(statusLine())
    $.ui.invalidate('ui.render')

    const header = `[ran in Vercel Sandbox ${s.name}, not on this machine · ${reason} · ${exit} · ${ms}ms${changed ? ` · ${changed}` : ''}]`
    const stderr = [result.stderr, result.error ? `jev-vercel-sandbox: ${result.error}` : '', result.exitCode ? `Exit code ${result.exitCode}` : '']
      .filter(Boolean)
      .join('\n')
    const where = workspace
      ? `on a copy of the project uploaded when the sandbox started (working directory ${cwd}; .env files, keys and credentials were left out, and so are the user's environment variables)`
      : `in an empty sandbox (working directory ${s.cwd || 'its default'}) with none of the project's files, environment variables or credentials`
    return {
      result: { stdout: cap(`${header}\n${result.stdout}`), stderr: cap(stderr), interrupted: false },
      context: [
        `This Bash command did not run on the user's machine. jev-vercel-sandbox judged it dangerous (${reason}) and ran it in an isolated Vercel Sandbox (a Linux microVM) ${where}. ` +
          `Nothing on the user's machine changed. ${exit}${changed ? `; in the sandbox: ${changed}` : ''}. ` +
          (e.run_in_background ? 'It ran in the foreground there, not in the background. ' : '') +
          'Files it wrote exist only in the sandbox, which is stopped when the session ends. ' +
          `If the task needs this to happen on the user's machine, tell the user: they can approve it with /${COMMAND} approve (or "run locally" in the sandbox pane), and then the same command, run again, runs on their machine once.`,
      ],
    }
  }).catch(async ($, e, next) => {
    // over budget or thrown: never let a command that may be dangerous fall through to the machine
    if (next.called) return next(e)
    tally.denied += 1
    return { deny: `jev-vercel-sandbox could not decide where to run this command (${next.error.kind}), so it was not run. Tell the user; do not retry it another way.` }
  })

  on('session.end', async ($, e, next) => {
    if (credentials && info && (state === 'ready' || state === 'starting') && flag('stopOnExit', true)) {
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
    const redraw = () => void $.ui.invalidate('ui.render')
    const openPane = async () => {
      isOpen = true
      await $.ui.open({ id: PANE, title: 'sandbox', focus: true, columns }).catch(err => {
        isOpen = false
        $.ui.log(`${TAG} pane not opened: ${err}`, { to: 'debug' })
      })
      redraw()
    }
    const host = (): Host => ({
      fetch: (url, init) => $.http.fetch(url, init),
      sleep: ms => $.clock.sleep(ms),
      now: () => $.clock.now(),
      run: (argv, init) => $.process.run(argv, init),
      readBase64: async path => (await $.fs.read(path, { as: 'bytes' })).base64,
      size: async path => (await $.fs.stat(path)).size,
      list: async path => (await $.fs.list(path)).map(x => x.name),
      cwd: () => $.session.cwd(),
      log: line => void $.ui.log(line),
      toast: line => void $.ui.toast(line),
      status: line => void $.ui.status(line),
      redraw,
    })
    const launch = (creds: Credentials) => {
      // runs on after this command answers: the pane shows the progress
      starting = boot(host(), creds)
      void starting
    }

    if (arg === 'log') {
      if (!recent.length) return { text: 'jev-vercel-sandbox: nothing has run in the sandbox yet' }
      return {
        text: recent
          .map(r => `${r.state === 'running' ? '◌' : r.state === 'error' ? '✗' : r.exitCode === 0 ? '✓' : '!'} ${r.short}  · ${r.state === 'running' ? 'running' : r.exitCode ?? r.error} · ${r.reason}${r.changes?.length ? ` · ${describeChanges(r.changes, 3)}` : ''}`)
          .join('\n'),
      }
    }
    if (arg === 'approve') {
      const last = [...recent].reverse().find(r => r.state === 'done')
      if (!last) return { text: 'jev-vercel-sandbox: no sandboxed command to approve' }
      approved.add(last.command)
      redraw()
      return {
        text: `jev-vercel-sandbox: approved to run once on this machine: ${last.short}`,
        context: [`The user approved running this exact command on their own machine, once: ${last.command}\nRun it again with the Bash tool if the task still needs it; jev-vercel-sandbox lets it through locally.`],
      }
    }
    if (arg === 'stop') {
      if (credentials && info && (state === 'ready' || state === 'starting')) {
        await client((url, init) => $.http.fetch(url, init), credentials, apiBase)
          .stop(info)
          .catch(err => $.ui.log(`${TAG} stop failed: ${err}`))
      }
      state = credentials ? 'stopped' : 'off'
      $.ui.status(statusLine())
      redraw()
      return { text: `jev-vercel-sandbox: stopped; dangerous commands are ${whenUnavailable === 'deny' ? 'refused' : 'run locally'} until /${COMMAND} starts a new one` }
    }
    if (arg === 'restart') {
      if (!credentials) {
        await openPane()
        return { text: `jev-vercel-sandbox: not configured (missing ${missing.join(', ')})` }
      }
      if (state === 'starting') {
        await openPane()
        return { text: 'jev-vercel-sandbox: already starting; the pane shows the progress' }
      }
      if (info && state === 'ready') await client((url, init) => $.http.fetch(url, init), credentials, apiBase).stop(info).catch(() => undefined)
      await openPane()
      launch(credentials)
      return { text: 'jev-vercel-sandbox: starting a new sandbox; the pane shows the progress' }
    }
    if (arg === '' || arg === 'start' || arg === 'open') {
      await openPane()
      if (!credentials) return { text: `jev-vercel-sandbox: not configured, set ${missing.join(', ')} in the plugin's options` }
      if (arg !== 'open' && state !== 'ready' && state !== 'starting') {
        launch(credentials)
        return {
          text: `jev-vercel-sandbox: starting the Vercel Sandbox${uploadWorkspace ? ' and copying the project into it' : ''}; the pane shows the progress. Dangerous commands wait until it is ready.`,
        }
      }
      if (arg === 'open') return {}
    }
    const left = minutesLeft()
    return {
      text: [
        `jev-vercel-sandbox: ${statusLine()}`,
        credentials
          ? `sandbox: ${info ? `${info.name} · ${info.status} · ${info.region} · ${info.vcpus} vCPU · ${info.memory} MB${left !== null ? ` · stops in ${left}m` : ''}` : 'not started'} (${credentialsKind})`
          : `not configured: missing ${missing.join(', ')}`,
        workspace ? `project: ${plural(workspace.files, 'file')} · ${megabytes(workspace.bytes)} in ${workspace.dir}` : '',
        `judge: ${backend} · threshold ${threshold.toFixed(2)} · severity ${severityLine.toFixed(1)}${audit ? ' · audit (nothing is sandboxed)' : ''}`,
        lastError ? `last error: ${lastError}` : '',
        `/${COMMAND} [start] · open · restart · stop · log · approve`,
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
    if (e.element === 'approve') {
      const last = [...recent].reverse().find(x => x.state === 'done')
      if (last) {
        approved.add(last.command)
        $.ui.toast(`jev-vercel-sandbox: ${last.short} may run once on this machine`)
      }
    } else if (credentials && e.element === 'stop' && info && state === 'ready') {
      await client((url, init) => $.http.fetch(url, init), credentials, apiBase)
        .stop(info)
        .catch(err => $.ui.toast(`jev-vercel-sandbox: stop failed: ${err}`))
      state = 'stopped'
    } else if (credentials && e.element === 'restart' && state !== 'starting') {
      // the person's own start, as if typed: /jev-vercel-sandbox restart
      void $.command.run({ command: COMMAND, args: 'restart' }).catch(err => $.ui.toast(`jev-vercel-sandbox: ${err}`))
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
    const refused = whenUnavailable === 'deny' ? 'refused' : 'run on your machine'

    const badge =
      state === 'ready' ? (
        <Text color="green" bold>● ready</Text>
      ) : state === 'starting' ? (
        <Text color="yellow" bold>◌ loading the sandbox…</Text>
      ) : state === 'failed' ? (
        <Text color="red" bold>✗ did not start</Text>
      ) : state === 'stopped' ? (
        <Text color="yellow" bold>○ stopped</Text>
      ) : state === 'idle' ? (
        <Text color="yellow" bold>○ not started</Text>
      ) : (
        <Text color="red" bold>– not configured</Text>
      )

    const glyph = { wait: '·', run: '◌', done: '✓', fail: '✗', skip: '–' } as const
    const tone = { wait: undefined, run: 'yellow', done: 'green', fail: 'red', skip: undefined } as const

    const explain =
      state === 'ready'
        ? null
        : state === 'starting'
          ? 'Dangerous commands wait for it and are refused if it is not ready in time.'
          : state === 'failed'
            ? `Dangerous commands are ${refused}. /${COMMAND} restart tries again.`
            : state === 'stopped' || state === 'idle'
              ? `Run /${COMMAND} to start it. Until then dangerous commands are ${refused}.`
              : `Set ${missing.join(', ')} in the plugin's options (settings.json, pluginConfigs["${$.plugin.name}@skills-dir"].options). Until then dangerous commands are ${refused}.`

    const showSteps = steps.length > 0 && state !== 'idle' && state !== 'off'
    const last = [...recent].reverse().find(r => r.state === 'done')

    return (
      <Box flexDirection="column">
        <Text bold>{fit('Vercel Sandbox')}</Text>
        {badge}

        {showSteps ? (
          <Box key="steps" flexDirection="column" marginTop={1}>
            {steps.map(s => (
              <Box key={`step:${s.key}`} flexDirection="column">
                <Box flexDirection="row">
                  <Text color={tone[s.state]}>{`${glyph[s.state]} `}</Text>
                  <Text dimColor={s.state === 'wait' || s.state === 'skip'}>{fit(s.label, width - 2)}</Text>
                </Box>
                {s.detail ? <Text dimColor wrap="wrap">{`  ${s.detail}`}</Text> : null}
              </Box>
            ))}
          </Box>
        ) : null}

        {state === 'ready' ? (
          <Box key="ready" flexDirection="column" marginTop={1}>
            <Text color="green" wrap="wrap">
              Jev will now run the commands it judges dangerous in this sandbox, not on your machine.
            </Text>
            {info ? <Text dimColor>{fit(`${info.name} · ${info.region} · ${info.vcpus} vCPU · ${info.memory} MB`)}</Text> : null}
            {workspace ? <Text dimColor>{fit(`${plural(workspace.files, 'file')} · ${megabytes(workspace.bytes)} · ${workspace.dir}`)}</Text> : null}
            {left !== null ? <Text dimColor>{fit(`stops in ${left}m`)}</Text> : null}
          </Box>
        ) : null}
        {explain ? (
          <Box key="explain" marginTop={1}>
            <Text wrap="wrap">{explain}</Text>
          </Box>
        ) : null}

        <Box key="judge-head" marginTop={1}>
          <Text bold color="cyan">Judge</Text>
        </Box>
        <Text dimColor>{fit(`${backend}${audit ? ' · audit' : ''}`)}</Text>
        <Text dimColor>{fit(`sandbox at ${threshold.toFixed(2)} · severity ${severityLine.toFixed(1)}`)}</Text>
        <Text dimColor>{fit(`${plural(tally.sandbox, 'sandboxed')} · ${tally.local} local${tally.denied ? ` · ${tally.denied} refused` : ''}`)}</Text>

        <Box key="log-head" marginTop={1}>
          <Text bold color="cyan">{`Commands in the sandbox (${recent.length})`}</Text>
        </Box>
        {recent.length === 0 ? <Text dimColor>none yet</Text> : null}
        {recent
          .slice()
          .reverse()
          .map((r, i) => {
            const mark = r.state === 'running' ? '◌ ' : r.state === 'error' ? '✗ ' : r.exitCode === 0 ? '✓ ' : '! '
            const color = r.state === 'running' ? 'yellow' : r.state === 'error' ? 'red' : r.exitCode === 0 ? 'green' : 'yellow'
            const tail = r.state === 'running' ? ' running' : r.state === 'error' ? ' failed' : ` ${r.exitCode ?? '?'}`
            const note = r.state === 'error' ? r.error : r.changes?.length ? describeChanges(r.changes, 3) : ''
            return (
              <Box key={`run:${i}`} flexDirection="column">
                <Box flexDirection="row">
                  <Text color={color}>{mark}</Text>
                  <Text>{fit(r.short, width - 2 - tail.length)}</Text>
                  <Text dimColor>{tail}</Text>
                </Box>
                {note ? <Text dimColor>{fit(`  ${note}`)}</Text> : null}
              </Box>
            )
          })}

        <Box key="toolbar" marginTop={1} flexDirection="row" columnGap={1}>
          {credentials && state !== 'starting' ? <Button key="restart" label={state === 'ready' ? 'restart' : 'start'} hotkey="r" onPress={noop} /> : null}
          {credentials && state === 'ready' ? <Button key="stop" label="stop" onPress={noop} /> : null}
          {last && !approved.has(last.command) ? <Button key="approve" label="run last locally" onPress={noop} /> : null}
          <Button key="close" label="close" onPress={noop} />
        </Box>
      </Box>
    )
  })
}
