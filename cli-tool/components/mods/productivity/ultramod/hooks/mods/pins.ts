import type { UltraApi } from '../core/api'
import { resolveSet, settingsFor } from '../core/sets'
import type { UltraMod } from '../core/mod'
import type { UltraModSettings } from '../../types/index'

const TITLE = 'Pinned rules from the user. Follow them in every reply:'

async function modSettings($: UltraApi): Promise<UltraModSettings> {
  try {
    return await settingsFor($, 'pins')
  } catch {
    return resolveSet(undefined).mods.pins
  }
}

// Cache by mtime so every prompt.compose only stats the files.
const cache = new Map<string, { mtimeMs: number; text: string }>()

// Test seam: the cache otherwise lives as long as the session.
export function resetPinsCache(): void {
  cache.clear()
}

async function loadPins($: UltraApi, path: string): Promise<string> {
  try {
    const stat = await $.fs.stat(path)
    const hit = cache.get(path)
    if (hit && hit.mtimeMs === stat.mtimeMs) return hit.text
    const text = await $.fs.read(path).catch(() => '')
    cache.set(path, { mtimeMs: stat.mtimeMs, text })
    return text
  } catch {
    return ''
  }
}

// Bullet or plain non-empty lines; headings and comments are skipped.
function pinLines(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#') || line.startsWith('<!--')) continue
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
async function pinPaths($: UltraApi): Promise<PinFiles> {
  let root = ''
  let home = ''
  try {
    root = await $.session.root()
  } catch {
    root = ''
  }
  try {
    home = (await $.env.get('HOME')) ?? ''
    if (home === '') home = (await $.env.get('USERPROFILE')) ?? ''
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

export const pins: UltraMod = {
  id: 'pins',
  hooks: {
    'prompt.compose': [{
      run: async ($, e, next) => {
        const composed = await next(e)
        try {
          await modSettings($)
          const files = await pinPaths($)
          const all = pinLines(await loadPins($, files.project))
          if (files.user !== null) all.push(...pinLines(await loadPins($, files.user)))
          if (all.length === 0) return composed
          const truncated = all.length > 30
          const lines = all.slice(0, 30)
          return { sections: [...composed.sections, { id: 'ultramod:pins', text: sectionText(lines, truncated), scope: 'session' as const }] }
        } catch {
          return composed
        }
      },
    }],
  },
  commands: {
    pin: async ($, args) => {
      const text = args.trim()
      if (text === '') return { text: 'Usage: /ultra pin <text>' }
      const root = await $.session.root().catch(() => '')
      const path = `${root}/.claude/pins.md`
      const current = await $.fs.read(path).catch(() => '')
      const prefix = current === '' || current.endsWith('\n') ? current : `${current}\n`
      await $.fs.write(path, `${prefix}- ${text}\n`)
      return { text: `Pinned: ${text}` }
    },
    pins: async $ => {
      const files = await pinPaths($)
      const sections: string[] = []
      const projectLines = pinLines(await loadPins($, files.project))
      if (projectLines.length > 0) sections.push(`project (${files.project}):\n${projectLines.map(line => `- ${line}`).join('\n')}`)
      if (files.user !== null) {
        const userLines = pinLines(await loadPins($, files.user))
        if (userLines.length > 0) sections.push(`user (${files.user}):\n${userLines.map(line => `- ${line}`).join('\n')}`)
      }
      if (sections.length === 0) return { text: 'No pinned rules. Add one with /ultra pin <text>.' }
      return { text: sections.join('\n') }
    },
  },
}
