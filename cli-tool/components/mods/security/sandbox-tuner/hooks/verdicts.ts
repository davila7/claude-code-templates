// Verdicts: what each record means against the current settings.

import type { Settings } from 'claude-code'

import type { SandboxTunerAction, SandboxTunerRecord, SandboxTunerSettingsKey } from '../types'
import { CLAUDE_PROTECTED, PROTECTED_PLACES, absolutePath, cacheFolder, displayPath, hostMatches, isDnsName, isKeyFile, isProtectedName, isUnder } from './names'
import { allowCount, sightingTotal } from './records'
import type { FileInfo } from './settings-file'
import { isPlainObject, isText } from './shapes'
import type { SandboxFacts } from './sightings'

export type SourceName = 'user' | 'project' | 'local' | 'flag' | 'policy'
export type Sources = Readonly<Record<SourceName, Settings>>
export type Context = {
  sources: Sources
  home: string | undefined
  configDir: string | undefined
  // Where the protected places and the credentials folders lie: as spelled, or where a press found them.
  protectedDirs: readonly string[]
  credentialDirs: readonly string[]
  pathDirs: readonly string[]
  cwd: string
  root: string
  threshold: number
  file: FileInfo | undefined
  isCanonical: boolean
}
export type Change = { action: SandboxTunerAction; settingsKey: SandboxTunerSettingsKey; entry: string; file: FileInfo }
export type NoFixReason =
  | 'unverified-path' | 'not-dns' | 'denied-by-settings' | 'managed-lock' | 'protected' | 'credentials' | 'system' | 'too-broad'
  | 'glob' | 'on-path' | 'inside-workspace' | 'deny-rule' | 'write-pattern' | 'read-rule' | 'read-pattern' | 'not-a-cache' | 'no-settings-file'
export type Verdict =
  | { status: 'ready'; allow: Change; deny: Change | null }
  | { status: 'waiting'; deny: Change | null }
  | { status: 'covered'; source: SourceName | 'combined' }
  | { status: 'no-fix'; reason: NoFixReason; detail: string }
export type Rated = { record: SandboxTunerRecord; verdict: Verdict }

type Entry = { text: string; path: string }
type DenialEntry = Entry & { reason: 'read-rule' | 'deny-rule' | 'read-pattern' | 'write-pattern' }

const SOURCE_NAMES: readonly SourceName[] = ['user', 'project', 'local', 'flag', 'policy']
// The sources a repository cannot write: user settings, --settings, and managed settings.
const TRUSTED_SOURCES: readonly SourceName[] = ['user', 'flag', 'policy']
const POLICY_ONLY: readonly SourceName[] = ['policy']
const WEB_FETCH = /^WebFetch\(domain:(.+)\)$/
const GLOB = /[*?[]/
const STATUS_RANK: Readonly<Record<Verdict['status'], number>> = { ready: 0, waiting: 1, 'no-fix': 2, covered: 3 }
// A git or Claude folder outside the working directory, in any letter case: its hooks and settings run outside the sandbox.
const REPO_FOLDERS: ReadonlySet<string> = new Set(['.git', '.claude'])
// Under HOME, beside the protected places that any folder can hold: Claude Code's own settings and the global git configuration.
const HOME_PROTECTED = ['.claude.json', '.config/git']
const CREDENTIAL_FOLDERS = ['.ssh', '.gnupg', '.aws', '.azure', '.config/gcloud', '.config/gh', '.docker', '.netrc', '.npmrc', '.pypirc', '.git-credentials', '.password-store', '.local/share/keyrings', 'Library/Keychains']
const SYSTEM_FOLDERS = ['/bin', '/sbin', '/usr', '/etc', '/private/etc', '/System', '/Library', '/Applications', '/opt/homebrew', '/opt/local', '/nix', '/boot', '/lib', '/lib64']
const READ_BLOCK = 'permissions.blockReadsOutsideWorkingDirectories'
// The roots that hold user files, which the read block closes to sandboxed commands (settings-reference.md).
const USER_ROOTS = ['/Users', '/home', '/root', '/Volumes', '/mnt', '/media', '/run/media', '/srv']

function at(value: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>((node, name) => (isPlainObject(node) ? node[name] : undefined), value)
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isText) : []
}

export function sandboxFacts(merged: Settings): SandboxFacts {
  return {
    isEnabled: at(merged, ['sandbox', 'enabled']) === true,
    allowsUnsandboxed: at(merged, ['sandbox', 'allowUnsandboxedCommands']) !== false,
  }
}

function isManagedDomainsOnly(sources: Sources): boolean {
  return at(sources.policy, ['sandbox', 'network', 'allowManagedDomainsOnly']) === true
}

function isStrict(sources: Sources): boolean {
  return TRUSTED_SOURCES.some(name => at(sources[name], ['sandbox', 'network', 'strictAllowlist']) === true)
}

function honoredSources(sources: Sources): readonly SourceName[] {
  const policyRetry = at(sources.policy, ['sandbox', 'allowUnsandboxedCommands'])
  const flagRetry = at(sources.flag, ['sandbox', 'allowUnsandboxedCommands'])
  const isAdminRequired = policyRetry === false || (flagRetry === false && policyRetry !== true) || isManagedDomainsOnly(sources)
  return isAdminRequired ? TRUSTED_SOURCES : SOURCE_NAMES
}

/** The sources whose host entries the sandbox honors. */
function networkAllowSources(sources: Sources): readonly SourceName[] {
  if (isManagedDomainsOnly(sources)) return POLICY_ONLY
  return isStrict(sources) ? TRUSTED_SOURCES : honoredSources(sources)
}

function hostEntries(settings: Settings, list: 'allowedDomains' | 'deniedDomains', rules: 'allow' | 'deny'): string[] {
  const fromRules = strings(at(settings, ['permissions', rules])).flatMap(rule => {
    const [, domain] = WEB_FETCH.exec(rule) ?? []
    return domain === undefined ? [] : [domain]
  })
  return [...strings(at(settings, ['sandbox', 'network', list])), ...fromRules]
}

/** Anchor a settings path without folding `..`: a press follows links before their following segments. */
function anchorEntry(text: string, source: SourceName, context: Context): string | null {
  const entry = text.replace(/\/\*\*$/, '')
  if (GLOB.test(entry)) return null
  const isHome = entry === '~' || entry.startsWith('~/')
  const base = entry.startsWith('/')
    ? '/'
    : isHome
      ? context.home
      : source === 'user'
        ? context.configDir
        : source === 'project' || source === 'local'
          ? context.root
          : undefined
  return base === undefined ? null : entry.startsWith('/') ? entry : `${base}/${isHome ? entry.slice(2) : entry}`
}

function resolveAll(texts: readonly string[], source: SourceName, context: Context): Entry[] {
  return texts.flatMap(text => {
    const path = anchorEntry(text, source, context)
    return path === null ? [] : [{ text, path: absolutePath(path, '/') }]
  })
}

function entriesOf(context: Context, names: readonly SourceName[], path: readonly string[]): Entry[] {
  return names.flatMap(name => resolveAll(strings(at(context.sources[name], path)), name, context))
}

/** Anchor the last literal parent of a sandbox pattern, retaining links and their following segments. */
function sandboxPath(text: string, source: SourceName, context: Context): { path: string; isPattern: boolean } {
  const entry = text.replace(/\/\*\*$/, '')
  const wildcard = entry.search(GLOB)
  const literal = wildcard < 0 ? entry : entry.slice(0, wildcard)
  const parent = wildcard < 0 ? literal : literal.slice(0, literal.lastIndexOf('/') + 1) || '.'
  return { path: anchorEntry(parent, source, context) ?? '/', isPattern: wildcard >= 0 }
}

/** Denial paths, or the last complete literal parent of each pattern, anchored before following links. */
export function denialEntries(context: Context): DenialEntry[] {
  const entries = permissionEntries(context)
  for (const source of SOURCE_NAMES) {
    for (const list of ['denyWrite', 'denyRead'] as const) {
      for (const text of strings(at(context.sources[source], ['sandbox', 'filesystem', list]))) {
        const { path, isPattern } = sandboxPath(text, source, context)
        const reason = list === 'denyRead' ? (isPattern ? 'read-pattern' : 'read-rule') : (isPattern ? 'write-pattern' : 'deny-rule')
        entries.push({ text, path, reason })
      }
    }
  }
  return entries
}

/** Permission rules use source-relative slash anchors and working-directory relative bare paths. */
function permissionAnchor(pattern: string, source: SourceName, context: Context): { base: string | undefined; entry: string } {
  if (pattern.startsWith('//')) return { base: '/', entry: pattern.slice(2) }
  if (pattern.startsWith('~/')) return { base: context.home, entry: pattern.slice(2) }
  if (pattern.startsWith('/')) return { base: source === 'user' ? context.configDir : source === 'project' || source === 'local' ? context.root : undefined, entry: pattern.slice(1) }
  return { base: context.cwd, entry: pattern.replace(/^\.\//, '') }
}

/** Only a literal subtree can prove coverage of the entire proposed folder. */
function editGrants(context: Context, source: SourceName): Entry[] {
  return strings(at(context.sources[source], ['permissions', 'allow'])).flatMap(text => {
    const pattern = /^Edit\((.+)\/\*\*\)$/.exec(text)?.[1]
    if (pattern === undefined || /[*?[\\!]/.test(pattern)) return []
    const { base, entry } = permissionAnchor(pattern, source, context)
    if (base === undefined) return []
    return [{ text, path: absolutePath(entry, base) }]
  })
}

/** Permission paths have different anchors from sandbox paths. Uncertain patterns cannot justify opening a folder. */
function permissionEntries(context: Context): DenialEntry[] {
  const entries: DenialEntry[] = []
  for (const source of SOURCE_NAMES) {
    for (const rule of strings(at(context.sources[source], ['permissions', 'deny']))) {
      const match = /^(Read|Edit)(?:\((.*)\))?$/.exec(rule)
      if (match === null) continue
      const isRead = match[1] === 'Read'
      const pattern = match[2]
      const uncertainReason = isRead ? 'read-pattern' : 'write-pattern'
      if (pattern === undefined || pattern === '') {
        entries.push({ text: rule, path: '/', reason: uncertainReason })
        continue
      }
      const anchored = permissionAnchor(pattern, source, context)
      const base = anchored.base
      let entry = anchored.entry
      if (!pattern.startsWith('/') && !pattern.startsWith('~/') && !entry.replace(/\/\*\*$/, '').includes('/')) entry = `**/${entry}`
      if (base === undefined) {
        entries.push({ text: rule, path: '/', reason: uncertainReason })
        continue
      }
      entry = entry.replace(/\/\*\*$/, '')
      // Escapes and negation need the full gitignore matcher. Keep their entire anchor uncertain.
      const wildcard = /[\\!]/.test(entry) ? 0 : entry.search(GLOB)
      const literal = wildcard < 0 ? entry : entry.slice(0, wildcard)
      const parent = wildcard < 0 ? literal : literal.slice(0, literal.lastIndexOf('/') + 1)
      entries.push({ text: rule, path: `${base}/${parent}`, reason: wildcard < 0 ? (isRead ? 'read-rule' : 'deny-rule') : uncertainReason })
    }
  }
  return entries
}

/** Denials apply to both a requested path and its real location. */
export function denialVerdict(samples: readonly string[], entries: readonly DenialEntry[]): Verdict | null {
  const denied = entries.find(entry => samples.some(sample => isUnder(absolutePath(sample, '/'), absolutePath(entry.path, '/'))))
  return denied === undefined ? null : noFix(denied.reason, denied.text)
}

/** Keep credential paths anchored for link resolution, using literal parents for patterns and `/` for unknown anchors. */
export function credentialEntries(context: Context): Entry[] {
  return SOURCE_NAMES.flatMap(name => {
    const files = at(context.sources[name], ['sandbox', 'credentials', 'files'])
    const paths = Array.isArray(files) ? files.map(file => at(file, ['path'])) : []
    return strings(paths).map(text => ({ text, path: sandboxPath(text, name, context).path }))
  })
}

/** A folder and each folder above it, up to the root. */
function foldersUp(folder: string): string[] {
  const folders = [folder]
  let at = folder
  while (at !== '/') {
    at = at.slice(0, at.lastIndexOf('/')) || '/'
    folders.push(at)
  }
  return folders
}

/**
 * The protected places and the credentials folders, as spelled: the config dir and its protected names, Claude Code's
 * files and the git configuration under HOME, and the protected places in HOME, in each project folder, and in every
 * folder above a project folder, where Claude Code protects the `.claude` settings too.
 */
export function guardedPlaces(home: string | undefined, configDir: string | undefined, projects: readonly string[]): Pick<Context, 'protectedDirs' | 'credentialDirs'> {
  const under = (folder: string | undefined, names: Iterable<string>) => (folder === undefined ? [] : [...names].map(name => `${folder === '/' ? '' : folder}/${name}`))
  const places = [
    ...(configDir === undefined ? [] : [configDir]),
    ...under(configDir, CLAUDE_PROTECTED),
    ...under(home, HOME_PROTECTED),
    ...[home, ...projects.flatMap(foldersUp)].flatMap(folder => under(folder, PROTECTED_PLACES)),
  ]
  return { protectedDirs: [...new Set(places)], credentialDirs: under(home, CREDENTIAL_FOLDERS) }
}

/**
 * A guarded place that the link check of a folder Allow walks: `levels` is how many levels of folders it lists, the
 * place itself first (Infinity for every level), and `skip` names the folders it never enters, each as a path from the
 * place, where `*` stands for any one name.
 */
export type Walk = { path: string; levels: number; skip: readonly string[] }

// In the config folder, the walk lists only the places where code or settings that run outside the sandbox live.
// It skips the data folders, such as transcripts (projects), todos, logs, and file history. Plugin code is too large to
// list whole, so the walk lists the top two levels of each installed plugin, marketplace, and plugin data folder.
const CONFIG_WALKS: readonly Walk[] = [
  // Beside the protected names: the output styles.
  { path: 'output-styles', levels: Infinity, skip: [] },
  { path: 'plugins', levels: 1, skip: [] },
  // <marketplace>/<plugin>/<version>, then two levels of the plugin.
  { path: 'plugins/cache', levels: 5, skip: [] },
  // <marketplace>, then two levels of it, without its git clone data.
  { path: 'plugins/marketplaces', levels: 3, skip: ['*/.git'] },
  // <plugin>, then two levels of the folder where a plugin keeps its installed dependencies.
  { path: 'plugins/data', levels: 3, skip: [] },
  // A local install of Claude Code.
  { path: 'local', levels: 2, skip: [] },
]

// VS Code keeps the extensions it installs in the `.vscode` folder of HOME. They are too large to list whole, so the
// walk lists the rest of that folder whole, and `extensions`: its top level, then two levels of each extension.
const EDITOR_FOLDER = '.vscode'
const EXTENSIONS_WALK: Walk = { path: 'extensions', levels: 3, skip: [] }

/** Whether a walk skips the folder at `at`, the names from the walked place down to that folder. */
export function isSkipped(skip: readonly string[], at: readonly string[]): boolean {
  return skip.some(entry => {
    const names = entry.split('/')
    return names.length === at.length && names.every((name, index) => name === '*' || name === at[index])
  })
}

/**
 * The walks of the link check over guarded places. Each place is walked whole, except two. The config folder: its top
 * level, its protected names (in `paths` already), and CONFIG_WALKS. The `.vscode` folder of HOME: the rest of it, and
 * EXTENSIONS_WALK. A `.vscode` folder elsewhere holds settings only, so it is walked whole.
 */
export function guardedWalks(paths: readonly string[], { home, configDir }: Pick<Context, 'home' | 'configDir'>): Walk[] {
  const inside = (folder: string, walk: Walk): Walk => ({ ...walk, path: `${folder === '/' ? '' : folder}/${walk.path}` })
  const editor = home === undefined ? undefined : `${home === '/' ? '' : home}/${EDITOR_FOLDER}`
  const walks = paths.map(path => ({ path, levels: path === configDir ? 1 : Infinity, skip: path === editor ? [EXTENSIONS_WALK.path] : [] }))
  const config = configDir !== undefined && paths.includes(configDir) ? CONFIG_WALKS.map(walk => inside(configDir, walk)) : []
  const extensions = editor !== undefined && paths.includes(editor) ? [inside(editor, EXTENSIONS_WALK)] : []
  return [...walks, ...config, ...extensions]
}

function isProtected(path: string, context: Context): boolean {
  return context.protectedDirs.some(dir => isUnder(path, dir)) || isProtectedName(path)
}

function isCredential(record: SandboxTunerRecord, context: Context): boolean {
  return [record.target, record.sample].some(path => context.credentialDirs.some(dir => isUnder(path, dir))) || isKeyFile(record.sample)
}

function isTooBroad(target: string, home: string | undefined): boolean {
  return target.split('/').filter(part => part !== '').length < 2 || (home !== undefined && isUnder(home, target))
}

function isReadBlocked(path: string, context: Context): boolean {
  const isOn = SOURCE_NAMES.some(name => at(context.sources[name], ['permissions', 'blockReadsOutsideWorkingDirectories']) === true)
  const roots = context.home === undefined ? USER_ROOTS : [context.home, ...USER_ROOTS]
  return isOn && roots.some(root => isUnder(path, root))
}

function noFix(reason: NoFixReason, detail: string): Verdict {
  return { status: 'no-fix', reason, detail }
}

function withFile(context: Context, build: (file: FileInfo) => Verdict): Verdict {
  return context.file === undefined ? noFix('no-settings-file', '') : build(context.file)
}

function byCount(record: SandboxTunerRecord, context: Context, allow: Change, deny: Change | null): Verdict {
  return allowCount(record.counts) < context.threshold ? { status: 'waiting', deny } : { status: 'ready', allow, deny }
}

function hostVerdict(record: SandboxTunerRecord, context: Context): Verdict {
  if (!isDnsName(record.target)) return noFix('not-dns', '')
  const ports = record.ports.length === 0 ? [[]] : record.ports.map(port => [port])
  const denied = SOURCE_NAMES.flatMap(name => hostEntries(context.sources[name], 'deniedDomains', 'deny')).find(entry => ports.some(port => hostMatches(entry, record.target, port)))
  if (denied !== undefined) return noFix('denied-by-settings', denied)
  const allowed = networkAllowSources(context.sources).map(source => ({ source, entries: hostEntries(context.sources[source], 'allowedDomains', 'allow') }))
  const coverage = ports.map(port => allowed.find(({ entries }) => entries.some(entry => hostMatches(entry, record.target, port)))?.source)
  const first = coverage[0]
  if (first !== undefined && coverage.every(source => source !== undefined)) {
    return { status: 'covered', source: coverage.every(source => source === first) ? first : 'combined' }
  }
  if (isManagedDomainsOnly(context.sources)) return noFix('managed-lock', record.target)
  return withFile(context, file => {
    // Deny only a host the person refused at the network prompt. Under strictAllowlist the sandbox refuses it already.
    const canDeny = record.counts.refused > 0 && !isStrict(context.sources)
    const deny: Change | null = canDeny ? { action: 'deny', settingsKey: 'sandbox.network.deniedDomains', entry: record.target, file } : null
    return byCount(record, context, { action: 'allow', settingsKey: 'sandbox.network.allowedDomains', entry: record.target, file }, deny)
  })
}

function pathVerdict(record: SandboxTunerRecord, context: Context): Verdict {
  const { target, sample } = record
  if (isProtected(target, context) || isProtected(sample, context)) return noFix('protected', '')
  if (isCredential(record, context)) return noFix('credentials', '')
  if (SYSTEM_FOLDERS.some(folder => isUnder(target, folder))) return noFix('system', '')
  if (isTooBroad(target, context.home)) return noFix('too-broad', '')
  if (GLOB.test(target)) return noFix('glob', '')
  const pathDir = context.pathDirs.map(dir => absolutePath(dir, '/')).find(dir => isUnder(target, dir) || isUnder(dir, target))
  if (pathDir !== undefined) return noFix('on-path', pathDir)
  if (isUnder(target, context.cwd)) return noFix('inside-workspace', '')
  if (target.toLowerCase().split('/').some(part => REPO_FOLDERS.has(part))) return noFix('protected', '')
  const denied = denialVerdict([sample], denialEntries(context))
  if (denied !== null) return denied
  const credentials = credentialEntries(context).map(entry => ({ ...entry, path: absolutePath(entry.path, '/') }))
  const readRule = credentials.find(entry => isUnder(sample, entry.path))
  if (readRule !== undefined) return noFix('read-rule', readRule.text)
  if (isReadBlocked(sample, context)) return noFix('read-rule', READ_BLOCK)
  const coveredBy = honoredSources(context.sources).find(name =>
    [...entriesOf(context, [name], ['sandbox', 'filesystem', 'allowWrite']), ...entriesOf(context, [name], ['permissions', 'additionalDirectories']), ...editGrants(context, name)]
      .some(entry => isUnder(target, entry.path)),
  )
  if (coveredBy !== undefined) return { status: 'covered', source: coveredBy }
  if (cacheFolder(sample, context.home) !== target) return noFix('not-a-cache', '')
  // Guard the entire folder, including credentials elsewhere inside it.
  if (context.protectedDirs.some(dir => isUnder(dir, target))) return noFix('protected', '')
  if ([...context.credentialDirs, ...credentials.map(entry => entry.path)].some(path => isUnder(path, target))) return noFix('credentials', '')
  if (record.counts.inferred > 0) return noFix('unverified-path', '')
  return withFile(context, file => byCount(record, context, { action: 'allow', settingsKey: 'sandbox.filesystem.allowWrite', entry: displayPath(target, context.home), file }, null))
}

export function verdictOf(record: SandboxTunerRecord, context: Context): Verdict {
  switch (record.kind) {
    case 'host':
      return hostVerdict(record, context)
    case 'path':
      return pathVerdict(record, context)
  }
}

function compareRated(a: Rated, b: Rated): number {
  const byTarget = a.record.target < b.record.target ? -1 : a.record.target > b.record.target ? 1 : 0
  return (
    STATUS_RANK[a.verdict.status] - STATUS_RANK[b.verdict.status] ||
    sightingTotal(b.record.counts) - sightingTotal(a.record.counts) ||
    b.record.lastSeen - a.record.lastSeen ||
    byTarget
  )
}

export function rateRecords(records: readonly SandboxTunerRecord[], context: Context): Rated[] {
  return records.map(record => ({ record, verdict: verdictOf(record, context) })).sort(compareRated)
}
