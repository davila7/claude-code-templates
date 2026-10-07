import type { UltraApi } from '../core/api'
import type { Args, Frozen } from 'claude-code'
import { atom, read, update } from 'claude-code'
import { resolveSet, settingsFor } from '../core/sets'
import type { UltraMod } from '../core/mod'
import type { UltraModSettings } from '../../types/index'
import { bashReadsSecret, isEnvDump, isSecretPath, redactSecrets } from '../lib/secrets'
import type { RedactionResult } from '../lib/secrets'

const allow = atom({ plugin: 'ultramod', key: 'allow' } as const, { risks: [], paths: [] })

async function modSettings($: UltraApi): Promise<UltraModSettings> {
  try {
    return await settingsFor($, 'secrets')
  } catch {
    return resolveSet(undefined).mods.secrets
  }
}

const PATH_TOOLS = ['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Grep', 'Glob']

// Rows a tool produced, the only ones worth scanning for a leaked value.
const REDACT_DOORS: readonly string[] = ['tool-result', 'tool-message']

// Path arguments of the file tools, however this build spells them.
function pathsOf(e: Frozen<Args<'tool.call'>>): string[] {
  const tool = String(e.tool)
  const input = e as Record<string, unknown>
  const out: string[] = []
  const push = (value: unknown) => {
    if (typeof value === 'string' && value !== '') out.push(value)
  }
  if (tool === 'Read' || tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit') push(input.file_path)
  else if (tool === 'NotebookEdit') push(input.notebook_path)
  else if (tool === 'Grep' || tool === 'Glob') {
    const given = input.path
    if (typeof given === 'string') push(given)
    else if (Array.isArray(given)) for (const one of given) push(one)
  }
  return out
}

async function allowedPaths($: UltraApi): Promise<string[]> {
  try {
    return (await read($, allow)).paths
  } catch {
    return []
  }
}

function commandOf(e: Frozen<Args<'tool.call'>>): string {
  const value = (e as Record<string, unknown>).command
  return typeof value === 'string' ? value : ''
}

function looksLikePath(value: string): boolean {
  if (value === '' || value.includes(' ')) return false
  if (value.startsWith('.') || value.startsWith('~') || value.startsWith('/')) return true
  if (value.includes('/')) return true
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(value)) return true
  return isSecretPath(value)
}

function mergeHits(total: { kind: string; count: number }[], more: { kind: string; count: number }[]): void {
  for (const hit of more) {
    const existing = total.find(one => one.kind === hit.kind)
    if (existing) existing.count += hit.count
    else total.push({ kind: hit.kind, count: hit.count })
  }
}

type TextLike = { type: 'text'; text: string }

function isTextBlock(block: unknown): block is TextLike {
  return typeof block === 'object' && block !== null && (block as { type?: unknown }).type === 'text'
    && typeof (block as { text?: unknown }).text === 'string'
}

type ToolResultBlock = { type: 'tool_result'; content: unknown }

function isToolResultBlock(block: unknown): block is ToolResultBlock {
  return typeof block === 'object' && block !== null && (block as { type?: unknown }).type === 'tool_result'
}

function redactValue(text: string, total: { kind: string; count: number }[]): { text: string; changed: boolean } {
  const result: RedactionResult = redactSecrets(text)
  if (result.text === text) return { text, changed: false }
  mergeHits(total, result.hits)
  return { text: result.text, changed: true }
}

export const secrets: UltraMod = {
  id: 'secrets',
  hooks: {
    'tool.call': [{
      gating: true,
      when: e => PATH_TOOLS.includes(String(e.tool)) || e.tool === 'Bash',
      run: async ($, e, next) => {
        const settings = await modSettings($)
        const paths = await allowedPaths($)
        if (e.tool === 'Bash') {
          const command = commandOf(e)
          if (settings.mode === 'strict' && isEnvDump(command)) {
            return { deny: 'This prints the whole environment, which can contain secrets. Ask the user for the specific value it needs.' }
          }
          const secret = bashReadsSecret(command)
          if (secret !== null && !paths.some(allowed => allowed.toLowerCase() === secret.toLowerCase())) {
            return { deny: `This would print the secret file ${secret}. Ask the user for the value it needs, or read .env.example instead, or have the user run /ultra allow ${secret}.` }
          }
          return next(e)
        }
        for (const path of pathsOf(e)) {
          if (!isSecretPath(path, paths)) continue
          return { deny: `${path} is a secret file. Ask the user for the value it needs, or read .env.example instead, or have the user run /ultra allow ${path}.` }
        }
        return next(e)
      },
    }],
    'session.append': [{
      // Only the rows a tool produced can carry a leaked value. The person's
      // own prompt and the reply are stored as typed.
      when: e => REDACT_DOORS.includes(e.door) && Array.isArray(e.message.content),
      run: async ($, e, next) => {
        const total: { kind: string; count: number }[] = []
        let changed = false
        const content = e.message.content.map(block => {
          if (isTextBlock(block)) {
            const redacted = redactValue(block.text, total)
            if (!redacted.changed) return block
            changed = true
            return { ...block, text: redacted.text }
          }
          if (isToolResultBlock(block)) {
            const inner = block.content
            if (typeof inner === 'string') {
              const redacted = redactValue(inner, total)
              if (!redacted.changed) return block
              changed = true
              return { ...block, content: redacted.text }
            }
            if (Array.isArray(inner)) {
              let innerChanged = false
              const blocks = inner.map(piece => {
                if (isTextBlock(piece)) {
                  const redacted = redactValue(piece.text, total)
                  if (!redacted.changed) return piece
                  innerChanged = true
                  return { ...piece, text: redacted.text }
                }
                return piece
              })
              if (!innerChanged) return block
              changed = true
              return { ...block, content: blocks }
            }
          }
          return block
        })
        if (!changed) return next(e)
        try {
          $.ui.log(`secrets: redacted ${total.map(hit => `${hit.count} ${hit.kind}`).join(', ')}`)
        } catch {
          // A lost log line must not lose the row.
        }
        return next({ ...e, message: { ...e.message, content } })
      },
    }],
  },
  commands: {
    allow: async ($, args) => {
      const path = args.trim()
      if (!looksLikePath(path)) return null
      await update($, allow, current => ({ ...current, paths: [...current.paths, path] }))
      return { text: `Secrets: ${path} is allowed for this session.` }
    },
  },
}
