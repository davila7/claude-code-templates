import type { Anchor, Progress } from '../types'
import { ETA_MIN_GAIN, ETA_MIN_SPAN_MS, TAIL_BYTES } from './limits'

const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][\s\S]*?(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g
const PERCENT = /(?<![\d.])(\d{1,3}(?:\.\d+)?)\s?%/g
const FRACTION = /(?<![\w./:-])(\d{1,7})\s?\/\s?(\d{1,7})(?![\w./-])/g
const OF = /(?<![\w./\\])(\d{1,7}) of (\d{1,7})(?![\w/\\]|\.\w)/gi
/** A two-digit clock right after a `done/total` match: with done 1 to 12 and total up to 31, the match is a short date, as in `10/11 14:03`. */
const CLOCK_AFTER = /\s+\d{2}:\d{2}/y
/** An output file path as the engine names it: absolute, in a `tasks` folder, named `<task id>.output`. Its folders may hold spaces (a temp folder set by CLAUDE_CODE_TMPDIR). */
const OUTPUT_PATH = /^(?:[A-Za-z]:)?[\\/][^\n]*[\\/]tasks[\\/]([A-Za-z0-9_-]+)\.output$/
/** The engine's words before the path in a background command's result. */
const OUTPUT_NOTICE = 'Output is being written to: '
/** A carriage return, built from its code so that no string literal holds a control character. */
const CR = String.fromCharCode(13)

type Found = { percent: number; label: string }

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
    if (value <= 100) found = { percent: value, label: `${Math.round(value)}%` }
  }
  return found
}

/** Whether a `done/total` match is a short date followed by a clock. */
function isDateBeforeClock(line: string, end: number, done: number, total: number): boolean {
  if (done < 1 || done > 12 || total > 31) return false
  CLOCK_AFTER.lastIndex = end
  return CLOCK_AFTER.test(line)
}

function lastRatio(line: string, pattern: RegExp): Found | undefined {
  let found: Found | undefined
  for (const match of line.matchAll(pattern)) {
    const done = Number(match[1])
    const total = Number(match[2])
    if (pattern === FRACTION && isDateBeforeClock(line, match.index + match[0].length, done, total)) continue
    if (total >= 1 && done <= total) found = { percent: (done / total) * 100, label: `${done}/${total}` }
  }
  return found
}

/** The newest progress reading in the lines: percent, then `done/total`, then `N of M`. */
export function progressOf(lines: readonly string[], at: number): Progress | undefined {
  for (const line of [...lines].reverse()) {
    const found = lastPercent(line) ?? lastRatio(line, FRACTION) ?? lastRatio(line, OF)
    if (found !== undefined) return { ...found, at }
  }
  return undefined
}

/** The start of the current rising run of readings, which the rate ETA measures from; a drop starts a new run. */
export function anchorOf(anchor: Anchor | undefined, progress: Progress, previous: Progress | undefined): Anchor {
  return anchor === undefined || previous === undefined || progress.percent < previous.percent ? { percent: progress.percent, at: progress.at } : anchor
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

/** The last TAIL_BYTES of an output, from a line start: a tail, or a read cut short, drops its partial first line; text with no line break stays whole, one line that `\r` redraws. */
export function outputEndOf(text: string, isTail: boolean): string {
  const end = text.slice(-TAIL_BYTES)
  if (!isTail && end.length === text.length) return end
  const lineStart = end.indexOf('\n') + 1
  return lineStart === 0 ? end : end.slice(lineStart)
}
