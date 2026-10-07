import type { UltraApi } from '../core/api'
import type { Args, Frozen } from 'claude-code'
import { resolveSet, settingsFor } from '../core/sets'
import type { UltraMod } from '../core/mod'
import type { UltraModSettings } from '../../types/index'
import { isAllowedDocPath, isDocFile } from '../lib/tidy'

async function modSettings($: UltraApi): Promise<UltraModSettings> {
  try {
    return await settingsFor($, 'tidy')
  } catch {
    return resolveSet(undefined).mods.tidy
  }
}

const REFUSE_TEXT = 'Put this summary in your reply instead of a new file unless the user asked for a file.'

async function relativeTo($: UltraApi, path: string): Promise<string> {
  if (!path.startsWith('/')) return path.replace(/^\.\//, '')
  try {
    const root = await $.session.root()
    if (root !== '' && path.startsWith(`${root}/`)) return path.slice(root.length + 1)
  } catch {
    // No root: treat the path as relative already.
  }
  return path
}

export const tidy: UltraMod = {
  id: 'tidy',
  hooks: {
    'tool.call': [{
      gating: true,
      when: e => e.tool === 'Write',
      run: async ($, e, next) => {
        if (e.tool !== 'Write') return next(e)
        const settings = await modSettings($)
        const rawPath = (e as Record<string, unknown>).file_path
        const path = typeof rawPath === 'string' ? rawPath : ''
        if (!isDocFile(path)) return next(e)
        let exists = false
        try {
          exists = await $.fs.exists(path)
        } catch {
          exists = false
        }
        if (exists) return next(e)
        const rel = await relativeTo($, path)
        if (isAllowedDocPath(rel)) return next(e)
        if (settings.mode === 'deny') {
          return { deny: `Writing ${rel} would add a new documentation file. ${REFUSE_TEXT}` }
        }
        let answer
        try {
          answer = await $.ui.ask(`Ultra Mod: create the new documentation file ${rel}?`, { header: 'Ultra Mod', options: ['Allow', 'Refuse'] })
        } catch {
          answer = 'Refuse'
        }
        if (answer !== 'Allow') {
          return { deny: `The new documentation file ${rel} was refused. ${REFUSE_TEXT}` }
        }
        return next(e)
      },
    }],
  },
}
