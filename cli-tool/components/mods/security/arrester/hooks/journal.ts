// The journal transforms: pure functions over the one `$.state` value,
// which `update` applies inside the host's versioned write. Pure: no `$`.

import { selectionKey } from './analyze/paths'
import type { Effect, Segment } from './analyze/types'
import type { ArresterAccess, ArresterBlock, ArresterDecision, ArresterGuard, ArresterHeld, ArresterJournal, ArresterTarget } from '../types/index'

/** A block as the capture gathers it, before the journal gives it an id and bounds its flags. */
type BlockDraft = Omit<ArresterBlock, 'id' | 'lastHitAt' | 'flagsComplete' | 'segments'> & { segments: Segment[] }

/** The journal of a session where no block has opened. */
export const EMPTY_JOURNAL: ArresterJournal = { seq: 0, blocks: [], held: [], decisions: [], guards: [], recorded: [] }

const MAX_BLOCKS = 50
const MAX_DECISIONS = 50
const MAX_SEGMENTS = 16
const MAX_FLAGS = 256
const MAX_FLAG_BYTES = 65_536
const MAX_TARGETS = 256
const MAX_RECORDED = 100
const MINUTE = 60_000
const STRENGTH: Readonly<Record<ArresterAccess, number>> = { read: 1, write: 2, destroy: 3 }

/** When a block closes: `block_minutes` after it opened or after its last caught workaround. */
function closesAt(block: ArresterBlock, minutes: number): number {
  return Math.max(block.at, block.lastHitAt) + minutes * MINUTE
}

/** The blocks still open at `now`, oldest first. */
export function openBlocks(journal: ArresterJournal, now: number, minutes: number): ArresterBlock[] {
  return journal.blocks.filter(block => now < closesAt(block, minutes))
}

/** True when the call `toolUseId` opened a block already, even one that has closed since. */
export function isRecorded(journal: ArresterJournal, toolUseId: string): boolean {
  return journal.recorded.includes(toolUseId) || journal.blocks.some(block => block.toolUseId === toolUseId)
}

/** The journal with a block opened at `draft.at`: the next id, its segments and flags capped, expired blocks pruned, the oldest past 50 closed, the guards replaced, and the call recorded; unchanged when the call opened a block already. */
export function withBlock(journal: ArresterJournal, draft: BlockDraft, guards: readonly ArresterGuard[], minutes: number): ArresterJournal {
  if (isRecorded(journal, draft.toolUseId)) return journal
  const seq = journal.seq + 1
  let bytes = 0
  const bounded = (flags: string[]): { flags: string[]; flagsComplete: boolean } => {
    let size = 0
    for (const flag of flags) {
      size += 4
      for (const ch of flag) {
        const point = ch.codePointAt(0)!
        size += point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4
      }
      if (size + bytes > MAX_FLAG_BYTES) break
    }
    if (flags.length > MAX_FLAGS || size + bytes > MAX_FLAG_BYTES) return { flags: [], flagsComplete: false }
    bytes += size
    return { flags, flagsComplete: true }
  }
  const whole = bounded(draft.flags)
  const segments = draft.segments.slice(0, MAX_SEGMENTS).map(segment => ({ ...segment, ...bounded(segment.flags) }))
  const limited = !whole.flagsComplete || segments.some(segment => !segment.flagsComplete)
  const retryLimited = [draft.retryLimited, ...(limited ? ['flag storage exceeds 256 flags or 65,536 total bytes; fuzzy retries with incomplete flags are unavailable'] : [])].filter(Boolean).join('; ') || undefined
  const block: ArresterBlock = { ...draft, id: `b${seq}`, lastHitAt: draft.at, ...whole, segments, retryLimited }
  const recorded = [...journal.recorded, draft.toolUseId].slice(-MAX_RECORDED)
  const blocks = [...openBlocks(journal, draft.at, minutes), block]
  const evicted = blocks.length > MAX_BLOCKS ? blocks[0] : undefined
  const eviction = evicted === undefined ? journal.eviction : { blockId: evicted.id, at: draft.at, toolUseId: draft.toolUseId }
  return { ...journal, seq, blocks: blocks.slice(-MAX_BLOCKS), guards: [...guards], recorded, eviction }
}

/** The journal with the blocks a workaround matched renewed: their window starts again at `now`, or stays at a later match that a parallel check saved first. */
export function renewed(journal: ArresterJournal, ids: readonly string[], now: number): ArresterJournal {
  return { ...journal, blocks: journal.blocks.map(block => (ids.includes(block.id) ? { ...block, lastHitAt: Math.max(block.lastHitAt, now) } : block)) }
}

/** The journal with one more decision; the oldest past 50 is dropped. */
export function withDecision(journal: ArresterJournal, decision: ArresterDecision): ArresterJournal {
  return { ...journal, decisions: [...journal.decisions, decision].slice(-MAX_DECISIONS) }
}

/** The journal with a call held for the user. */
export function withHeld(journal: ArresterJournal, held: ArresterHeld): ArresterJournal {
  return { ...journal, held: [...journal.held, held] }
}

/** The journal without the held call `toolUseId`: its hold has ended. */
export function withoutHeld(journal: ArresterJournal, toolUseId: string): ArresterJournal {
  return { ...journal, held: journal.held.filter(held => held.toolUseId !== toolUseId) }
}

/** The journal with the open block `id` closed, or every open block when `id` is undefined, and the ids it closed; a clear that closes something is recorded. */
export function cleared(journal: ArresterJournal, id: string | undefined, now: number, minutes: number): { journal: ArresterJournal; closed: string[] } {
  const open = openBlocks(journal, now, minutes)
  const closed = open.filter(block => id === undefined || block.id === id).map(block => block.id)
  if (closed.length === 0) return { journal, closed }
  const kept = { ...journal, blocks: open.filter(block => !closed.includes(block.id)) }
  return { journal: withDecision(kept, { at: now, action: 'cleared', blockIds: closed, detail: 'by the user' }), closed }
}

/** The journal at `now` with expired blocks dropped, and every held call too when `dropHeld` (a reload ends the hooks that held them); the same object when nothing changes. */
export function pruned(journal: ArresterJournal, now: number, minutes: number, dropHeld: boolean): ArresterJournal {
  const blocks = openBlocks(journal, now, minutes)
  const isHeldDropped = dropHeld && journal.held.length > 0
  if (blocks.length === journal.blocks.length && !isHeldDropped) return journal
  return { ...journal, blocks, held: isHeldDropped ? [] : journal.held }
}

/** When the next open block closes; undefined when none is open. */
export function nextClose(journal: ArresterJournal, minutes: number): number | undefined {
  const times = journal.blocks.map(block => closesAt(block, minutes))
  return times.length === 0 ? undefined : Math.min(...times)
}

/** The targets of a blocked call: the first 256 paths its effects touch, each with the strongest access; recursive reads and lists give none. */
export function targetsOf(effects: readonly Effect[]): ArresterTarget[] {
  const targets = new Map<string, ArresterTarget>()
  for (const effect of effects) {
    if ((effect.kind === 'read' || effect.kind === 'list') && effect.recursive) continue
    const access: ArresterAccess = effect.kind === 'list' ? 'read' : effect.kind
    const key = JSON.stringify([effect.path, effect.glob, effect.globOptions?.dot === true, effect.globOptions?.nocase === true, effect.entry === true, selectionKey(effect.selection)])
    const found = targets.get(key)
    if (found !== undefined) {
      if (STRENGTH[access] > STRENGTH[found.access]) found.access = access
    } else if (targets.size < MAX_TARGETS) targets.set(key, { path: effect.path, access, ...(effect.globOptions === undefined ? {} : { globOptions: effect.globOptions }), ...(effect.glob === undefined ? {} : { glob: effect.glob }), ...(effect.entry === true ? { entry: true } : {}), ...(effect.selection === undefined ? {} : { selection: effect.selection }) })
  }
  return [...targets.values()]
}
