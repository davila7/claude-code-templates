import type { UltraApi } from '../core/api'
import { resolveSet, settingsFor } from '../core/sets'
import type { UltraMod } from '../core/mod'
import type { UltraModSettings } from '../../types/index'
import { needsYou } from '../core/notifier'
import { isAllowedDocPath, isDocFile } from '../lib/tidy'

async function modSettings(api: UltraApi): Promise<UltraModSettings> {
  try {
    return await settingsFor(api, 'tidy')
  } catch {
    return resolveSet(undefined).mods.tidy
  }
}

const REFUSE_TEXT = 'Put this summary in your reply instead of a new file unless the user asked for a file.'

async function relativeTo(api: UltraApi, path: string): Promise<string> {
  if (!path.startsWith('/')) return path.replace(/^\.\//, '')
  try {
    const root = await api.session.root()
    if (root !== '' && path.startsWith(`${root}/`)) return path.slice(root.length + 1)
  } catch {
    // No root: treat the path as relative already.
  }
  return path
}

export const tidy: UltraMod = {
  id: 'tidy',
  check: {
    when: e => e.tool === 'Write',
    run: async (api, e) => {
      if (e.tool !== 'Write') return null
      const settings = await modSettings(api)
      const rawPath = (e as Record<string, unknown>).file_path
      const path = typeof rawPath === 'string' ? rawPath : ''
      if (!isDocFile(path)) return null
      let exists = false
      try {
        exists = await api.fs.exists(path)
      } catch {
        exists = false
      }
      if (exists) return null
      const rel = await relativeTo(api, path)
      if (isAllowedDocPath(rel)) return null
      if (settings.mode === 'deny') {
        return `Writing ${rel} would add a new documentation file. ${REFUSE_TEXT}`
      }
      needsYou(api, `tidy: create ${rel}?`)
      let answer
      try {
        answer = await api.ui.ask(`Ultra Mod: create the new documentation file ${rel}?`, { header: 'Ultra Mod', options: ['Allow', 'Refuse'] })
      } catch {
        answer = 'Refuse'
      }
      if (answer !== 'Allow') {
        return `The new documentation file ${rel} was refused. ${REFUSE_TEXT}`
      }
      return null
    },
  },
}
