// Guard paths and guard names: the files whose read or change
// counts as touching a guard while a block is open. Pure: no `$`.

import { isRecord } from './analyze/call'
import { lex } from './analyze/lexer'
import type { Word } from './analyze/lexer'
import { basenameOf, foldPath, joinPath, looksLikePath } from './analyze/paths'
import { INTERPRETER, KEYWORDS, SHELLS } from './analyze/programs'
import type { ArresterGuard } from '../types/index'

/** The settings sources whose command hooks name guard files, lowest precedence first. */
export const SETTINGS_SOURCES = ['user', 'project', 'local', 'flag', 'policy'] as const

/** The fixed guard paths: the settings files of the user and of the project, and Arrester's own folder, for any touch; the installed plugins, for a change only. */
export function fixedGuards(home: string | undefined, root: string, pluginRoot: string): ArresterGuard[] {
  const userPaths = home === undefined ? [] : [`${home}/.claude/settings.json`]
  const projectPaths = ['settings.json', 'settings.local.json'].map(name => `${root}/.claude/${name}`)
  const guards: ArresterGuard[] = [...new Set([...userPaths, ...projectPaths, pluginRoot].map(foldPath))].map(path => ({ path }))
  return home === undefined ? guards : [...guards, { path: foldPath(`${home}/.claude/plugins`), changeOnly: true }]
}

/** The options after which an interpreter or a shell takes code or a module, not a script file. */
const CODE_OPTIONS = new Set(['-c', '-e', '-m'])

/** A shell assignment word, such as `MODE=strict`. */
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*\+?=/

/** The paths that the command hooks of one settings source name: each absolute word, and each relative path-like word that is a command's program, the script operand of an interpreter or a shell, or a path under `.claude/`, read in the session folder `cwd` and in the project folder `root`. A hook with `args` runs `command` as one program with each argument as written, so only `$CLAUDE_PROJECT_DIR` is replaced there; a hook without them is a shell command, split into commands and words with its quotes, where `~` and `$HOME` expand too. */
export function hookPaths(settings: Readonly<Record<string, unknown>>, home: string | undefined, root: string, cwd: string): string[] {
  const paths: string[] = []
  for (const hook of commandHooks(settings.hooks)) {
    const args = hook.args
    const commands = Array.isArray(args) ? [[hook.command, ...args].map(word => (typeof word === 'string' ? word.replace(/\$\{CLAUDE_PROJECT_DIR\}|\$CLAUDE_PROJECT_DIR/g, () => root) : undefined))] : typeof hook.command === 'string' ? shellCommands(hook.command, home, root) : []
    for (const words of commands) paths.push(...commandPaths(words, root, cwd))
  }
  return paths
}

/** The paths that one command's words name, its program first: each absolute word, and a relative path-like word that is the program, the script operand, or under `.claude/`, joined to `cwd` and to `root`; an unreadable word is undefined and names none. */
function commandPaths(words: readonly (string | undefined)[], root: string, cwd: string): string[] {
  const script = scriptIndex(words)
  return words.flatMap((word, index) => {
    if (word === undefined) return []
    if (word.startsWith('/')) return [foldPath(word)]
    if (!looksLikePath(word) || (index !== 0 && index !== script && !word.split('/').slice(0, -1).includes('.claude'))) return []
    return [...new Set([cwd, root])].map(base => joinPath(base, word))
  })
}

/** Where the script operand of an interpreter or a shell is: its first path-like word that is no option; -1 for another program, or when `-c`, `-e`, `-m`, or an unreadable word comes first. */
function scriptIndex(words: readonly (string | undefined)[]): number {
  const program = words[0] === undefined ? undefined : basenameOf(words[0])
  if (program === undefined || !(INTERPRETER.test(program) || SHELLS.has(program))) return -1
  for (const [index, word] of words.entries()) {
    if (index === 0) continue
    if (word === undefined || CODE_OPTIONS.has(word)) return -1
    if (!word.startsWith('-') && looksLikePath(word)) return index
  }
  return -1
}

/** The words of each simple command of a shell command, with supported variables expanded, respecting quoting; leading assignments and keywords are dropped, so the program comes first. An unreadable word is undefined; redirections give no word; a command that does not parse gives none. */
function shellCommands(command: string, home: string | undefined, root: string): (string | undefined)[][] {
  const lexed = lex(command)
  if ('error' in lexed) return []
  const commands: (string | undefined)[][] = [[]]
  for (const token of lexed.tokens) {
    const words = commands[commands.length - 1]!
    if (token.type === 'op') commands.push([])
    else if (token.type === 'word' && !(words.length === 0 && isPrefix(token.word))) words.push(literal(token.word, home, root))
  }
  return commands
}

/** True for a word that comes before a command's program: an assignment or a shell keyword. */
function isPrefix(word: Word): boolean {
  const [first] = word
  return first?.kind === 'text' && !first.quoted && (ASSIGNMENT.test(first.text) || (word.length === 1 && KEYWORDS.has(first.text)))
}

/** A literal shell word with supported variables expanded, respecting quoting; undefined when it cannot be read. */
function literal(word: Word, home: string | undefined, root: string): string | undefined {
  let text = ''
  for (const [index, part] of word.entries()) {
    if (part.kind === 'var') {
      const value = part.name === 'CLAUDE_PROJECT_DIR' ? root : part.name === 'HOME' ? home : undefined
      if (value === undefined) return undefined
      text += value
    } else if (part.kind === 'text') {
      if (index === 0 && !part.quoted && /^~(?:\/|$)/.test(part.text)) {
        if (home === undefined) return undefined
        text += home + part.text.slice(1)
      } else text += part.text
    } else return undefined
  }
  return text
}

/** The command hooks of a settings `hooks` value: each entry of `type: "command"` in each matcher group of each event. */
function commandHooks(hooks: unknown): Readonly<Record<string, unknown>>[] {
  if (!isRecord(hooks)) return []
  const groups = Object.values(hooks).flatMap(list => (Array.isArray(list) ? list : []))
  const entries = groups.flatMap(group => (isRecord(group) && Array.isArray(group.hooks) ? group.hooks : []))
  return entries.filter((hook): hook is Readonly<Record<string, unknown>> => isRecord(hook) && hook.type === 'command')
}
