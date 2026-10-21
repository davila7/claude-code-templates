/**
 * stack-viewer: the model behind the pane. Pure functions, no `$`.
 *
 * `scanFiles` walks the folders each component type is installed from, through
 * an `Io` the hooks module builds from `$.fs`. `buildStack` joins what was found
 * on disk with what the engine says is loaded (the /context breakdown, the
 * command list, the settings layers) into one Section per component type: its
 * scopes in precedence order, each with the components installed there and
 * whether each one is active, shadowed by a higher scope, or off.
 */

export type Kind = 'skills' | 'agents' | 'commands' | 'hooks' | 'mcp' | 'plugins' | 'settings' | 'memory' | 'styles'

export type ScopeId =
  | 'managed'
  | 'flag'
  | 'local'
  | 'project'
  | 'user'
  | 'plugin'
  | 'skillsdir-project'
  | 'skillsdir-user'
  | 'session'
  | 'claudeai'
  | 'synced'
  | 'mcp'
  | 'automem'
  | 'builtin'
  | 'other'

export type Status = 'active' | 'shadowed' | 'off'

export type Item = {
  name: string
  /** One short line after the name: tokens, a version, a hook's matcher. */
  detail?: string
  status: Status
  /** Why: `shadowed by User`, `awaiting approval`, `merged`. */
  note?: string
  /** The scope that wins over this one, for a shadowed item. */
  by?: ScopeId
  /** The scope was read off files, not reported by the engine. */
  isInferred?: boolean
  /** The selected output style. */
  isSelected?: boolean
}

export type ScopeNode = {
  id: ScopeId
  /** Where this scope lives on disk, or what it is. */
  where: string
  items: Item[]
  /** Said once under the scope's header (no items to list, or why). */
  note?: string
}

export type Section = {
  kind: Kind
  /** How the scopes combine, in one line. */
  rule: string
  /** What `active` means for this kind (`active`, `available`, `set`). */
  noun: string
  scopes: ScopeNode[]
  /** One extra line under the rule, e.g. the selected output style. */
  extra?: string
}

export const SCOPE: Record<ScopeId, { label: string }> = {
  managed: { label: 'Enterprise' },
  flag: { label: 'CLI flag' },
  local: { label: 'Local' },
  project: { label: 'Project' },
  user: { label: 'User' },
  plugin: { label: 'Plugin' },
  'skillsdir-project': { label: 'Project skills dir' },
  'skillsdir-user': { label: 'User skills dir' },
  session: { label: 'This session' },
  claudeai: { label: 'claude.ai' },
  synced: { label: 'claude.ai account' },
  mcp: { label: 'MCP server' },
  automem: { label: 'Auto memory' },
  builtin: { label: 'Built-in' },
  other: { label: 'Other' },
}

export const KINDS: { kind: Kind; title: string }[] = [
  { kind: 'skills', title: 'Skills' },
  { kind: 'agents', title: 'Subagents' },
  { kind: 'commands', title: 'Commands' },
  { kind: 'hooks', title: 'Hooks' },
  { kind: 'mcp', title: 'MCP servers' },
  { kind: 'plugins', title: 'Plugins & mods' },
  { kind: 'settings', title: 'Settings' },
  { kind: 'memory', title: 'Memory' },
  { kind: 'styles', title: 'Output styles' },
]

// ---------------------------------------------------------------------------
// What is on disk

/** The file system calls the scan needs; each resolves, never rejects. */
export type Io = {
  read: (path: string) => Promise<string | undefined>
  list: (path: string) => Promise<{ name: string; kind: 'file' | 'dir' | 'other' }[]>
}

export type Base = {
  /** The Claude config directory: `$CLAUDE_CONFIG_DIR`, else `~/.claude`. */
  configDir: string
  /** Where `.claude.json` is: beside the config dir's parent, or inside it. */
  claudeJson: string
  /** The working directory and the project root (often the same). */
  cwd: string
  root: string
  /** The managed settings directories to try, first found wins. */
  managedDirs: string[]
  /** This mod's own folder, so it shows up even when nothing else names it. */
  selfRoot?: string
  home?: string
}

type FileScope = 'managed' | 'user' | 'project'

export type Found = { scope: FileScope; name: string; path: string }

export type PluginRoot = {
  /** `name@marketplace` for an installed plugin, the manifest name otherwise. */
  id: string
  name: string
  version?: string
  root: string
  origin: 'installed' | 'skills-dir' | 'self'
  /** Where an installed plugin was installed, or which skills dir holds it. */
  scope?: 'managed' | 'user' | 'project' | 'local'
  commands: string[]
  styles: string[]
  hookEvents: { event: string; matcher?: string; command: string }[]
  modules: number
  mcpServers: string[]
}

export type McpEntry = { scope: 'managed' | 'local' | 'project' | 'user'; name: string }

export type Files = {
  managedDir?: string
  skills: Found[]
  commands: Found[]
  agents: Found[]
  styles: Found[]
  plugins: PluginRoot[]
  mcp: McpEntry[]
}

const join = (...parts: string[]) => parts.join('/').replace(/\/{2,}/g, '/')

/** The frontmatter `name:` of a markdown file, if it has one. */
export function frontmatterName(text: string | undefined): string | undefined {
  if (!text) return undefined
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!fm) return undefined
  const m = /^name:\s*["']?(.+?)["']?\s*$/m.exec(fm[1]!)
  return m?.[1]?.trim() || undefined
}

function parseJson(text: string | undefined): any {
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** Markdown files under `dir`, as `a:b` names for `a/b.md`, three levels deep. */
async function markdownTree(io: Io, dir: string, depth = 3, prefix = ''): Promise<{ name: string; path: string }[]> {
  const out: { name: string; path: string }[] = []
  for (const e of await io.list(dir)) {
    const path = join(dir, e.name)
    if (e.kind === 'dir' && depth > 1) out.push(...(await markdownTree(io, path, depth - 1, `${prefix}${e.name}:`)))
    else if (e.kind !== 'dir' && e.name.endsWith('.md')) out.push({ name: prefix + e.name.slice(0, -3), path })
  }
  return out
}

async function scanPluginRoot(
  io: Io,
  root: string,
  origin: PluginRoot['origin'],
  fallback: { id?: string; scope?: PluginRoot['scope']; version?: string },
): Promise<PluginRoot | undefined> {
  const manifest = parseJson(await io.read(join(root, '.claude-plugin/plugin.json')))
  if (!manifest && origin !== 'installed') return undefined
  const name: string = manifest?.name ?? fallback.id?.split('@')[0] ?? root.split('/').pop() ?? root
  const commands = (await markdownTree(io, join(root, 'commands'))).map(c => c.name)
  const styles: string[] = []
  for (const f of await markdownTree(io, join(root, 'output-styles'), 1)) {
    styles.push(frontmatterName(await io.read(f.path)) ?? f.name)
  }
  const hooksJson = parseJson(await io.read(join(root, 'hooks/hooks.json')))
  const hookEvents: PluginRoot['hookEvents'] = []
  for (const [event, groups] of Object.entries((hooksJson?.hooks ?? {}) as Record<string, unknown>)) {
    for (const g of Array.isArray(groups) ? groups : []) {
      for (const hk of Array.isArray(g?.hooks) ? g.hooks : []) {
        hookEvents.push({ event, matcher: g?.matcher || undefined, command: hookLabel(hk) })
      }
    }
  }
  const modules = Array.isArray(hooksJson?.modules) ? hooksJson.modules.length : 0
  const mcp = parseJson(await io.read(join(root, '.mcp.json')))
  const mcpServers = [
    ...Object.keys((mcp?.mcpServers ?? mcp ?? {}) as object),
    ...Object.keys((manifest?.mcpServers ?? {}) as object),
  ].filter(k => k !== 'mcpServers')
  return {
    id: fallback.id ?? name,
    name,
    version: manifest?.version ?? fallback.version,
    root,
    origin,
    scope: fallback.scope,
    commands,
    styles,
    hookEvents,
    modules,
    mcpServers: [...new Set(mcpServers)],
  }
}

/** What a hook entry runs, short: its command, URL, or type. */
export function hookLabel(hk: any): string {
  if (typeof hk?.command === 'string') return redact(hk.command)
  if (typeof hk?.url === 'string') return redact(hk.url)
  if (typeof hk?.prompt === 'string') return `prompt: ${redact(hk.prompt)}`
  return String(hk?.type ?? 'hook')
}

/** Masks what reads like a credential in a command or URL: bearer tokens, secret-looking params and flags, long opaque runs. */
export function redact(text: string): string {
  return text
    .replace(/(bearer|basic)\s+[^\s"']+/gi, '$1 •••')
    .replace(/([?&;\s-](?:[\w-]*?(?:token|key|secret|password|passwd|auth|sig|signature|credential)[\w-]*)[=:]\s*)("[^"]*"|'[^']*'|[^\s&"']+)/gi, '$1•••')
    .replace(/\b[A-Za-z0-9+/_-]{32,}={0,2}/g, '•••')
}

/**
 * Every place a component can be installed from, read off disk: skills,
 * commands, agents and output styles at managed, user and project level; the
 * installed plugins and the plugin folders in the skills dirs; MCP servers in
 * `.claude.json`, `.mcp.json` and `managed-mcp.json`.
 */
export async function scanFiles(io: Io, base: Base): Promise<Files> {
  let managedDir: string | undefined
  for (const d of base.managedDirs) {
    if ((await io.list(d)).length) {
      managedDir = d
      break
    }
  }
  const projectDirs = [...new Set([base.cwd, base.root])].map(d => join(d, '.claude'))
  const levels: { scope: FileScope; dir: string }[] = [
    ...(managedDir ? [{ scope: 'managed' as const, dir: join(managedDir, '.claude') }] : []),
    { scope: 'user', dir: base.configDir },
    ...projectDirs.map(dir => ({ scope: 'project' as const, dir })),
  ]

  const files: Files = { managedDir, skills: [], commands: [], agents: [], styles: [], plugins: [], mcp: [] }
  const seen = new Set<string>()
  const once = (k: string) => (seen.has(k) ? false : (seen.add(k), true))

  for (const { scope, dir } of levels) {
    for (const e of await io.list(join(dir, 'skills'))) {
      if (e.kind !== 'dir' && e.kind !== 'other') continue
      const sub = join(dir, 'skills', e.name)
      const skill = await io.read(join(sub, 'SKILL.md'))
      if (skill !== undefined) {
        const name = frontmatterName(skill) ?? e.name
        if (once(`s:${scope}:${name}`)) files.skills.push({ scope, name, path: join(sub, 'SKILL.md') })
        continue
      }
      if (scope === 'managed') continue
      const root = await scanPluginRoot(io, sub, 'skills-dir', { scope: scope === 'user' ? 'user' : 'project' })
      if (root && once(`p:${root.root}`)) files.plugins.push(root)
    }
    for (const c of await markdownTree(io, join(dir, 'commands'))) {
      if (once(`c:${scope}:${c.name}`)) files.commands.push({ scope, name: c.name, path: c.path })
    }
    for (const a of await markdownTree(io, join(dir, 'agents'))) {
      const name = frontmatterName(await io.read(a.path)) ?? a.name.split(':').pop()!
      if (once(`a:${scope}:${name}`)) files.agents.push({ scope, name, path: a.path })
    }
    for (const s of await markdownTree(io, join(dir, 'output-styles'), 1)) {
      const name = frontmatterName(await io.read(s.path)) ?? s.name
      if (once(`o:${scope}:${name}`)) files.styles.push({ scope, name, path: s.path })
    }
  }

  // installed plugins: one entry per install, kept when it applies here
  const installed = parseJson(await io.read(join(base.configDir, 'plugins/installed_plugins.json')))
  const here = new Set([base.cwd, base.root])
  for (const [id, entries] of Object.entries((installed?.plugins ?? {}) as Record<string, any[]>)) {
    for (const ent of Array.isArray(entries) ? entries : []) {
      const scope = ent?.scope as PluginRoot['scope']
      if ((scope === 'project' || scope === 'local') && !here.has(ent?.projectPath)) continue
      if (typeof ent?.installPath !== 'string') continue
      const root = await scanPluginRoot(io, ent.installPath, 'installed', { id, scope, version: ent?.version })
      if (root && once(`p:${root.root}`)) files.plugins.push(root)
    }
  }
  if (base.selfRoot && !files.plugins.some(p => p.root === base.selfRoot)) {
    const self = await scanPluginRoot(io, base.selfRoot, 'self', {})
    if (self) files.plugins.push(self)
  }

  // MCP servers by config scope; only names are kept, never their env or headers
  const cj = parseJson(await io.read(base.claudeJson))
  for (const name of Object.keys((cj?.mcpServers ?? {}) as object)) files.mcp.push({ scope: 'user', name })
  for (const dir of here) {
    for (const name of Object.keys((cj?.projects?.[dir]?.mcpServers ?? {}) as object)) {
      if (once(`m:local:${name}`)) files.mcp.push({ scope: 'local', name })
    }
    const mcpJson = parseJson(await io.read(join(dir, '.mcp.json')))
    for (const name of Object.keys((mcpJson?.mcpServers ?? {}) as object)) {
      if (once(`m:project:${name}`)) files.mcp.push({ scope: 'project', name })
    }
  }
  if (managedDir) {
    const managed = parseJson(await io.read(join(managedDir, 'managed-mcp.json')))
    for (const name of Object.keys((managed?.mcpServers ?? {}) as object)) files.mcp.push({ scope: 'managed', name })
  }
  return files
}

// ---------------------------------------------------------------------------
// What the engine says is loaded

type SettingsSourceName = 'user' | 'project' | 'local' | 'flag' | 'policy'

export type Facts = {
  /** The skill listing: skills and commands the model can call. */
  skills: { name: string; source: string; pluginName?: string }[]
  /** Custom agents the Agent tool offers. */
  agents: { agentType: string; source: string }[]
  /** Every slash command. */
  commands: { name: string; source: string; plugin?: string; description?: string }[]
  /** MCP tools, by server. */
  mcpTools: { name: string; serverName: string }[]
  /** CLAUDE.md and other memory files in the context. */
  memory: { path: string; type: string; tokens: number }[]
  /** Each settings source as loaded. */
  settings: Partial<Record<SettingsSourceName, Record<string, unknown>>>
  /** The output style the last request carried; undefined when none seen yet. */
  activeStyle?: string | null
  /** MCP server name → the config scope the engine reported on a call. */
  mcpSeen: Record<string, string>
  /** Skills over the listing's budget, not in `skills`. */
  skillsOverBudget?: number
  /** For shortening paths; `configDir` only when `$CLAUDE_CONFIG_DIR` moved it. */
  home?: string
  configDir?: string
  cwd?: string
}

/** Settings sources, highest precedence first, with the scope each one is. */
const SETTINGS_ORDER: { source: SettingsSourceName; scope: ScopeId; where: string }[] = [
  { source: 'policy', scope: 'managed', where: 'managed-settings.json' },
  { source: 'flag', scope: 'flag', where: '--settings' },
  { source: 'local', scope: 'local', where: '.claude/settings.local.json' },
  { source: 'project', scope: 'project', where: '.claude/settings.json' },
  { source: 'user', scope: 'user', where: '~/.claude/settings.json' },
]

const ENGINE_SOURCE: Record<string, ScopeId> = {
  policySettings: 'managed',
  flagSettings: 'flag',
  localSettings: 'local',
  projectSettings: 'project',
  userSettings: 'user',
  plugin: 'plugin',
  'built-in': 'builtin',
  builtin: 'builtin',
  mcp: 'mcp',
  syncedSkills: 'synced',
}
const scopeOfSource = (s: string): ScopeId => ENGINE_SOURCE[s] ?? 'other'

const label = (s: ScopeId) => SCOPE[s].label

/** `~/…` and `./…` in place of the home and working directories. */
export function shortPath(path: string, f: Pick<Facts, 'home' | 'cwd' | 'configDir'>): string {
  if (f.configDir && path.startsWith(f.configDir + '/')) return '$CLAUDE_CONFIG_DIR/' + path.slice(f.configDir.length + 1)
  if (f.cwd && path.startsWith(f.cwd + '/')) return './' + path.slice(f.cwd.length + 1)
  if (f.home && path.startsWith(f.home + '/')) return '~/' + path.slice(f.home.length + 1)
  return path
}

function node(id: ScopeId, where: string, items: Item[] = [], note?: string): ScopeNode {
  return { id, where, items: items.sort(byName), note }
}
const byName = (a: Item, b: Item) => a.name.localeCompare(b.name)

/** The first scope in `order` that holds `name`, by `has`. */
function winner<T extends ScopeId>(order: T[], has: (s: T) => boolean): T | undefined {
  return order.find(has)
}

// ---------------------------------------------------------------------------
// Sections

function skillsSection(files: Files, f: Facts, isCommand: (scope: FileScope, name: string) => boolean): Section {
  const pluginCommands = new Set(files.plugins.flatMap(p => p.commands.map(c => `${p.name}:${c}`)))
  const listed = f.skills.filter(s => {
    const scope = scopeOfSource(s.source)
    if (scope === 'plugin') return !pluginCommands.has(s.name)
    return !((scope === 'user' || scope === 'project') && isCommand(scope, s.name))
  })
  const listedIn = (scope: ScopeId, name: string) => listed.some(s => s.name === name && scopeOfSource(s.source) === scope)
  const menu = new Set(f.commands.filter(c => c.source === 'user').map(c => c.name))
  const order: ScopeId[] = ['managed', 'user', 'project']
  const fileNode = (scope: FileScope, where: string) => {
    const items: Item[] = []
    const names = new Set([
      ...files.skills.filter(s => s.scope === scope).map(s => s.name),
      ...listed.filter(s => scopeOfSource(s.source) === scope).map(s => s.name),
    ])
    for (const name of names) {
      if (listedIn(scope, name)) {
        items.push({ name, status: 'active' })
        continue
      }
      const by = winner(order, s => s !== scope && listedIn(s, name))
      if (by) items.push({ name, status: 'shadowed', by, note: `shadowed by ${label(by)}` })
      else if (menu.has(name)) items.push({ name, status: 'active', note: 'menu only (/name)' })
      else items.push({ name, status: 'off', note: 'not loaded' })
    }
    return node(scope, where, items)
  }
  const byScope = (scope: ScopeId) =>
    listed
      .filter(s => scopeOfSource(s.source) === scope)
      .map<Item>(s => ({ name: s.name, status: 'active', detail: s.pluginName && scope !== 'plugin' ? s.pluginName : undefined }))
  const known = new Set<ScopeId>(['managed', 'user', 'project', 'plugin', 'synced', 'mcp', 'builtin'])
  const other = listed.filter(s => !known.has(scopeOfSource(s.source)))
  const scopes = [
    fileNode('managed', files.managedDir ? `${files.managedDir}/.claude/skills` : 'managed settings dir'),
    fileNode('user', '~/.claude/skills'),
    fileNode('project', '.claude/skills'),
    node('plugin', '<plugin>/skills · /plugin:skill', byScope('plugin')),
    node('synced', 'enabled on claude.ai', byScope('synced')),
    node('mcp', 'skills an MCP server provides', byScope('mcp')),
    node('builtin', 'ship with Claude Code', byScope('builtin')),
  ]
  if (other.length) scopes.push(node('other', 'reported by the engine', other.map(s => ({ name: s.name, status: 'active', detail: s.source }))))
  return {
    kind: 'skills',
    noun: 'active',
    rule: 'Enterprise › User › Project on a name clash · plugin skills are namespaced, both load',
    extra: f.skillsOverBudget ? `${f.skillsOverBudget} more over the listing budget, not shown to the model` : undefined,
    scopes,
  }
}

function commandsSection(files: Files, f: Facts): Section {
  const skillFiles = new Map<string, FileScope>()
  for (const s of files.skills) if (!skillFiles.has(s.name)) skillFiles.set(s.name, s.scope)
  const listedAs = (name: string) => f.skills.filter(s => s.name === name).map(s => scopeOfSource(s.source))
  const menu = new Set(f.commands.filter(c => c.source === 'user').map(c => c.name))
  const fileNode = (scope: FileScope, where: string) => {
    const items: Item[] = []
    for (const c of files.commands.filter(c => c.scope === scope)) {
      const skillScope = skillFiles.get(c.name)
      const listed = listedAs(c.name)
      if (skillScope && listed.length) {
        const by = listed.find(s => s === 'managed' || s === 'user' || s === 'project') ?? skillScope
        items.push({ name: c.name, status: 'shadowed', by, note: `a ${label(by)} skill of the same name wins` })
      } else if (listed.includes(scope)) items.push({ name: c.name, status: 'active' })
      else if (listed.length) items.push({ name: c.name, status: 'shadowed', by: listed[0], note: `shadowed by ${label(listed[0]!)}` })
      else if (menu.has(c.name)) items.push({ name: c.name, status: 'active', note: 'menu only' })
      else items.push({ name: c.name, status: 'off', note: 'not loaded' })
    }
    return node(scope, where, items)
  }
  const pluginCommands = new Set(files.plugins.flatMap(p => p.commands.map(c => `${p.name}:${c}`)))
  const listedPlugin = new Set(f.skills.filter(s => s.source === 'plugin').map(s => s.name))
  const plugin = f.commands
    .filter(c => c.source === 'plugin' && (pluginCommands.has(c.name) || !listedPlugin.has(c.name)))
    .map<Item>(c => ({ name: c.name, status: 'active', detail: c.plugin && !c.name.startsWith(`${c.plugin}:`) ? c.plugin : undefined }))
  const builtinSkills = new Set(f.skills.filter(s => scopeOfSource(s.source) === 'builtin').map(s => s.name))
  const builtin = new Map<string, string | undefined>()
  for (const c of f.commands) {
    if (c.source === 'builtin' && !builtinSkills.has(c.name) && !c.name.startsWith('_') && !builtin.has(c.name)) builtin.set(c.name, c.description)
  }
  return {
    kind: 'commands',
    noun: 'active',
    rule: 'Same names as skills: a skill wins over a command file · User › Project',
    scopes: [
      fileNode('user', '~/.claude/commands'),
      fileNode('project', '.claude/commands'),
      node('plugin', '<plugin>/commands · registered by mods', plugin),
      node('mcp', 'MCP prompts', f.commands.filter(c => c.source === 'mcp').map(c => ({ name: c.name, status: 'active' }))),
      node('builtin', 'ship with Claude Code', [...builtin].map(([name, description]) => ({ name, detail: description || undefined, status: 'active' }))),
    ],
  }
}

function agentsSection(files: Files, f: Facts): Section {
  const order: ScopeId[] = ['managed', 'flag', 'project', 'user', 'plugin']
  const listedIn = (scope: ScopeId, name: string) => f.agents.some(a => a.agentType === name && scopeOfSource(a.source) === scope)
  const make = (scope: ScopeId, where: string) => {
    const items: Item[] = []
    const fsScope = scope === 'managed' || scope === 'user' || scope === 'project' ? scope : undefined
    const names = new Set([
      ...f.agents.filter(a => scopeOfSource(a.source) === scope).map(a => a.agentType),
      ...(fsScope ? files.agents.filter(a => a.scope === fsScope).map(a => a.name) : []),
    ])
    for (const name of names) {
      if (listedIn(scope, name)) {
        items.push({ name, status: 'active' })
        continue
      }
      const by = winner(order, s => s !== scope && listedIn(s, name))
      items.push(by ? { name, status: 'shadowed', by, note: `shadowed by ${label(by)}` } : { name, status: 'off', note: 'not loaded' })
    }
    return node(scope, where, items)
  }
  const scopes = [
    make('managed', 'managed settings'),
    make('flag', '--agents JSON'),
    make('project', '.claude/agents'),
    make('user', '~/.claude/agents'),
    make('plugin', '<plugin>/agents · plugin:agent'),
    node('builtin', 'ship with Claude Code', [], 'Explore, Plan, general-purpose… (not listed by the mods API)'),
  ]
  const other = f.agents.filter(a => !order.includes(scopeOfSource(a.source)) && scopeOfSource(a.source) !== 'builtin')
  if (other.length) scopes.push(node('other', 'reported by the engine', other.map(a => ({ name: a.agentType, status: 'active', detail: a.source }))))
  return {
    kind: 'agents',
    noun: 'active',
    rule: 'Enterprise › CLI flag › Project › User › Plugin on a name clash',
    scopes,
  }
}

function hooksSection(files: Files, f: Facts): Section {
  const policy = f.settings.policy ?? {}
  const isManagedOnly = policy.allowManagedHooksOnly === true
  const isAllOff = policy.disableAllHooks === true
  const othersOff =
    !isAllOff && (['flag', 'local', 'project', 'user'] as const).find(s => f.settings[s]?.disableAllHooks !== undefined)
  const disabledBy = othersOff && f.settings[othersOff]?.disableAllHooks === true ? othersOff : undefined
  const scopes = SETTINGS_ORDER.map(({ source, scope, where }) => {
    const items: Item[] = []
    const hooks = (f.settings[source]?.hooks ?? {}) as Record<string, unknown>
    for (const [event, groups] of Object.entries(hooks)) {
      for (const g of Array.isArray(groups) ? groups : []) {
        for (const hk of Array.isArray((g as any)?.hooks) ? (g as any).hooks : []) {
          const matcher = (g as any)?.matcher
          const off =
            isAllOff ? 'disableAllHooks (Enterprise)'
            : scope !== 'managed' && isManagedOnly ? 'allowManagedHooksOnly'
            : scope !== 'managed' && disabledBy ? `disableAllHooks (${label(SETTINGS_ORDER.find(o => o.source === disabledBy)!.scope)})`
            : undefined
          items.push({
            name: event,
            detail: `${matcher ? matcher : '*'} → ${hookLabel(hk)}`,
            status: off ? 'off' : 'active',
            note: off,
          })
        }
      }
    }
    return { id: scope, where, items, note: undefined } as ScopeNode
  })
  const pluginItems: Item[] = []
  for (const p of files.plugins) {
    for (const h of p.hookEvents) {
      pluginItems.push({
        name: h.event,
        detail: `${p.name} · ${h.matcher ?? '*'} → ${h.command}`,
        status: isAllOff || isManagedOnly ? 'off' : 'active',
        note: isAllOff ? 'disableAllHooks' : isManagedOnly ? 'allowManagedHooksOnly' : undefined,
      })
    }
    if (p.modules) {
      pluginItems.push({
        name: 'function hooks',
        detail: `${p.name} · ${p.modules} module${p.modules > 1 ? 's' : ''}`,
        status: 'active',
        note: p.origin === 'self' ? 'this mod' : undefined,
      })
    }
  }
  scopes.push(node('plugin', 'hooks/hooks.json of each plugin and mod', pluginItems))
  return {
    kind: 'hooks',
    noun: 'active',
    rule: 'Every source runs: hooks add up, none replaces another',
    scopes,
  }
}

function mcpSection(files: Files, f: Facts): Section {
  const tools = new Map<string, number>()
  for (const t of f.mcpTools) tools.set(t.serverName, (tools.get(t.serverName) ?? 0) + 1)
  const order: ScopeId[] = ['managed', 'local', 'project', 'user']
  const configured = (scope: ScopeId, name: string) =>
    files.mcp.some(m => m.scope === scope && m.name === name) ||
    (scope === 'managed' && Object.prototype.hasOwnProperty.call((f.settings.policy?.managedMcpServers ?? {}) as object, name))
  const seenScope = (name: string): ScopeId | undefined => {
    const s = f.mcpSeen[name]
    if (!s) return undefined
    if (s === 'enterprise') return 'managed'
    if (s === 'claudeai') return 'claudeai'
    if (s === 'dynamic' || s === 'sdk' || s === 'agent') return 'session'
    return (['managed', 'local', 'project', 'user', 'plugin'] as string[]).includes(s) ? (s as ScopeId) : 'other'
  }
  const merged = mergeSettings(f.settings)
  const approved = (name: string) => {
    const disabled = (merged.disabledMcpjsonServers as string[] | undefined) ?? []
    if (disabled.includes(name)) return false
    if (merged.enableAllProjectMcpServers === true) return true
    return ((merged.enabledMcpjsonServers as string[] | undefined) ?? []).includes(name)
  }
  const detail = (name: string) => {
    const n = tools.get(name)
    return n ? `${n} tool${n > 1 ? 's' : ''}` : undefined
  }
  const nodes = new Map<ScopeId, Item[]>()
  const push = (s: ScopeId, item: Item) => nodes.set(s, [...(nodes.get(s) ?? []), item])
  const names = new Set([...files.mcp.map(m => m.name), ...Object.keys((f.settings.policy?.managedMcpServers ?? {}) as object)])
  for (const name of names) {
    const top = seenScope(name) ?? winner(order, s => configured(s, name))!
    for (const s of order) {
      if (!configured(s, name)) continue
      if (s === top) {
        const isUp = tools.has(name)
        push(s, {
          name,
          detail: detail(name),
          status: isUp ? 'active' : 'off',
          note: isUp ? undefined : s === 'project' && !approved(name) ? 'awaiting approval' : 'not connected',
        })
      } else push(s, { name, status: 'shadowed', by: top, note: `shadowed by ${label(top)}` })
    }
  }
  for (const name of tools.keys()) {
    if (names.has(name)) continue
    const seen = seenScope(name)
    const scope: ScopeId =
      seen ?? (name.startsWith('plugin:') || name.startsWith('plugin_') ? 'plugin' : /^claude[._]ai[ _]/.test(name) ? 'claudeai' : 'session')
    push(scope, {
      name,
      detail: detail(name),
      status: 'active',
      isInferred: seen === undefined && scope === 'session',
      note: seen === undefined && scope === 'session' ? '--mcp-config or SDK' : undefined,
    })
  }
  return {
    kind: 'mcp',
    noun: 'connected',
    rule: 'Enterprise › Local › Project › User › Plugin › claude.ai, the whole entry wins',
    scopes: [
      node('managed', 'managed-mcp.json · managedMcpServers', nodes.get('managed')),
      node('local', '~/.claude.json, this project', nodes.get('local')),
      node('project', '.mcp.json', nodes.get('project')),
      node('user', '~/.claude.json', nodes.get('user')),
      node('plugin', '<plugin>/.mcp.json', nodes.get('plugin')),
      node('claudeai', 'claude.ai connectors', nodes.get('claudeai')),
      node('session', '--mcp-config · SDK', nodes.get('session')),
      ...(nodes.get('other') ? [node('other', 'reported by the engine', nodes.get('other'))] : []),
    ],
  }
}

function pluginsSection(files: Files, f: Facts): Section {
  const order = SETTINGS_ORDER
  const enabled = (src: SettingsSourceName) => (f.settings[src]?.enabledPlugins ?? {}) as Record<string, unknown>
  const ids = new Set(order.flatMap(o => Object.keys(enabled(o.source))))
  const roots = new Map(files.plugins.map(p => [p.id, p]))
  const byName = new Map(files.plugins.map(p => [p.name, p]))
  const summary = (name: string, root?: PluginRoot) => {
    const parts: string[] = []
    if (root?.version) parts.push(`v${root.version}`)
    const skills = f.skills.filter(s => s.pluginName === name).length
    const agents = f.agents.filter(a => a.agentType.startsWith(`${name}:`)).length
    const cmds = f.commands.filter(c => c.plugin === name && !f.skills.some(s => s.name === c.name)).length
    const mcp = new Set(f.mcpTools.filter(t => t.serverName.includes(`plugin:${name}:`) || t.serverName.startsWith(`plugin_${name}_`)).map(t => t.serverName)).size
    if (skills) parts.push(`${skills} skill${skills > 1 ? 's' : ''}`)
    if (agents) parts.push(`${agents} agent${agents > 1 ? 's' : ''}`)
    if (cmds) parts.push(`${cmds} cmd${cmds > 1 ? 's' : ''}`)
    if (mcp) parts.push(`${mcp} MCP`)
    if (root?.hookEvents.length || root?.modules) parts.push('hooks')
    return parts.join(' · ') || undefined
  }
  const nodes = new Map<ScopeId, Item[]>()
  const push = (s: ScopeId, item: Item) => nodes.set(s, [...(nodes.get(s) ?? []), item])
  const placed = new Set<string>()
  for (const id of ids) {
    const name = id.split('@')[0]!
    placed.add(name)
    const top = order.find(o => enabled(o.source)[id] !== undefined)!
    for (const o of order) {
      const v = enabled(o.source)[id]
      if (v === undefined) continue
      if (o === top) {
        const isOn = v !== false
        push(o.scope, { name: id, detail: summary(name, roots.get(id) ?? byName.get(name)), status: isOn ? 'active' : 'off', note: isOn ? undefined : 'disabled here' })
      } else push(o.scope, { name: id, status: 'shadowed', by: top.scope, note: `overridden by ${label(top.scope)}` })
    }
  }
  for (const p of files.plugins) {
    if (p.origin !== 'skills-dir' || placed.has(p.name)) continue
    placed.add(p.name)
    push(p.scope === 'user' ? 'skillsdir-user' : 'skillsdir-project', {
      name: `${p.name}@skills-dir`,
      detail: summary(p.name, p),
      status: 'active',
      note: p.scope === 'project' ? 'loads once the folder is trusted' : undefined,
      isInferred: true,
    })
  }
  // plugins the engine shows components for but nothing on disk installed
  const seen = new Set<string>([
    ...f.skills.map(s => s.pluginName).filter((n): n is string => !!n),
    ...f.commands.map(c => c.plugin).filter((n): n is string => !!n),
    ...f.agents.filter(a => a.source === 'plugin' && a.agentType.includes(':')).map(a => a.agentType.split(':')[0]!),
    ...files.plugins.filter(p => p.origin === 'self').map(p => p.name),
  ])
  for (const name of seen) {
    if (placed.has(name)) continue
    const root = byName.get(name)
    push('session', {
      name,
      detail: summary(name, root),
      status: 'active',
      isInferred: true,
      note: root?.origin === 'self' ? 'this mod · --plugin-dir or SDK' : '--plugin-dir or SDK',
    })
  }
  return {
    kind: 'plugins',
    noun: 'enabled',
    rule: 'enabledPlugins: Enterprise › CLI flag › Local › Project › User, the highest that names it decides',
    scopes: [
      node('managed', 'managed enabledPlugins', nodes.get('managed')),
      node('flag', '--settings', nodes.get('flag')),
      node('local', '.claude/settings.local.json', nodes.get('local')),
      node('project', '.claude/settings.json', nodes.get('project')),
      node('user', '~/.claude/settings.json', nodes.get('user')),
      node('skillsdir-project', '.claude/skills/<mod>', nodes.get('skillsdir-project')),
      node('skillsdir-user', '~/.claude/skills/<mod>', nodes.get('skillsdir-user')),
      node('session', '--plugin-dir · SDK', nodes.get('session')),
    ],
  }
}

/** The engine's merge: a scalar from the highest source that has it, lists joined, objects merged. */
export function mergeSettings(settings: Facts['settings']): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const { source } of [...SETTINGS_ORDER].reverse()) {
    for (const [k, v] of Object.entries(settings[source] ?? {})) {
      const prev = out[k]
      if (Array.isArray(prev) && Array.isArray(v)) out[k] = [...prev, ...v]
      else if (isObject(prev) && isObject(v)) out[k] = { ...prev, ...v }
      else out[k] = v
    }
  }
  return out
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const SENSITIVE = /key|token|secret|password|passwd|auth|credential|cookie|helper|uuid|org/i

/** A settings value as one short, safe line: no secrets, no env values. */
export function showValue(key: string, v: unknown): string {
  if (key === 'env' && isObject(v)) {
    const keys = Object.keys(v)
    return keys.length ? `${keys.length} var${keys.length > 1 ? 's' : ''}: ${keys.join(', ')}` : '{}'
  }
  if (SENSITIVE.test(key)) return '•••'
  if (typeof v === 'boolean' || typeof v === 'number') return String(v)
  if (typeof v === 'string') return v.length > 40 ? `"${v.slice(0, 39)}…"` : `"${v}"`
  if (Array.isArray(v)) return `[${v.length}]`
  if (isObject(v)) {
    const keys = Object.keys(v)
    return `{ ${keys.slice(0, 4).join(', ')}${keys.length > 4 ? ', …' : ''} }`
  }
  return String(v)
}

function settingsSection(f: Facts): Section {
  const scopes = SETTINGS_ORDER.map(({ source, scope, where }) => {
    const items: Item[] = []
    for (const [k, v] of Object.entries(f.settings[source] ?? {})) {
      const isMerged = isObject(v) || Array.isArray(v)
      const top = isMerged ? undefined : SETTINGS_ORDER.find(o => f.settings[o.source]?.[k] !== undefined && !isObject(f.settings[o.source]?.[k]))
      if (isMerged) items.push({ name: k, detail: showValue(k, v), status: 'active', note: 'merged' })
      else if (top && top.source !== source) items.push({ name: k, detail: showValue(k, v), status: 'shadowed', by: top.scope, note: `overridden by ${label(top.scope)}` })
      else items.push({ name: k, detail: showValue(k, v), status: 'active' })
    }
    return node(scope, where, items)
  })
  return {
    kind: 'settings',
    noun: 'in effect',
    rule: 'Enterprise › CLI flag › Local › Project › User · a value wins, objects and lists merge',
    scopes,
  }
}

function memorySection(f: Facts): Section {
  const map: Record<string, ScopeId> = { Managed: 'managed', User: 'user', Project: 'project', Local: 'local', AutoMem: 'automem' }
  const by = new Map<ScopeId, Item[]>()
  for (const m of f.memory) {
    const s = map[m.type] ?? 'other'
    by.set(s, [...(by.get(s) ?? []), { name: shortPath(m.path, f), detail: `${m.tokens} tok`, status: 'active' }])
  }
  const scopes = [
    node('managed', 'managed CLAUDE.md', by.get('managed')),
    node('project', 'CLAUDE.md · .claude/CLAUDE.md · rules', by.get('project')),
    node('local', 'CLAUDE.local.md', by.get('local')),
    node('user', '~/.claude/CLAUDE.md', by.get('user')),
    node('automem', 'auto memory', by.get('automem')),
  ]
  if (by.get('other')) scopes.push(node('other', 'reported by the engine', by.get('other')))
  return { kind: 'memory', noun: 'loaded', rule: 'All load together, none replaces another', scopes }
}

const BUILTIN_STYLES = ['Default', 'Proactive', 'Concise', 'Explanatory', 'Learning']

function stylesSection(files: Files, f: Facts): Section {
  const setIn = SETTINGS_ORDER.filter(o => typeof f.settings[o.source]?.outputStyle === 'string')
  const fromSettings = setIn[0] ? String(f.settings[setIn[0].source]!.outputStyle) : undefined
  const selected = f.activeStyle === null ? 'Default' : (f.activeStyle ?? fromSettings ?? 'Default')
  const mark = (name: string): Item => ({
    name,
    status: 'active',
    isSelected: name === selected || (name === 'Default' && selected.toLowerCase() === 'default'),
    note: name === selected && setIn[0] ? `selected in ${label(setIn[0].scope)} settings` : undefined,
  })
  const fromFiles = (scope: FileScope) => files.styles.filter(s => s.scope === scope).map(s => mark(s.name))
  const plugin = files.plugins.flatMap(p => p.styles.map(s => ({ ...mark(s), detail: p.name })))
  const overridden = setIn.slice(1).map(o => `${label(o.scope)}: ${String(f.settings[o.source]!.outputStyle)}`)
  return {
    kind: 'styles',
    noun: 'available',
    rule: 'One style is selected; the highest settings source with outputStyle picks it',
    extra: `selected: ${selected}${setIn[0] ? ` ← ${label(setIn[0].scope)}` : ''}${overridden.length ? ` · overrides ${overridden.join(', ')}` : ''}`,
    scopes: [
      node('managed', 'managed .claude/output-styles', fromFiles('managed')),
      node('project', '.claude/output-styles', fromFiles('project')),
      node('user', '~/.claude/output-styles', fromFiles('user')),
      node('plugin', '<plugin>/output-styles', plugin),
      { id: 'builtin', where: 'ship with Claude Code', items: BUILTIN_STYLES.map(mark) },
    ],
  }
}

/** Every component type's section, in the sidebar's order. */
export function buildStack(files: Files, f: Facts): Section[] {
  const commandFile = new Set(files.commands.map(c => `${c.scope}:${c.name}`))
  const skillFile = new Set(files.skills.map(s => `${s.scope}:${s.name}`))
  // a listed `userSettings` entry is a command when only a command file has that name there
  const isCommand = (scope: FileScope, name: string) => commandFile.has(`${scope}:${name}`) && !skillFile.has(`${scope}:${name}`)
  const sections: Record<Kind, Section> = {
    skills: skillsSection(files, f, isCommand),
    agents: agentsSection(files, f),
    commands: commandsSection(files, f),
    hooks: hooksSection(files, f),
    mcp: mcpSection(files, f),
    plugins: pluginsSection(files, f),
    settings: settingsSection(f),
    memory: memorySection(f),
    styles: stylesSection(files, f),
  }
  return KINDS.map(k => sections[k.kind])
}

export type Counts = { active: number; shadowed: number; off: number }

export function counts(section: Section): Counts {
  const c: Counts = { active: 0, shadowed: 0, off: 0 }
  for (const s of section.scopes) for (const i of s.items) c[i.status]++
  return c
}

/** `text` cut to `width` cells with an ellipsis. */
export function fit(text: string, width: number): string {
  const w = Math.max(1, Math.floor(width))
  const chars = Array.from(text)
  if (chars.length <= w) return text
  return chars.slice(0, Math.max(0, w - 1)).join('') + '…'
}

/** `text` cut or padded to exactly `width` cells. */
export function cell(text: string, width: number, align: 'left' | 'right' = 'left'): string {
  const t = fit(text, width)
  const pad = ' '.repeat(Math.max(0, width - Array.from(t).length))
  return align === 'left' ? t + pad : pad + t
}
