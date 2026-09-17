// aitmpl.com catalog: pure helpers (no `$`), drawn by ../register.tsx and covered by ../tests.

export type TypeKey =
  | 'agents'
  | 'commands'
  | 'mcps'
  | 'settings'
  | 'hooks'
  | 'skills'
  | 'loops'
  | 'mods'

export type TypeInfo = {
  key: TypeKey
  label: string
  /** the CLI flag that installs one (`--agent`) */
  flag: string
  /** the digit that opens it from the home view */
  hotkey: string
}

// The browsable types, in the site's order; sandbox, plugins and the retired templates are not browsed.
export const TYPES: readonly TypeInfo[] = [
  { key: 'agents', label: 'Agents', flag: '--agent', hotkey: '1' },
  { key: 'commands', label: 'Commands', flag: '--command', hotkey: '2' },
  { key: 'mcps', label: 'MCPs', flag: '--mcp', hotkey: '3' },
  { key: 'settings', label: 'Settings', flag: '--setting', hotkey: '4' },
  { key: 'hooks', label: 'Hooks', flag: '--hook', hotkey: '5' },
  { key: 'skills', label: 'Skills', flag: '--skill', hotkey: '6' },
  { key: 'loops', label: 'Loops', flag: '--loop', hotkey: '7' },
  { key: 'mods', label: 'Mods', flag: '--mod', hotkey: '8' },
]

export function typeByKey(key: string): TypeInfo | undefined {
  return TYPES.find(t => t.key === key || t.label.toLowerCase() === key)
}

export type Item = {
  name: string
  /** `category/name.md` for most types; absent on templates */
  path?: string
  category: string
  description: string
  downloads: number
  /** a row that carries its own install command uses it as is */
  installCommand?: string
}

export type Trending = {
  type: TypeInfo
  name: string
  category: string
  downloadsWeek: number
}

export type GlobalStats = {
  totalComponents?: number
  totalDownloads?: number
  weeklyDownloads?: number
  totalCountries?: number
}

// `trending-data.json`: `trending.all[]` rows keyed `{singular}-{name}` (skill-frontend-design), plus globalStats
export function parseTrending(text: string, max = 6): { rows: Trending[]; stats: GlobalStats } {
  const data: unknown = JSON.parse(text)
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const stats: GlobalStats = {}
  const gs = (d.globalStats && typeof d.globalStats === 'object' ? d.globalStats : {}) as Record<string, unknown>
  for (const k of ['totalComponents', 'totalDownloads', 'weeklyDownloads', 'totalCountries'] as const) {
    if (typeof gs[k] === 'number') stats[k] = gs[k] as number
  }
  const trending = (d.trending && typeof d.trending === 'object' ? d.trending : {}) as Record<string, unknown>
  const all = Array.isArray(trending.all) ? trending.all : []
  const rows: Trending[] = []
  for (const row of all) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.name !== 'string') continue
    const prefix = r.id.slice(0, r.id.length - r.name.length - 1)
    const type = TYPES.find(t => t.flag === `--${prefix}`)
    if (!type) continue
    rows.push({
      type,
      name: r.name,
      category: typeof r.category === 'string' ? r.category : '',
      downloadsWeek: typeof r.downloadsWeek === 'number' ? r.downloadsWeek : 0,
    })
    if (rows.length >= max) break
  }
  return { rows, stats }
}

// The catalog keeps some descriptions as the quoted frontmatter string they came from:
// literal `\n`, escaped quotes, and an <example> block the model reads but a list does not.
export function cleanDescription(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  let s = raw.trim()
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1)
  s = s.replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  const example = s.search(/<example>|\bExamples?:/i)
  if (example > 0) s = s.slice(0, example)
  s = s.replace(/\s+/g, ' ').trim()
  // a lead-in left dangling by the cut ("... integration. Specifically:") ends at its last full sentence
  if (s.endsWith(':')) {
    const lastStop = s.lastIndexOf('. ')
    s = lastStop > 0 ? s.slice(0, lastStop + 1) : s.slice(0, -1)
  }
  return s
}

// One `components/{type}.json` body: an array of components; a bad row is skipped, a bad body throws.
export function parseItems(text: string): Item[] {
  const data: unknown = JSON.parse(text)
  const rows = Array.isArray(data) ? data : []
  const items: Item[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (typeof r.name !== 'string' || !r.name) continue
    items.push({
      name: r.name,
      path: typeof r.path === 'string' ? r.path : undefined,
      category: typeof r.category === 'string' ? r.category : '',
      description: cleanDescription(r.description),
      downloads: typeof r.downloads === 'number' ? r.downloads : 0,
      installCommand: typeof r.installCommand === 'string' ? r.installCommand : undefined,
    })
  }
  return items
}

// `counts.json`: `{ agents: 422, ... }`
export function parseCounts(text: string): Record<string, number> {
  const data: unknown = JSON.parse(text)
  const out: Record<string, number> = {}
  if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) if (typeof v === 'number') out[k] = v
  }
  return out
}

// Every word of the query must appear in the name, category or description; no query keeps all.
export function filterItems(items: readonly Item[], query: string): Item[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...items]
  return items.filter(it => {
    const hay = `${it.name} ${it.category} ${it.description}`.toLowerCase()
    return words.every(w => hay.includes(w))
  })
}

export function sortByDownloads(items: readonly Item[]): Item[] {
  return [...items].sort((a, b) => b.downloads - a.downloads || a.name.localeCompare(b.name))
}

export function pageOf<T>(items: readonly T[], page: number, size: number): { slice: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / Math.max(1, size)))
  const p = Math.min(Math.max(0, page), pages - 1)
  return { slice: items.slice(p * size, p * size + size), page: p, pages }
}

// `category/name.md` -> `category/name`, what the CLI flag and the site's URL take
export function cleanPath(item: Item): string {
  return item.path?.replace(/\.(md|json)$/, '') ?? item.name
}

export function installCommandFor(item: Item, type: TypeInfo): string {
  if (item.installCommand) return item.installCommand
  return `npx claude-code-templates@latest ${type.flag} ${cleanPath(item)}`
}

// The argv `$.process.run` takes for the install: no shell, so the command is never a string
export function installArgv(item: Item, type: TypeInfo): string[] {
  const argv = installCommandFor(item, type).split(/\s+/).filter(Boolean)
  return argv.includes('--yes') || argv.includes('-y') ? argv : [...argv, '--yes']
}

export function webUrlFor(site: string, item: Item, type: TypeInfo): string {
  return `${site.replace(/\/+$/, '')}/component/${type.key}/${cleanPath(item)}`
}

export function truncate(text: string, width: number): string {
  if (width <= 0) return ''
  if (text.length <= width) return text
  return width <= 1 ? '…' : text.slice(0, width - 1) + '…'
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n)
}

export function padRight(text: string, width: number): string {
  return truncate(text, width).padEnd(width)
}
