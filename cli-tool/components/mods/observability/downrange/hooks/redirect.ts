/**
 * The redirect rule: the one file that a background command's own text sends its output to, its redirect file. A
 * small reader of shell text finds it. It gives up on text it cannot read for sure, and the command then follows no file.
 */

/** A word after quote removal; isLiteral is false when the shell can expand it: a variable, command text, a pattern, or a leading `~`. */
type Word = { kind: 'word'; text: string; isLiteral: boolean }
/** A redirection, with the file descriptor written right before it: digits or `{name}`, or empty. */
type Redirect = { kind: 'redirect'; op: string; fd: string }
/** An operator between commands. */
type Separator = { kind: 'separator'; op: string }
type Token = Word | Redirect | Separator

/** Redirection operators, longest first. */
const REDIRECTS = ['&>>', '&>', '>>', '>&', '>|', '>', '<<<', '<<-', '<<', '<>', '<&', '<']
/** A here-document, whose lines this reader does not follow. */
const HERE_DOCUMENTS: ReadonlySet<string> = new Set(['<<', '<<-'])
/** Operators between commands, longest first. */
const SEPARATORS = ['&&', '&', '||', '|&', '|', ';;&', ';;', ';&', ';', '(', ')', '\n']
/** Characters that end a word outside quotes. */
const METACHARACTERS: ReadonlySet<string> = new Set([' ', '\t', '\n', '|', '&', ';', '(', ')', '<', '>'])
/** Unquoted characters that make a word a pattern or a brace list. */
const PATTERN_CHARACTERS: ReadonlySet<string> = new Set(['*', '?', '[', '{'])
/** Commands that change the folder, after which a relative path can name another file. */
const FOLDER_CHANGES: ReadonlySet<string> = new Set(['cd', 'chdir', 'pushd', 'popd'])
/** Words that run other shell text in this shell, or a builtin behind a prefix, which can change the folder out of sight: anywhere in the command. */
const HIDDEN_CODE: ReadonlySet<string> = new Set(['eval', 'source', 'command', 'builtin'])
/** The operators of a plain command list; every other operator, such as `||`, `(`, or `&`, makes the text one this reader does not follow. */
const LIST_SEPARATORS: ReadonlySet<string> = new Set(['&&', ';', '\n', '|', '|&'])
/** Words that, as a command, start or belong to code that may not run, or that runs later or in the background: a function, a condition, a loop, or a group. */
const COMPOUND_WORDS: ReadonlySet<string> = new Set(['function', 'if', 'then', 'elif', 'else', 'fi', 'case', 'esac', 'while', 'until', 'for', 'select', 'do', 'done', 'repeat', 'foreach', 'coproc', '{', '}'])
/** Words before a command that keep the next word a command: `!`, `time`, and `time -p`. */
const PIPELINE_PREFIXES: ReadonlySet<string> = new Set(['!', 'time', '-p'])
/** A variable assignment before a command, such as `FLAGS=-j4`. */
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*\+?=/
/** The redirections that send standard output to a file, with the file descriptors each may carry: `>`, `>>`, `1>`, `1>>`, `&>`, `&>>`, and `>&`. */
const OUTPUT_REDIRECTS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['>', new Set(['', '1'])],
  ['>>', new Set(['', '1'])],
  ['&>', new Set([''])],
  ['&>>', new Set([''])],
  ['>&', new Set([''])],
])
/** A file descriptor written right before a redirection. */
const FD = /^(?:\d+|\{[A-Za-z_][A-Za-z0-9_]*\})$/
/** The target of `>&` that copies, moves (`3-`), or closes a file descriptor instead of naming a file. */
const DUPLICATE = /^(?:\d+-?|-)$/
/** A variable name or a special parameter after `$`. */
const PARAMETER = /[A-Za-z_][A-Za-z0-9_]*|[0-9?$!#*@-]/y
/** A Windows drive path, such as `C:/b.log`. */
const DRIVE = /^[A-Za-z]:/

/** The end of a `'…'` or `` `…` `` part that starts at `at`, after its closing mark; a backslash escapes the next character when isEscaped. */
function closingMarkOf(command: string, at: number, mark: string, isEscaped: boolean): number | undefined {
  for (let end = at + 1; end < command.length; end += 1) {
    if (isEscaped && command[end] === '\\') end += 1
    else if (command[end] === mark) return end + 1
  }
  return undefined
}

/** The end of the bracketed part that opens at `open`, after its closing bracket; quotes and expansions inside it are skipped. */
function closingBracketOf(command: string, open: number, opener: string, closer: string): number | undefined {
  let depth = 0
  let at = open
  while (at < command.length) {
    const char = command[at]
    if (char === '\\') {
      at += 2
      continue
    }
    if (char === "'" || char === '"' || char === '$' || char === '`') {
      const end = char === "'" ? closingMarkOf(command, at, "'", false) : char === '"' ? doubleQuotedAt(command, at)?.end : expansionEnd(command, at)
      if (end === undefined) return undefined
      at = end
      continue
    }
    if (char === opener) depth += 1
    else if (char === closer && --depth === 0) return at + 1
    at += 1
  }
  return undefined
}

/** The end of the expansion at `at`: `$(…)`, `$((…))`, `${…}`, `$'…'`, `$name`, a lone `$`, or `` `…` ``. */
function expansionEnd(command: string, at: number): number | undefined {
  if (command[at] === '`') return closingMarkOf(command, at, '`', true)
  const next = command[at + 1]
  if (next === '(') return closingBracketOf(command, at + 1, '(', ')')
  if (next === '{') return closingBracketOf(command, at + 1, '{', '}')
  if (next === "'") return closingMarkOf(command, at + 1, "'", true)
  PARAMETER.lastIndex = at + 1
  return PARAMETER.test(command) ? PARAMETER.lastIndex : at + 1
}

/** The `"…"` part at `at`: its text after quote removal, its end, and whether it holds no expansion. */
function doubleQuotedAt(command: string, at: number): { text: string; end: number; isLiteral: boolean } | undefined {
  let text = ''
  let isLiteral = true
  let index = at + 1
  while (index < command.length) {
    const char = command[index]!
    if (char === '"') return { text, end: index + 1, isLiteral }
    if (char === '\\' && index + 1 < command.length) {
      const next = command[index + 1]!
      if (next !== '\n') text += '$`"\\'.includes(next) ? next : `\\${next}`
      index += 2
    } else if (char === '$' || char === '`') {
      const end = expansionEnd(command, index)
      if (end === undefined) return undefined
      text += command.slice(index, end)
      isLiteral = false
      index = end
    } else {
      text += char
      index += 1
    }
  }
  return undefined
}

/** The word at `start`: its text after quote removal, its end, whether it is literal, and whether any of it was quoted. */
function wordAt(command: string, start: number): { text: string; end: number; isLiteral: boolean; isQuoted: boolean } | undefined {
  let text = ''
  let isLiteral = command[start] !== '~'
  let isQuoted = false
  let at = start
  while (at < command.length && !METACHARACTERS.has(command[at]!)) {
    const char = command[at]!
    if (char === '\\') {
      if (command[at + 1] !== '\n') text += command[at + 1] ?? ''
      isQuoted = true
      at += 2
    } else if (char === "'") {
      const end = closingMarkOf(command, at, "'", false)
      if (end === undefined) return undefined
      text += command.slice(at + 1, end - 1)
      isQuoted = true
      at = end
    } else if (char === '"') {
      const quoted = doubleQuotedAt(command, at)
      if (quoted === undefined) return undefined
      text += quoted.text
      isLiteral &&= quoted.isLiteral
      isQuoted = true
      at = quoted.end
    } else if (char === '$' || char === '`') {
      const end = expansionEnd(command, at)
      if (end === undefined) return undefined
      text += command.slice(at, end)
      isLiteral = false
      at = end
    } else {
      if (PATTERN_CHARACTERS.has(char)) isLiteral = false
      text += char
      at += 1
    }
  }
  return { text, end: at, isLiteral, isQuoted }
}

/**
 * The tokens of a command, or undefined for text this reader does not follow: an open quote, a here-document,
 * arithmetic in `((`, or a word right before `(`, such as a function or an array.
 */
function tokensOf(command: string): Token[] | undefined {
  const tokens: Token[] = []
  let fd = ''
  let at = 0
  while (at < command.length) {
    const char = command[at]!
    if (char === ' ' || char === '\t') {
      at += 1
      continue
    }
    if (char === '\\' && command[at + 1] === '\n') {
      at += 2
      continue
    }
    if (char === '#') {
      const end = command.indexOf('\n', at)
      at = end === -1 ? command.length : end
      continue
    }
    if (command.startsWith('((', at)) return undefined
    if ((char === '<' || char === '>') && command[at + 1] === '(') {
      // Process substitution: command text in place of a path.
      const end = closingBracketOf(command, at + 1, '(', ')')
      if (end === undefined) return undefined
      tokens.push({ kind: 'word', text: command.slice(at, end), isLiteral: false })
      fd = ''
      at = end
      continue
    }
    const redirect = REDIRECTS.find(op => command.startsWith(op, at))
    if (redirect !== undefined) {
      if (HERE_DOCUMENTS.has(redirect)) return undefined
      tokens.push({ kind: 'redirect', op: redirect, fd })
      fd = ''
      at += redirect.length
      continue
    }
    const separator = SEPARATORS.find(op => command.startsWith(op, at))
    if (separator !== undefined) {
      tokens.push({ kind: 'separator', op: separator })
      at += separator.length
      continue
    }
    const word = wordAt(command, at)
    if (word === undefined || command[word.end] === '(') return undefined
    at = word.end
    if ((command[at] === '<' || command[at] === '>') && !word.isQuoted && FD.test(word.text)) {
      fd = word.text
    } else {
      tokens.push({ kind: 'word', text: word.text, isLiteral: word.isLiteral })
    }
  }
  return tokens
}

/** Whether a redirection sends standard output to the file its target names. */
function isOutputRedirect(redirect: Redirect, target: Word): boolean {
  const fds = OUTPUT_REDIRECTS.get(redirect.op)
  return fds !== undefined && fds.has(redirect.fd) && (redirect.op !== '>&' || !DUPLICATE.test(target.text))
}

/** The file of `tee FILE` or `tee -a FILE`; `other` for another tee, whose files are unknown; undefined when the command is no tee. */
function teeFileOf(words: readonly Word[]): Word | 'other' | undefined {
  if (words[0]?.text !== 'tee') return undefined
  const files = words[1]?.text === '-a' ? words.slice(2) : words.slice(1)
  const [file] = files
  return files.length === 1 && file !== undefined && !file.text.startsWith('-') ? file : 'other'
}

/**
 * The one file that a command's own text sends its output to, as the text names it: the target of `>`, `>>`, `1>`,
 * `1>>`, `&>`, `&>>`, or `>&`, or the file of `tee FILE` or `tee -a FILE` at the end of a pipeline. Only a plain command
 * list counts: commands joined by `;`, `&&`, a new line, or a pipe. Undefined when the text names no such file, names two
 * different ones, names one that is not literal, holds `&` or `nohup`, holds code that may not run (a function, a
 * condition, a loop, `||`, a group, or a subshell), or names a relative path after a folder change.
 */
export function redirectTargetOf(command: string): string | undefined {
  const tokens = tokensOf(command)
  if (tokens === undefined) return undefined
  const targets: Word[] = []
  let pipeline: Word[][] = [[]]
  let isCondition = false
  let changesFolder = false
  /** Whether the next word is a command, where a word such as `if` or `{` starts compound code. */
  let isCommandStart = true
  /** Ends a pipeline: its last command's tee file counts, and an unknown tee follows nothing. */
  const isEnded = (): boolean => {
    const tee = pipeline.length > 1 ? teeFileOf(pipeline.at(-1) ?? []) : undefined
    if (tee !== undefined && tee !== 'other') targets.push(tee)
    pipeline = [[]]
    return tee !== 'other'
  }
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!
    if (token.kind === 'word') {
      if (token.text === 'nohup' || (isCommandStart && (COMPOUND_WORDS.has(token.text) || token.text.startsWith('{')))) return undefined
      if (HIDDEN_CODE.has(token.text) || (isCommandStart && token.text === '.')) changesFolder = true
      isCommandStart &&= PIPELINE_PREFIXES.has(token.text) || ASSIGNMENT.test(token.text)
      if (FOLDER_CHANGES.has(token.text)) changesFolder = true
      // Inside `[[ … ]]`, `<` and `>` compare strings.
      if (token.text === '[[') isCondition = true
      else if (token.text === ']]') isCondition = false
      pipeline.at(-1)?.push(token)
    } else if (token.kind === 'redirect') {
      if (isCondition) continue
      const target = tokens[index + 1]
      // zsh `>!`, `>>!`, and `>&!` force the redirection, so the word after `!` names the file: this reader follows none.
      if (target?.kind !== 'word' || target.text.startsWith('!')) return undefined
      index += 1
      if (isOutputRedirect(token, target)) targets.push(target)
    } else if (!LIST_SEPARATORS.has(token.op)) {
      return undefined
    } else if (token.op === '|' || token.op === '|&') {
      isCommandStart = true
      pipeline.push([])
    } else if (isEnded()) {
      isCommandStart = true
    } else {
      return undefined
    }
  }
  if (!isEnded()) return undefined
  const names = new Set(targets.map(target => target.text))
  const [name] = names
  if (names.size !== 1 || name === undefined || name === '' || targets.some(target => !target.isLiteral)) return undefined
  return changesFolder && !name.startsWith('/') ? undefined : name
}

/** Whether a path, with `.` and `..` folded by their text, is `/dev` or under it. */
function isDevicePath(path: string): boolean {
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (part === '..') parts.pop()
    else if (part !== '' && part !== '.') parts.push(part)
  }
  return parts[0] === 'dev'
}

/**
 * A redirect target as an absolute path in the session folder `cwd`. Undefined on Windows, where `cwd` is no POSIX
 * path and the shell can map a path to another folder, and for a drive path or a path under `/dev`.
 */
export function redirectFileOf(target: string, cwd: string): string | undefined {
  if (!cwd.startsWith('/') || DRIVE.test(target)) return undefined
  const path = target.startsWith('/') ? target : `${cwd.replace(/\/+$/, '')}/${target.replace(/^(?:\.\/+)+/, '')}`
  return isDevicePath(path) ? undefined : path
}
