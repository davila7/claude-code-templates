import type { UltraApi } from '../core/api'
import type { Args, Frozen } from 'claude-code'
import { atom, read, update } from 'claude-code'
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

// What reading a test file gave: its text, nothing because the file does not
// exist, or unreadable (over the read limit, withheld, or the check failed).
// An unreadable file is not an untouched one.
type FileState = { kind: 'text'; text: string } | { kind: 'missing' } | { kind: 'unreadable' }

async function readFile($: UltraApi, path: string): Promise<FileState> {
  try {
    return { kind: 'text', text: await $.fs.read(path) }
  } catch {
    // A failed existence check is taken as "exists": the safe side.
    let exists = true
    try {
      exists = await $.fs.exists(path)
    } catch {
      exists = true
    }
    return exists ? { kind: 'unreadable' } : { kind: 'missing' }
  }
}

// The file or command a call touches, for a check that failed.
function checkedPath(e: Frozen<Args<'tool.call'>>): string {
  const input = e as Record<string, unknown>
  if (typeof input.file_path === 'string') return input.file_path
  if (typeof input.notebook_path === 'string') return input.notebook_path
  return 'this call'
}

const unreadable = (path: string) => `${path} could not be checked`

// The text of one notebook cell, found by id or by position; '' when the
// notebook or the cell cannot be read.
function notebookCell(raw: string, cellId: unknown, cellNumber: unknown): string {
  try {
    const cells = (JSON.parse(raw) as { cells?: unknown }).cells
    if (!Array.isArray(cells)) return ''
    let cell: unknown
    if (typeof cellId === 'string') cell = cells.find(one => typeof one === 'object' && one !== null && (one as { id?: unknown }).id === cellId)
    else if (typeof cellNumber === 'number') cell = cells[cellNumber]
    const source = typeof cell === 'object' && cell !== null ? (cell as { source?: unknown }).source : undefined
    if (typeof source === 'string') return source
    if (Array.isArray(source)) return source.filter(line => typeof line === 'string').join('')
    return ''
  } catch {
    return ''
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
  if (tool === 'NotebookEdit' && input.edit_mode === 'delete') return 'deletes a notebook cell'
  if (tool === 'Write') {
    const content = typeof input.content === 'string' ? input.content : ''
    const held = await readFile($, path)
    if (held.kind === 'unreadable') return unreadable(path)
    // A new file has nothing to lose, but a skip or focus marker in it still counts.
    const before = held.kind === 'text' ? held.text : ''
    if (before.trim() !== '' && content.trim() === '') return 'empties a test file'
    return markersAndDrops(path, before, content)
  }
  if (tool !== 'Edit' && tool !== 'MultiEdit' && tool !== 'NotebookEdit') return null
  const held = await readFile($, path)
  if (held.kind === 'missing') return null
  if (held.kind === 'unreadable') return unreadable(path)
  const before = held.text
  if (tool === 'Edit') {
    const after = applyEdit(before, String(input.old_string ?? ''), String(input.new_string ?? ''), input.replace_all === true)
    return markersAndDrops(path, before, after)
  }
  if (tool === 'MultiEdit') {
    const edits = Array.isArray(input.edits) ? input.edits : []
    let after = before
    for (const edit of edits) {
      if (typeof edit !== 'object' || edit === null) continue
      const step = edit as Record<string, unknown>
      after = applyEdit(after, String(step.old_string ?? ''), String(step.new_string ?? ''), step.replace_all === true)
    }
    return markersAndDrops(path, before, after)
  }
  // NotebookEdit: compare the cell being replaced with its new source. An
  // inserted cell has no old text.
  const source = typeof input.new_source === 'string' ? input.new_source : ''
  const cell = input.edit_mode === 'insert' ? '' : notebookCell(before, input.cell_id, input.cell_number)
  return markersAndDrops(path, cell, source)
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

// Call ids the person allowed in this mod's dialog. The engine asks about the
// same call right after, and tool.check answers that ask with allow. The key
// is shared with guard, whose tool.check honors the same ids.
const approved = atom({ plugin: 'ultramod', key: 'guard-approved' } as const, [] as string[])

// Bounded: one id per approved call, oldest dropped past the limit.
const KEEP_APPROVED = 32

async function rememberApproved($: UltraApi, id: string): Promise<void> {
  await update($, approved, ids => ids.includes(id) ? ids : [...ids, id].slice(-KEEP_APPROVED))
}

export const tests: UltraMod = {
  id: 'tests',
  hooks: {
    'tool.call': [{
      gating: true,
      when: e => VIOLATION_TOOLS.includes(String(e.tool)),
      run: async ($, e, next) => {
        const settings = await modSettings($)
        let reason: string
        try {
          const found = await violation($, e)
          if (found === null) return next(e)
          reason = found
        } catch {
          // A check that cannot finish is not a clean check.
          reason = `${checkedPath(e)} could not be checked`
        }
        if (settings.mode === 'deny') {
          // Unattended runs use deny; the notification is the only voice they have.
          needsYou($, `tests: ${reason}`)
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
        // Recorded before next: the engine raises tool.check inside it.
        if (e.tool_use_id !== undefined) {
          try {
            await rememberApproved($, e.tool_use_id)
          } catch {
            // The edit is allowed; a lost id only costs a second native dialog.
          }
        }
        return next(e)
      },
    }],
    'tool.check': [{
      run: async ($, e: Frozen<Args<'tool.check'>>, next) => {
        const verdict = await next(e)
        const id = e.tool_use_id
        if (verdict.decision !== 'ask' || id === undefined) return verdict
        const ids = await read($, approved)
        return ids.includes(id) ? { decision: 'allow' } : verdict
      },
    }],
  },
}
