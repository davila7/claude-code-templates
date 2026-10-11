// Guard paths and guard names: the files whose read or change
// counts as touching a guard while a block is open. Pure: no `$`.

import { isRecord } from './analyze/call'
import { lex } from './analyze/lexer'
import { foldPath } from './analyze/paths'
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

/** The absolute paths that the command hooks of one settings source name. A hook with `args` runs `command` as one program with each argument as written, so only `$CLAUDE_PROJECT_DIR` is replaced there; a hook without them is a shell command, split into words with its quotes, where `~` and `$HOME` expand too. */
export function hookPaths(settings: Readonly<Record<string, unknown>>, home: string | undefined, root: string): string[] {
  const paths: string[] = []
  for (const hook of commandHooks(settings.hooks)) {
    const args = hook.args
    const isExec = Array.isArray(args)
    const words = isExec ? [hook.command, ...args] : typeof hook.command === 'string' ? shellWords(hook.command, home, root) : []
    for (const word of words) {
      if (typeof word !== 'string') continue
      const path = isExec ? word.replaceAll('${CLAUDE_PROJECT_DIR}', root).replaceAll('$CLAUDE_PROJECT_DIR', root) : word
      if (path?.startsWith('/') === true) paths.push(foldPath(path))
    }
  }
  return paths
}

/** Literal shell words with supported variables expanded, respecting quoting; unreadable words name no guard. */
function shellWords(command: string, home: string | undefined, root: string): string[] {
  const lexed = lex(command)
  if ('error' in lexed) return []
  return lexed.tokens.flatMap(token => {
    if (token.type !== 'word') return []
    let text = ''
    for (const [index, part] of token.word.entries()) {
      if (part.kind === 'var') {
        const value = part.name === 'CLAUDE_PROJECT_DIR' ? root : part.name === 'HOME' ? home : undefined
        if (value === undefined) return []
        text += value
      } else if (part.kind === 'text') {
        if (index === 0 && !part.quoted && /^~(?:\/|$)/.test(part.text)) {
          if (home === undefined) return []
          text += home + part.text.slice(1)
        } else text += part.text
      } else return []
    }
    return [text]
  })
}

/** The command hooks of a settings `hooks` value: each entry of `type: "command"` in each matcher group of each event. */
function commandHooks(hooks: unknown): Readonly<Record<string, unknown>>[] {
  if (!isRecord(hooks)) return []
  const groups = Object.values(hooks).flatMap(list => (Array.isArray(list) ? list : []))
  const entries = groups.flatMap(group => (isRecord(group) && Array.isArray(group.hooks) ? group.hooks : []))
  return entries.filter((hook): hook is Readonly<Record<string, unknown>> => isRecord(hook) && hook.type === 'command')
}
