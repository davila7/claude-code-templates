// The interpreter code scan associates literal paths with file operations.
// Pure: no `$`. Bounded lookahead keeps each scan linear.

import { absolute, hasGlob, isRemote, looksLikePath, MAX_PATH, PATH_TOO_LONG, splitGlob } from './paths'
import type { Effect, EffectKind } from './types'

/** Words that make recognized file paths in the code a deletion: removal, moves, and running other programs, whose effects Arrester cannot see. */
const DESTROY_WORDS: readonly string[] = ['rmtree', 'removedirs', 'remove_tree', 'os.remove', 'os.replace', 'unlink', 'rmdir', 'rmSync', '.rm(', 'rimraf', 'FileUtils.rm', 'File.delete', 'Deno.remove', 'rename', 'shutil.move', 'truncate', 'system(', 'subprocess', 'child_process', 'execSync', 'exec(', 'spawn', 'popen', 'Deno.Command', 'Deno.run']

/** Words that make recognized file paths in the code a write. */
const WRITE_WORDS: readonly string[] = ['write_text', 'write_bytes', 'writeFile', 'appendFile', 'createWriteStream', 'mkdir', 'makedirs', 'chmod', 'chown', 'copyfile', 'copytree', 'copyFile', 'cpSync', 'symlink', 'File.write']

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

/** True when the literal names a module (`require('…')`, `import('…')`, `from '…'`): code to load, not a file the code changes. */
function isSpecifier(code: string, literal: Literal): boolean {
  return SPECIFIER.test(code.slice(Math.max(0, literal.start - SPECIFIER_WINDOW), literal.start))
}

/** Selects literals within file operations, leaving printed text and other data out of the effects. */
function fileLiterals(code: string): FileLiteral[] {
  const strings = literals(code)
  const found: FileLiteral[] = []
  const calls: { access?: Access; multiple: boolean; argument: number; open: boolean; constructor: boolean; copy: boolean; pair: boolean }[] = []
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
      const access = bare === undefined ? call?.access : { kind: operationKind(bare), glob: false }
      if (access !== undefined && (bare !== undefined || call?.multiple || call?.argument === 0)) {
        found.push({ literal, definite: !access.potential && (bare !== undefined || call?.argument === 0 || call?.pair === true && call.argument < 2 || call?.open === true && /(?:my\s+\$|FH\b)/.test(code.slice(Math.max(0, literal.start - 80), literal.start))), access: call?.copy && call.argument === 0 ? { kind: 'read', glob: false } : access })
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
      const inherited = parent !== undefined && (parent.multiple || parent.argument === 0) ? parent.access : undefined
      const kind = operationKind(name)
      const operation = /(?:open|Path|glob|readFile(?:Sync)?|read_text|read_bytes|readdir(?:Sync)?|readlink|stat|lstat|access|exists|read)$/.test(name)
        || kind !== 'read' && !/(?:write_text|write_bytes)$/.test(name)
      const constructor = /(?:^|\.)Path$/.test(name)
      const access = constructor && inherited !== undefined ? inherited : operation ? { kind, glob: /glob$/.test(name), potential: /(?:system|subprocess|child_process|exec|spawn|popen|Deno\.(?:Command|run))/.test(name) } : inherited === undefined || name === '' ? inherited : { ...inherited, potential: true }
      calls.push({ access, multiple: !operation && inherited !== undefined || /(?:open|copy|move|rename|replace|symlink|subprocess|exec|spawn|system|popen)/i.test(name), argument: 0, open: /open$/.test(name), constructor, copy: /(?:copy|cpSync)/.test(name), pair: /(?:copy|cpSync|move|rename|replace|symlink)/.test(name) })
      name = ''
    } else if (ch === ')' || ch === ']') {
      const call = calls.pop()
      if (call?.constructor && call.access !== undefined) {
        const method = /^\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(code.slice(i + 1, i + 121))?.[1]
        if (method !== undefined) call.access.kind = operationKind(method)
      }
      name = ''
    } else if (ch === ',') {
      const call = calls.at(-1)
      if (call !== undefined) call.argument += 1
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
