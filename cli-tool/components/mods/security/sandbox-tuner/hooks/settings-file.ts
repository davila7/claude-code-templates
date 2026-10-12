// Parses, edits, and serializes the user settings file, formats and parses the record of its lock file, and checks the
// shape of a journal entry.

import type { SandboxTunerApplied, SandboxTunerSettingsKey } from '../types'
import { causeOf } from './diagnostics'
import { displayPath, normalHost, plainText } from './names'
import { isCount, isListOf, isPlainObject, isText } from './shapes'

export type FileInfo = { path: string; display: string; backup: string; backupDisplay: string; lock: string; lockDisplay: string }
export type ParsedSettings = { value: Record<string, unknown>; bom: string; trailingNewline: boolean; isCanonical: boolean }
export type Refusal =
  | { refusal: 'invalid-json'; message: string }
  | { refusal: 'wrong-type'; path: string; found: string; expected: string }
type AddResult = { value: Record<string, unknown>; created: string[] } | { isPresent: true } | Refusal
type RemoveResult = { value: Record<string, unknown> } | { isAbsent: true } | Refusal
type KeyPath = { parents: readonly string[]; leaf: string }
type Link = { holder: Record<string, unknown>; name: string; dotted: string }
type Walked = { node: Record<string, unknown>; links: Link[]; created: string[] }

const BOM = '\ufeff'
const KEY_PATHS: Readonly<Record<SandboxTunerSettingsKey, KeyPath>> = {
  'sandbox.network.allowedDomains': { parents: ['sandbox', 'network'], leaf: 'allowedDomains' },
  'sandbox.network.deniedDomains': { parents: ['sandbox', 'network'], leaf: 'deniedDomains' },
  'sandbox.filesystem.allowWrite': { parents: ['sandbox', 'filesystem'], leaf: 'allowWrite' },
}
const HOST_KEYS: ReadonlySet<SandboxTunerSettingsKey> = new Set(['sandbox.network.allowedDomains', 'sandbox.network.deniedDomains'])

/**
 * The paths of a settings file, its backup, and its lock file, each with the text that shows it: CLAUDE_CONFIG_DIR can
 * hold any character.
 */
export function fileInfo(path: string, home: string | undefined): FileInfo {
  const backup = `${path.slice(0, path.lastIndexOf('/'))}/backups/settings.json.sandbox-tuner.bak`
  const lock = `${path}.sandbox-tuner.lock`
  return { path, display: plainText(displayPath(path, home)), backup, backupDisplay: plainText(displayPath(backup, home)), lock, lockDisplay: plainText(displayPath(lock, home)) }
}

/** Who holds the lock of a settings file: the token of one press, and when it took the lock. */
export type LockRecord = { holder: string; since: number }

/** The text of a lock file: held by the press `holder` since `since`, or free since `since` when `holder` is null. */
export function lockText(holder: string | null, since: number): string {
  return `${JSON.stringify({ holder, since })}\n`
}

/**
 * What a lock file holds: its holder, `free` when the file is missing or free, or null when its text is no lock record,
 * such as an empty file that a write has not finished.
 */
export function readLock(text: string | null): LockRecord | 'free' | null {
  if (text === null) return 'free'
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  if (!isPlainObject(value) || !isCount(value.since)) return null
  if (value.holder === null) return 'free'
  return isText(value.holder) && value.holder !== '' ? { holder: value.holder, since: value.since } : null
}

function typeName(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  return typeof value === 'object' ? 'an object' : `a ${typeof value}`
}

function wrongType(path: string, value: unknown, expected: string): Refusal {
  return { refusal: 'wrong-type', path, found: typeName(value), expected }
}

/**
 * The JSON parser's reason without the text of the file, because settings can hold secrets in `env` and the
 * reason goes to the debug log. The parsers quote the file near the fault: V8 quotes the token and an excerpt,
 * JavaScriptCore quotes the identifier. So all from the first quote to the last one becomes `…`. JavaScriptCore
 * also names a bad escape character without quotes, so that character goes too.
 */
export function parserReason(message: string): string {
  return message
    .replace(/["'][\s\S]*["'](?:\.\.\.)?/, '…')
    .replace(/(escape character) \S+/, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseSettings(text: string): ParsedSettings | Refusal {
  const bom = text.startsWith(BOM) ? BOM : ''
  const body = text.slice(bom.length)
  const isBlank = body.trim() === ''
  let value: unknown
  try {
    value = isBlank ? {} : JSON.parse(body)
  } catch (error) {
    return { refusal: 'invalid-json', message: parserReason(causeOf(error)) }
  }
  if (!isPlainObject(value)) return wrongType('the top level', value, 'an object')
  const canonical = JSON.stringify(value, null, 2)
  return { value, bom, trailingNewline: isBlank || body.endsWith('\n'), isCanonical: body === canonical || body === `${canonical}\n` }
}

function cloneSettings(root: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(root)) as Record<string, unknown>
}

function walk(root: Record<string, unknown>, parents: readonly string[], isCreating: true): Walked | Refusal
function walk(root: Record<string, unknown>, parents: readonly string[], isCreating: false): Walked | Refusal | 'missing'
function walk(root: Record<string, unknown>, parents: readonly string[], isCreating: boolean): Walked | Refusal | 'missing' {
  const walked: Walked = { node: root, links: [], created: [] }
  for (const name of parents) {
    const dotted = [...walked.links.map(link => link.name), name].join('.')
    const child = walked.node[name]
    if (child === undefined && !isCreating) return 'missing'
    if (child !== undefined && !isPlainObject(child)) return wrongType(dotted, child, 'an object')
    if (child === undefined) {
      walked.node[name] = {}
      walked.created.push(dotted)
    }
    walked.links.push({ holder: walked.node, name, dotted })
    walked.node = walked.node[name] as Record<string, unknown>
  }
  return walked
}

function listAt(node: Record<string, unknown>, leaf: string, key: SandboxTunerSettingsKey): string[] | undefined | Refusal {
  const list = node[leaf]
  return list === undefined || isListOf(list, isText) ? list : wrongType(key, list, 'an array of strings')
}

function sameEntry(key: SandboxTunerSettingsKey, left: string, right: string): boolean {
  return HOST_KEYS.has(key) ? normalHost(left) === normalHost(right) : left === right
}

export function addEntry(root: Record<string, unknown>, key: SandboxTunerSettingsKey, entry: string): AddResult {
  const copy = cloneSettings(root)
  const { parents, leaf } = KEY_PATHS[key]
  const walked = walk(copy, parents, true)
  if ('refusal' in walked) return walked
  const list = listAt(walked.node, leaf, key)
  if (list === undefined) {
    walked.node[leaf] = [entry]
    return { value: copy, created: [...walked.created, key] }
  }
  if ('refusal' in list) return list
  if (list.some(item => sameEntry(key, item, entry))) return { isPresent: true }
  list.push(entry)
  return { value: copy, created: walked.created }
}

export function removeEntry(root: Record<string, unknown>, key: SandboxTunerSettingsKey, entry: string, created: readonly string[]): RemoveResult {
  const copy = cloneSettings(root)
  const { parents, leaf } = KEY_PATHS[key]
  const walked = walk(copy, parents, false)
  if (walked === 'missing') return { isAbsent: true }
  if ('refusal' in walked) return walked
  const list = listAt(walked.node, leaf, key)
  if (list === undefined) return { isAbsent: true }
  if ('refusal' in list) return list
  const index = list.findIndex(item => sameEntry(key, item, entry))
  if (index === -1) return { isAbsent: true }
  list.splice(index, 1)
  for (const link of [...walked.links, { holder: walked.node, name: leaf, dotted: key }].reverse()) {
    const value = link.holder[link.name]
    const isEmpty = (Array.isArray(value) && value.length === 0) || (isPlainObject(value) && Object.keys(value).length === 0)
    if (isEmpty && created.includes(link.dotted)) delete link.holder[link.name]
  }
  return { value: copy }
}

export function serializeSettings(value: Record<string, unknown>, format: Pick<ParsedSettings, 'bom' | 'trailingNewline'>): string {
  return `${format.bom}${JSON.stringify(value, null, 2)}${format.trailingNewline ? '\n' : ''}`
}

/** The shape of one journal entry. */
export function isApplied(value: unknown): value is SandboxTunerApplied {
  return (
    isPlainObject(value) &&
    isText(value.id) &&
    isText(value.recordKey) &&
    (value.action === 'allow' || value.action === 'deny') &&
    isText(value.settingsKey) &&
    Object.hasOwn(KEY_PATHS, value.settingsKey) &&
    isText(value.entry) &&
    isText(value.file) &&
    (value.backup === null || isText(value.backup)) &&
    isListOf(value.created, isText) &&
    isCount(value.appliedAt) &&
    (value.undoneAt === null || isCount(value.undoneAt)) &&
    (value.applyState === undefined || (value.applyState === 'pending' && value.undoneAt === null)) &&
    (value.undoState === undefined || (value.undoneAt !== null && ['pending', 'retry', 'superseded'].includes(String(value.undoState))))
  )
}
