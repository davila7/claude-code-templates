// The interpreter code scan associates literal paths with file operations.
// Pure: no `$`. Bounded lookahead keeps each scan linear.

import { absolute, hasGlob, isRemote, looksLikePath, MAX_PATH, PATH_TOO_LONG, splitGlob } from './paths'
import type { Effect, EffectKind } from './types'

/** Words that make recognized file paths in the code a deletion: removal, moves, and running other programs, whose effects Arrester cannot see. */
const DESTROY_WORDS: readonly string[] = ['rmtree', 'removedirs', 'remove_tree', 'os.remove', 'os.replace', 'unlink', 'rmdir', 'rmSync', '.rm(', 'rimraf', 'FileUtils.rm', 'File.delete', 'Deno.remove', 'rename', 'shutil.move', 'truncate', 'system(', 'subprocess', 'child_process', 'execSync', 'exec(', 'spawn', 'popen', 'Deno.Command', 'Deno.run']

/** Words that make recognized file paths in the code a write. */
const WRITE_WORDS: readonly string[] = ['write_text', 'write_bytes', 'writeFile', 'appendFile', 'createWriteStream', 'mkdir', 'makedirs', 'chmod', 'chown', 'copyfile', 'copytree', 'copyFile', 'shutil.copy', 'cpSync', 'symlink', 'File.write']

/** Names of calls that read a file without a word in the lists above. */
const READ_CALL = /(?:open|glob|readFile(?:Sync)?|read_text|read_bytes|readdir(?:Sync)?|readlink|stat|lstat|access|exists|read)$/

/** A Python `shutil` copy, whose `src=` and `dst=` arguments are keywords. In other languages, `src = …` in a call is an assignment. */
const SHUTIL_COPY = /(?:^|[^.]|shutil\.)(?:copy2?|copyfile|copytree|copymode|copystat)$/

/** One method called on a path object, up to its `(`. */
const METHOD = /\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/y
/** The next method called in a chain on a path object, past attributes such as `.parent`, up to its `(`. */
const LINK = /\s*(?:\.\s*[A-Za-z_][A-Za-z0-9_]*\s*)*?\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/y
const METHOD_WINDOW = 120

/** Path methods that return the same file, so a file operation after them still acts on the path. */
const SAME_FILE = new Set(['resolve', 'absolute', 'expanduser'])

/** The end of the path expression after such a method: the end of an argument, a bracket, or a statement. */
const CHAIN_END = /\s*(?:[)\]},;]|$)/y

const MODE = /^[rwxabt+<>]{1,4}$/
const PERL_MODE = /^\+?[<>]{1,2}/
const WRITE_MODE = /[wax+>]/
const SPECIFIER = /(?:\brequire\(|\bimport\(|\bfrom|\bimport)\s*$/
const SPECIFIER_WINDOW = 16
const BARE = /^\.{0,2}\/?$/

/** One string literal of the code: its text and source bounds. */
type Literal = { text: string; start: number; end: number }

/** The string literals of the code: `'…'`, `"…"`, tripled quotes, and a template literal up to its first `${`. */
function literals(code: string): Literal[] {
  const found: Literal[] = []
  let i = 0
  while (i < code.length) {
    const quote = code.charAt(i)
    if (quote !== "'" && quote !== '"' && quote !== '`') {
      i += 1
      continue
    }
    const close = quote !== '`' && code.startsWith(quote.repeat(3), i) ? quote.repeat(3) : quote
    let j = i + close.length
    let text = ''
    let isCut = false
    while (j < code.length && !code.startsWith(close, j)) {
      if (quote === '`' && code.startsWith('${', j)) isCut = true
      const step = code.charAt(j) === '\\' && j + 1 < code.length ? 2 : 1
      if (!isCut) text += code.charAt(j + step - 1)
      j += step
    }
    found.push({ text, start: i, end: j + close.length })
    i = j + close.length
  }
  return found
}

/** The mode a literal gives `open(`: a short mode string, or the prefix of a two-argument Perl open. */
function modeOf(literal: Literal): string | undefined {
  return MODE.test(literal.text) ? literal.text : PERL_MODE.exec(literal.text)?.[0]
}

/** The access of a recognized operation, independent of neighboring calls. */
function operationKind(name: string): EffectKind {
  if (DESTROY_WORDS.some(word => name.includes(word.replace(/\($/, '')))) return 'destroy'
  return WRITE_WORDS.some(word => name.includes(word)) ? 'write' : 'read'
}

/** Access shared by a file call and its path literals, including a later open mode. */
type Access = { kind: EffectKind; glob: boolean; potential?: boolean }

/** One literal path and the operation that accesses it. */
type FileLiteral = { literal: Literal; access: Access; definite: boolean }

/** One open call or bracket: the access of its arguments, the index and keyword of its current argument, and its kind. `named` marks a Python `shutil` copy. `twoPaths` marks `cpSync`, whose arguments after its destination, such as its options, name no file. `found` counts the literals found before it opened. `pathOpen` is the access of the path object whose `.open(` this is. `link` marks a method chained on a path object, with the access kind of the arguments of each method in that chain. */
type CallState = { access?: Access; multiple: boolean; argument: number; keyword: string; open: boolean; constructor: boolean; copy: boolean; named: boolean; twoPaths: boolean; pair: boolean; found: number; pathOpen?: Access; link?: EffectKind }

/** The keyword of the current argument of a Python `shutil` copy, or `''`. */
function copyKeyword(call: CallState): string {
  return call.named ? call.keyword : ''
}

/** The access of the current argument: a copy reads its source, named by `src=` in a Python `shutil` copy or else first, and gives the call's access to the rest, up to the destination of `cpSync`. */
function argumentAccess(call: CallState): Access | undefined {
  if (!call.copy || call.access === undefined) return call.access
  if (call.twoPaths && call.argument > 1) return undefined
  const keyword = copyKeyword(call)
  return keyword === 'src' || (keyword !== 'dst' && call.argument === 0) ? { kind: 'read', glob: false } : call.access
}

/** The method that `pattern` finds at `at`, and the index of its `(`. */
function nextMethod(code: string, at: number, pattern: RegExp): { name: string; open: number } | undefined {
  pattern.lastIndex = 0
  const match = pattern.exec(code.slice(at, at + METHOD_WINDOW))
  return match === null ? undefined : { name: match[1]!, open: at + pattern.lastIndex - 1 }
}

/** The first method chained after a path object, past methods that keep the same file, such as `.resolve()`, and the index of its `(`. A file operation, such as `.unlink()`, gives its own access. A method that changes the path, such as `.with_name()`, reads, whatever follows it. So does the last method that keeps the same file when the path goes on after it, as in `.resolve().parent`. */
function chainedOperation(code: string, at: number): { name: string; open: number } | undefined {
  const rest = code.slice(at, at + METHOD_WINDOW)
  let kept: { name: string; open: number } | undefined
  let k = 0
  for (;;) {
    METHOD.lastIndex = k
    const match = METHOD.exec(rest)
    if (match === null) break
    const method = { name: match[1]!, open: at + METHOD.lastIndex - 1 }
    if (!SAME_FILE.has(method.name)) return method
    let depth = 1
    for (k = METHOD.lastIndex; k < rest.length && depth > 0; k += 1) depth += rest.charAt(k) === '(' ? 1 : rest.charAt(k) === ')' ? -1 : 0
    if (depth > 0) return undefined
    kept = method
  }
  CHAIN_END.lastIndex = k
  return kept === undefined || CHAIN_END.test(rest) ? undefined : kept
}

/** True when the literal names a module (`require('…')`, `import('…')`, `from '…'`): code to load, not a file the code changes. */
function isSpecifier(code: string, literal: Literal): boolean {
  return SPECIFIER.test(code.slice(Math.max(0, literal.start - SPECIFIER_WINDOW), literal.start))
}

/** Selects literals within file operations, leaving printed text and other data out of the effects. */
function fileLiterals(code: string): FileLiteral[] {
  const strings = literals(code)
  const found: FileLiteral[] = []
  const calls: CallState[] = []
  // The indices in `found` of the literals that hold each access object, in order.
  const holders = new Map<Access, number[]>()
  let pathOpen: { at: number; access: Access } | undefined
  // The `(` of the next method in a chain on a path object, and the access kind of the arguments of that chain.
  let chain: { at: number; kind: EffectKind } | undefined
  let next = 0
  let name = ''
  for (let i = 0; i < code.length; i += 1) {
    const literal = strings[next]
    if (literal?.start === i) {
      const call = calls.at(-1)
      const bare = /(?:unlink|rmdir|open)\s*$/.exec(code.slice(Math.max(0, i - 32), i))?.[0].trim()
      if (call?.open && call.access !== undefined) {
        const mode = modeOf(literal)
        if (mode !== undefined && WRITE_MODE.test(mode)) call.access.kind = 'write'
      }
      if (call?.pathOpen !== undefined && (call.keyword === 'mode' || (call.keyword === '' && call.argument === 0)) && MODE.test(literal.text) && WRITE_MODE.test(literal.text)) call.pathOpen.kind = 'write'
      const access = bare === undefined ? call && argumentAccess(call) : { kind: operationKind(bare), glob: false }
      if (access !== undefined && (bare !== undefined || call?.multiple || call?.argument === 0)) {
        found.push({ literal, definite: !access.potential && (bare !== undefined || call?.argument === 0 || call?.pair === true && (call.argument < 2 || call.keyword === 'src' || call.keyword === 'dst') || call?.open === true && /(?:my\s+\$|FH\b)/.test(code.slice(Math.max(0, literal.start - 80), literal.start))), access })
        const held = holders.get(access)
        if (held === undefined) holders.set(access, [found.length - 1])
        else held.push(found.length - 1)
      }
      i = literal.end - 1
      next += 1
      name = ''
      continue
    }
    const ch = code.charAt(i)
    if (/[A-Za-z0-9_.$]/.test(ch)) name = (name + ch).slice(-80)
    else if (ch === '(' || ch === '[') {
      const parent = calls.at(-1)
      const inherited = parent !== undefined && (parent.multiple || parent.argument === 0) ? argumentAccess(parent) : undefined
      const kind = operationKind(name)
      const operation = READ_CALL.test(name) || /Path$/.test(name)
        || kind !== 'read' && !/(?:write_text|write_bytes)$/.test(name)
      const constructor = /(?:^|[^A-Za-z0-9_$])Path\s*$/.test(code.slice(Math.max(0, i - 16), i))
      const link = chain?.at === i ? chain.kind : undefined
      const access = constructor && inherited !== undefined ? inherited : operation ? { kind, glob: /glob$/.test(name), potential: /(?:system|subprocess|child_process|exec|spawn|popen|Deno\.(?:Command|run))/.test(name) } : inherited === undefined || name === '' ? inherited : { ...inherited, kind: link ?? inherited.kind, potential: true }
      calls.push({ access, multiple: !operation && inherited !== undefined || /(?:open|copy|cpSync|move|rename|replace|symlink|subprocess|exec|spawn|system|popen)/i.test(name), argument: 0, keyword: '', open: /open$/.test(name), constructor, copy: /(?:copy|cpSync)/.test(name), named: SHUTIL_COPY.test(name), twoPaths: /cpSync/.test(name), pair: /(?:copy|cpSync|move|rename|replace|symlink)/.test(name), found: found.length, pathOpen: pathOpen?.at === i ? pathOpen.access : undefined, link })
      name = ''
    } else if (ch === ')' || ch === ']') {
      const call = calls.pop()
      const method = call?.constructor && call.access !== undefined ? chainedOperation(code, i + 1) : undefined
      if (call?.access !== undefined && method !== undefined) {
        // The method decides the access of the path, apart from the call around it, which can share the access object.
        // Each literal leaves the shared object once, so the work stays linear.
        const own: Access = { kind: operationKind(method.name), glob: call.access.glob }
        const held = holders.get(call.access) ?? []
        while (held.length > 0 && held.at(-1)! >= call.found) {
          const k = held.pop()!
          found[k] = { ...found[k]!, access: own }
        }
        if (method.name === 'open') pathOpen = { at: method.open, access: own }
      }
      // The arguments of each method chained on the path, such as `'.x'` in `.with_suffix('.x')`, take the kind of the method
      // right after `Path(…)`, never the access of the call around the path. A file operation in those arguments keeps its own access.
      const after = call?.link !== undefined ? nextMethod(code, i + 1, LINK) : call?.constructor && call.access !== undefined ? nextMethod(code, i + 1, METHOD) : undefined
      if (after !== undefined) chain = { at: after.open, kind: call?.link ?? operationKind(after.name) }
      name = ''
    } else if (ch === ',') {
      const call = calls.at(-1)
      if (call !== undefined) {
        call.argument += 1
        call.keyword = ''
      }
      name = ''
    } else if (ch === '=') {
      const call = calls.at(-1)
      if (call !== undefined && code.charAt(i + 1) !== '=' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) call.keyword = name
      name = ''
    } else if (!/\s/.test(ch)) name = ''
  }
  return found
}

/** The effects of a piece of interpreter code run in `cwd`; module names and the bare `.`, `..`, and `/` name no file. */
export function scanCode(code: string, cwd: string | undefined): { effects: Effect[]; opaque?: string } {
  const effects: Effect[] = []
  let opaque: string | undefined
  for (const { literal, access, definite } of fileLiterals(code)) {
    const { kind } = access
    if (isSpecifier(code, literal)) continue
    const operand = literal.text.replace(PERL_MODE, '')
    const resolved = absolute(operand, cwd)
    if (definite && !isRemote(operand) && (resolved?.length ?? operand.length) > MAX_PATH) opaque = PATH_TOO_LONG
    for (const word of literal.text.split(/\s+/)) {
      const token = word.replace(PERL_MODE, '')
      if (BARE.test(token) || !looksLikePath(token)) continue
      const path = absolute(token, cwd)
      if (path === undefined || path.length > MAX_PATH) continue
      const globbed = access.glob && hasGlob(path) ? splitGlob(path) : undefined
      effects.push({ path: globbed?.path ?? path, glob: globbed?.glob, kind, recursive: kind === 'destroy' })
    }
  }
  return { effects, opaque }
}
