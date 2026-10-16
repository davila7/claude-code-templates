// Saved records: store keys, the merge of a sighting, counts, shape, retention.

import type { SandboxTunerApplied, SandboxTunerCounts, SandboxTunerLatest, SandboxTunerRecord } from '../types'
import { isGuardedPath, normalHost } from './names'
import { isCount, isListOf, isPlainObject, isText } from './shapes'
import type { Sighting } from './sightings'

// Writers keep independent records.
export const WRITER_PREFIX = 'writer:'
export const HIDDEN_PREFIX = 'hidden:'
export const JOURNAL_PREFIX = 'applied:'
const JOURNAL_LIMIT = 50

const RECORD_LIMIT = 300
const RECORD_AGE_MS = 30 * 24 * 60 * 60 * 1000
const PORT_LIMIT = 5
const PROGRAM_LIMIT = 3
const SESSION_LIMIT = 20
const COUNTERS = ['blocked', 'refused', 'listed', 'inferred'] as const
const KINDS: ReadonlySet<unknown> = new Set(['host', 'path'])

export function recordKey(sighting: Pick<Sighting, 'kind' | 'target'>): string {
  return `${sighting.kind}:${sighting.target}`
}

function joinNewest<T>(list: readonly T[], item: T, limit: number): T[] {
  return [...list.filter(value => value !== item), item].slice(-limit)
}

/** Distinct values, the newer record's last so that the cut keeps them: a value in both takes its newer place. */
function mergeNewest<T>(older: readonly T[], newer: readonly T[], limit: number): T[] {
  const joined = [...older, ...newer]
  return joined.filter((value, index) => joined.lastIndexOf(value) === index).slice(-limit)
}

export function mergeSighting(record: SandboxTunerRecord | undefined, sighting: Sighting, sessionId: string | null, now: number): SandboxTunerRecord {
  const base: SandboxTunerRecord = record ?? {
    key: recordKey(sighting),
    kind: sighting.kind,
    target: sighting.target,
    counts: { blocked: 0, refused: 0, listed: 0, inferred: 0 },
    ports: [],
    sample: '',
    seenWith: [],
    sessions: [],
    firstSeen: now,
    lastSeen: now,
    isHidden: false,
  }
  return {
    ...base,
    counts: {
      ...base.counts,
      [sighting.counter]: base.counts[sighting.counter] + 1,
      refused: base.counts.refused + (sighting.reason === 'refused' ? 1 : 0),
    },
    ports: sighting.ports.reduce((list, port) => joinNewest(list, port, PORT_LIMIT), base.ports),
    seenWith: sighting.program === '' ? base.seenWith : joinNewest(base.seenWith, sighting.program, PROGRAM_LIMIT),
    sessions: sessionId === null ? base.sessions : joinNewest(base.sessions, sessionId, SESSION_LIMIT),
    // A folder keeps a protected or key file as its sample, so a later write beside it cannot bring Allow back.
    sample: base.kind === 'path' && isGuardedPath(base.sample) && !isGuardedPath(sighting.detail) ? base.sample : sighting.detail,
    lastSeen: now,
  }
}

export function sightingTotal(counts: SandboxTunerCounts): number {
  return counts.blocked + counts.listed + counts.inferred
}

export function allowCount(counts: SandboxTunerCounts): number {
  return sightingTotal(counts) - counts.refused
}

export function isRecord(value: unknown): value is SandboxTunerRecord {
  if (!isPlainObject(value) || !isPlainObject(value.counts)) return false
  const counts = value.counts
  return (
    KINDS.has(value.kind) &&
    isText(value.target) &&
    value.key === `${String(value.kind)}:${value.target}` &&
    COUNTERS.every(name => isCount(counts[name])) &&
    isListOf(value.ports, isCount) &&
    isText(value.sample) &&
    isListOf(value.seenWith, isText) &&
    isListOf(value.sessions, isText) &&
    isCount(value.firstSeen) &&
    isCount(value.lastSeen) &&
    typeof value.isHidden === 'boolean'
  )
}

/** The record keys omitted from the display after 30 days or beyond the 300 newest targets. */
export function staleKeys(records: readonly SandboxTunerRecord[], now: number): string[] {
  const fresh = records.filter(record => now - record.lastSeen <= RECORD_AGE_MS)
  const kept = new Set([...fresh].sort((a, b) => b.lastSeen - a.lastSeen).slice(0, RECORD_LIMIT).map(record => record.key))
  return records.filter(record => !kept.has(record.key)).map(record => record.key)
}

/** The records that the display shows at `now`: each seen within 30 days, at most the 300 newest. */
export function shownRecords(records: readonly SandboxTunerRecord[], now: number): SandboxTunerRecord[] {
  const stale = new Set(staleKeys(records, now))
  return records.filter(record => !stale.has(record.key))
}

/** The 50 newest history entries plus every unresolved edit, oldest first. */
export function journalOf(entries: readonly SandboxTunerApplied[]): SandboxTunerApplied[] {
  const sorted = [...entries].sort((a, b) => a.appliedAt - b.appliedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const unresolved = (entry: SandboxTunerApplied) => entry.applyState === 'pending' || isUndoUnresolved(entry)
  const history = sorted.filter(entry => !unresolved(entry)).slice(-JOURNAL_LIMIT)
  return sorted.filter(entry => unresolved(entry) || history.includes(entry))
}

/** An unconfirmed removal retains its retry action. */
export function isUndoUnresolved(entry: SandboxTunerApplied): boolean {
  return entry.undoState === 'pending' || entry.undoState === 'retry'
}

export function hasLaterOwner(journal: readonly SandboxTunerApplied[], entry: SandboxTunerApplied): boolean {
  return journal.some(item => item.id !== entry.id && item.file === entry.file && item.settingsKey === entry.settingsKey &&
    (entry.settingsKey === 'sandbox.filesystem.allowWrite' ? item.entry === entry.entry : normalHost(item.entry) === normalHost(entry.entry)) &&
    item.appliedAt >= entry.appliedAt)
}

export function isPressedAgain(journal: readonly SandboxTunerApplied[], written: SandboxTunerApplied): boolean {
  return hasLaterOwner(journal, written) || journal.some(item => item.id === written.id && item.undoneAt !== written.undoneAt)
}

/** True when a press changed settings for the target of the latest block at or after that block. */
export function isFixedSince(journal: readonly SandboxTunerApplied[], latest: SandboxTunerLatest): boolean {
  return journal.some(entry => entry.applyState !== 'pending' && entry.recordKey === latest.recordKey && entry.appliedAt >= latest.at)
}

/** Combine independent writers without losing a protected sample or inferred evidence. */
export function aggregateRecords(records: readonly SandboxTunerRecord[]): SandboxTunerRecord[] {
  const result = new Map<string, SandboxTunerRecord>()
  for (const record of [...records].sort((a, b) => a.lastSeen - b.lastSeen)) {
    const previous = result.get(record.key)
    if (previous === undefined) { result.set(record.key, record); continue }
    result.set(record.key, {
      ...record,
      counts: {
        blocked: previous.counts.blocked + record.counts.blocked,
        refused: previous.counts.refused + record.counts.refused,
        listed: previous.counts.listed + record.counts.listed,
        inferred: previous.counts.inferred + record.counts.inferred,
      },
      sample: isGuardedPath(previous.sample) ? previous.sample : record.sample,
      ports: mergeNewest(previous.ports, record.ports, PORT_LIMIT),
      seenWith: mergeNewest(previous.seenWith, record.seenWith, PROGRAM_LIMIT),
      sessions: mergeNewest(previous.sessions, record.sessions, SESSION_LIMIT),
      firstSeen: Math.min(previous.firstSeen, record.firstSeen),
    })
  }
  return [...result.values()]
}
