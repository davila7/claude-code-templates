// The journal transforms: pure functions over the one `$.state` value,
// which `update` applies inside the host's versioned write. Pure: no `$`.

import { basenameOf, foldCase, foldPath, globMatch, joinPath, relation, selectionKey } from './analyze/paths'
import type { Meter } from './analyze/paths'
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
/** A deny reason that names another tool to use, such as `Use rg instead of grep`: the guard objected to the tool, not to the folder. */
const SUGGESTS_TOOL = /\binstead\b|\bprefer(?:s|red)?\b|\bplease use\b|\buse `?rg\b|\btry `/i
/** What a word of a deny reason loses at its two ends: quotes, backticks, and brackets. */
const WORD_EDGES = new Set([...'\'"`‘’“”()[]{}'])
/** What one form of a word of a deny reason also loses at its end. */
const WORD_ENDS = new Set([...'.,;:!?'])
/** Where a command splits into the words that spell its paths: blanks, quotes, and shell operators. */
const SPELLING_BREAKS = /[\s'"`;&|()<>=]+/
/** The programs that change the folder of a shell; a blocked command that names one keeps every target. */
const FOLDER_CHANGERS = new Set(['cd', 'pushd', 'popd'])
/** What a command loses before Arrester looks for a program that changes its folder: its quotes, the `$` before a quote, and its backslashes. */
const QUOTING = /\$?['"]|\\/g
/** Where a command without its quoting splits into the names of the programs that it can run. */
const NAME_BREAKS = /[^A-Za-z0-9_.-]+/
/** The most distinct words of a deny reason that naming reads; a reason with more keeps every target. */
const MAX_REASON_WORDS = 256
/** The most glob steps that naming targets takes; past it, the reason keeps every target. */
const MAX_NAME_STEPS = 1_000_000

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

/** Whether a blocked full search of a folder may keep the folder as a read target: its deny `reason` names no other tool to use, and no spelling of it is `/` or is or holds one of the `spared` paths, such as the home, session, and project folders and the guard files. */
export function isTargetFolder(spellings: readonly string[], spared: readonly string[], reason: string): boolean {
  return !SUGGESTS_TOOL.test(reason) && spellings.every(folder => folder !== '/' && !spared.some(path => path === folder || path.startsWith(`${folder}/`)))
}

/** The targets of a blocked call: the first 256 paths its effects touch, each with the strongest access; recursive reads and lists, and paths that an MCP call names, give none. */
export function targetsOf(effects: readonly Effect[]): ArresterTarget[] {
  const targets = new Map<string, ArresterTarget>()
  for (const effect of effects) {
    if (effect.kind === 'name' || ((effect.kind === 'read' || effect.kind === 'list') && effect.recursive)) continue
    const access: ArresterAccess = effect.kind === 'list' ? 'read' : effect.kind
    const key = JSON.stringify([effect.path, effect.glob, effect.globOptions?.dot === true, effect.globOptions?.nocase === true, effect.entry === true, selectionKey(effect.selection)])
    const found = targets.get(key)
    if (found !== undefined) {
      if (STRENGTH[access] > STRENGTH[found.access]) found.access = access
    } else if (targets.size < MAX_TARGETS) targets.set(key, { path: effect.path, access, ...(effect.globOptions === undefined ? {} : { globOptions: effect.globOptions }), ...(effect.glob === undefined ? {} : { glob: effect.glob }), ...(effect.entry === true ? { entry: true } : {}), ...(effect.selection === undefined ? {} : { selection: effect.selection }) })
  }
  return [...targets.values()]
}

/** What naming a target reads besides the word: the words of the blocked command, and the shared glob budget. */
type Naming = { spelled: ReadonlySet<string>; meter: Meter }

/** The targets of a blocked call that its deny `reason` names, when there are two or more and the reason names some but not all of them; else every target. Every target stays when the blocked `command` names `cd`, `pushd`, or `popd`. Each word of the reason, cut at blanks, is read in the two forms of `formsOf`, and names a target when one of its forms does: when the form is the target's absolute path or real path, its spelling in the blocked `command`, its path relative to the session folder `cwd`, or its file name, or one of these for a folder that holds the target; a relative form is read in `cwd` and `~` in `home`. A form with `*` names a target with no glob whose file name or path it matches as a glob; a glob target is named only by its glob text or a folder that holds it. Every target stays when the reason has more than MAX_REASON_WORDS distinct words, when a form holds `**`, when a word with a form that looks like a path names no target in either form, when a glob target can match a form of a word that does not name it, or past the glob budget. */
export function namedTargets(targets: readonly ArresterTarget[], reason: string, command: string | undefined, cwd: string, home: string | undefined): ArresterTarget[] {
  if (targets.length < 2 || (command !== undefined && movesFolder(command))) return [...targets]
  const words = new Map<string, string[]>()
  for (const word of reason.split(/\s+/)) {
    const forms = [...new Set(formsOf(word))].filter(form => form !== '')
    if (forms.length > 0) words.set(forms.join(' '), forms)
    if (words.size > MAX_REASON_WORDS) return [...targets]
  }
  const naming: Naming = { spelled: new Set(command?.split(SPELLING_BREAKS) ?? []), meter: { steps: 0, limit: MAX_NAME_STEPS } }
  const named = new Set<ArresterTarget>()
  for (const forms of words.values()) {
    if (forms.some(form => form.includes('**'))) return [...targets]
    const read = forms.map(form => ({ form, resolved: form === '~' || form.startsWith('~/') ? (home === undefined ? undefined : foldPath(`${home}${form.slice(1)}`)) : joinPath(cwd, form) }))
    const hits = new Set(targets.filter(target => read.some(({ form, resolved }) => names(form, resolved, target, naming))))
    if (hits.size === 0 && forms.some(form => isPathWord(form, naming))) return [...targets]
    if (targets.some(target => !hits.has(target) && read.some(({ form, resolved }) => globCanMatch(form, resolved, target, naming.meter)))) return [...targets]
    if (naming.meter.steps > MAX_NAME_STEPS) return [...targets]
    for (const hit of hits) named.add(hit)
  }
  const kept = targets.filter(target => named.has(target))
  return kept.length > 0 && kept.length < targets.length ? kept : [...targets]
}

/** Whether a blocked command can change its folder: without its quoting, it names `cd`, `pushd`, or `popd` as a word, in any part. */
function movesFolder(command: string): boolean {
  return command.replace(QUOTING, '').split(NAME_BREAKS).some(word => FOLDER_CHANGERS.has(word))
}

/** Whether a form of a word of a deny reason looks like a path: it holds `/` or `*`, or it is a word of the blocked command. */
function isPathWord(word: string, naming: Naming): boolean {
  return word.includes('/') || word.includes('*') || naming.spelled.has(word)
}

/** The two forms of a word of a deny reason, both without the quotes, backticks, and brackets at its two ends: the first also without the `.`, `,`, `;`, `:`, `!`, and `?` at its end; the second keeps those that come before the last closing quote or bracket of the word, or all of them when the word ends in none, so `` `secret.`, `` gives `secret` and `secret.`. */
function formsOf(word: string): [string, string] {
  let start = 0
  let end = word.length
  let kept = end
  while (start < end && WORD_EDGES.has(word.charAt(start))) start += 1
  while (end > start && (WORD_EDGES.has(word.charAt(end - 1)) || WORD_ENDS.has(word.charAt(end - 1)))) {
    end -= 1
    if (WORD_EDGES.has(word.charAt(end))) kept = end
  }
  return [word.slice(start, end), word.slice(start, kept)]
}

/** Whether a form of a word of a deny reason, `resolved` as a path, names a target, or a folder that holds it, by its path or real path: as an absolute path, or a relative one read in the session folder, or `~` read in the home folder; as a file or folder name; as a spelling of the blocked command that the path ends with; or, with `*`, as a glob. A glob target's glob text names it, in the same forms, but no other part of the glob does, and no glob word. */
function names(word: string, resolved: string | undefined, target: ArresterTarget, naming: Naming): boolean {
  const paths = target.real === undefined ? [target.path] : [target.path, target.real]
  const spelling = naming.spelled.has(word) ? word.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '') : ''
  return paths.some(path => {
    const place = target.glob === undefined ? path : `${path === '/' ? '' : path}/${target.glob}`
    if (resolved !== undefined && (place === resolved || path === resolved || path.startsWith(resolved === '/' ? '/' : `${resolved}/`))) return true
    if (!word.includes('/') && (word === target.glob || path.split('/').includes(word))) return true
    if (spelling !== '' && !spelling.startsWith('/') && (place.endsWith(`/${spelling}`) || path.endsWith(`/${spelling}`) || path.includes(`/${spelling}/`))) return true
    return target.glob === undefined && word.includes('*') && globNames(word, resolved, place, naming.meter)
  })
}

/** Whether a glob target can match a form of a word of a deny reason as a file: the form `resolved` as a path, or a form without `/` as a file name that the last segment of the glob matches; past the budget, or when the comparison is uncertain, it can. */
function globCanMatch(word: string, resolved: string | undefined, target: ArresterTarget, meter: Meter): boolean {
  const glob = target.glob
  if (glob === undefined) return false
  if (meter.steps > MAX_NAME_STEPS) return true
  const paths = target.real === undefined ? [target.path] : [target.path, target.real]
  if (resolved !== undefined && paths.some(path => relation({ path: resolved, recursive: false }, path, meter, glob, target.globOptions) !== undefined)) return true
  if (word.includes('/')) return false
  const last = glob.slice(glob.lastIndexOf('/') + 1)
  const nocase = target.globOptions?.nocase === true
  return globMatch(nocase ? foldCase(last) : last, nocase ? foldCase(word) : word, meter, target.globOptions?.dot === true) !== false
}

/** Whether a word with `*` matches the file name of a place, or the place as a path when it is read as `resolved`, with each name a glob; past the budget it counts as a match. */
function globNames(word: string, resolved: string | undefined, place: string, meter: Meter): boolean {
  if (globMatch(word, basenameOf(place), meter, true) !== false) return true
  if (resolved === undefined) return false
  const pattern = resolved.split('/')
  const parts = place.split('/')
  return pattern.length === parts.length && pattern.every((part, i) => globMatch(part, parts[i] ?? '', meter, true) !== false)
}
