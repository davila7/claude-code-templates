/**
 * jev-vercel-sandbox — Claude Mod
 *
 * A Vercel Sandbox (an isolated Linux microVM) as a place Claude sends work to
 * on purpose: a long test run, someone else's repository, an installer of
 * unknown origin, a bulk change to preview, a clean build. Whether a command
 * may run on the person's machine at all is not this mod's call (auto mode and
 * jev-guardrails decide that); this one only moves the jobs a sandbox is for.
 *
 * TypeSafe's Jev reads every Bash command Claude is about to run and says
 * whether it is one of those jobs. With confirmSandbox on (the default) the
 * person is asked, in Claude Code's own question dialog, whether it runs in
 * the sandbox or locally; with it off, a detected job always goes to the
 * sandbox. Claude can also send work itself with the sandbox_run tool.
 *
 * Every job starts from the project as it is at that moment (the copy uploaded
 * by /jev-vercel-sandbox, brought up to date with a patch) in its own git
 * worktree, and every result says it is remote, which job it was and which
 * tree it started from. Nothing a job does reaches the person's disk except a
 * patch they apply themselves with /jev-vercel-sandbox apply, after a question.
 *
 *   session.start  registers /jev-vercel-sandbox and the sandbox_* tools, reads the credentials
 *   command.run    /jev-vercel-sandbox: starts the sandbox and opens the pane (status|open|restart|stop|jobs|run|result|apply)
 *   turn.start     records the user's request (the detector's context)
 *   tool.call      Bash: Jev detects a sandbox job and asks where it runs;
 *                  mcp__jev-vercel-sandbox__sandbox_*: Claude's own jobs
 *   session.end    stops the sandbox
 *   ui.render      the pane: the start's progress, then the jobs
 *
 * Vercel credentials and Jev keys come from the plugin's options
 * (pluginConfigs["jev-vercel-sandbox@skills-dir"].options in user settings), with
 * VERCEL_TOKEN / VERCEL_OIDC_TOKEN / VERCEL_TEAM_ID / VERCEL_PROJECT_ID as a
 * fallback. Never from this code. Needs Claude Code >= 2.1.287.
 *
 * Privacy: with a Jev key set, the user's latest request and each command
 * that is not a plain read go to that backend. /jev-vercel-sandbox uploads the
 * project's files (what git tracks, minus .env*, keys and credentials;
 * untracked files only with uploadUntracked) to Vercel, and each job sends
 * what changed since; no environment variable goes.
 */
import type { ProcessRunInit, ProcessRunResult, Register } from 'claude-code'
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  PROFILES,
  builtinLabels,
  classifyText,
  decide,
  describeJudgement,
  detectionReason,
  endpoint,
  isPlainRead,
  parseUseCases,
  readJudgement,
  requestBody,
  requestHeaders,
  selectProvider,
  shortCommand,
  stateText,
} from './judge.ts'
import type { Detection, Judgement, Provider, Returns, UseCase } from './judge.ts'
import { DEFAULT_API_URL, client, resolveCredentials } from './vercel.ts'
import type { Client, CreateOptions, Credentials, Fetch, RunResult, SandboxInfo } from './vercel.ts'
import {
  APPEND_SCRIPT,
  EXTRACT_SCRIPT,
  PART_BYTES,
  PATCH_SCRIPT,
  PREPARE_SCRIPT,
  REPORT_SCRIPT,
  SYNC_FILE,
  SYNC_SCRIPT,
  TRUNCATE_SCRIPT,
  UPLOAD_FILE,
  describeChanges,
  filesToUpload,
  folderName,
  isExcluded,
  isGitRef,
  isGitUrl,
  megabytes,
  patchTargets,
  nulList,
  readReport,
  relativeCwd,
  uploadBatches,
} from './workspace.ts'
import type { Report } from './workspace.ts'

const PANE = 'jev-vercel-sandbox'
const COMMAND = 'jev-vercel-sandbox'
const TAG = '[jev-vercel-sandbox]'
const TOOLS = { run: 'sandbox_run', jobs: 'sandbox_jobs', result: 'sandbox_result', apply: 'sandbox_apply' } as const
const RECENT = 20
// what the Bash tool itself keeps inline
const MAX_OUTPUT = 30_000
// what a job keeps for sandbox_result
const KEEP_OUTPUT = 200_000
// what a finished background job's message carries
const SUBMIT_OUTPUT = 6_000
const PATCH_MAX = 5 * 1_048_576
const POLL_MS = 500
const POLL_TRIES = 12
const STEP_TIMEOUT_MS = 120_000

type State = 'off' | 'idle' | 'starting' | 'ready' | 'failed' | 'stopped'
type StepKey = 'vm' | 'pack' | 'upload' | 'prepare'
type Step = { key: StepKey; label: string; state: 'wait' | 'run' | 'done' | 'fail' | 'skip'; detail: string }
type Source = { kind: 'current' } | { kind: 'none' } | { kind: 'git'; url: string; ref: string }
type Job = {
  id: string
  command: string
  short: string
  source: Source
  useCase: UseCase | null
  /** Who sent it: Jev's detection of a Bash command, Claude's sandbox_run, or the person's /jev-vercel-sandbox run. */
  by: 'jev' | 'claude' | 'user'
  background: boolean
  returns: Returns
  watch: boolean
  timeoutMs: number
  state: 'queued' | 'syncing' | 'running' | 'done' | 'error'
  /** The tree it started from (7 characters), or what stands for one. */
  tree: string
  note: string
  exitCode: number | null
  ms: number
  stdout: string
  stderr: string
  error?: string
  report?: Report
  dir?: string
  /** The sandbox session it ran in: a patch lives only there. */
  session?: string
  applied?: boolean
}
type Workspace = {
  /** The project's folder in the sandbox. */
  dir: string
  /** The session's working directory relative to the project root. */
  rel: string
  /** The project's root on this machine. */
  root: string
  files: number
  excluded: number
  bytes: number
  /** Git works in the sandbox (the baseline, worktrees). */
  git: boolean
  /** The tree the sandbox's copy holds, when the project is a git repository here (else no sync). */
  synced: string
}
type Choice = 'sandbox' | 'local'

/** What a job needs from `$`, handed in as closures so it can run after the hook that started it returned. */
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
  submit: (text: string) => void
  redraw: () => void
  classify: (text: string, labels: readonly string[]) => Promise<string | undefined>
  ask: (question: string, options: readonly string[], header: string) => Promise<string>
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
let nextId = 1
let syncChain: Promise<unknown> = Promise.resolve()
const jobs: Job[] = []
const detections = new Map<string, Detection>()
/** Use cases the person said always go to the sandbox, this session. */
const always = new Set<UseCase>()
/** Bash calls the person (or confirmSandbox off) sent to the sandbox: they never fall through to the machine. */
const chosen = new Set<string>()
const tally = { detected: 0, sandboxed: 0, local: 0 }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err))
const shortTree = (sha: string) => sha.slice(0, 7)

/** Both ends: how a run started and, where a test or build prints its failures and summary, how it ended. */
function cap(text: string, max = MAX_OUTPUT): string {
  if (text.length <= max) return text
  const head = Math.floor(max / 2)
  return `${text.slice(0, head)}\n… (${text.length - max} characters in the middle cut by jev-vercel-sandbox)\n${text.slice(-(max - head))}`
}

/** The tail, where a test run's summary is. */
function tail(text: string, max: number): string {
  return text.length > max ? `… (${text.length - max} earlier characters cut)\n${text.slice(-max)}` : text
}

function minutesLeft(): number | null {
  if (!info || !info.timeout || !info.startedAt || !now) return null
  return Math.max(0, Math.round((info.startedAt + info.timeout - now) / 60_000))
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

function findJob(id: string): Job | undefined {
  const want = id.trim().toLowerCase().replace(/^#/, '')
  return jobs.find(j => j.id === want || j.id === `j${want}`)
}

function sourceText(j: Job): string {
  if (j.source.kind === 'git') return `clone of ${j.source.url}${j.source.ref ? `@${j.source.ref}` : ''}`
  if (j.source.kind === 'none') return 'empty folder'
  return j.tree ? `tree ${j.tree}` : 'the project'
}

/** The first line of every result: remote, which job, and what it started from. */
function header(j: Job): string {
  return `[sandbox · ${j.id} · ${sourceText(j)}]`
}

function exitText(j: Job): string {
  if (j.state === 'error') return `failed: ${j.error ?? 'unknown error'}`
  if (j.state !== 'done') return j.state
  return j.exitCode === null ? 'no exit code' : `exit ${j.exitCode}`
}

function reportLines(j: Job): string[] {
  const r = j.report
  if (!r) return []
  const lines: string[] = []
  if (j.source.kind !== 'none' || r.changes.length) lines.push(`in the job's folder: ${describeChanges(r.changes)}`)
  if (j.watch) {
    lines.push(r.outside.length ? `written outside the job's folder (not /tmp): ${r.outside.slice(0, 30).join(', ')}${r.outside.length > 30 ? `, … ${r.outside.length - 30} more` : ''}` : 'nothing written outside the job\'s folder (besides /tmp)')
    lines.push(r.processes.length ? `still running: ${r.processes.slice(0, 15).join(', ')}` : 'no process left running')
  }
  if (r.patchBytes) lines.push(`patch kept (${megabytes(r.patchBytes)}); not applied to the user's project`)
  return lines
}

/** The whole result as text: header, exit, report, then the output. */
function resultText(j: Job, max = MAX_OUTPUT): string {
  const summary = [`${header(j)} ${j.short}: ${exitText(j)}${j.ms ? ` · ${Math.round(j.ms / 100) / 10}s` : ''}`, ...reportLines(j)]
  const out = [j.stdout && `stdout:\n${cap(j.stdout, max)}`, j.stderr && `stderr:\n${cap(j.stderr, max)}`].filter(Boolean)
  return [...summary, ...out].join('\n')
}

/** What Claude reads beside a finished job's result. */
function jobContext(j: Job, sandboxName: string): string {
  const from =
    j.source.kind === 'git'
      ? `in a fresh clone of ${j.source.url}${j.source.ref ? ` at ${j.source.ref}` : ''}`
      : j.source.kind === 'none'
        ? "in an empty folder with none of the project's files, environment variables or credentials"
        : `on a copy of the project as it was when the job started (${j.tree ? `tree ${j.tree}` : 'the copy made at start'}; .env files, keys and credentials left out, and none of the user's environment variables)`
  const patch = j.report?.patchBytes
    ? ` The job's changes are kept as a patch and were NOT applied to the user's project. If they should be, tell the user they can apply it with /${COMMAND} apply ${j.id}, or call sandbox_apply (it asks the user first).`
    : ''
  return (
    `This did not run on the user's machine. jev-vercel-sandbox ran it as job ${j.id} in Vercel Sandbox ${sandboxName} ${from}. ` +
    `Nothing on the user's machine changed; files it wrote exist only in the sandbox, which is stopped when the session ends.${patch} ` +
    `Do not run it again locally unless the user asks. sandbox_result ${j.id} returns its whole output.`
  )
}

function remember(j: Job): Job {
  jobs.push(j)
  if (jobs.length > RECENT) {
    // finished jobs go first; a running one is kept
    const i = jobs.findIndex(x => x.state === 'done' || x.state === 'error')
    if (i >= 0) jobs.splice(i, 1)
  }
  return j
}

export const register: Register = (on, options) => {
  const text = (key: string, fallback = '') =>
    typeof options[key] === 'string' && options[key] ? (options[key] as string).trim() : fallback
  const number = (key: string, fallback: number) =>
    typeof options[key] === 'number' && Number.isFinite(options[key]) ? (options[key] as number) : fallback
  const flag = (key: string, fallback: boolean) => (typeof options[key] === 'boolean' ? (options[key] as boolean) : fallback)

  // the detector
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
  const useCases = parseUseCases(text('useCases'))
  const threshold = number('threshold', 0.5)
  const judgeTimeoutMs = number('judgeTimeoutMs', 2_000)
  const confirmSandbox = flag('confirmSandbox', true)
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
  const toolNames = new Map<string, keyof typeof TOOLS>()

  const statusLine = () => {
    const where =
      state === 'ready' ? 'ready' : state === 'starting' ? 'starting…' : state === 'off' ? 'not configured' : state === 'idle' ? `/${COMMAND} to start` : state
    const running = jobs.filter(j => j.state === 'queued' || j.state === 'syncing' || j.state === 'running').length
    return `sandbox · ${where} · ${plural(jobs.length, 'job')}${running ? ` (${running} running)` : ''} · ${confirmSandbox ? 'asks first' : 'no questions'}`
  }

  const clampTimeout = (ms: unknown) => Math.min(600_000, typeof ms === 'number' && ms > 0 ? ms : commandTimeoutMs)

  function newJob(fields: Pick<Job, 'command' | 'source' | 'useCase' | 'by' | 'background' | 'returns' | 'watch' | 'timeoutMs'> & { note?: string }): Job {
    let source = fields.source
    let note = fields.note ?? ''
    if (source.kind === 'current' && !uploadWorkspace) {
      source = { kind: 'none' }
      note = [note, 'no copy of the project (uploadWorkspace is off)'].filter(Boolean).join('; ')
    }
    // a patch is of the project: another repo's or an empty folder's files never land in it
    const returns = fields.returns === 'patch' && source.kind !== 'current' ? 'changes' : fields.returns
    return remember({
      ...fields,
      returns,
      source,
      note,
      id: `j${nextId++}`,
      short: shortCommand(fields.command),
      state: 'queued',
      tree: '',
      exitCode: null,
      ms: 0,
      stdout: '',
      stderr: '',
    })
  }

  // ── the project on this machine ───────────────────────────────────────────

  /** The files that go: git's list minus deleted files and secrets (every file outside git, with uploadUntracked). */
  async function listFiles(h: Host, root: string): Promise<{ files: string[]; excluded: string[]; git: boolean }> {
    const listing = uploadUntracked ? ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'] : ['git', 'ls-files', '-z', '--cached']
    const git = await h.run(listing, { cwd: root, timeoutMs: 60_000 }).catch(() => undefined)
    if (git && git.exitCode === 0) {
      // every entry ends in NUL: output cut at the limit ends mid-path
      if (git.stdout && !git.stdout.endsWith('\0')) throw new Error('the file list was cut short; the project is too large to copy')
      const gone = await h.run(['git', 'ls-files', '-z', '--deleted'], { cwd: root, timeoutMs: 60_000 }).catch(() => undefined)
      return { ...filesToUpload(nulList(git.stdout), gone?.exitCode === 0 ? nulList(gone.stdout) : []), git: true }
    }
    // outside git every file is untracked
    if (!uploadUntracked) throw new Error('the folder is not a git repository; set uploadUntracked to copy its files, or uploadWorkspace to false for an empty sandbox')
    const found = await h.run(['find', '.', '-type', 'f', '-not', '-path', './.git/*', '-not', '-path', '*/node_modules/*', '-print0'], { cwd: root, timeoutMs: 60_000 })
    if (found.exitCode !== 0) throw new Error(`listing the project failed: ${found.stderr.trim().slice(0, 200)}`)
    if (found.stdout && !found.stdout.endsWith('\0')) throw new Error('the file list was cut short; the project is too large to copy')
    return { ...filesToUpload(nulList(found.stdout)), git: false }
  }

  /** A folder of the machine's own temp dir, removed after `use`. */
  async function withTemp<T>(h: Host, use: (tmp: string) => Promise<T>): Promise<T> {
    const tmp = (await h.run(['mktemp', '-d'])).stdout.trim()
    if (!tmp) throw new Error('mktemp -d gave no folder')
    try {
      return await use(tmp)
    } finally {
      await h.run(['rm', '-rf', tmp]).catch(() => undefined)
    }
  }

  /**
   * The tree of exactly these files as they are on disk, through a throwaway
   * index: the person's own index and `git status` are untouched.
   */
  async function treeOf(h: Host, root: string, files: string[], tmp: string): Promise<string> {
    const env = { GIT_INDEX_FILE: `${tmp}/index` }
    const add = await h.run(['git', 'update-index', '--add', '-z', '--stdin'], { cwd: root, env, stdin: `${files.join('\0')}\0`, timeoutMs: STEP_TIMEOUT_MS })
    if (add.exitCode !== 0) throw new Error(`git update-index failed: ${add.stderr.trim().slice(0, 200)}`)
    const tree = await h.run(['git', 'write-tree'], { cwd: root, env, timeoutMs: 60_000 })
    const sha = tree.stdout.trim()
    if (tree.exitCode !== 0 || !/^[0-9a-f]{40,64}$/.test(sha)) throw new Error(`git write-tree failed: ${tree.stderr.trim().slice(0, 200)}`)
    return sha
  }

  /** A file of the temp folder as base64, read in parts when it is over `$.fs.read`'s 4 MiB. */
  async function readParts(h: Host, file: string, tmp: string): Promise<string> {
    const bytes = await h.size(file)
    let parts = [file]
    if (bytes > PART_BYTES) {
      const split = await h.run(['split', '-b', String(PART_BYTES), file, `${tmp}/part.`], { timeoutMs: 60_000 })
      if (split.exitCode !== 0) throw new Error(`split failed: ${split.stderr.trim().slice(0, 200)}`)
      parts = (await h.list(tmp)).filter(n => n.startsWith('part.')).sort().map(n => `${tmp}/${n}`)
    }
    let base64 = ''
    for (const p of parts) base64 += await h.readBase64(p)
    await h.run(['rm', '-f', ...parts.filter(p => p !== file)]).catch(() => undefined)
    return base64
  }

  /** The project as one base64 gzip tar, and the tree it holds. */
  async function pack(h: Host, root: string): Promise<{ base64: string; files: number; excluded: number; bytes: number; tree: string }> {
    step('pack', 'run', 'listing files')
    h.redraw()
    const listed = await listFiles(h, root)
    const { files, excluded } = listed
    if (!files.length) throw new Error('the project has no files to copy')
    step('pack', 'run', `${plural(files.length, 'file')}, compressing`)
    h.redraw()
    return withTemp(h, async tmp => {
      const tree = listed.git ? await treeOf(h, root, files, tmp) : ''
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
      const base64 = await readParts(h, archive, tmp)
      step('pack', 'done', `${plural(files.length, 'file')} · ${megabytes(bytes)}${excluded.length ? ` · ${excluded.length} credential file${excluded.length === 1 ? '' : 's'} left out` : ''}`)
      h.redraw()
      return { base64, files: files.length, excluded: excluded.length, bytes, tree }
    })
  }

  // ── the sandbox ───────────────────────────────────────────────────────────

  const must = (r: RunResult, what: string) => {
    if (r.exitCode !== 0) throw new Error(`${what} failed in the sandbox: ${(r.error || r.stderr || `exit ${r.exitCode}`).trim().slice(0, 300)}`)
    return r
  }

  /** base64 into a sandbox file, a few arguments per call. */
  async function send(api: Client, s: SandboxInfo, base64: string, file: string, progress?: (done: number, total: number) => void): Promise<number> {
    const batches = uploadBatches(base64)
    must(await api.script(s, TRUNCATE_SCRIPT, [file], 30_000), 'preparing the upload')
    for (let i = 0; i < batches.length; i++) {
      must(await api.script(s, APPEND_SCRIPT, [file, ...batches[i]!], 60_000), 'uploading')
      progress?.(i + 1, batches.length)
    }
    return batches.length
  }

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

  /** The base64 into the sandbox, then unpacked with a git baseline. */
  async function upload(h: Host, api: Client, s: SandboxInfo, base64: string, dir: string): Promise<boolean> {
    step('upload', 'run', '0')
    h.redraw()
    const calls = await send(api, s, base64, UPLOAD_FILE, (done, total) => {
      step('upload', 'run', `${done}/${total}`)
      h.redraw()
    })
    step('upload', 'done', `${calls} request${calls === 1 ? '' : 's'}`)
    step('prepare', 'run', dir)
    h.redraw()
    const r = must(await api.script(s, EXTRACT_SCRIPT, [UPLOAD_FILE, dir], STEP_TIMEOUT_MS), 'unpacking')
    const git = r.stdout.trim().endsWith('git') && !r.stdout.trim().endsWith('no-git')
    step('prepare', 'done', git ? dir : `${dir} · no git in the sandbox image: jobs cannot start from the project`)
    h.redraw()
    return git
  }

  /** The whole start, run after /jev-vercel-sandbox (or a confirmed job) asked for it; the pane follows every step. */
  async function boot(h: Host, creds: Credentials): Promise<void> {
    const api = client(h.fetch, creds, apiBase)
    state = 'starting'
    info = undefined
    workspace = undefined
    lastError = undefined
    steps = freshSteps(uploadWorkspace)
    h.status(statusLine())
    h.redraw()
    let vm: Promise<SandboxInfo> | undefined
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
      vm = startVm(h, api).catch(failing('vm'))
      const packing = uploadWorkspace ? pack(h, root).catch(failing('pack')) : undefined
      // when one half fails the other runs on unobserved
      vm.catch(() => undefined)
      packing?.catch(() => undefined)
      const [s, packed] = await Promise.all([vm, packing])
      if (packed) {
        const dir = `${(s.cwd || '/vercel/sandbox').replace(/\/+$/, '')}/${folderName(root)}`
        const git = await upload(h, api, s, packed.base64, dir)
        workspace = { dir, rel: relativeCwd(root, cwd) ?? '', root, files: packed.files, excluded: packed.excluded, bytes: packed.bytes, git, synced: packed.tree }
      }
      syncChain = Promise.resolve()
      state = 'ready'
      now = await h.now()
      h.log(
        `${TAG} sandbox ready: ${s.name} · ${s.region}${workspace ? ` · ${plural(workspace.files, 'file')} in ${workspace.dir}` : ''}. ` +
          `Jev (${backend}) checks each command for sandbox jobs and ${confirmSandbox ? 'asks you before sending one' : 'sends them here without asking'}`,
      )
      h.toast('jev-vercel-sandbox: sandbox ready')
    } catch (err) {
      lastError = messageOf(err)
      if (!steps.some(x => x.state === 'fail')) {
        const running = steps.find(x => x.state === 'run')
        step(running ? running.key : 'vm', 'fail', lastError)
      }
      state = 'failed'
      h.log(`${TAG} the sandbox did not start: ${lastError}`)
      h.toast(`jev-vercel-sandbox: the sandbox did not start (${lastError})`)
      // never leave a half-started microVM running (and billed): when packing failed first,
      // the create request may still be in flight, so wait for it before stopping what it made
      await vm?.catch(() => undefined)
      if (info) await api.stop(info).catch(() => undefined)
    }
    h.status(statusLine())
    h.redraw()
  }

  function ensureStarted(h: Host, creds: Credentials): Promise<void> {
    if (state === 'ready') return Promise.resolve()
    if (state === 'starting' && starting) return starting
    starting = boot(h, creds)
    return starting
  }

  /** Brings the sandbox's copy to the project as it is now; the tree it then holds (empty when it cannot be synced). */
  function sync(h: Host, api: Client, s: SandboxInfo): Promise<string> {
    const run = syncChain.then(async () => {
      const w = workspace
      if (!w || !w.synced) return ''
      const listed = await listFiles(h, w.root)
      return withTemp(h, async tmp => {
        const tree = await treeOf(h, w.root, listed.files, tmp)
        if (tree === w.synced) return tree
        const patch = `${tmp}/sync.patch`
        const diff = await h.run(['git', 'diff', '--binary', '--full-index', `--output=${patch}`, w.synced, tree], { cwd: w.root, timeoutMs: STEP_TIMEOUT_MS })
        if (diff.exitCode !== 0) throw new Error(`git diff failed: ${diff.stderr.trim().slice(0, 200)}`)
        const bytes = await h.size(patch)
        if (bytes > maxMB * 1_048_576) throw new Error(`the changes since the last sync are ${megabytes(bytes)}, over workspaceMaxMB; /${COMMAND} restart uploads the project again`)
        if (bytes > 0) {
          await send(api, s, await readParts(h, patch, tmp), SYNC_FILE)
          must(await api.script(s, SYNC_SCRIPT, [SYNC_FILE, w.dir, `sync ${tree}`], STEP_TIMEOUT_MS), 'syncing the project')
        }
        w.synced = tree
        return tree
      })
    })
    syncChain = run.catch(() => undefined)
    return run
  }

  /** One job, start to end: sync, its own folder, the command, the report. Never throws: a failure is the job's state. */
  async function runJob(h: Host, api: Client, s: SandboxInfo, j: Job): Promise<void> {
    const startedAt = await h.now()
    try {
      const jobsRoot = `${(s.cwd || '/vercel/sandbox').replace(/\/+$/, '')}/.jev-jobs`
      const dir = `${jobsRoot}/${j.id}`
      let rel = ''
      if (j.source.kind === 'current') {
        if (!workspace) throw new Error('the sandbox holds no copy of the project')
        if (!workspace.git) throw new Error('git is not available in the sandbox image, so a job cannot start from the project')
        j.state = 'syncing'
        h.redraw()
        const tree = await sync(h, api, s)
        j.tree = tree ? shortTree(tree) : 'start copy'
        if (!tree) j.note = [j.note, 'not a git repository here: the copy made at start, not synced'].filter(Boolean).join('; ')
        rel = workspace.rel
      }
      const url = j.source.kind === 'git' ? j.source.url : ''
      const ref = j.source.kind === 'git' ? j.source.ref : ''
      must(await api.script(s, PREPARE_SCRIPT, [j.source.kind, workspace?.dir ?? '', dir, url, ref, rel], STEP_TIMEOUT_MS), 'preparing the job')
      j.dir = dir
      j.session = s.sessionId
      j.state = 'running'
      h.redraw()
      const r = await api.run(s, j.command, j.timeoutMs, rel ? `${dir}/${rel}` : dir)
      j.stdout = cap(r.stdout, KEEP_OUTPUT)
      j.stderr = cap([r.stderr, r.error ? `jev-vercel-sandbox: ${r.error}` : ''].filter(Boolean).join('\n'), KEEP_OUTPUT)
      j.exitCode = r.exitCode
      const report = await api.script(s, REPORT_SCRIPT, [dir, j.watch ? '1' : '0', j.returns === 'patch' ? '1' : '0'], STEP_TIMEOUT_MS).catch(() => undefined)
      if (report && report.exitCode === 0) j.report = readReport(report.stdout)
      j.state = 'done'
      j.ms = Math.round(r.durationMs ?? (await h.now()) - startedAt)
    } catch (err) {
      j.state = 'error'
      j.error = messageOf(err)
      j.ms = (await h.now()) - startedAt
      // the session may have timed out or been stopped from the dashboard
      const fresh = await api.get(s).catch(() => undefined)
      if (fresh && fresh.status !== 'running') {
        info = fresh
        state = 'stopped'
      }
    }
    now = await h.now()
    tally.sandboxed += 1
    if (logDecisions) h.log(`${TAG} ${header(j)} ${j.short}: ${exitText(j)}${j.report ? ` · ${describeChanges(j.report.changes, 3)}` : ''}`)
    h.status(statusLine())
    h.redraw()
  }

  /**
   * A job that runs on after the hook answered (a background job, or any job
   * while the sandbox starts): when it ends, Claude reads the result as a new
   * message (the person's own jobs only log it).
   */
  function detach(h: Host, creds: Credentials, j: Job): void {
    void (async () => {
      await ensureStarted(h, creds).catch(() => undefined)
      const s = info
      if ((state as State) !== 'ready' || !s) {
        j.state = 'error'
        j.error = `the sandbox did not start (${lastError ?? state})`
        h.redraw()
      } else {
        await runJob(h, client(h.fetch, creds, apiBase), s, j)
      }
      const done = `${header(j)} ${j.short}: ${exitText(j)}`
      h.toast(`jev-vercel-sandbox: ${j.id} ${exitText(j)}`)
      if (j.by === 'user') {
        h.log(`${TAG} ${done}. /${COMMAND} result ${j.id} shows its output`)
        return
      }
      h.submit(
        [
          `jev-vercel-sandbox: background job ${j.id} finished. It ran in the Vercel Sandbox, not on this machine; nothing on the user's machine changed.`,
          tail(resultText(j, SUBMIT_OUTPUT), SUBMIT_OUTPUT * 2),
          j.report?.patchBytes ? `Its changes are kept as a patch, not applied: the user applies it with /${COMMAND} apply ${j.id}, or call sandbox_apply (it asks the user).` : '',
          `sandbox_result ${j.id} returns the whole output.`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      )
    })()
  }

  /** A patch a job kept, onto the person's project, after they say yes. */
  async function applyJob(h: Host, j: Job): Promise<{ ok: boolean; text: string }> {
    if (j.applied) return { ok: false, text: `${j.id}'s patch was already applied` }
    if (j.state !== 'done' || !j.report?.patchBytes || !j.dir || j.source.kind !== 'current') return { ok: false, text: `${j.id} kept no patch to apply` }
    if (!credentials || !info || state !== 'ready' || !workspace || info.sessionId !== j.session) return { ok: false, text: `the sandbox holding ${j.id} is no longer running` }
    if (j.report.patchBytes > PATCH_MAX) return { ok: false, text: `${j.id}'s patch is ${megabytes(j.report.patchBytes)}, too large to bring back` }
    // the patch itself, not the sandbox's word about it, says what it writes
    const r = await client(h.fetch, credentials, apiBase).script(info, PATCH_SCRIPT, [`${j.dir}.patch`], 60_000)
    if (r.exitCode !== 0 || r.error) return { ok: false, text: `the patch could not be read from the sandbox: ${(r.error || r.stderr).trim().slice(0, 200)}` }
    if (r.stdout.length > PATCH_MAX) return { ok: false, text: `${j.id}'s patch is too large to bring back` }
    const targets = patchTargets(r.stdout)
    if (targets.symlink) return { ok: false, text: `${j.id}'s patch creates or changes a symlink; it was not applied` }
    const refused = [...new Set([...targets.paths, ...j.report.changes.map(c => c.path)])].filter(isExcluded)
    if (refused.length) return { ok: false, text: `${j.id}'s patch touches files this mod never writes (${refused.slice(0, 5).join(', ')}); it was not applied` }
    const listed = targets.paths.length
    let answer: string
    try {
      answer = await h.ask(
        `Apply ${j.id}'s changes to your project? ${describeChanges(j.report.changes, 12)}${listed > j.report.changes.length ? ` (the patch names ${plural(listed, 'path')})` : ''} (from ${sourceText(j)}: ${j.short})`,
        ['Apply', 'Cancel'],
        'Apply',
      )
    } catch {
      return { ok: false, text: 'not applied: nobody confirmed it' }
    }
    if (answer !== 'Apply') return { ok: false, text: 'not applied: the user said no' }
    const check = await h.run(['git', 'apply', '--check', '-'], { cwd: workspace.root, stdin: r.stdout, timeoutMs: 60_000 })
    if (check.exitCode !== 0) return { ok: false, text: `the patch no longer applies to your project (it changed since ${sourceText(j)}): ${check.stderr.trim().slice(0, 300)}` }
    const applied = await h.run(['git', 'apply', '-'], { cwd: workspace.root, stdin: r.stdout, timeoutMs: 60_000 })
    if (applied.exitCode !== 0) return { ok: false, text: `git apply failed: ${applied.stderr.trim().slice(0, 300)}` }
    j.applied = true
    h.redraw()
    return { ok: true, text: `applied ${j.id}'s patch to ${workspace.root}: ${describeChanges(j.report.changes)}` }
  }

  function jobsText(): string {
    if (!jobs.length) return 'no sandbox jobs yet'
    return jobs
      .map(j => `${j.id} · ${j.state === 'done' || j.state === 'error' ? exitText(j) : j.state} · ${sourceText(j)} · ${j.short}${j.report?.patchBytes ? ` · patch${j.applied ? ' applied' : ''}` : ''}`)
      .join('\n')
  }

  // ── the detector ──────────────────────────────────────────────────────────

  /** Jev's (or the built-in classifier's) answer for one command, cached per request. */
  async function detect(h: Host, command: string, cwd: string, short: string): Promise<Detection> {
    if (isPlainRead(command)) return { useCase: null, probability: null, by: 'read-only' }
    const key = `${intent}\u0000${command}`
    const cached = detections.get(key)
    if (cached) return cached
    const startedAt = await h.now()
    const state_ = stateText(intent, command, cwd)
    let found: Detection | undefined
    let judgement: Judgement | null = null
    try {
      if (active) {
        const response = await Promise.race([
          h.fetch(judgeUrl, { method: 'POST', headers: requestHeaders(active, apiKey, modelId), body: requestBody(active, state_, modelId, useCases) }),
          h.sleep(judgeTimeoutMs),
        ])
        if (response && response.ok) judgement = readJudgement(response.text, useCases)
        else h.log(`${TAG} detector: ${response ? `${active} responded ${response.status}` : `no answer in ${judgeTimeoutMs}ms`}`)
        if (judgement) found = decide(judgement, threshold)
      } else {
        const label = await h.classify(classifyText(state_, useCases), builtinLabels(useCases))
        const useCase = useCases.find(c => c === label) ?? null
        if (useCase || label === 'none') found = { useCase, probability: null, by: 'built-in' }
      }
    } catch (err) {
      h.log(`${TAG} detector failed: ${messageOf(err)}`)
    }
    if (logDecisions && active) h.log(`${TAG} jev ${short}: ${describeJudgement(judgement, (await h.now()) - startedAt)}`)
    if (!found) return { useCase: null, probability: null, by: 'no answer' }
    detections.set(key, found)
    if (detections.size > 300) detections.delete(detections.keys().next().value as string)
    return found
  }

  const askLabels = (kind: UseCase) => ['Run in sandbox', 'Run locally', `Always sandbox ${kind.replace(/_/g, ' ')}`]

  // ── hooks ─────────────────────────────────────────────────────────────────

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: COMMAND,
        description: 'Start the Vercel Sandbox and show its jobs (status|open|restart|stop|jobs|run <cmd>|result <job>|apply <job>)',
        argumentHint: '[status|open|restart|stop|jobs|run <command>|result <job>|apply <job>]',
        immediate: true,
      })
      .catch(err => $.ui.log(`${TAG} /${COMMAND} not registered: ${err}`))

    const specs = [
      {
        key: 'run' as const,
        description:
          "Run a shell command in a Vercel Sandbox (an isolated Linux microVM), not on the user's machine. Use it for work a sandbox is for: a long test/lint/typecheck run in the background while you keep working, someone else's repository (workspace {git, ref}), an installer or script of unknown origin (workspace none; the result lists what it wrote and left running), a bulk change to preview (returns patch: the user decides whether it is applied), a clean build. " +
          'workspace "current" starts from the project exactly as it is now (tracked files, secrets left out), in a folder of its own. Results are marked [sandbox · job · tree]. A background job reports back as a new message.',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The bash command to run' },
            workspace: {
              description: '"current" (default): the project as it is now; "none": an empty folder; or { git, ref } to clone an https repository',
              anyOf: [
                { type: 'string', enum: ['current', 'none'] },
                { type: 'object', properties: { git: { type: 'string' }, ref: { type: 'string' } }, required: ['git'] },
              ],
            },
            background: { type: 'boolean', description: 'Return at once; the result arrives as a new message when it ends' },
            returns: { type: 'string', enum: ['output', 'changes', 'patch'], description: '"patch" keeps a patch of the changes for the user to apply' },
            timeoutMs: { type: 'number', description: `Longest it may run (default ${commandTimeoutMs}, max 600000)` },
          },
          required: ['command'],
        },
      },
      { key: 'jobs' as const, description: 'List the Vercel Sandbox jobs of this session: id, state, what each started from.', inputSchema: { type: 'object', properties: {} } },
      {
        key: 'result' as const,
        description: "A sandbox job's whole result: exit code, files it changed, and its output.",
        inputSchema: { type: 'object', properties: { job: { type: 'string', description: 'The job id, e.g. j3' } }, required: ['job'] },
      },
      {
        key: 'apply' as const,
        description: "Apply a sandbox job's patch to the user's project. The user is always asked first; call it only when the task needs the change on their machine.",
        inputSchema: { type: 'object', properties: { job: { type: 'string', description: 'The job id, e.g. j3' } }, required: ['job'] },
      },
    ]
    toolNames.clear()
    for (const spec of specs) {
      await $.tool
        .register({ name: TOOLS[spec.key], description: spec.description, inputSchema: spec.inputSchema })
        .then(({ tool }) => void toolNames.set(tool, spec.key))
        .catch(err => $.ui.log(`${TAG} ${TOOLS[spec.key]} not registered: ${err}`, { to: 'debug' }))
    }

    // a fresh load of the plugin starts from nothing
    info = undefined
    workspace = undefined
    lastError = undefined
    starting = undefined
    steps = []
    jobs.length = 0
    nextId = 1
    detections.clear()
    always.clear()
    chosen.clear()
    tally.detected = tally.sandboxed = tally.local = 0

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
    $.ui.log(
      credentials
        ? `${TAG} configured (${credentialsKind}); Jev (${backend}) checks commands for sandbox jobs (${useCases.join(', ') || 'none turned on'}) and ${confirmSandbox ? 'asks you' : 'sends them without asking'}. /${COMMAND} starts the sandbox`
        : `${TAG} not configured: set ${missing.join(', ')} in pluginConfigs["${$.plugin.name}@skills-dir"] (or "${$.plugin.name}" with --plugin-dir); every command runs locally until then`,
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
    if (!command.trim() || !useCases.length) return next(e)
    const short = shortCommand(command)
    // what a job that outlives this hook needs, spelled here where `$` is
    const host: Host = {
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
      submit: line => void $.prompt.submit({ text: line }).catch(err => $.ui.log(`${TAG} could not report back: ${err}`, { to: 'debug' })),
      redraw: () => void $.ui.invalidate('ui.render'),
      classify: (t, labels) => $.model.classify(t, labels),
      ask: (question, labels, header) => $.ui.ask(question, { header, options: labels }),
    }
    const cwd = await $.session.cwd().catch(() => '')
    const found = await detect(host, command, cwd, short)
    if (!found.useCase) return next(e)

    const kind = found.useCase
    const profile = PROFILES[kind]
    const reason = detectionReason(found)
    tally.detected += 1
    if (!credentials) {
      if (logDecisions) $.ui.log(`${TAG} ${short} looks like ${profile.label} (${reason}), but no sandbox is configured: it runs locally`)
      tally.local += 1
      return next(e)
    }

    // a start that failed is not retried on every command without the person
    if (state === 'failed' && !confirmSandbox) {
      tally.local += 1
      if (logDecisions) $.ui.log(`${TAG} local ${short} (${reason}): the sandbox did not start; /${COMMAND} restart tries again`)
      return next(e)
    }

    // 1. where it runs: the person says, unless they turned the question off
    let choice: Choice = 'sandbox'
    if (confirmSandbox && !always.has(kind)) {
      const labels = askLabels(kind)
      const first = state === 'ready' ? '' : state === 'starting' ? ' (it is starting)' : ' (this starts it)'
      try {
        const answer = await host.ask(`Jev: \`${short}\` looks like ${profile.label}. Run it in the Vercel Sandbox${first}?`, labels, 'Sandbox')
        if (answer === labels[2]) always.add(kind)
        choice = answer === labels[0] || answer === labels[2] || /sandbox/i.test(answer) ? 'sandbox' : 'local'
      } catch {
        // dismissed, or a -p run with no one to ask: as if the mod were not here
        choice = 'local'
      }
    }
    if (choice === 'local') {
      tally.local += 1
      if (logDecisions) $.ui.log(`${TAG} local ${short} (${reason}; the user chose this machine)`)
      $.ui.status(statusLine())
      return next(e)
    }
    chosen.add(e.tool_use_id ?? command)

    // 2. the job
    const j = newJob({
      command,
      source: { kind: profile.workspace },
      useCase: kind,
      by: 'jev',
      background: profile.background || e.run_in_background === true,
      returns: profile.returns,
      watch: profile.watch,
      timeoutMs: clampTimeout(e.timeout),
    })
    if (logDecisions) $.ui.log(`${TAG} ${j.id} → sandbox: ${short} (${reason})`)
    $.ui.invalidate('ui.render')
    const s = info
    if (state === 'ready' && s && !j.background) {
      await runJob(host, client(host.fetch, credentials, apiBase), s, j)
      const out = resultText(j)
      return {
        result: { stdout: out, stderr: '', interrupted: false },
        context: [jobContext(j, s.name)],
      }
    }
    // background, or the sandbox is not ready yet: it runs on and reports back
    const why = state === 'ready' ? 'in the background' : state === 'starting' ? 'once the sandbox finishes starting' : 'once the sandbox has started (it is starting now)'
    j.background = true
    detach(host, credentials, j)
    return {
      result: { stdout: `${header(j)} ${short}: queued, runs ${why}. The result arrives as a new message.`, stderr: '', interrupted: false },
      context: [
        `This command did not run on the user's machine. It was sent to the Vercel Sandbox as job ${j.id} (${profile.label}); it runs there ${why} and its result arrives as a new message. Do not run it locally meanwhile; carry on with other work or wait for it.`,
      ],
    }
  }).catch(async ($, e, next) => {
    // over budget or thrown: a command sent to the sandbox never falls through to the machine
    const key = typeof e.command === 'string' ? (e.tool_use_id ?? e.command) : ''
    if (!chosen.has(key)) return next(e)
    return { deny: `jev-vercel-sandbox could not run this command in the Vercel Sandbox (${next.error.kind}), and it was not run on the user's machine either. Tell the user; do not retry it another way.` }
  })

  on('tool.call', async ($, e, next) => {
    const which = toolNames.get(e.tool)
    if (!which) return next(e)
    const input = e as unknown as Record<string, unknown>
    // what a job that outlives this hook needs, spelled here where `$` is
    const host: Host = {
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
      submit: line => void $.prompt.submit({ text: line }).catch(err => $.ui.log(`${TAG} could not report back: ${err}`, { to: 'debug' })),
      redraw: () => void $.ui.invalidate('ui.render'),
      classify: (t, labels) => $.model.classify(t, labels),
      ask: (question, labels, header) => $.ui.ask(question, { header, options: labels }),
    }

    if (which === 'jobs') return { result: `${statusLine()}\n${jobsText()}` }
    if (which === 'result') {
      const j = findJob(String(input.job ?? ''))
      if (!j) return { deny: `no sandbox job ${String(input.job ?? '')}; sandbox_jobs lists them` }
      return { result: resultText(j, KEEP_OUTPUT) }
    }
    if (which === 'apply') {
      const j = findJob(String(input.job ?? ''))
      if (!j) return { deny: `no sandbox job ${String(input.job ?? '')}; sandbox_jobs lists them` }
      const r = await applyJob(host, j)
      return r.ok ? { result: r.text } : { deny: `${r.text}.` }
    }

    // sandbox_run
    const command = typeof input.command === 'string' ? input.command : ''
    if (!command.trim()) return { deny: 'sandbox_run needs a command' }
    if (!credentials) return { deny: `no Vercel Sandbox is configured (missing ${missing.join(', ')}); the user sets it in the plugin's options` }
    let source: Source = { kind: 'current' }
    const w = input.workspace
    if (w === 'none') source = { kind: 'none' }
    else if (w && typeof w === 'object') {
      const url = String((w as Record<string, unknown>).git ?? '')
      const ref = String((w as Record<string, unknown>).ref ?? '')
      if (!isGitUrl(url)) return { deny: `workspace.git must be an https URL, got ${JSON.stringify(url).slice(0, 100)}` }
      if (ref && !isGitRef(ref)) return { deny: `workspace.ref is not a branch, tag or commit: ${JSON.stringify(ref).slice(0, 100)}` }
      source = { kind: 'git', url, ref }
    }
    const returns: Returns = input.returns === 'patch' || input.returns === 'changes' ? input.returns : 'output'
    // Jev picks the profile: code of unknown origin never gets the project's copy
    const found = await detect(host, command, await $.session.cwd().catch(() => ''), shortCommand(command))
    let note = ''
    if (source.kind === 'current' && found.useCase && PROFILES[found.useCase].workspace === 'none') {
      source = { kind: 'none' }
      note = `Jev judged it ${PROFILES[found.useCase].label}, so it runs in an empty folder, not on the project's copy`
    }
    const j = newJob({
      command,
      source,
      useCase: found.useCase,
      by: 'claude',
      background: input.background === true,
      returns,
      watch: found.useCase ? PROFILES[found.useCase].watch : false,
      timeoutMs: clampTimeout(input.timeoutMs),
      note,
    })
    $.ui.invalidate('ui.render')

    if (state !== 'ready' && state !== 'starting') {
      if (confirmSandbox) {
        let answer = ''
        try {
          answer = await host.ask(`Claude wants to run \`${j.short}\` in the Vercel Sandbox, which is not running. Start it?`, ['Start sandbox', 'Not now'], 'Sandbox')
        } catch {}
        if (answer !== 'Start sandbox') {
          j.state = 'error'
          j.error = 'the user did not start the sandbox'
          return { deny: `The Vercel Sandbox is not running and the user did not start it, so the command was not run. They can start it with /${COMMAND}.` }
        }
      }
      if (logDecisions) $.ui.log(`${TAG} starting the sandbox for ${j.id}`)
    }
    const s = info
    if (state === 'ready' && s && !j.background) {
      await runJob(host, client(host.fetch, credentials, apiBase), s, j)
      return { result: `${resultText(j)}${note ? `\n(${note})` : ''}`, context: [jobContext(j, s.name)] }
    }
    const queued = state === 'ready' ? ', running in the background' : ', runs once the sandbox has started'
    j.background = true
    detach(host, credentials, j)
    return {
      result: `${header(j)} ${j.short}: queued${queued}. The result arrives as a new message.${note ? ` (${note})` : ''}`,
    }
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
    const args = e.args.trim()
    const sub = (args.split(/\s+/)[0] ?? '').toLowerCase()
    const rest = args.slice(sub.length).trim()
    now = await $.clock.now()
    // what a job that outlives this hook needs, spelled here where `$` is
    const host: Host = {
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
      submit: line => void $.prompt.submit({ text: line }).catch(err => $.ui.log(`${TAG} could not report back: ${err}`, { to: 'debug' })),
      redraw: () => void $.ui.invalidate('ui.render'),
      classify: (t, labels) => $.model.classify(t, labels),
      ask: (question, labels, header) => $.ui.ask(question, { header, options: labels }),
    }
    const openPane = async () => {
      isOpen = true
      await $.ui.open({ id: PANE, title: 'sandbox', focus: true, columns }).catch(err => {
        isOpen = false
        $.ui.log(`${TAG} pane not opened: ${err}`, { to: 'debug' })
      })
      host.redraw()
    }
    const launch = (creds: Credentials) => {
      // runs on after this command answers: the pane shows the progress
      starting = boot(host, creds)
      void starting
    }

    if (sub === 'jobs') return { text: `jev-vercel-sandbox: ${statusLine()}\n${jobsText()}` }
    if (sub === 'result') {
      const j = findJob(rest) ?? (rest ? undefined : jobs[jobs.length - 1])
      return { text: j ? resultText(j, KEEP_OUTPUT) : `jev-vercel-sandbox: no job ${rest}` }
    }
    if (sub === 'apply') {
      const j = findJob(rest) ?? (rest ? undefined : [...jobs].reverse().find(x => x.report?.patchBytes && !x.applied))
      if (!j) return { text: `jev-vercel-sandbox: no job ${rest || 'with a patch'}` }
      const r = await applyJob(host, j)
      return {
        text: `jev-vercel-sandbox: ${r.text}`,
        context: r.ok ? [`The user applied sandbox job ${j.id}'s patch to their project: ${describeChanges(j.report!.changes)}. These files changed on their machine.`] : undefined,
      }
    }
    if (sub === 'run') {
      if (!rest) return { text: `jev-vercel-sandbox: /${COMMAND} run <command>` }
      if (!credentials) return { text: `jev-vercel-sandbox: not configured (missing ${missing.join(', ')})` }
      const j = newJob({ command: rest, source: { kind: 'current' }, useCase: null, by: 'user', background: true, returns: 'patch', watch: false, timeoutMs: commandTimeoutMs })
      await openPane()
      detach(host, credentials, j)
      return { text: `jev-vercel-sandbox: ${j.id} ${state === 'ready' ? 'running' : 'queued until the sandbox has started'}; the pane follows it` }
    }
    if (sub === 'stop') {
      if (credentials && info && (state === 'ready' || state === 'starting')) {
        await client((url, init) => $.http.fetch(url, init), credentials, apiBase)
          .stop(info)
          .catch(err => $.ui.log(`${TAG} stop failed: ${err}`))
      }
      state = credentials ? 'stopped' : 'off'
      $.ui.status(statusLine())
      host.redraw()
      return { text: `jev-vercel-sandbox: stopped; detected jobs ${confirmSandbox ? 'ask to start a new one' : 'start a new one'}, or /${COMMAND}` }
    }
    if (sub === 'restart') {
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
    if (sub === '' || sub === 'start' || sub === 'open') {
      await openPane()
      if (!credentials) return { text: `jev-vercel-sandbox: not configured, set ${missing.join(', ')} in the plugin's options` }
      if (sub !== 'open' && state !== 'ready' && state !== 'starting') {
        launch(credentials)
        return { text: `jev-vercel-sandbox: starting the Vercel Sandbox${uploadWorkspace ? ' and copying the project into it' : ''}; the pane shows the progress` }
      }
      if (sub === 'open') return {}
    }
    const left = minutesLeft()
    return {
      text: [
        `jev-vercel-sandbox: ${statusLine()}`,
        credentials
          ? `sandbox: ${info ? `${info.name} · ${info.status} · ${info.region} · ${info.vcpus} vCPU · ${info.memory} MB${left !== null ? ` · stops in ${left}m` : ''}` : 'not started'} (${credentialsKind})`
          : `not configured: missing ${missing.join(', ')}`,
        workspace ? `project: ${plural(workspace.files, 'file')} · ${megabytes(workspace.bytes)} in ${workspace.dir}${workspace.synced ? ` · tree ${shortTree(workspace.synced)}` : ''}` : '',
        `jev: ${backend} · ${useCases.join(', ') || 'no use cases'} · threshold ${threshold.toFixed(2)} · ${confirmSandbox ? 'asks first' : 'no questions'}${always.size ? ` · always: ${[...always].join(', ')}` : ''}`,
        lastError ? `last error: ${lastError}` : '',
        `/${COMMAND} [start] · open · restart · stop · jobs · run <cmd> · result <job> · apply <job>`,
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
    if (e.element === 'apply') {
      const j = [...jobs].reverse().find(x => x.report?.patchBytes && !x.applied)
      // the person's own apply, as if typed: it asks before touching anything
      if (j) void $.command.run({ command: COMMAND, args: `apply ${j.id}` }).catch(err => $.ui.toast(`jev-vercel-sandbox: ${err}`))
    } else if (credentials && e.element === 'stop' && info && state === 'ready') {
      void $.command.run({ command: COMMAND, args: 'stop' }).catch(err => $.ui.toast(`jev-vercel-sandbox: ${err}`))
    } else if (credentials && e.element === 'restart' && state !== 'starting') {
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
    const how = confirmSandbox ? 'asks you first' : 'sends them here without asking'

    const explain =
      state === 'ready'
        ? null
        : state === 'starting'
          ? 'Jobs sent now wait for it and then run.'
          : state === 'failed'
            ? `/${COMMAND} restart tries again. Commands run on your machine meanwhile.`
            : state === 'stopped' || state === 'idle'
              ? `Run /${COMMAND} to start it. Jev ${confirmSandbox ? 'offers to start it' : 'starts it'} when it spots a sandbox job.`
              : `Set ${missing.join(', ')} in the plugin's options (settings.json, pluginConfigs["${$.plugin.name}@skills-dir"].options).`

    const showSteps = steps.length > 0 && state !== 'idle' && state !== 'off'
    const withPatch = [...jobs].reverse().find(x => x.report?.patchBytes && !x.applied)

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
              {`Jev checks each command Claude runs. Tests, someone else's repo, an unknown installer, a bulk change or a clean build: it ${how}, and they run here, not on your machine.`}
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

        <Box key="jev-head" marginTop={1}>
          <Text bold color="cyan">Jev</Text>
        </Box>
        <Text dimColor>{fit(`${backend} · ${confirmSandbox ? 'asks first' : 'no questions'}`)}</Text>
        <Text dimColor>{fit(`${tally.detected} detected · ${tally.sandboxed} sandboxed · ${tally.local} local`)}</Text>
        {always.size ? <Text dimColor>{fit(`always: ${[...always].join(', ')}`)}</Text> : null}

        <Box key="jobs-head" marginTop={1}>
          <Text bold color="cyan">{`Jobs (${jobs.length})`}</Text>
        </Box>
        {jobs.length === 0 ? <Text dimColor>none yet</Text> : null}
        {jobs
          .slice()
          .reverse()
          .map(j => {
            const busy = j.state === 'queued' || j.state === 'syncing' || j.state === 'running'
            const mark = busy ? '◌ ' : j.state === 'error' ? '✗ ' : j.exitCode === 0 ? '✓ ' : '! '
            const color = busy ? 'yellow' : j.state === 'error' ? 'red' : j.exitCode === 0 ? 'green' : 'yellow'
            const end = busy ? ` ${j.state}` : j.state === 'error' ? ' failed' : ` ${j.exitCode ?? '?'}`
            const lead = `${j.id} `
            const detail =
              j.state === 'error'
                ? j.error
                : [sourceText(j), j.report ? describeChanges(j.report.changes, 2) : '', j.report?.patchBytes ? (j.applied ? 'patch applied' : 'patch') : '']
                    .filter(Boolean)
                    .join(' · ')
            return (
              <Box key={`job:${j.id}`} flexDirection="column">
                <Box flexDirection="row">
                  <Text color={color}>{mark}</Text>
                  <Text bold>{lead}</Text>
                  <Text>{fit(j.short, width - 2 - lead.length - end.length)}</Text>
                  <Text dimColor>{end}</Text>
                </Box>
                {detail ? <Text dimColor>{fit(`  ${detail}`)}</Text> : null}
              </Box>
            )
          })}

        <Box key="toolbar" marginTop={1} flexDirection="row" columnGap={1}>
          {credentials && state !== 'starting' ? <Button key="restart" label={state === 'ready' ? 'restart' : 'start'} hotkey="r" onPress={noop} /> : null}
          {credentials && state === 'ready' ? <Button key="stop" label="stop" onPress={noop} /> : null}
          {withPatch ? <Button key="apply" label={`apply ${withPatch.id}`} onPress={noop} /> : null}
          <Button key="close" label="close" onPress={noop} />
        </Box>
      </Box>
    )
  })
}
