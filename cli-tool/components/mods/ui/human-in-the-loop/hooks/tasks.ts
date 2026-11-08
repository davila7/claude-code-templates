import type { Task, TaskKind } from '../types'
import { ago, oneLine, plural, sizeOf } from './text'

/** Open tasks at once; the next is refused. */
export const MAX_OPEN = 5
export const MAX_TITLE = 80
const MAX_WHY = 300
const MAX_OPTION = 60
/** Answers longer than this are named in a digest, not quoted. */
const MAX_INLINE_ANSWER = 2000

const KINDS: readonly TaskKind[] = ['do', 'answer', 'choose']

/** Still the user's to act on. */
export function isActive(task: Task): boolean {
  return task.state === 'open'
}

/** In the My tasks pane: the user's to act on, or acted on and not yet told to Claude. */
export function isShown(task: Task): boolean {
  return isActive(task) || task.update === 'pending'
}

/** A title as two near-identical asks compare equal. */
export function sameAsk(a: string, b: string): boolean {
  const norm = (s: string) => oneLine(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' '))

  return norm(a) === norm(b)
}

export type Ask = Pick<Task, 'title' | 'why' | 'doneWhen' | 'kind' | 'options'>

/** Reads `assign_task`'s arguments, or says what is wrong with them. */
export function parseAsk(args: Record<string, unknown>): Ask | { error: string } {
  const text = (key: string) => (typeof args[key] === 'string' ? oneLine(args[key] as string) : '')
  const title = text('title')
  const why = text('why')
  const doneWhen = text('done_when')
  const kind = args['kind'] ?? 'do'

  if (title === '') {
    return { error: 'title is required: what the user should do, as an imperative.' }
  }

  if (title.length > MAX_TITLE) {
    return { error: `title is ${title.length} characters; keep it under ${MAX_TITLE} and put the rest in why.` }
  }

  if (why === '') {
    return { error: 'why is required: one sentence on what it unblocks.' }
  }

  if (!KINDS.includes(kind as TaskKind)) {
    return { error: 'kind must be "do", "answer" or "choose".' }
  }

  const raw = Array.isArray(args['options']) ? args['options'] : []
  const options = raw.filter((o): o is string => typeof o === 'string').map(oneLine).filter(o => o !== '')

  if (kind === 'choose' && (options.length < 2 || options.length > 4)) {
    return { error: 'a choose task needs 2 to 4 options.' }
  }

  if (options.some(o => o.length > MAX_OPTION)) {
    return { error: `keep each option under ${MAX_OPTION} characters.` }
  }

  return {
    title,
    why: why.slice(0, MAX_WHY),
    ...(doneWhen === '' ? {} : { doneWhen: doneWhen.slice(0, MAX_WHY) }),
    kind: kind as TaskKind,
    ...(kind === 'choose' ? { options } : {}),
  }
}

/**
 * What the user did with a task, after its head: their answer, choice or
 * reason; '' when there is nothing more to say. `isFull` quotes a long
 * answer whole; a digest names it instead and points at `list_tasks`.
 */
function bodyOf(task: Task, isFull: boolean): string {
  switch (task.state) {
    case 'rejected':
      return task.reason ? `The user's reason: "${task.reason}"` : 'No reason given.'
    case 'withdrawn':
      return task.reason ? `You withdrew it: ${task.reason}` : 'You withdrew it.'
    case 'done':
      if (task.answer === undefined || task.answer === '') {
        return ''
      }

      if (task.kind === 'choose' && task.options?.includes(task.answer)) {
        return `The user chose: ${task.answer}`
      }

      if (!isFull && task.answer.length > MAX_INLINE_ANSWER) {
        return `The user's answer (${sizeOf(task.answer.length)}) is saved: call list_tasks with id ${task.id} to read it.`
      }

      return `The user's answer:\n${task.answer}`
    default:
      return ''
  }
}

/** One task's news for Claude: `#5 done: <title>.` and what the user said. */
export function newsOf(task: Task, isFull: boolean): string {
  const body = bodyOf(task, isFull)

  return `#${task.id} ${task.state}: ${task.title}.${body === '' ? '' : ` ${body}`}`
}

/** What the user did with a task, in their own words. */
function ownWordsOf(task: Task): string {
  const head = `#${task.id} ${task.title}:`

  switch (task.state) {
    case 'rejected':
      return task.reason ? `${head} I won't do this. ${task.reason}` : `${head} I won't do this.`
    case 'done':
      if (task.answer === undefined || task.answer === '') {
        return `${head} Done.`
      }

      if (task.kind === 'choose' && task.options?.includes(task.answer)) {
        return `${head} I chose "${task.answer}".`
      }

      return `${head}\n${task.answer}`
    default:
      return head
  }
}

/**
 * What reaches Claude as a message: every response it has not heard,
 * whole, in the user's own words, since they are the user's.
 */
export function messageOf(due: readonly Task[]): string {
  const lines = due.map(ownWordsOf)

  return `${due.length === 1 ? 'My response to a task' : 'My responses to tasks'} you gave me (Human in the loop):\n\n${lines.join('\n\n')}`
}

/** What rides along with the user's next prompt: the updates, long answers named. */
export function digestOf(due: readonly Task[]): string {
  const lines = due.map(task => newsOf(task, false))

  return `Task updates since you last checked (Human in the loop):\n${lines.join('\n')}`
}

/** Read after a compaction or at a session's start: what is still with the user. */
export function contextOf(shown: readonly Task[], sessionId: string): string {
  const lines = shown.map(task => {
    const earlier = task.sessionId === sessionId ? '' : ' (from an earlier session)'
    return isActive(task) ? `#${task.id} ${task.state}${earlier}: ${task.title}. ${task.why}` : newsOf(task, false)
  })

  return [
    'Tasks you gave the user, through the Human in the loop tools (assign_task, list_tasks, withdraw_task):',
    ...lines,
    'The user sees them in their My tasks pane, or with /my-tasks. Withdraw any you no longer need.',
  ].join('\n')
}

/** `list_tasks`'s answer. */
export function listOf(tasks: readonly Task[], nowMs: number): string {
  if (tasks.length === 0) {
    return 'No tasks match.'
  }

  return tasks
    .map(task => {
      const age = ago(nowMs - task.createdMs)
      const detail = isActive(task)
        ? [`Why: ${task.why}`, task.doneWhen ? `Done when: ${task.doneWhen}` : '', task.options ? `Options: ${task.options.join(' | ')}` : '']
        : bodyOf(task, true).split('\n')

      return [`#${task.id} ${task.state} · assigned ${age === 'now' ? 'just now' : `${age} ago`} · ${task.title}`, ...detail]
        .filter(line => line.trim() !== '')
        .join('\n  ')
    })
    .join('\n\n')
}

/** `assign_task`'s answer. */
export function assignedOf(task: Task, open: number): string {
  return [
    `Assigned task #${task.id}: "${task.title}".`,
    'The user sees it in their My tasks pane, or with /my-tasks, until they act on it. Their response reaches you as a message, or through list_tasks.',
    'You can carry on with work that does not depend on it.',
    `Open tasks: ${open} of ${MAX_OPEN}.`,
  ].join(' ')
}

/**
 * The status line under the prompt: this session's tasks and responses not
 * sent yet, and how many tasks wait in the project's other live sessions,
 * which this session neither shows nor answers.
 */
export function statusOf(shown: readonly Task[], elsewhere = 0): string | undefined {
  const open = shown.filter(isActive).length
  const saved = shown.length - open
  const parts = [
    open > 0 ? `☐ ${plural(open, 'task')} for you` : '',
    saved > 0 ? `${open > 0 ? '' : '✓ '}${saved} not sent yet` : '',
  ].filter(part => part !== '')
  const others = elsewhere > 0 ? `${plural(elsewhere, 'task')} in another session` : ''

  if (parts.length === 0) {
    return others === '' ? undefined : others
  }

  return [...parts, '/my-tasks', others].filter(part => part !== '').join(' · ')
}

/**
 * The rows the My tasks pane asks for: a head, the selected task whole, a row
 * for every other task, and a hint; at most `max`.
 */
export function rowsFor(shown: readonly Task[], selectedId: number | null, isEditing: boolean, max: number): number {
  const open = shown.filter(isActive)
  const selected = open.find(task => task.id === selectedId) ?? open[0]
  const whole =
    selected === undefined
      ? 0
      : 1 + Math.ceil(selected.why.length / 70) + (selected.doneWhen === undefined ? 0 : 1) + (isEditing ? 2 : 1)

  return Math.min(max, 2 + whole + (open.length - (selected === undefined ? 0 : 1)) + (shown.length - open.length) + 1)
}

const BRIDGE = /^\s*↳?\s*Answer to #(\d+):[ \t]*\n?/i

/** What a long answer written in the prompt box starts with. */
export function bridgeOf(id: number): string {
  return `↳ Answer to #${id}: `
}

/** A prompt that answers a task: the task's id and the answer, or null. */
export function answerIn(text: string): { id: number; answer: string } | null {
  const match = BRIDGE.exec(text)

  return match ? { id: Number(match[1]), answer: text.slice(match[0].length).trim() } : null
}

const SECRET_SHAPES: readonly RegExp[] = [
  /\bsk_(live|test)_[0-9A-Za-z]{10,}/,
  /\bsk-ant-[\w-]{10,}/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bA(KIA|SIA)[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/,
  /\bxox[abprs]-[\w-]{10,}/,
  /\bAIza[\w-]{30,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/,
]

/**
 * Whether an answer looks like it carries a secret: a known key shape, or a
 * long token mixing upper case, lower case and digits (a git hash, all lower
 * case hex, is not one).
 */
export function looksSecret(text: string): boolean {
  if (SECRET_SHAPES.some(shape => shape.test(text))) {
    return true
  }

  return (text.match(/[A-Za-z0-9+/_=-]{32,}/g) ?? []).some(
    token => /[a-z]/.test(token) && /[A-Z]/.test(token) && /[0-9]/.test(token),
  )
}
