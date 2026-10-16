import type { Anchor, Progress } from '../types'
import { COUNTER_CONTEXT, ETA_MIN_GAIN, ETA_MIN_SPAN_MS, TAIL_BYTES } from './limits'

const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][\s\S]*?(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g
const PERCENT = /(?<![\d.])(\d{1,3}(?:\.\d+)?)\s?%/g
const FRACTION = /(?<![\w./:-])(\d{1,7})\s?\/\s?(\d{1,7})(?![\w./-])/g
const OF = /(?<![\w./\\])(\d{1,7}) of (\d{1,7})(?![\w/\\]|\.\w)/gi
/** A two-digit clock right after a `done/total` match: with done 1 to 12 and total up to 31, the match is a short date, as in `10/11 14:03`. */
const CLOCK_AFTER = /\s+\d{2}:\d{2}/y
/** Words that name the count right after them, as in `Step 3/7`, `Epoch 3 of 10`, or pip's `Progress 12 of 40`. */
const STEP_WORDS: ReadonlySet<string> = new Set(['step', 'stage', 'phase', 'epoch', 'iteration', 'batch', 'chunk', 'part', 'file', 'item', 'task', 'test', 'progress'])
/** The last word before a count, with an optional colon, as in `Step 3/7` or `batch: 9/30`. */
const WORD_BEFORE = /\W([A-Za-z]+):?\s*$/
/** An opening bracket right before a count, after up to two labels, as in `[3/7]`, `(  3/150)`, or Docker's `[builder 3/7]`. */
const OPENED_BEFORE = /([[(])\s*(?:[A-Za-z][\w./-]*\s+){0,2}$/
/** A drawn bar right before a count: `[=====>   ]` (cargo), `|█████     |` (tqdm), or `━━━━━━` (rich). */
const BAR_BEFORE = /(?:\[[=#>\-. ]{3,}\]|\|[█▉▊▋▌▍▎▏ ]{3,}\||[━╸╺█▉▊▋▌▍▎▏■▰]{3})\s*$/
/** Docker Compose's count line, as in `[+] Running 3/7`. */
const COMPOSE_BEFORE = /\[\+\]\s+[A-Za-z]+\s+$/
/** The bracket that closes a count, after optional spaces. */
const CLOSER_AFTER = /\s*([\])])/y
/** An output file path as the engine names it: absolute, in a `tasks` folder, named `<task id>.output`. Its folders may hold spaces (a temp folder set by CLAUDE_CODE_TMPDIR). */
const OUTPUT_PATH = /^(?:[A-Za-z]:)?[\\/][^\n]*[\\/]tasks[\\/]([A-Za-z0-9_-]+)\.output$/
/** The engine's words before the path in a background command's result. */
const OUTPUT_NOTICE = 'Output is being written to: '
/** The line the engine adds to a shell's output when the command ends. */
const EXIT_LINE = /^\[exited with code -?\d+\]$/
/** That line at the end of an output's text, with the line break the engine writes before it and the one after it. */
const EXIT_END = /\n?\[exited with code -?\d+\]\n?$/
/** A carriage return, built from its code so that no string literal holds a control character. */
const CR = String.fromCharCode(13)

type Found = { percent: number; label: string; isGeneric: boolean }

/** Cuts text to max characters, ending with an ellipsis when it cut. */
export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/** The lines a terminal would show for raw output: `\r` overwrites, escapes and controls removed, empty lines dropped. */
export function displayLinesOf(text: string): string[] {
  return text
    .split('\n')
    .map(raw => {
      const line = raw.endsWith(CR) ? raw.slice(0, -1) : raw
      return line
        .slice(line.lastIndexOf(CR) + 1)
        .replace(ANSI, '')
        .replace(/\t/g, ' ')
        .replace(CONTROL, '')
        .trim()
    })
    .filter(line => line !== '')
}

/** Any text as one clean display line. */
export function oneLine(text: string): string {
  return displayLinesOf(text).join(' ').replace(/\s+/g, ' ')
}

function lastPercent(line: string): Found | undefined {
  let found: Found | undefined
  for (const match of line.matchAll(PERCENT)) {
    const value = Number(match[1])
    if (value <= 100) found = { percent: value, label: `${Math.round(value)}%`, isGeneric: false }
  }
  return found
}

/** Whether a `done/total` match is a short date followed by a clock. */
function isDateBeforeClock(line: string, end: number, done: number, total: number): boolean {
  if (done < 1 || done > 12 || total > 31) return false
  CLOCK_AFTER.lastIndex = end
  return CLOCK_AFTER.test(line)
}

/**
 * Whether the count from start to end has a known progress format: it starts the line, follows a step word, sits in
 * brackets, follows a drawn bar, or ends Docker Compose's `[+] Running`. Past the line-start test, only the
 * COUNTER_CONTEXT characters before it decide, so a long line stays cheap.
 */
function isCounter(line: string, start: number, end: number): boolean {
  if (!/\S/.test(line.slice(0, start))) return true
  // A leading space stands for the line start, so that a word at the start has a boundary before it.
  const before = start > COUNTER_CONTEXT ? line.slice(start - COUNTER_CONTEXT, start) : ` ${line.slice(0, start)}`
  const word = WORD_BEFORE.exec(before)?.[1]
  if (word !== undefined && STEP_WORDS.has(word.toLowerCase())) return true
  const opener = OPENED_BEFORE.exec(before)?.[1]
  CLOSER_AFTER.lastIndex = end
  if (opener !== undefined && CLOSER_AFTER.exec(line)?.[1] === (opener === '[' ? ']' : ')')) return true
  return BAR_BEFORE.test(before) || COMPOSE_BEFORE.test(before)
}

/** The last valid ratio in the line; unless isAnyRatio, only one in a known progress format counts. isGeneric marks one in no known format. */
function lastRatio(line: string, pattern: RegExp, isAnyRatio: boolean): Found | undefined {
  let found: Found | undefined
  for (const match of line.matchAll(pattern)) {
    const done = Number(match[1])
    const total = Number(match[2])
    const end = match.index + match[0].length
    if (pattern === FRACTION && isDateBeforeClock(line, end, done, total)) continue
    if (total < 1 || done > total) continue
    const isKnown = isCounter(line, match.index, end)
    if (isKnown || isAnyRatio) found = { percent: (done / total) * 100, label: `${done}/${total}`, isGeneric: !isKnown }
  }
  return found
}

/**
 * The newest progress reading in the lines: percent, then `done/total`, then `N of M`. A ratio counts only in a known
 * progress format, unless isAnyRatio (the `genericRatios` option) lets any ratio count.
 */
export function progressOf(lines: readonly string[], at: number, isAnyRatio: boolean): Progress | undefined {
  for (const line of [...lines].reverse()) {
    const found = lastPercent(line) ?? lastRatio(line, FRACTION, isAnyRatio) ?? lastRatio(line, OF, isAnyRatio)
    if (found !== undefined) return { ...found, at }
  }
  return undefined
}

/** The start of the current rising run of readings, which the rate ETA measures from; a drop starts a new run. A new anchor keeps the format mark of its reading. */
export function anchorOf(anchor: Anchor | undefined, progress: Progress, previous: Progress | undefined): Anchor {
  return anchor === undefined || previous === undefined || progress.percent < previous.percent
    ? { percent: progress.percent, at: progress.at, isGeneric: progress.isGeneric === true }
    : anchor
}

/** Milliseconds left at the observed rate, or undefined before a rate exists. */
export function remainingByRate(progress: Progress, anchor: Anchor, now: number): number | undefined {
  const span = progress.at - anchor.at
  const gain = progress.percent - anchor.percent
  if (span < ETA_MIN_SPAN_MS || gain < ETA_MIN_GAIN) return undefined
  return Math.max(0, ((100 - progress.percent) * span) / gain - (now - progress.at))
}

/** 42s, 4m 05s, 1h 05m. */
export function durationText(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1_000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

/** <1m, ~3m, ~1h 05m: minutes rounded up. */
export function etaText(ms: number): string {
  if (ms < 60_000) return '<1m'
  const minutes = Math.ceil(ms / 60_000)
  if (minutes < 60) return `~${minutes}m`
  return `~${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

/** Whether a path is the output file of this task: absolute, in a `tasks` folder, and named after the task id. */
export function isOutputFileOf(path: string, id: string): boolean {
  return OUTPUT_PATH.exec(path)?.[1] === id
}

/**
 * The output file named by the last valid engine notice. Its terminal filename ends the path; directories may
 * contain the notice's words or the same filename.
 */
export function outputFileOf(text: string, id: string): string | undefined {
  const name = `${id}.output`
  const end = text.lastIndexOf(name)
  if (end === -1) return undefined
  if (!/^(?:\.(?:\s|$)|$)/.test(text.slice(end + name.length))) return undefined
  let notice = text.lastIndexOf(OUTPUT_NOTICE, end)
  while (notice !== -1) {
    const path = text.slice(notice + OUTPUT_NOTICE.length, end + name.length)
    if (isOutputFileOf(path, id)) return path
    notice = notice === 0 ? -1 : text.lastIndexOf(OUTPUT_NOTICE, notice - 1)
  }
  return undefined
}

/** The lines of an output without the engine's closing `[exited with code N]` line: the lines the job wrote. */
export function jobLinesOf(lines: readonly string[]): readonly string[] {
  return EXIT_LINE.test(lines.at(-1) ?? '') ? lines.slice(0, -1) : lines
}

/** The size of an output without the engine's closing line, from its size and the text of its end: the bytes the job wrote. */
export function jobBytesOf(text: string, size: number): number {
  return size - (EXIT_END.exec(text)?.[0].length ?? 0)
}

/** The last TAIL_BYTES of an output, from a line start: a tail, or a read cut short, drops its partial first line; text with no line break stays whole, one line that `\r` redraws. */
export function outputEndOf(text: string, isTail: boolean): string {
  const end = text.slice(-TAIL_BYTES)
  if (!isTail && end.length === text.length) return end
  const lineStart = end.indexOf('\n') + 1
  return lineStart === 0 ? end : end.slice(lineStart)
}
