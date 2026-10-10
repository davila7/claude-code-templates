import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { TodoLines } from '../types'
import { add, openCount, parse, remove, setText, toFile, toggle, toLines } from './todo-file'

const PANE = 'todo'
const lines = atom({ plugin: 'todo-pane', key: 'lines' } as const, null)
// MultiEdit is not in every build's tool table; naming it costs nothing where it is absent.
const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit']
// The keybinding actions the band button may borrow for a shortcut: ones whose engine
// handler lives in a dialog, so at the prompt nothing else answers their chord. Any other
// name is kept off the button, because the engine refuses the whole band, every mod's
// part of it, over an action it does not know.
export const ACTIONS = [
  'app:cycleDiffBase',
  'app:diffFileListDown',
  'app:diffFileListUp',
  'diff:nextFile',
  'diff:previousFile',
  'help:dismiss',
  'plugin:toggle',
  'settings:search',
  'theme:toggleSyntaxHighlighting',
]

// The `toggleAction` option: the action whose chord presses the band button, or why there is none.
function toggleAction(value: unknown): { action?: string; problem?: string } {
  const name = typeof value === 'string' ? value.trim() : ''
  if (name === '') {
    return {}
  }

  return ACTIONS.includes(name)
    ? { action: name }
    : { problem: `todo-pane: toggleAction "${name}" is not one of ${ACTIONS.join(', ')}; no shortcut` }
}

// Asked again each time, so a /cd or worktree move is followed.
async function pathOf($: EngineInterface) {
  let root = await $.session.cwd()
  try {
    const git = await $.process.run(['git', 'rev-parse', '--show-toplevel'])
    if (git.exitCode === 0 && git.stdout.trim() !== '') {
      root = git.stdout.trim()
    }
  } catch {
    // No git on this host: the session's directory is the root.
  }

  return `${root}/todo.md`
}

// The file as lines, null when it does not exist, undefined when it cannot be read or is a
// symbolic link (a write would land wherever the link points, outside the repo too).
async function readTodo($: EngineInterface, path: string): Promise<TodoLines | undefined> {
  try {
    if ((await $.fs.stat(path)).isLink) {
      $.ui.toast('todo-pane: todo.md is a symbolic link, left alone')
      return undefined
    }
    return toLines(await $.fs.read(path))
  } catch {
    if (!(await $.fs.exists(path))) {
      return null
    }
    $.ui.toast('todo-pane: todo.md could not be read')
    return undefined
  }
}

// A file left alone shows no tasks, never the ones read before it became unreadable.
async function load($: EngineInterface) {
  const current = await readTodo($, await pathOf($))
  await update($, lines, () => (current === undefined ? false : current))
}

async function applySave($: EngineInterface, change: (current: TodoLines) => string[] | undefined) {
  const path = await pathOf($)
  const current = await readTodo($, path)
  if (current === undefined) {
    await update($, lines, () => false as const)
    return
  }
  const next = change(current)
  if (next === undefined) {
    $.ui.toast('todo-pane: todo.md changed under the pane; shown as it is now')
  } else {
    await $.fs.write(path, toFile(next))
  }
  await update($, lines, () => next ?? current)
}

// One save at a time, each over the file as it is on disk now, so neither a
// change made outside the pane nor a second quick press is written over.
let saving = Promise.resolve()

// Tasks added from the new task field: part of that field's key, so each add draws a fresh one.
let added = 0

function save($: EngineInterface, change: (current: TodoLines) => string[] | undefined) {
  saving = saving
    .then(() => applySave($, change))
    .catch(() => $.ui.toast('todo-pane: todo.md could not be written'))

  return saving
}

// An action on a line of the file as drawn: refused when any line of it has changed since.
// The whole file is compared, because the lines alone cannot tell which of two identical
// lines above the target was added or removed, and either would land the action on another.
const at = (drawn: readonly string[], apply: (current: string[]) => string[]) => (current: TodoLines) =>
  current !== null && current.length === drawn.length && drawn.every((raw, i) => current[i] === raw)
    ? apply(current)
    : undefined

async function togglePane($: EngineInterface) {
  if ((await $.ui.panes()).some(pane => pane.id === PANE && pane.isShown)) {
    await $.ui.close({ id: PANE })
    return
  }
  await $.ui.open({ id: PANE, title: 'todo.md', focus: true, closeOnEscape: true })
  await load($)
}

export const register: Register = (on, options) => {
  const { action, problem } = toggleAction(options.toggleAction)

  on('session.start', async ($, e, next) => {
    if (problem !== undefined) {
      $.ui.toast(problem)
    }
    await $.command.register({ name: 'todo', description: 'Open or close the todo.md pane', immediate: true })
    await load($)

    return next(e)
  })

  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'clear' || e.source === 'resume' || e.source === 'fork') {
      await load($)
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const target = 'file_path' in e ? e.file_path : undefined
    if (EDIT_TOOLS.includes(e.tool) && target === (await pathOf($))) {
      await load($)
    }

    return ran
  })

  on('command.run', { command: 'todo' }, async $ => {
    await togglePane($)

    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) {
      return below
    }
    const { Box, Button } = $.ui.resolve(e)
    const current = await read($, lines)
    const label = Array.isArray(current) ? `📝 todo (${openCount(current)})` : '📝 todo'

    return (
      <Box flexDirection="column">
        {below}
        <Button
          key="todo"
          label={label}
          hotkey="1"
          {...(action === undefined ? {} : { action })}
          plain
          onPress={() => togglePane($)}
        />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Button, Text } = elements
    // Mobile draws no Input: there the pane toggles and deletes, and shows the text.
    const Input = 'Input' in elements ? elements.Input : undefined
    const current = await read($, lines)
    const raws = current || []

    return (
      <Box flexDirection="column">
        {current === null && <Text dimColor>No todo.md yet: the first task creates it.</Text>}
        {current === false && <Text dimColor>todo.md is left alone: a symbolic link, or it cannot be read.</Text>}
        {parse(raws).map(line =>
          line.kind === 'task' ? (
            <Box key={`row${line.index}`} flexDirection="row">
              <Button
                key={`toggle${line.index}`}
                label={line.isDone ? '☑' : '☐'}
                plain
                onPress={() => save($, at(raws, value => toggle(value, line.index)))}
              />
              {Input ? (
                <Input
                  key={`text${line.index}`}
                  value={line.text}
                  onSubmit={text => save($, at(raws, value => setText(value, line.index, text)))}
                />
              ) : (
                <Text key={`text${line.index}`}>{line.text}</Text>
              )}
              {/* One column apart, so the x does not run into the task's text. */}
              <Box key={`gap${line.index}`} marginLeft={1}>
                <Button
                  key={`delete${line.index}`}
                  label="x"
                  plain
                  onPress={() => save($, at(raws, value => remove(value, line.index)))}
                />
              </Box>
            </Box>
          ) : (
            <Text key={`line${line.index}`}>{line.text === '' ? ' ' : line.text}</Text>
          ),
        )}
        {/* A file left alone takes no new task: its save would always be refused. */}
        {Input && current !== false && (
          <Input
            // A new key after each add draws the field afresh: Desktop would put the typed text back
            // into a field redrawn under the same key and value. autoFocus keeps Desktop's focus on it.
            key={`new${added}`}
            {...(e.surface === 'desktop' ? { autoFocus: true as const } : {})}
            placeholder="new task"
            submitLabel="add"
            onSubmit={text => {
              if (text.trim() === '') {
                return undefined
              }
              added += 1
              const key = `new${added}`
              const saved = save($, value => add(value, text.trim()))
              // The terminal draws the fresh field with the pane's focus ring on nothing, so the next
              // keys would go to the prompt. $.ui.focus waits for the drawing that brings the new key.
              // Best effort: where it fails, the keys go to the prompt, as before.
              void saved.then(() => $.ui.focus({ requestId: PANE, key })).catch(() => undefined)
              return saved
            }}
          />
        )}
      </Box>
    )
  })
}
