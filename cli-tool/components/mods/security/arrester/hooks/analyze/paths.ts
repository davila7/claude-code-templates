// Path arithmetic for Arrester: lexical folding, globs, braces, and how an
// effect's path stands to a protected path. Pure: no `$`.

import type { Effect } from './types'

/** How an effect's path stands to a protected path. */
export type Relation = 'same' | 'inside' | 'contains'

/** What `relation` reads of an effect: a path, or a glob's prefix folder and remaining glob segments. */
type Reach = Pick<Effect, 'path' | 'glob' | 'globOptions' | 'recursive' | 'selection'>

/** The comparison work one check has done, in character steps. */
export type Meter = { steps: number; uncertain?: true; limit?: number }

/** The longest path operand that analysis supports. */
export const MAX_PATH = 4_096

/** A definite file operand exceeded the supported path length. */
export const PATH_TOO_LONG = 'a file path exceeds the 4,096-character analysis limit'

const REMOTE = /^[^/]*:/
const GLOB_CHAR = /[*?[]/
/** The most work one glob comparison takes before returning uncertainty. */
const MAX_GLOB_STEPS = 65_536
/** How deep brace groups may nest inside one another. */
const MAX_BRACE_DEPTH = 32

/** True when the text holds a glob character: `*`, `?`, or `[`. */
export function hasGlob(text: string): boolean {
  return GLOB_CHAR.test(text)
}

/** True for a URL or a remote `host:path` operand: a colon before any slash. */
export function isRemote(word: string): boolean {
  return REMOTE.test(word)
}

/** True when an operand of a program Arrester does not know looks like a path. */
export function looksLikePath(word: string): boolean {
  return !isRemote(word) && (word.includes('/') || word.startsWith('.') || word.startsWith('~'))
}

/** An absolute path with `.`, `..`, and repeated or trailing slashes folded. */
export function foldPath(path: string): string {
  const kept: string[] = []
  for (const part of path.split('/')) {
    if (part === '..') kept.pop()
    else if (part !== '' && part !== '.') kept.push(part)
  }
  return `/${kept.join('/')}`
}

/** The absolute lexical path of `path` read in the absolute folder `dir`. */
export function joinPath(dir: string, path: string): string {
  return foldPath(path.startsWith('/') ? path : `${dir}/${path}`)
}

/** The absolute lexical path of `path` read in `cwd`; undefined for a relative path when the folder is unknown. */
export function absolute(path: string, cwd: string | undefined): string | undefined {
  if (path.startsWith('/')) return foldPath(path)
  return cwd === undefined ? undefined : joinPath(cwd, path)
}

/** The folder that holds `path`; `/` for `/`. */
export function dirnameOf(path: string): string {
  return foldPath(`${path}/..`)
}

/** The last segment of `path`. */
export function basenameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** `~` and `~/…` with the home folder; undefined when the home folder is unknown; other words as they are. */
export function expandHome(word: string, home: string | undefined): string | undefined {
  if (word !== '~' && !word.startsWith('~/')) return word
  return home === undefined ? undefined : `${home}${word.slice(1)}`
}

/** One piece of a brace expansion: literal text or a group of alternatives. */
type Brace = { text: string } | { choices: Brace[][] }

/** Every brace expansion of `text`, in order: comma lists, nested ones too; undefined past `max` words, which are counted before any is built, or past MAX_BRACE_DEPTH levels. */
export function expandBraces(text: string, max: number): string[] | undefined {
  if (!text.includes('{')) return [text]
  const pieces = new BraceReader(text).read(0, text.length, 0)
  if (pieces === undefined) return undefined
  const count = countOf(pieces, max)
  if (count > max || count * text.length > 4_000_000) return undefined
  return build(pieces)
}

/** The brace pairs of a text, found in one pass, and the commas each pair holds at its own level. */
class BraceReader {
  private readonly text: string
  private readonly closes = new Map<number, number>()
  private readonly commas = new Map<number, number[]>()

  constructor(text: string) {
    this.text = text
    const open: number[] = []
    for (let i = 0; i < text.length; i += 1) {
      const ch = text.charAt(i)
      if (ch === '{') open.push(i)
      else if (ch === '}' && open.length > 0) this.closes.set(open.pop() as number, i)
      else if (ch === ',' && open.length > 0) {
        const at = open[open.length - 1] as number
        const commas = this.commas.get(at)
        if (commas === undefined) this.commas.set(at, [i])
        else commas.push(i)
      }
    }
  }

  /** The pieces of `text` from `start` to `end`; a pair with no comma at its level stays literal. */
  read(start: number, end: number, depth: number): Brace[] | undefined {
    if (depth > MAX_BRACE_DEPTH) return undefined
    const pieces: Brace[] = []
    let literal = ''
    let i = start
    while (i < end) {
      const close = this.closes.get(i)
      const group = close === undefined || close >= end ? undefined : this.group(i, close, depth)
      if (group === null) return undefined
      if (group === undefined) {
        literal += this.text.charAt(i)
        i += 1
        continue
      }
      if (literal !== '') pieces.push({ text: literal })
      literal = ''
      pieces.push(group)
      i = (close as number) + 1
    }
    if (literal !== '') pieces.push({ text: literal })
    return pieces
  }

  /** The group of the pair from `open` to `close`; undefined when it is literal text; null when it nests too deep. */
  private group(open: number, close: number, depth: number): Brace | undefined | null {
    const commas = this.commas.get(open)
    if (commas === undefined) return undefined
    const choices: Brace[][] = []
    const bounds = [open, ...commas, close]
    for (let k = 0; k + 1 < bounds.length; k += 1) {
      const choice = this.read((bounds[k] as number) + 1, bounds[k + 1] as number, depth + 1)
      if (choice === undefined) return null
      choices.push(choice)
    }
    return { choices }
  }
}

/** How many words the pieces expand to, stopping once the count passes `max`. */
function countOf(pieces: readonly Brace[], max: number): number {
  let total = 1
  for (const piece of pieces) {
    if ('text' in piece) continue
    let options = 0
    for (const choice of piece.choices) options += countOf(choice, max)
    total *= options
    if (total > max) return max + 1
  }
  return total
}

/** The words the pieces expand to, in order. */
function build(pieces: readonly Brace[]): string[] {
  let words = ['']
  for (const piece of pieces) {
    const options = 'text' in piece ? [piece.text] : piece.choices.flatMap(build)
    words = words.flatMap(word => options.map(option => word + option))
  }
  return words
}

/** A glob path as its literal prefix folder and remaining glob segments; undefined when no segment holds a glob character. */
export function splitGlob(path: string): { path: string; glob: string } | undefined {
  const segments = path.split('/').filter(segment => segment !== '')
  const at = segments.findIndex(hasGlob)
  const glob = segments[at]
  return glob === undefined ? undefined : { path: `/${segments.slice(0, at).join('/')}`, glob: segments.slice(at).join('/') }
}

/** ASCII members of the standard POSIX character classes. */
const CHARACTER_CLASSES: Readonly<Record<string, RegExp>> = {
  alnum: /^[A-Za-z0-9]$/, alpha: /^[A-Za-z]$/, blank: /^[ \t]$/, cntrl: /^[\x00-\x1f\x7f]$/,
  digit: /^[0-9]$/, graph: /^[!-~]$/, lower: /^[a-z]$/, print: /^[ -~]$/,
  punct: /^[!-/:-@[-`{-~]$/, space: /^[ \t\r\n\v\f]$/, upper: /^[A-Z]$/, xdigit: /^[A-Fa-f0-9]$/,
}

/** The closing bracket of a glob expression, skipping named character classes and a leading literal bracket. */
function bracketEnd(pattern: string, start: number): number {
  let i = start + 1
  if (pattern.charAt(i) === '!' || pattern.charAt(i) === '^') i += 1
  if (pattern.charAt(i) === ']') i += 1
  for (; i < pattern.length; i += 1) {
    if (pattern.startsWith('[:', i)) {
      const end = pattern.indexOf(':]', i + 2)
      if (end < 0) return pattern.indexOf(']', i + 2)
      i = end + 1
      continue
    }
    if (pattern.charAt(i) === ']') return i
  }
  return -1
}

/** One step of a glob: the index after the token at `p` when it matches `ch`, else -1. */
function stepGlob(pattern: string, p: number, ch: string): number {
  const token = pattern.charAt(p)
  if (token === '?') return p + 1
  if (token !== '[') return token === ch ? p + 1 : -1
  const end = bracketEnd(pattern, p)
  if (end < 0) return ch === '[' ? p + 1 : -1
  const negate = pattern.charAt(p + 1) === '!' || pattern.charAt(p + 1) === '^'
  const body = pattern.slice(negate ? p + 2 : p + 1, end)
  let hit = false
  for (let i = 0; i < body.length; i += 1) {
    if (body.startsWith('[:', i)) {
      const end = body.indexOf(':]', i + 2)
      if (end >= 0) {
        hit = hit || CHARACTER_CLASSES[body.slice(i + 2, end)]?.test(ch) === true
        i = end + 1
        continue
      }
    }
    if (body.charAt(i + 1) === '-' && i + 2 < body.length) {
      hit = hit || (body.charAt(i) <= ch && ch <= body.charAt(i + 2))
      i += 2
    } else hit = hit || body.charAt(i) === ch
  }
  return hit === negate ? -1 : end + 1
}

/** The pattern with each run of `*` as one `*`, which matches the same names. */
function compact(pattern: string): string {
  return pattern.replace(/\*+/g, '*')
}

/** Charges actual comparison work without interpreting exhaustion as a match. */
class Comparison {
  private steps = 0

  constructor(private readonly meter?: Meter) {}

  /** True while this comparison remains inside its work budget. */
  spend(units = 1): boolean {
    this.steps += units
    if (this.meter !== undefined) this.meter.steps += units
    return this.steps <= MAX_GLOB_STEPS && (this.meter === undefined || this.meter.steps <= (this.meter.limit ?? Infinity))
  }
}

/** Safe literal edges stop impossible comparisons before wildcard work. */
function edges(pattern: string, tokens: readonly GlobToken[]): { prefix: string; suffix: string } {
  const literal = (token: GlobToken): string | undefined => 'star' in token || pattern.charAt(token.at) === '?' || pattern.charAt(token.at) === '[' && token.end > token.at ? undefined : pattern.charAt(token.at)
  let prefix = ''
  let suffix = ''
  for (const token of tokens) {
    const ch = literal(token)
    if (ch === undefined) break
    prefix += ch
  }
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const ch = literal(tokens[i]!)
    if (ch === undefined) break
    suffix = ch + suffix
  }
  return { prefix, suffix }
}

/** Matches a complete name, or returns uncertainty when bounded comparison work expires. */
export function globMatch(pattern: string, name: string, meter?: Meter, dot = false): boolean | 'uncertain' {
  if (!dot && name.startsWith('.') && !pattern.startsWith('.')) return false
  const work = new Comparison(meter)
  if (!work.spend(pattern.length + name.length)) return 'uncertain'
  const glob = compact(pattern)
  const tokens = globTokens(glob, work)
  if (tokens === undefined) return 'uncertain'
  const edge = edges(glob, tokens)
  if (!name.startsWith(edge.prefix) || !name.endsWith(edge.suffix)) return false
  let p = 0
  let n = 0
  let star = -1
  let mark = 0
  while (n < name.length) {
    if (!work.spend(glob.charAt(p) === '[' ? glob.length - p : 1)) return 'uncertain'
    if (glob.charAt(p) === '*') {
      star = p
      mark = n
      p += 1
      continue
    }
    const next = p < glob.length ? stepGlob(glob, p, name.charAt(n)) : -1
    if (next >= 0) {
      p = next
      n += 1
    } else if (star >= 0) {
      p = star + 1
      mark += 1
      n = mark
    } else return false
  }
  while (glob.charAt(p) === '*') p += 1
  return p === glob.length
}

/** One token of a glob segment: `*`, or one character position of the pattern (`?`, a class, or a literal). */
type GlobToken = { star: true } | { at: number; end: number }

/** The tokens of a compacted glob segment. */
function globTokens(glob: string, work: Comparison): GlobToken[] | undefined {
  const tokens: GlobToken[] = []
  for (let p = 0; p < glob.length; ) {
    if (!work.spend(glob.charAt(p) === '[' ? glob.length - p : 1)) return undefined
    if (glob.charAt(p) === '*') {
      tokens.push({ star: true })
      p += 1
      continue
    }
    const end = glob.charAt(p) === '[' ? bracketEnd(glob, p) : -1
    tokens.push({ at: p, end: Math.max(p, end) })
    p = end < 0 ? p + 1 : end + 1
  }
  return tokens
}

/** Finds one character accepted by every current token, including bracket intersections. */
function sharedCharacter(globs: readonly string[], tokens: readonly (GlobToken | undefined)[], leadingDot: boolean, work: Comparison): boolean | 'uncertain' {
  if (tokens.some(token => token === undefined)) return false
  const fixed = tokens.flatMap((token, i) => {
    if (token === undefined || 'star' in token) return []
    const pattern = globs[i]!
    const ch = pattern.charAt(token.at)
    return ch === '?' || ch === '[' && token.end > token.at ? [] : [ch.charCodeAt(0)]
  })
  const candidates = new Set<number>(fixed.length > 0 ? [fixed[0]!] : [65535])
  if (fixed.length === 0) for (let point = 1; point < 128; point += 1) candidates.add(point)
  for (const [i, token] of (fixed.length > 0 ? [] : tokens).entries()) {
    if (token === undefined || 'star' in token) continue
    const pattern = globs[i]!
    const end = token.end
    if (!work.spend(Math.max(1, end - token.at + 1))) return 'uncertain'
    for (let j = token.at; j <= Math.max(token.at, end); j += 1) {
      const point = pattern.charCodeAt(j)
      for (const value of [point - 1, point, point + 1]) if (value > 0 && value <= 65535) candidates.add(value)
    }
  }
  for (const point of candidates) {
    if (point === 47 || point === 46 && !leadingDot) continue
    let matches = true
    for (const [i, token] of tokens.entries()) {
      if (token === undefined || 'star' in token) continue
      const pattern = globs[i]!
      if (!work.spend(pattern.charAt(token.at) === '[' ? pattern.length - token.at : 1)) return 'uncertain'
      if (stepGlob(pattern, token.at, String.fromCharCode(point)) < 0) {
        matches = false
        break
      }
    }
    if (matches) return true
  }
  return false
}

/** Requires one shared name across all patterns, with bounded product-state traversal. */
function intersectGlobs(patterns: readonly string[], dots: readonly boolean[], meter?: Meter): boolean | 'uncertain' {
  const work = new Comparison(meter)
  if (!work.spend(patterns.reduce((sum, pattern) => sum + pattern.length + 1, 0))) return 'uncertain'
  const globs = patterns.map(compact)
  const tokens: GlobToken[][] = []
  for (const glob of globs) {
    const parsed = globTokens(glob, work)
    if (parsed === undefined) return 'uncertain'
    tokens.push(parsed)
  }
  const literalEdges = globs.map((glob, i) => edges(glob, tokens[i]!))
  for (let i = 0; i < globs.length; i += 1) for (let j = 0; j < i; j += 1) {
    const a = literalEdges[i]!
    const b = literalEdges[j]!
    if (!work.spend(a.prefix.length + b.prefix.length + a.suffix.length + b.suffix.length + 1)) return 'uncertain'
    if (!a.prefix.startsWith(b.prefix) && !b.prefix.startsWith(a.prefix) || !a.suffix.endsWith(b.suffix) && !b.suffix.endsWith(a.suffix)) return false
    if (globs[i]!.startsWith('.') && !globs[j]!.startsWith('.') && !dots[j] || globs[j]!.startsWith('.') && !globs[i]!.startsWith('.') && !dots[i]) return false
  }
  const pending = [{ at: globs.map(() => 0), started: false }]
  const seen = new Set<string>()
  while (pending.length > 0) {
    if (!work.spend(globs.length + 1)) return 'uncertain'
    const state = pending.pop()!
    const key = `${state.started}:${state.at.join(',')}`
    if (seen.has(key)) continue
    seen.add(key)
    if (state.at.every((at, i) => at === tokens[i]!.length)) return true
    const current = state.at.map((at, i) => tokens[i]![at])
    for (const [i, token] of current.entries()) if (token !== undefined && 'star' in token) {
      if (!work.spend(globs.length)) return 'uncertain'
      const next = [...state.at]
      next[i] = next[i]! + 1
      pending.push({ at: next, started: state.started })
    }
    const leadingDot = state.started || globs.every((glob, i) => dots[i] || glob.startsWith('.'))
    const matches = sharedCharacter(globs, current, leadingDot, work)
    if (matches === 'uncertain') return matches
    if (matches) pending.push({ at: state.at.map((at, i) => current[i] !== undefined && 'star' in current[i]! ? at : at + 1), started: true })
  }
  return false
}

/** Whether one name matches both glob segments, preserving comparison uncertainty. */
export function globsMeet(first: string, second: string, meter?: Meter, dot = false, otherDot = false): boolean | 'uncertain' {
  return intersectGlobs([first, second], [dot, otherDot], meter)
}

/** The find names of a selection, all of which an entry must match. */
export function selectionNames(selection: Reach['selection']): string[] {
  return selection?.names ?? []
}

/** Requires all predicates to match the same literal name or glob candidate. */
function namesMatch(names: readonly string[], name: string, glob: boolean, meter?: Meter, dot = false): boolean | 'uncertain' {
  if (glob) return intersectGlobs([...names, name], [...names.map(() => true), dot], meter)
  let uncertain = false
  for (const pattern of names) {
    const matches = globMatch(pattern, name, meter, true)
    if (matches === false) return false
    if (matches === 'uncertain') uncertain = true
  }
  return uncertain ? 'uncertain' : true
}

/** A path or a path segment as a case-insensitive comparison reads it. */
export function foldCase(segment: string): string {
  return segment.toLowerCase().replace(/\[:upper:\]/g, '[:lower:]')
}

/** How the effect stands to a protected path or glob, comparing each segment within the work budget. */
export function relation(reach: Reach, target: string, meter?: Meter, targetGlob?: string, targetOptions?: Effect['globOptions']): Relation | 'uncertain' | undefined {
  if (reach.selection !== undefined) return selectedRelation(reach, target, meter, targetGlob, targetOptions)
  const dot = reach.globOptions?.dot === true
  const targetDot = targetOptions?.dot === true
  const nocase = reach.globOptions?.nocase || targetOptions?.nocase
  const left = reach.path.split('/').filter(Boolean)
  const right = target.split('/').filter(Boolean)
  const leftPrefix = left.length
  const rightPrefix = right.length
  if (reach.glob !== undefined) left.push(...reach.glob.split('/'))
  if (targetGlob !== undefined) right.push(...targetGlob.split('/'))
  if (nocase) {
    for (let i = 0; i < left.length; i += 1) left[i] = foldCase(left[i]!)
    for (let i = 0; i < right.length; i += 1) right[i] = foldCase(right[i]!)
  }
  if (meter !== undefined) meter.steps += reach.path.length + target.length + (reach.glob?.length ?? 0) + (targetGlob?.length ?? 0)
  if (left.slice(leftPrefix, -1).includes('**') || right.slice(rightPrefix, -1).includes('**')) return recursiveRelation(left, right, leftPrefix, rightPrefix, reach.recursive, meter, dot, targetDot)
  let uncertain = false
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    const a = left[i] as string
    const b = right[i] as string
    const aGlob = i >= leftPrefix && hasGlob(a)
    const bGlob = i >= rightPrefix && hasGlob(b)
    const matches = aGlob && bGlob ? globsMeet(a, b, meter, dot, targetDot) : aGlob ? globMatch(a, b, meter, dot) : bGlob ? globMatch(b, a, meter, targetDot) : a === b
    if (matches === false) return undefined
    if (matches === 'uncertain') uncertain = true
  }
  if (uncertain) return 'uncertain'
  if (left.length === right.length) return 'same'
  if (left.length > right.length) return 'inside'
  return reach.recursive ? 'contains' : undefined
}

/** Compares a find selection to the target and its ancestors, without inventing deletion of the starting tree. */
function selectedRelation(reach: Reach, target: string, meter?: Meter, targetGlob?: string, targetOptions?: Effect['globOptions']): Relation | 'uncertain' | undefined {
  const selection = reach.selection as NonNullable<Reach['selection']>
  const minDepth = selection.minDepth ?? 0
  const maxDepth = selection.maxDepth ?? Infinity
  if (minDepth > maxDepth) return undefined
  const names = selectionNames(selection)
  const possible = selectionPossible(selection, meter)
  if (possible === false) return undefined
  if (possible === 'uncertain') return possible
  if (selection.parentOperand !== undefined) return parentRelation(reach, target, meter, targetGlob, targetOptions)
  const base = relation({ ...reach, selection: undefined, recursive: true }, target, meter, targetGlob, targetOptions)
  if (base === undefined || base === 'uncertain') return base
  if (base === 'inside') return base
  if (base === 'same') {
    const candidate = targetGlob?.split('/').at(-1) ?? basenameOf(target)
    const rootGlob = reach.glob?.split('/').at(-1)
    const predicates = rootGlob === undefined ? names : [...names, rootGlob]
    const matches = namesMatch(predicates, candidate, targetGlob !== undefined && hasGlob(candidate), meter, targetOptions?.dot)
    if (matches === 'uncertain') return matches
    return minDepth === 0 && matches ? 'same' : maxDepth > 0 ? 'inside' : undefined
  }
  const descend = selection.descend === true
  const rootDepth = reach.path.split('/').filter(Boolean).length + (reach.glob?.split('/').length ?? 0)
  const parts = `${target}${targetGlob === undefined ? '' : `/${targetGlob}`}`.split('/').filter(Boolean)
  const rootName = parts[rootDepth - 1] ?? ''
  if (descend && !selection.file && minDepth === 0) {
    const matches = namesMatch(names, rootName, targetGlob !== undefined && rootDepth > target.split('/').filter(Boolean).length && hasGlob(rootName), meter, targetOptions?.dot)
    if (matches === 'uncertain') return matches
    if (matches) return 'contains'
  }
  const suffix = parts.slice(rootDepth)
  for (let i = 0; i < suffix.length; i += 1) {
    if (i + 1 < minDepth || i + 1 > maxDepth) continue
    const last = i === suffix.length - 1
    if (!last && (selection.file || !descend)) continue
    const part = suffix[i] as string
    const matches = namesMatch(names, part, targetGlob !== undefined && rootDepth + i >= target.split('/').filter(Boolean).length && hasGlob(part), meter, targetOptions?.dot)
    if (matches === 'uncertain') return matches
    if (matches) return last ? 'same' : 'contains'
  }
  return undefined
}

/** Compares an execdir sibling operand below each possible selected entry's parent, retaining selection depth. */
function parentRelation(reach: Reach, target: string, meter?: Meter, targetGlob?: string, targetOptions?: Effect['globOptions']): Relation | 'uncertain' | undefined {
  const selection = reach.selection!
  const rootDepth = reach.path.split('/').filter(Boolean).length + (reach.glob?.split('/').length ?? 0)
  const parts = target.split('/').filter(Boolean)
  const min = Math.max(0, (selection.minDepth ?? 1) - 1)
  const max = (selection.maxDepth ?? Infinity) - 1
  for (let depth = min; depth <= max && rootDepth + depth <= parts.length; depth += 1) {
    const parent = `/${parts.slice(0, rootDepth + depth).join('/')}`
    const base = relation({ path: reach.path, glob: reach.glob, recursive: true }, parent, meter)
    if (base === undefined) continue
    if (base === 'uncertain') return base
    const operand = joinPath(parent, selection.parentOperand!)
    const glob = selection.parentGlob ? splitGlob(operand) : undefined
    const found = relation({ path: glob?.path ?? operand, glob: glob?.glob, globOptions: reach.globOptions, recursive: selection.descend === true }, target, meter, targetGlob, targetOptions)
    if (found !== undefined) return found
  }
  return undefined
}

/** Matches recursive directory segments with bounded iterative states, preserving ordinary wildcard and leading-dot rules. */
function recursiveRelation(left: readonly string[], right: readonly string[], leftPrefix: number, rightPrefix: number, recursive: boolean, meter?: Meter, dot = false, targetDot = false): Relation | 'uncertain' | undefined {
  const pending: [number, number][] = [[0, 0]]
  const seen = new Set<number>()
  const work: Meter = { steps: 0 }
  let found: Relation | undefined
  let uncertain = false
  while (pending.length > 0) {
    work.steps += 1
    if (work.steps > MAX_GLOB_STEPS) {
      uncertain = true
      break
    }
    const [i, j] = pending.pop() as [number, number]
    const key = i * (right.length + 1) + j
    if (seen.has(key)) continue
    seen.add(key)
    const a = left[i]
    const b = right[j]
    const aStar = i >= leftPrefix && i + 1 < left.length && a === '**'
    const bStar = j >= rightPrefix && j + 1 < right.length && b === '**'
    if (aStar) pending.push([i + 1, j])
    if (bStar) pending.push([i, j + 1])
    if (a === undefined || b === undefined) {
      if (a === undefined && b === undefined) {
        found = 'same'
        break
      }
      if (b === undefined) found = 'inside'
      else if (recursive && found === undefined) found = 'contains'
      continue
    }
    if (aStar || bStar) {
      if (aStar && (dot || !b.startsWith('.'))) pending.push([i, j + 1])
      if (bStar && (targetDot || !a.startsWith('.'))) pending.push([i + 1, j])
      continue
    }
    const aGlob = i >= leftPrefix && hasGlob(a)
    const bGlob = j >= rightPrefix && hasGlob(b)
    const matches = aGlob && bGlob ? globsMeet(a, b, work, dot, targetDot) : aGlob ? globMatch(a, b, work, dot) : bGlob ? globMatch(b, a, work, targetDot) : a === b
    if (work.steps > MAX_GLOB_STEPS) {
      uncertain = true
      break
    }
    if (matches === 'uncertain') uncertain = true
    else if (matches) pending.push([i + 1, j + 1])
  }
  if (meter !== undefined) meter.steps += work.steps
  return found ?? (uncertain ? 'uncertain' : undefined)
}

/** A stable equality key retains every selection constraint without depending on property order. */
export function selectionKey(selection: Reach['selection']): string | undefined {
  if (selection === undefined) return undefined
  return JSON.stringify([selection.parentOperand, selection.parentGlob === true, [...new Set(selectionNames(selection))].sort(), selection.file === true, selection.minDepth ?? 0, selection.maxDepth, selection.descend])
}

/** Whether a find conjunction has any possible shared name, with explicit bounded uncertainty. */
export function selectionPossible(selection: Reach['selection'], meter?: Meter): boolean | 'uncertain' {
  const names = selectionNames(selection)
  return intersectGlobs(names, names.map(() => true), meter)
}
