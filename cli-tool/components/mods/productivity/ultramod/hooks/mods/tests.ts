import type { UltraApi } from '../core/api'
import type { Args, Frozen } from 'claude-code'
import { resolveSet, settingsFor } from '../core/sets'
import type { UltraMod } from '../core/mod'
import type { UltraModSettings } from '../../types/index'
import { needsYou } from '../core/notifier'
import { addedMarkers, assertionDrop, bashDeletesTests, isTestPath } from '../lib/testguard'

async function modSettings($: UltraApi): Promise<UltraModSettings> {
  try {
    return await settingsFor($, 'tests')
  } catch {
    return resolveSet(undefined).mods.tests
  }
}

const REFUSE_TEXT = 'Fix the code under test; do not skip or weaken tests unless the user asks.'

const VIOLATION_TOOLS = ['Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'Bash']

function commandOf(e: Frozen<Args<'tool.call'>>): string {
  const value = (e as Record<string, unknown>).command
  return typeof value === 'string' ? value : ''
}

function applyEdit(before: string, oldString: string, newString: string, replaceAll?: boolean): string {
  if (oldString === '') return before
  if (replaceAll) return before.split(oldString).join(newString)
  const at = before.indexOf(oldString)
  if (at === -1) return before
  return before.slice(0, at) + newString + before.slice(at + oldString.length)
}

async function readFile($: UltraApi, path: string): Promise<string | null> {
  try {
    return await $.fs.read(path)
  } catch {
    return null
  }
}

// What is risky about this call, or null when it is a normal edit.
async function violation($: UltraApi, e: Frozen<Args<'tool.call'>>): Promise<string | null> {
  const tool = String(e.tool)
  const input = e as Record<string, unknown>
  if (e.tool === 'Bash') {
    const deleted = bashDeletesTests(commandOf(e))
    if (deleted.length > 0) return `deletes tests (${deleted.join(', ')})`
    return null
  }
  const path = typeof input.file_path === 'string' ? input.file_path : typeof input.notebook_path === 'string' ? input.notebook_path : ''
  if (path === '' || !isTestPath(path)) return null
  if (tool === 'Edit') {
    const before = await readFile($, path)
    if (before === null) return null
    const after = applyEdit(before, String(input.old_string ?? ''), String(input.new_string ?? ''), input.replace_all === true)
    return markersAndDrops(path, before, after)
  }
  if (tool === 'MultiEdit') {
    const before = await readFile($, path)
    if (before === null) return null
    const edits = Array.isArray(input.edits) ? input.edits : []
    let after = before
    for (const edit of edits) {
      if (typeof edit !== 'object' || edit === null) continue
      const step = edit as Record<string, unknown>
      after = applyEdit(after, String(step.old_string ?? ''), String(step.new_string ?? ''), step.replace_all === true)
    }
    return markersAndDrops(path, before, after)
  }
  if (tool === 'Write') {
    const content = typeof input.content === 'string' ? input.content : ''
    let exists = true
    try {
      exists = await $.fs.exists(path)
    } catch {
      exists = true
    }
    if (!exists) return null
    const before = await readFile($, path)
    if (before === null) return null
    if (before.trim() !== '' && content.trim() === '') return 'empties a test file'
    return markersAndDrops(path, before, content)
  }
  if (tool === 'NotebookEdit') {
    const before = await readFile($, path)
    if (before === null) return null
    if (input.edit_mode === 'delete') return 'deletes a notebook cell'
    const source = typeof input.new_source === 'string' ? input.new_source : ''
    const markers = addedMarkers(before, `${before}\n${source}`)
    if (markers.length > 0) return `adds ${markers.join(', ')}`
    return null
  }
  return null
}

function markersAndDrops(path: string, before: string, after: string): string | null {
  const markers = addedMarkers(before, after)
  const dropped = assertionDrop(before, after)
  if (markers.length === 0 && dropped === 0) return null
  const reasons: string[] = []
  if (markers.length > 0) reasons.push(`adds ${markers.join(', ')}`)
  if (dropped > 0) reasons.push(`removes ${dropped} assertion${dropped === 1 ? '' : 's'}`)
  return `${path} ${reasons.join(' and ')}`
}

export const tests: UltraMod = {
  id: 'tests',
  hooks: {
    'tool.call': [{
      gating: true,
      when: e => VIOLATION_TOOLS.includes(String(e.tool)),
      run: async ($, e, next) => {
        const settings = await modSettings($)
        let reason: string | null = null
        try {
          reason = await violation($, e)
        } catch {
          reason = null
        }
        if (reason === null) return next(e)
        if (settings.mode === 'deny') {
          return { deny: `${reason}. ${REFUSE_TEXT}` }
        }
        // An away user has to hear the dialog before it can wait for them.
        needsYou($, `tests: ${reason}`)
        let answer
        try {
          answer = await $.ui.ask(`Ultra Mod: this edit ${reason}. Allow it?`, { header: 'Ultra Mod', options: ['Allow', 'Refuse'] })
        } catch {
          answer = 'Refuse'
        }
        if (answer !== 'Allow') {
          return { deny: `The edit was refused (${reason}). ${REFUSE_TEXT}` }
        }
        return next(e)
      },
    }],
  },
}
