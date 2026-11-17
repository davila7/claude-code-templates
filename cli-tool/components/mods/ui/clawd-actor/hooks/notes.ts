// /clawd note, notes, plan, done, list and remind: what they ask, and the markdown file they keep.
// Pure functions only, like scenes.ts; what Clawd says about it is in say.ts. The file holds one `# YYYY-MM-DD` heading a day, with
// `## Notes`, `## Todo` and `## Reminders` lists under it, so a person (or Claude) can read it too.
// A `# Inbox` heading at the top holds the todos for some day, not yet picked for one.

import { say, type Lang } from './say.ts'

export const NOTES = 'Notes'
export const TODO = 'Todo'
export const REMINDERS = 'Reminders'
export const INBOX = 'Inbox' // kept like a day of its own, at the top of the file
export const MAX_PICKS = 3 // suggestions a plan offers: as many as the bubble shows
export const WARN_MIN = 5 // minutes before a reminder that Clawd first calls it out
const DAY_MIN = 24 * 60

export type NoteAsk =
  | { kind: 'note'; text: string }
  | { kind: 'plan'; items: string[] }
  | { kind: 'todo'; text: string } // into the inbox, for some day
  | { kind: 'suggest' } // a lone plan: Clawd picks from the inbox and days past
  | { kind: 'accept'; picks?: number[] } // plan ok [1 3]: the suggestions taken, 1-based; absent, all
  | { kind: 'done'; n?: number } // the n-th of today's todos, 1-based; absent, the first open one
  | { kind: 'list' }
  | { kind: 'notes' } // today's notes, read back
  | { kind: 'remind'; when: string; text: string }
  | { kind: 'usage'; of: 'note' | 'todo' | 'plan' | 'done' | 'remind' } // the command, missing what it needs

export type Item = { isDone: boolean; text: string }

/**
 * A reminder's time and text: 14:00 or 14：00, or a wait of 1h30m, 30m, 30min, 1小時30分 or
 * 30分鐘, the text after it with or without a space. The time comes back as 14:00, 1h30m or 30m.
 */
const parseWhen = (rest: string): { when: string; text: string } | undefined => {
  const clock = /^(\d{1,2})[:：](\d{2})(?!\d)\s*(.*)$/s.exec(rest)
  if (clock) return { when: `${clock[1]}:${clock[2]}`, text: clock[3]!.trim() }
  // an English unit must end the word: "30 meeting" is no wait
  const wait = /^(?:(\d+)(?:h(?:ours?|rs?)?(?![a-z])|小時|小时))?\s*(?:(\d+)(?:m(?:in(?:ute)?s?)?(?![a-z])|分鐘|分钟|分))?\s*(.*)$/is.exec(rest)
  if (!wait || (!wait[1] && !wait[2])) return undefined
  return { when: `${wait[1] ? `${wait[1]}h` : ''}${wait[2] ? `${wait[2]}m` : ''}`, text: wait[3]!.trim() }
}

/** The note command `text` asks for, or undefined when it is not one. */
export const parseNotes = (text: string): NoteAsk | undefined => {
  const m = /^(notes|note|todo|plan|done|list|remind)(?![\p{L}\p{N}_])\s*(.*)$/isu.exec(text.trim())
  if (!m) return undefined
  const cmd = m[1]!.toLowerCase() as 'notes' | 'note' | 'todo' | 'plan' | 'done' | 'list' | 'remind'
  const rest = m[2]!.trim()
  if (cmd === 'list') return rest ? undefined : { kind: 'list' } // "list the files" is a chat
  if (cmd === 'notes') return rest ? undefined : { kind: 'notes' } // "notes are handy" is a chat
  if (cmd === 'note') return rest ? { kind: 'note', text: rest } : { kind: 'usage', of: 'note' }
  if (cmd === 'todo') return rest ? { kind: 'todo', text: rest } : { kind: 'usage', of: 'todo' }
  if (cmd === 'plan') {
    if (!rest) return { kind: 'suggest' }
    const ok = /^ok((?:[\s,]+\d+)*)$/i.exec(rest)
    if (ok) {
      const picks = ok[1]!.split(/[\s,]+/).filter(Boolean).map(Number)
      return picks.length ? { kind: 'accept', picks } : { kind: 'accept' }
    }
    const items = rest.split(/[;；\n]/).map(s => s.trim()).filter(Boolean)
    return items.length ? { kind: 'plan', items } : { kind: 'usage', of: 'plan' }
  }
  if (cmd === 'done') {
    if (!rest) return { kind: 'done' }
    if (!/^\d+$/.test(rest)) return undefined // "done with this?" is a chat
    return Number(rest) > 0 ? { kind: 'done', n: Number(rest) } : { kind: 'usage', of: 'done' }
  }
  const r = parseWhen(rest)
  return r?.text ? { kind: 'remind', ...r } : { kind: 'usage', of: 'remind' }
}

const two = (n: number) => String(n).padStart(2, '0')
/** The day's heading key, in local time: 2026-11-14. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
/** Minutes since local midnight. */
export const minuteOf = (d: Date) => d.getHours() * 60 + d.getMinutes()
export const hhmm = (min: number) => `${two(Math.floor(min / 60))}:${two(min % 60)}`
const toMin = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number)
  return h * 60 + m
}

/** Why a reminder's time will not do, as say.ts words it. */
export type NoTime = 'notTime' | 'passed' | 'rightNow' | 'todayOnly'

/** The minute of today `when` (14:00, 30m, 1h30m) names, or why not when it is no time later today. */
export const resolveAt = (when: string, now: Date): number | NoTime => {
  const nowMin = minuteOf(now)
  let at: number
  if (when.includes(':')) {
    const [h = 0, m = 0] = when.split(':').map(Number)
    if (h > 23 || m > 59) return 'notTime'
    at = h * 60 + m
    if (at <= nowMin) return 'passed'
  } else {
    const h = Number(/(\d+)h/.exec(when)?.[1] ?? 0)
    const m = Number(/(\d+)m/.exec(when)?.[1] ?? 0)
    at = nowMin + h * 60 + m
    if (at === nowMin) return 'rightNow'
  }
  return at < DAY_MIN ? at : 'todayOnly'
}

/** Index of the first line in [from, to) that `isIt`, or `to`. */
const scan = (lines: string[], from: number, to: number, isIt: (l: string) => boolean) => {
  for (let i = from; i < to; i++) if (isIt(lines[i]!)) return i
  return to
}

/** Where `section` of `day` sits in `lines`: its heading's index and the end of its body; heading -1 when absent. */
const locate = (lines: string[], day: string, section: string) => {
  const d = lines.findIndex(l => l.trim() === `# ${day}`)
  if (d < 0) return { day: -1, dayEnd: lines.length, head: -1, end: -1 }
  const dayEnd = scan(lines, d + 1, lines.length, l => /^# /.test(l))
  const head = scan(lines, d + 1, dayEnd, l => l.trim() === `## ${section}`)
  if (head === dayEnd) return { day: d, dayEnd, head: -1, end: -1 }
  return { day: d, dayEnd, head, end: scan(lines, head + 1, dayEnd, l => /^#{1,2} /.test(l)) }
}

const split = (md: string) => (md.trim() ? md.replace(/\s+$/, '').split(/\r?\n/) : []) // written back with \n
const join = (lines: string[]) => lines.join('\n') + '\n'

/** The file with `add` appended to `section` of `day`, the day and section made when missing. */
export const addLines = (md: string, day: string, section: string, add: string[]): string => {
  const lines = split(md)
  const at = locate(lines, day, section)
  if (at.day < 0) {
    const made = [`# ${day}`, '', `## ${section}`, ...add]
    // the inbox goes first, a day last
    if (day === INBOX) return join([...made, ...(lines.length ? ['', ...lines] : [])])
    return join([...lines, ...(lines.length ? [''] : []), ...made])
  }
  // after the last non-blank line of the section, or of the day for a new section
  const [from, to] = at.head < 0 ? [at.day, at.dayEnd] : [at.head, at.end]
  let end = to
  while (end > from + 1 && !lines[end - 1]!.trim()) end--
  const head = at.head < 0 ? ['', `## ${section}`] : []
  return join([...lines.slice(0, end), ...head, ...add, ...lines.slice(end)])
}

const ITEM = /^\s*- \[( |x|X)\] (.*)$/

/** The checklist items of `section` of `day`, in order. */
export const items = (md: string, day: string, section: string): Item[] => {
  const lines = split(md)
  const at = locate(lines, day, section)
  if (at.head < 0) return []
  return lines.slice(at.head + 1, at.end).flatMap(l => {
    const m = ITEM.exec(l)
    return m ? [{ isDone: m[1] !== ' ', text: m[2]!.trim() }] : []
  })
}

/** The `- ` lines of `day`'s notes, as written: `14:05 ask PM`. */
export const noteLines = (md: string, day: string): string[] => {
  const lines = split(md)
  const at = locate(lines, day, NOTES)
  if (at.head < 0) return []
  return lines.slice(at.head + 1, at.end).flatMap(l => {
    const m = /^\s*- (.*)$/.exec(l)
    return m?.[1]?.trim() ? [m[1].trim()] : []
  })
}

/** The file with the `n`-th (0-based) checklist item of `section` of `day` ticked, `note` after it; undefined when there is none. */
export const tick = (md: string, day: string, section: string, n: number, note = ''): string | undefined => {
  const lines = split(md)
  const at = locate(lines, day, section)
  if (at.head < 0) return undefined
  let seen = -1
  const i = scan(lines, at.head + 1, at.end, l => ITEM.test(l) && ++seen === n)
  if (i === at.end) return undefined
  return join(lines.map((l, k) => (k === i ? l.replace(/- \[ \]/, '- [x]') + note : l)))
}

export type Due = { n: number; at: number; text: string; isNow: boolean }

/** Today's open reminders to call out at minute `nowMin`: due ones (isNow), and ones within WARN_MIN minutes. */
export const dueReminders = (md: string, day: string, nowMin: number): Due[] =>
  items(md, day, REMINDERS).flatMap((it, n): Due[] => {
    const m = /^(\d{1,2}:\d{2}) (.*)$/.exec(it.text)
    if (it.isDone || !m) return []
    const at = toMin(m[1]!)
    const text = m[2]!
    if (at <= nowMin) return [{ n, at, text, isNow: true }]
    return at - nowMin <= WARN_MIN ? [{ n, at, text, isNow: false }] : []
  })

/** What /clawd list says: today's todos, numbered and ticked, the reminders still to come, and the todos waiting in the inbox. */
export const summary = (md: string, day: string, lang: Lang): string => {
  const s = say(lang)
  const todo = items(md, day, TODO).map((it, i) => `${i + 1}.${it.isDone ? '✓' : ''} ${it.text}`)
  const later = items(md, day, REMINDERS).filter(it => !it.isDone).map(it => it.text)
  const inbox = items(md, INBOX, TODO).filter(it => !it.isDone).map(it => it.text)
  const parts = [todo.length ? s.today(todo.join(', ')) : s.noTodos, later.length ? s.later(later.join(', ')) : '', inbox.length ? s.todos(inbox.join(', ')) : '']
  return parts.filter(Boolean).join(' · ')
}

/** An open todo that could go on today's list: from the inbox or a day before. */
export type Candidate = { from: string; text: string }

/** Open todos left from days before `today`, oldest first, then the inbox's, in its order. */
export const candidates = (md: string, today: string): Candidate[] => {
  const days = split(md).flatMap(l => /^# (\d{4}-\d{2}-\d{2})\s*$/.exec(l)?.[1] ?? []).filter(d => d < today).sort()
  return [...days, INBOX].flatMap(from => items(md, from, TODO).filter(it => !it.isDone).map(it => ({ from, text: it.text })))
}

/** Haiku's prompt for picking today's work out of `cands`, numbered from 1. */
export const pickPrompt = (cands: Candidate[], today: string, time: string, reminders: string[]) =>
  [
    `It is ${today}, ${time}. ${reminders.length ? `Today's reminders: ${reminders.join('; ')}.` : 'No meetings today.'}`,
    'Open todos (where each came from in brackets):',
    ...cands.map((c, i) => `${i + 1}. [${c.from === INBOX ? 'inbox' : `left from ${c.from}`}] ${c.text}`),
  ].join('\n')

export const PICK_SYSTEM = [
  `You help a programmer choose what to work on today. Choose at most ${MAX_PICKS} of the numbered todos:`,
  'favour ones left over from earlier days, anything urgent, and what fits around the reminders.',
  'Reply with JSON only: {"picks":[numbers],"why":"one short reason, 12 words at most, in the language of the todos"}',
].join(' ')

/** The 0-based candidates Haiku picked in `reply`, or the oldest ones when it gave none that hold. */
export const readPicks = (reply: string, count: number): { picks: number[]; why: string } => {
  try {
    const json = JSON.parse(/\{[\s\S]*\}/.exec(reply)?.[0] ?? '')
    const picks = [...new Set<number>((json.picks ?? []).filter((n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= count))]
    if (picks.length) return { picks: picks.slice(0, MAX_PICKS).map(n => n - 1), why: typeof json.why === 'string' ? json.why : '' }
  } catch {
    // not JSON: the oldest ones, below
  }
  return { picks: Array.from({ length: Math.min(MAX_PICKS, count) }, (_, i) => i), why: '' }
}

/** The file with `taken` added to today's todos and each ticked where it came from, "→ MM-DD" after it. */
export const takeOn = (md: string, today: string, taken: Candidate[]): { md: string; count: number } => {
  let out = md
  let count = 0
  for (const c of taken) {
    // found again by its text: the file may have changed since the suggestion
    const n = items(out, c.from, TODO).findIndex(it => !it.isDone && it.text === c.text)
    const ticked = n < 0 ? undefined : tick(out, c.from, TODO, n, ` → ${today.slice(5)}`)
    if (!ticked) continue
    out = addLines(ticked, today, TODO, [`- [ ] ${c.text}`])
    count++
  }
  return { md: out, count }
}
