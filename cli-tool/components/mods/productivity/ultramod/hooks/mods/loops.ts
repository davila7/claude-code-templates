import type { UltraApi } from '../core/api'
import { resolveSet, settingsFor } from '../core/sets'
import type { UltraMod } from '../core/mod'
import type { UltraModSettings } from '../../types/index'
import type { EventResult } from 'claude-code'

function str(e: { [field: string]: unknown }, key: string): string {
  const value = e[key]
  return typeof value === 'string' ? value : ''
}

async function modSettings($: UltraApi): Promise<UltraModSettings> {
  try {
    return await settingsFor($, 'loops')
  } catch {
    return resolveSet(undefined).mods.loops
  }
}

const BASH_NUDGE = 'This exact command has now failed 3 times with the same error. Stop retrying it. Read the error, check your assumptions, or ask the user.'
const EDIT_NUDGE = 'old_string was not found twice in a row in this file. Read the file again before editing.'

// Module state: counts reset when the module reloads, which is a fresh
// session environment anyway. Nothing here is drawn, so $.state is not needed.
// Both are bounded: the oldest streak is forgotten once MAX_STREAKS are tracked.
const failures = new Map<string, number>()
const nudged = new Set<string>()
const MAX_STREAKS = 200

function count(key: string): number {
  const next = (failures.get(key) ?? 0) + 1
  // Re-inserting keeps the Map ordered by last failure.
  failures.delete(key)
  failures.set(key, next)
  while (failures.size > MAX_STREAKS) {
    const oldest = failures.keys().next().value
    if (oldest === undefined) break
    failures.delete(oldest)
    nudged.delete(oldest)
  }
  return next
}

function forget(key: string): void {
  failures.delete(key)
  nudged.delete(key)
}

// Whitespace runs collapse to one space outside quotes only: inside them the
// spaces are part of an argument, so 'a  b' and 'a b' are different commands.
function normalizeCommand(command: string): string {
  let out = ''
  let quote = ''
  let space = false
  for (let i = 0; i < command.length; i++) {
    const ch = command[i] ?? ''
    if (quote === '') {
      if (/\s/.test(ch)) {
        space = true
        continue
      }
      if (space && out !== '') out += ' '
      space = false
      if (ch === '\\') {
        out += ch + (command[i + 1] ?? '')
        i++
        continue
      }
      if (ch === "'" || ch === '"') quote = ch
    } else if (ch === '\\' && quote === '"') {
      out += ch + (command[i + 1] ?? '')
      i++
      continue
    } else if (ch === quote) quote = ''
    out += ch
  }
  return out
}

// Test seam: module state otherwise lives as long as the session.
export function resetLoops(): void {
  failures.clear()
  nudged.clear()
}

// The tool's own exit code line sits above the real error, and every failure
// carries one, so counting it would merge unrelated errors into one signature.
function isExitHeader(line: string): boolean {
  return /^(?:command failed with )?exit code \d+/i.test(line)
}

function firstErrorLine(text: string | undefined): string {
  for (const line of (text ?? '').split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || isExitHeader(trimmed)) continue
    return trimmed
  }
  return ''
}

function missedOldString(text: string | undefined): boolean {
  const message = text ?? ''
  return /old_string/i.test(message) && /(not found|no match|does not exist|couldn't find|cannot find)/i.test(message)
}

export const loops: UltraMod = {
  id: 'loops',
  hooks: {
    'tool.call': [{
      when: e => e.tool === 'Bash' || e.tool === 'Edit',
      run: async ($, e, next) => {
        const result = await next(e)
        try {
          const settings = await modSettings($)
          const nudge = settings.mode !== 'warn'
          if (e.tool === 'Bash') {
            const key = `bash:${normalizeCommand(str(e, 'command'))}`
            if (result.isError) {
              const line = firstErrorLine(result.text)
              // With no diagnostic line, unrelated failures would pass for one error.
              if (line === '') return result
              const signature = `${key}|${line}`
              if (count(signature) >= 3 && !nudged.has(signature)) {
                nudged.add(signature)
                try {
                  $.ui.toast('Bash failed 3 times with the same error')
                } catch {
                  // A toast must never break the result.
                }
                if (nudge) return withContext(result, BASH_NUDGE)
              }
            } else {
              for (const signature of [...failures.keys()]) {
                if (signature.startsWith(`${key}|`)) forget(signature)
              }
            }
          } else if (e.tool === 'Edit') {
            const key = `edit:${e.file_path}`
            if (result.isError && missedOldString(result.text)) {
              if (count(key) >= 2 && !nudged.has(key)) {
                nudged.add(key)
                try {
                  $.ui.toast('Edit missed old_string twice on one file')
                } catch {
                  // A toast must never break the result.
                }
                if (nudge) return withContext(result, EDIT_NUDGE)
              }
            } else {
              // A success or an unrelated failure ends the streak of misses.
              forget(key)
            }
          }
        } catch {
          // An observer must never lose the tool's result.
        }
        return result
      },
    }],
  },
}

function withContext(result: EventResult<'tool.call'>, line: string): EventResult<'tool.call'> {
  const context = [...(result.context ?? []), line]
  return { ...result, context } as unknown as EventResult<'tool.call'>
}
