// Which open blocks a call matches, and why, by four rules: target, retry,
// guard, and opaque. Pure: no `$`.

import type { CallAnalysis } from './analyze/call'
import { foldCase, relation } from './analyze/paths'
import type { Meter, Relation } from './analyze/paths'
import { OPAQUE } from './analyze/shell'
import type { Effect, EffectKind } from './analyze/types'
import type { ArresterAccess, ArresterBlock, ArresterGuard, ArresterTarget } from '../types/index'

/** An effect with the real path of its path, when the file system gave one that differs. */
export type PlacedEffect = Effect & { real?: string }

/** One reason a call matches a block; paths are written for people, a glob as its folder and segment. A guard finding names the guard the effect touched, or the launch flag or plugin command that can turn guards off. */
export type Finding =
  | { rule: 'target'; block: ArresterBlock; kind: EffectKind; path: string; relation: Relation; target: string; access: ArresterAccess }
  | { rule: 'retry'; block: ArresterBlock }
  | { rule: 'guard'; block: ArresterBlock; kind: EffectKind; path: string; relation: Relation; guard: string }
  | { rule: 'guard'; block: ArresterBlock; bypass: string }
  | { rule: 'opaque'; block: ArresterBlock; reason: string }

/** The most comparison steps one check takes; past them it stops comparing and the call is opaque, so a crafted call cannot hold the check. */
const MAX_STEPS = 20_000_000

/** Every finding of a call against the open blocks: target findings for each block that is not a user rejection and retry findings for each block, oldest first, then guard and opaque findings against the newest block that is not a user rejection. */
export function findings(open: readonly ArresterBlock[], guards: readonly ArresterGuard[], call: CallAnalysis, effects: readonly PlacedEffect[]): Finding[] {
  const found: Finding[] = []
  const meter: Meter = { steps: 0 }
  const candidates = targetCandidates(open, effects, meter)
  for (const block of open) {
    for (const effect of block.source === 'user' ? [] : effects) {
      if (meter.steps > MAX_STEPS) break
      const hit = targetHit(block, effect, meter, candidates.get(effect))
      if (hit !== undefined) found.push({ rule: 'target', block, kind: effect.kind, path: shown(effect.path, effect.glob), relation: hit.relation, target: shown(hit.target.path, hit.target.glob), access: hit.target.access })
    }
    if (isRetry(block, call)) found.push({ rule: 'retry', block })
  }
  const newest = open.filter(block => block.source !== 'user').at(-1)
  if (newest === undefined) return found
  for (const effect of effects) {
    if (meter.steps > MAX_STEPS) break
    const hit = guardHit(effect, guards, meter)
    if (hit !== undefined) found.push({ rule: 'guard', block: newest, kind: effect.kind, path: shown(effect.path, effect.glob), relation: hit.relation, guard: hit.guard })
  }
  if (call.bypass !== undefined) found.push({ rule: 'guard', block: newest, bypass: call.bypass })
  const reason = call.opaque ?? (meter.uncertain ? 'path comparison exceeded its work budget; target overlap is uncertain' : undefined) ?? (meter.steps > MAX_STEPS ? OPAQUE.tooMany : undefined)
  if (reason !== undefined) found.push({ rule: 'opaque', block: newest, reason })
  return found
}

/** Literal-prefix index of retained targets, including their real spellings. */
type TargetNode = { children: Map<string, TargetNode>; targets: Set<ArresterTarget> }

/** Selects only targets whose literal prefixes overlap an effect, charging index work to the shared budget. A case-insensitive glob on either side compares its folders without case, so case-insensitive targets sit in an index of case-folded folders, and a case-insensitive effect looks up the other targets by their folded folders too. */
function targetCandidates(open: readonly ArresterBlock[], effects: readonly PlacedEffect[], meter: Meter): Map<PlacedEffect, Set<ArresterTarget>> {
  const retained = open.flatMap(block => (block.source === 'user' ? [] : block.targets))
  const sensitive = retained.filter(target => target.globOptions?.nocase !== true)
  const loose = retained.filter(target => target.globOptions?.nocase === true)
  const insensitive = targetIndex(loose, true, meter)
  if (insensitive === undefined) return new Map()
  let exact: TargetNode | undefined
  let folded: TargetNode | undefined
  const cache = new Map<string, Set<ArresterTarget>>()
  const result = new Map<PlacedEffect, Set<ArresterTarget>>()
  for (const effect of effects) {
    const nocase = effect.globOptions?.nocase === true
    const key = `${effect.path}\0${effect.real ?? ''}\0${nocase}`
    let candidates = cache.get(key)
    if (candidates === undefined) {
      const root = nocase ? (folded ??= targetIndex(sensitive, true, meter)) : (exact ??= targetIndex(sensitive, false, meter))
      if (root === undefined) return new Map()
      candidates = new Set()
      for (const path of spellings(effect.path, effect.real)) {
        meter.steps += path.length
        gather(root, path, nocase, candidates, meter)
        if (loose.length > 0) gather(insensitive, path, true, candidates, meter)
      }
      cache.set(key, candidates)
    }
    result.set(effect, candidates)
  }
  return result
}

/** The index of the targets by the folders of each spelling, case-folded when `fold` is set; undefined past the step budget. */
function targetIndex(targets: readonly ArresterTarget[], fold: boolean, meter: Meter): TargetNode | undefined {
  const root: TargetNode = { children: new Map(), targets: new Set() }
  for (const target of targets) {
    for (const path of spellings(target.path, target.real)) {
      meter.steps += path.length
      if (meter.steps > MAX_STEPS) return undefined
      let node = root
      for (const part of folders(path, fold)) {
        let child = node.children.get(part)
        if (child === undefined) {
          child = { children: new Map(), targets: new Set() }
          node.children.set(part, child)
        }
        node = child
      }
      node.targets.add(target)
    }
  }
  return root
}

/** Adds to `candidates` the indexed targets at or above the path and every target below it. */
function gather(root: TargetNode, path: string, fold: boolean, candidates: Set<ArresterTarget>, meter: Meter): void {
  let node: TargetNode | undefined = root
  for (const part of folders(path, fold)) {
    meter.steps += node.targets.size
    if (meter.steps > MAX_STEPS) break
    for (const target of node.targets) candidates.add(target)
    node = node.children.get(part)
    if (node === undefined) break
  }
  const pending = node === undefined ? [] : [node]
  while (pending.length > 0 && meter.steps <= MAX_STEPS) {
    const next = pending.pop()!
    meter.steps += 1 + next.targets.size + next.children.size
    for (const target of next.targets) candidates.add(target)
    pending.push(...next.children.values())
  }
}

/** The folders of a path, each case-folded as a case-insensitive comparison reads it when `fold` is set. */
function folders(path: string, fold: boolean): string[] {
  return (fold ? foldCase(path) : path).split('/').filter(Boolean)
}

/** The blocks that findings name, in order, each once. */
export function blocksOf(found: readonly Finding[]): ArresterBlock[] {
  return [...new Set(found.map(finding => finding.block))]
}

/** The ids of the blocks that a target or retry finding names: the blocks a caught workaround renews; a guard or opaque finding alone renews none. */
export function renewable(found: readonly Finding[]): string[] {
  return blocksOf(found.filter(finding => finding.rule === 'target' || finding.rule === 'retry')).map(block => block.id)
}

/** A path as people read it: a glob as its folder and its glob segment. */
export function shown(path: string, glob: string | undefined): string {
  if (glob === undefined) return path
  return path === '/' ? `/${glob}` : `${path}/${glob}`
}

/** The target rule: the first target of the block that the effect meets in a way its access counts. */
function targetHit(block: ArresterBlock, effect: PlacedEffect, meter: Meter, candidates: ReadonlySet<ArresterTarget> | undefined): { target: ArresterTarget; relation: Relation } | undefined {
  if (candidates === undefined || candidates.size === 0) return undefined
  for (const target of block.targets) {
    if (!candidates.has(target)) continue
    if (meter.steps > MAX_STEPS) break
    const found = meet(effect, target.path, target.real, target.glob, meter, target.selection, target.globOptions)
    if (found === 'uncertain') {
      meter.uncertain = true
      continue
    }
    if (found !== undefined && counts(target.access, effect.kind, found)) return { target, relation: found }
  }
  return undefined
}

/** Whether an effect of `kind` that stands in `found` to a target of `access` gets the result the guard blocked. */
function counts(access: ArresterAccess, kind: EffectKind, found: Relation): boolean {
  if (kind === 'destroy') return true
  if (kind === 'write') return found === 'same' || (access === 'write' && found === 'contains')
  if (kind === 'read') return access === 'read'
  return access === 'read' && found !== 'contains'
}

/** The retry rule: the call repeats the blocked command as a whole, or holds the one command the block had, unless it only drops some of the blocked flags. A block from the user's own rejection matches only the same call again: the complete syntax-preserving input and context identity. */
function isRetry(block: ArresterBlock, call: CallAnalysis): boolean {
  const isWhole = call.skeleton !== '' && call.skeleton === block.skeleton
  const exact = call.exact !== undefined && call.exact === block.exact
  if (block.source === 'user') return exact
  const preview = call.segments.some(segment => segment.preview)
  if (exact && !preview) return true
  if (block.flagsComplete && isWhole) {
    if (!preview && !dropsFlags(call.flags, block.flags)) return true
    if (preview && call.segments.some(segment => !segment.preview && block.segments.some(blocked => blocked.flagsComplete && blocked.skeleton === segment.skeleton && !dropsFlags(segment.flags, blocked.flags)))) return true
  }
  const [only, ...others] = block.segments
  return only !== undefined && others.length === 0 && call.segments.some(segment => !segment.preview && only.flagsComplete && segment.skeleton === only.skeleton && !dropsFlags(segment.flags, only.flags))
}

/** True when the later flags are some, not all, of the blocked ones: the retry drops flags, and a guard that objected to the command itself sees it again. */
function dropsFlags(later: readonly string[], blocked: readonly string[]): boolean {
  return later.length < blocked.length && later.every(flag => blocked.includes(flag))
}

/** The guard rule compares only recorded guard paths; containing reads and change-only guard reads do not count. */
function guardHit(effect: PlacedEffect, guards: readonly ArresterGuard[], meter: Meter): { guard: string; relation: Relation } | undefined {
  const changes = effect.kind === 'write' || effect.kind === 'destroy'
  for (const guard of guards) {
    if (guard.changeOnly === true && !changes) continue
    const found = meet(effect, guard.path, guard.real, undefined, meter)
    if (found === 'uncertain') meter.uncertain = true
    if (found === 'same' || found === 'inside' || (found === 'contains' && changes)) return { guard: guard.path, relation: found }
  }
  return undefined
}

/** How an effect stands to a protected path: the first relation among the pairs of {written, real} spellings, effect first. */
function meet(effect: PlacedEffect, path: string, real: string | undefined, glob: string | undefined, meter: Meter, selection?: ArresterTarget['selection'], globOptions?: ArresterTarget['globOptions']): Relation | 'uncertain' | undefined {
  for (const spelling of spellings(effect.path, effect.real)) {
    for (const place of spellings(path, real)) {
      if (selection !== undefined) {
        const selected = relation({ path: place, glob, globOptions, recursive: true, selection }, spelling, meter, effect.glob, effect.globOptions)
        if (selected === undefined) continue
        if (selected === 'uncertain') return selected
      }
      const found = relation({ path: spelling, glob: effect.glob, globOptions: effect.globOptions, recursive: effect.recursive, selection: effect.selection }, place, meter, glob, globOptions)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/** A path, and its real path when that differs. */
function spellings(path: string, real: string | undefined): string[] {
  return real === undefined || real === path ? [path] : [path, real]
}
