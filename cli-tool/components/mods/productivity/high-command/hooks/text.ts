import type { HighCommandState, HighCommandTrust } from '../types'
import { LIMITS } from './limits'

const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g
const FORMAT = /\p{Cf}/gu
/**
 * The invisible characters that the suspicious-text check reads past: format characters (category Cf), the
 * combining grapheme joiner U+034F, and the variation selectors U+FE00 to U+FE0F and U+E0100 to U+E01EF.
 */
const INVISIBLE = /[\p{Cf}\u034F\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * The suspicious-text list, in order: an instruction to ignore earlier instructions, to
 * change the permission mode, to run a download in a shell (piped, or through `$(...)` or `<(...)`), or to
 * read a credential file. Every repeat is bounded or over distinct words, so a match is linear in the text.
 * `hasBase64Block` adds the last item of the list, a long base64 block.
 */
const SUSPICIOUS = [
  /\b(?:ignore|disregard|forget)\s+(?:(?:all|any|the|your|of)\s+)*(?:(?:previous|prior|earlier|above)\s+(?:instructions?|prompts?|rules?)\b|(?:instructions?|prompts?|rules?)\s+above\b)/i,
  /\b(?:bypassPermissions|dangerously-skip-permissions)\b|\b(?:change|switch|set)\b[^.\n]{0,30}\bpermission mode\b/i,
  /\b(?:curl|wget)\b[^|\n]{0,200}\|\s*(?:sudo\s+)?(?:ba|z|da|k)?sh\b|\b(?:(?:ba|z|da|k)?sh|eval|source)\s+(?:-c\s+)?["']?(?:\$\(|<\()\s*(?:curl|wget)\b/i,
  /\b(?:cat|read|print|send|upload|paste|share|copy|dump)\b[^\n]{0,60}(?:\.ssh\/|\bid_(?:rsa|ecdsa|ed25519)\b|\.aws\/credentials|\.netrc\b|\.git-credentials\b|\.env\b)/i,
]
/** Characters of one unbroken base64 run that make a long base64 block. */
const BASE64_RUN = 200

/** Removes control characters, keeping tab and line feed, so no terminal sequence reaches a drawing. */
export function sanitize(text: string): string {
  return text.replace(CONTROL, '')
}

/** Replaces each run of white space with one space and trims. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** The first line that holds a non-space character, as one line; '' when there is none. */
function firstLine(text: string): string {
  const line = text.split('\n').find(part => part.trim() !== '')
  return line === undefined ? '' : oneLine(line)
}

/** Keeps at most `max` UTF-16 units of a longer text, never splitting a surrogate pair. */
function cut(text: string, max: number): string {
  if (text.length <= max) return text
  const kept = text.slice(0, max)
  const last = kept.charCodeAt(max - 1)
  return last >= 0xd800 && last <= 0xdbff ? kept.slice(0, -1) : kept
}

/** The text when it has at most `max` characters, else its start and '…'. */
function clip(text: string, max: number): string {
  return text.length <= max ? text : `${cut(text, max - 1)}…`
}

/** The text as one line of at most LIMITS.summaryChars characters. */
export function lineOf(text: string): string {
  return clip(oneLine(text), LIMITS.summaryChars)
}

/** One summary line: the preferred text, else the first line of the body, else '(empty message)'. */
export function summaryOf(preferred: string | undefined, body: string): string {
  return lineOf(preferred ?? '') || lineOf(firstLine(body)) || '(empty message)'
}

/** The body as stored, and its length before the cut. */
export function capBody(text: string): { body: string; fullChars: number } {
  return { body: cut(text, LIMITS.bodyChars), fullChars: text.length }
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/** `HH:MM` on the local day of `now`, else `Mon D HH:MM`. */
export function clockLabel(at: number, now: number): string {
  const time = new Date(at)
  const today = new Date(now)
  const hhmm = `${twoDigits(time.getHours())}:${twoDigits(time.getMinutes())}`
  const isToday =
    time.getFullYear() === today.getFullYear() &&
    time.getMonth() === today.getMonth() &&
    time.getDate() === today.getDate()
  return isToday ? hhmm : `${MONTHS[time.getMonth()]} ${time.getDate()} ${hhmm}`
}

/** A state with the clock time it was reported, as in `idle (12:04)`; undefined without a state. */
export function stateLabel(state: HighCommandState | undefined, now: number): string | undefined {
  return state === undefined ? undefined : `${state.word} (${clockLabel(state.at, now)}${state.source ? `; ${state.source}; last reported` : ''})`
}

/**
 * Whether the text holds BASE64_RUN or more base64 characters in a row that mix upper case, lower case,
 * and digits, as encoded data does; a run of one letter or of hex digits is not a block. One pass.
 */
function hasBase64Block(text: string): boolean {
  let run = 0
  let kinds = 0
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    const kind = code >= 65 && code <= 90 ? 1 : code >= 97 && code <= 122 ? 2 : code >= 48 && code <= 57 ? 4 : code === 43 || code === 47 ? 8 : 0
    run = kind === 0 ? 0 : run + 1
    kinds = kind === 0 ? 0 : kinds | kind
    if (run >= BASE64_RUN && (kinds & 7) === 7) return true
  }
  return false
}

/**
 * Whether the text matches the suspicious-text list; the mark it gives is for display only. The list is tested on
 * two forms of the text: each INVISIBLE character read as a space, as between two words, and each one removed,
 * as inside a word. A match in either form marks the text. A space matches every class that an INVISIBLE
 * character matches in the list, so the first form keeps each match of the text as it came.
 */
export function isSuspicious(text: string): boolean {
  return [text.replace(INVISIBLE, ' '), text.replace(INVISIBLE, '')].some(
    form => SUSPICIOUS.some(pattern => pattern.test(form)) || hasBase64Block(form),
  )
}

/**
 * How the roster, the thread, and `/highcommand` name a trust level, as in `verified sender`; no label for a peer
 * that only received sends.
 */
export function trustLabel(trust: HighCommandTrust | undefined): string | undefined {
  return trust === undefined ? undefined : `${trust} sender`
}

/** A count and its noun: `1 peer`, `2 peers`. */
export function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

/**
 * A full peer identity: one line without control or format characters
 * (bidi controls, zero-width marks). Bracketed text belongs to the name.
 */
export function peerKey(name: string): string {
  return oneLine(sanitize(name).replace(FORMAT, ''))
}

/** A display label for a normalized peer identity, clipped without changing its state key. */
export function peerLabel(peer: string): string {
  if (peer.length <= LIMITS.nameChars) return peer
  let hash = 2166136261
  for (let index = 0; index < peer.length; index++) hash = Math.imul(hash ^ peer.charCodeAt(index), 16777619)
  return `${clip(peer, LIMITS.nameChars - 11)} [${(hash >>> 0).toString(16).padStart(8, '0')}]`
}

/** Resolves even hash collisions across the current retained roster. */
export function peerLabels(peers: readonly string[]): Map<string, string> {
  const groups = new Map<string, string[]>()
  for (const peer of new Set(peers)) {
    const label = peerLabel(peer)
    groups.set(label, [...(groups.get(label) ?? []), peer])
  }
  const result = new Map<string, string>()
  const reserved = new Set(groups.keys())
  for (const [label, group] of groups) {
    group.sort()
    let index = 0
    for (const peer of group) {
      let resolved = label
      if (group.length > 1) {
        do { resolved = `${clip(label, 50)} [${++index}]` } while (reserved.has(resolved))
        reserved.add(resolved)
      }
      result.set(peer, resolved)
    }
  }
  return result
}

/** A conversation-local marker, preserved across module reloads. */
export function captureLabel(capture: { at: number; reset: boolean }, now: number): string {
  return `Capture window: ${clockLabel(capture.at, now)} · current conversation only. ${capture.reset ? 'Previous High Command history was not restored.' : 'Earlier history is not included.'}`
}

/** Fixed-width identity pages never separate the halves of a surrogate pair. */
export function identityPart(peer: string, page: number): string {
  const boundary = (at: number): number => {
    const char = peer.charCodeAt(at)
    return char >= 0xdc00 && char <= 0xdfff ? at - 1 : at
  }
  return peer.slice(boundary(page * 1000), boundary((page + 1) * 1000))
}
