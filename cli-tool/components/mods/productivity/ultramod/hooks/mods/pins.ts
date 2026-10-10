import type { UltraApi } from '../core/api'
import type { UltraMod } from '../core/mod'

const TITLE = 'Pinned rules from the user. Follow them in every reply:'

// Cache by mtime so every prompt.compose only stats the files.
const cache = new Map<string, { mtimeMs: number; text: string }>()

// The project pin file is repository content: a clone can ship one, so its lines
// are data until the user approves that exact text in this session. The user's
// own file under the home directory needs no approval.
const approved = new Map<string, string>()
const announced = new Set<string>()

// Test seam: the cache otherwise lives as long as the session.
export function resetPinsCache(): void {
  cache.clear()
  approved.clear()
  announced.clear()
}

async function loadPins(api: UltraApi, path: string): Promise<string> {
  try {
    const stat = await api.fs.stat(path)
    const hit = cache.get(path)
    if (hit && hit.mtimeMs === stat.mtimeMs) return hit.text
    const text = await api.fs.read(path).catch(() => '')
    cache.set(path, { mtimeMs: stat.mtimeMs, text })
    return text
  } catch {
    return ''
  }
}

// Removes <!-- ... --> blocks, across lines too; an unterminated one runs to the end.
function stripComments(text: string): string {
  let out = ''
  let from = 0
  for (;;) {
    const open = text.indexOf('<!--', from)
    if (open === -1) return out + text.slice(from)
    out += text.slice(from, open)
    const close = text.indexOf('-->', open + 4)
    if (close === -1) return out
    from = close + 3
  }
}

// Bullet or plain non-empty lines; headings and comments are skipped.
function pinLines(text: string): string[] {
  const out: string[] = []
  for (const raw of stripComments(text).split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('+ ')) {
      const stripped = line.slice(2).trim()
      if (stripped !== '') out.push(stripped)
      continue
    }
    out.push(line)
  }
  return out
}

type PinFiles = { project: string; user: string | null }

// The project pin file, plus the user one when a home is known and it is not
// the same file. Without a home the old code fell back to the project root and
// every pin showed up twice.
async function pinPaths(api: UltraApi): Promise<PinFiles> {
  let root = ''
  let home = ''
  try {
    root = await api.session.root()
  } catch {
    root = ''
  }
  try {
    home = (await api.env.get('HOME')) ?? ''
    if (home === '') home = (await api.env.get('USERPROFILE')) ?? ''
  } catch {
    home = ''
  }
  return {
    project: `${root}/.claude/pins.md`,
    user: home === '' || home === root ? null : `${home}/.claude/pins.md`,
  }
}

function sectionText(lines: string[], truncated: boolean): string {
  const body = lines.map(line => `- ${line}`).join('\n')
  const note = truncated ? '\n- (the list was truncated; edit pins.md for the rest)' : ''
  let text = `${TITLE}\n${body}${note}`
  if (text.length > 3000) text = `${text.slice(0, 2975)}\n(pinned rules truncated)`
  return text
}

// One notice per file content: the pins are not applied, and how to apply them.
async function announce(api: UltraApi, path: string, text: string, count: number): Promise<void> {
  const key = `${path}\n${text}`
  if (announced.has(key)) return
  announced.add(key)
  try {
    api.ui.toast(`Ultra Mod: ${path} has ${count} pinned ${count === 1 ? 'line' : 'lines'} that are not applied. Run /ultra pins to read them and /ultra pins approve to apply them.`)
  } catch {
    // A notice that cannot show does not stop the prompt.
  }
}

export const pins: UltraMod = {
  id: 'pins',
  compose: {
    run: async api => {
      try {
        const files = await pinPaths(api)
        const all: string[] = []
        const projectText = await loadPins(api, files.project)
        const projectLines = pinLines(projectText)
        if (projectLines.length > 0) {
          if (approved.get(files.project) === projectText) all.push(...projectLines)
          else await announce(api, files.project, projectText, projectLines.length)
        }
        if (files.user !== null) all.push(...pinLines(await loadPins(api, files.user)))
        if (all.length === 0) return null
        const truncated = all.length > 30
        const lines = all.slice(0, 30)
        return { id: 'ultramod:pins', text: sectionText(lines, truncated), scope: 'session' as const }
      } catch {
        return null
      }
    },
  },
  commands: {
    pin: async (api, args) => {
      const text = args.trim()
      if (text === '') return { text: 'Usage: /ultra pin <text>' }
      const root = await api.session.root().catch(() => '')
      // Without the project root the pin would land where /ultra pins and the prompt never look.
      if (root === '') return { text: 'Could not find the project root, so nothing was pinned.' }
      const path = `${root}/.claude/pins.md`
      // Only a missing file counts as empty: a read that fails on a file that is there must not end in an overwrite.
      let current = ''
      try {
        if (await api.fs.exists(path)) current = await api.fs.read(path)
      } catch {
        return { text: `Could not read ${path}, so nothing was pinned.` }
      }
      const prefix = current === '' || current.endsWith('\n') ? current : `${current}\n`
      const written = `${prefix}- ${text}\n`
      await api.fs.writePins(root, written)
      // A file the user starts, or one they already approved, stays approved with the line they add.
      // Lines a repository shipped stay data until the user approves them.
      if (current.trim() === '' || approved.get(path) === current) {
        approved.set(path, written)
        cache.delete(path)
        return { text: `Pinned: ${text}` }
      }
      return { text: `Pinned: ${text}. The file also holds lines you have not approved, so none of its lines apply yet. Run /ultra pins to read them, then /ultra pins approve.` }
    },
    pins: async (api, args) => {
      const files = await pinPaths(api)
      const projectText = await loadPins(api, files.project)
      const projectLines = pinLines(projectText)
      if (args.trim() === 'approve') {
        if (projectLines.length === 0) return { text: 'No project pins to approve.' }
        approved.set(files.project, projectText)
        return { text: `Approved ${projectLines.length} project pin${projectLines.length === 1 ? '' : 's'} from ${files.project}. They apply from the next message, until the file changes.` }
      }
      const sections: string[] = []
      if (projectLines.length > 0) {
        const applied = approved.get(files.project) === projectText
        const list = projectLines.map(line => `- ${line}`).join('\n')
        sections.push(applied
          ? `project (${files.project}):\n${list}`
          : `project (${files.project}), not applied:\n${list}\nThese lines come from the repository. Read them, then run /ultra pins approve to apply them.`)
      }
      if (files.user !== null) {
        const userLines = pinLines(await loadPins(api, files.user))
        if (userLines.length > 0) sections.push(`user (${files.user}):\n${userLines.map(line => `- ${line}`).join('\n')}`)
      }
      if (sections.length === 0) return { text: 'No pinned rules. Add one with /ultra pin <text>.' }
      return { text: sections.join('\n') }
    },
  },
}
