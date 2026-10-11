import type { SessionReceiveOrigin } from 'claude-code'

import type { HighCommandEntry, HighCommandTrust } from '../types'
import { capBody, isSuspicious, peerKey, sanitize, summaryOf } from './text'

/** An entry before the inbox numbers and stamps it. */
export type NewEntry = Omit<HighCommandEntry, 'seq' | 'at'>

/** What a frame or a listing row says about a peer. */
export type PeerReport = { peer: string; state?: string; address?: string; source?: string }

/** The peer a delivery that names no sender is filed under. */
export const UNNAMED = 'unnamed peer'

/** One frame of a delivery; `name` is the tag, absent for text kept from beside the frames. */
type Frame = { name?: string; attributes: ReadonlyMap<string, string>; body: string }
type Protocol = { type: string } & Record<string, unknown>

const FRAMING = /^\s*Another Claude session sent a message:\s*/
/** The start of the notice that the engine writes on a line of its own after a delivery's text. */
const NOTICE = '\nThis came from another Claude session'
/** Decodes the XML entities attribute values use; `&amp;` last, so `&amp;lt;` stays `&lt;`. */
function decode(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

/** Tokenizes once from left to right; malformed names never trigger suffix searches. */
function attributesOf(text: string): { attributes: Map<string, string>; malformed: boolean } {
  const attributes = new Map<string, string>()
  let at = 0
  let malformed = false
  while (at < text.length) {
    if (/\s/.test(text[at]!)) { at++; continue }
    const start = at
    while (at < text.length && /[\w-]/.test(text[at]!)) at++
    const name = text.slice(start, at)
    if (name === '' || text[at] !== '=' || text[at + 1] !== '"') {
      malformed = true
      if (at === start) at++
      continue
    }
    at += 2
    const valueAt = at
    while (at < text.length && text[at] !== '"') at++
    if (at === text.length) { malformed = true; break }
    const value = text.slice(valueAt, at++)
    if (value.trim() !== '') attributes.set(name, decode(value))
  }
  return { attributes, malformed }
}

/** Finds a frame's closing tag, ignoring literals inside a JSON object's strings. */
function closingOf(text: string, start: number, closing: string): number {
  let at = start
  while (at < text.length && /\s/.test(text[at]!)) at += 1
  if (text[at] !== '{') return text.indexOf(closing, at)
  let depth = 0
  let quoted = false
  let escaped = false
  for (; at < text.length; at += 1) {
    const char = text[at]
    if (quoted) {
      // A raw line feed or tab cannot occur in a JSON string; keep malformed text as a message.
      if (char === '\n' || char === '\t') return text.indexOf(closing, at)
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (text.startsWith(closing, at)) {
      return at
    } else if (char === '"') {
      quoted = true
    } else if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) return text.indexOf(closing, at + 1)
    }
  }
  return -1
}

/**
 * Finds complete frames in one forward pass, skipping closing-tag literals in JSON strings.
 * A name with no closing tag left is not searched for again, keeping the scan linear.
 */
function framesOf(text: string): { frames: Frame[]; incomplete: boolean } {
  const names = ['teammate-message', 'agent-message', 'cross-session-message']
  const unclosed = new Set<string>()
  const frames: Frame[] = []
  let at = 0
  let span = 0
  let incomplete = false
  const preserve = (end: number, tail = false): void => {
    const raw = text.slice(span, end)
    const body = (tail ? unframed(raw) : raw).trim()
    if (body !== '') {
      frames.push({ attributes: new Map(), body })
      incomplete = true
    }
  }
  while (at < text.length) {
    const opening = text.indexOf('<', at)
    if (opening < 0) break
    at = opening + 1
    const name = names.find(value => text.startsWith(value, at) && /[\s>]/.test(text[at + value.length] ?? ''))
    if (name === undefined || unclosed.has(name)) continue
    const attributesAt = at + name.length
    at = attributesAt
    while (at < text.length && text[at] !== '>' && text[at] !== '<') at++
    if (text[at] !== '>') { incomplete = true; continue }
    const start = at + 1
    const closing = `</${name}>`
    const end = closingOf(text, start, closing)
    if (end === -1) { incomplete = true; unclosed.add(name); continue }
    preserve(opening)
    const parsed = attributesOf(text.slice(attributesAt, at))
    incomplete ||= parsed.malformed
    frames.push({ name, attributes: parsed.attributes, body: text.slice(start, end).trim() })
    at = end + closing.length
    span = at
  }
  if (frames.length > 0) preserve(text.length, true)
  return { frames, incomplete }
}

/** The text of a delivery that holds no frame, cut before the engine's last notice; the peer wrote only the text before it. */
function unframed(text: string): string {
  const at = `\n${text}`.lastIndexOf(NOTICE)
  return (at === -1 ? text : text.slice(0, at)).trim()
}

/** The JSON object a protocol body holds, or undefined for any other body. */
function protocolOf(body: string): Protocol | undefined {
  if (!body.startsWith('{')) return undefined
  try {
    // JSON text that starts with "{" parses to an object or throws.
    const value = JSON.parse(body) as Record<string, unknown>
    return typeof value.type === 'string' ? (value as Protocol) : undefined
  } catch {
    // A body that starts with "{" and is not JSON is a plain message.
    return undefined
  }
}

/** A sanitized string field with a non-space character, else undefined. */
function textField(value: unknown): string | undefined {
  const text = typeof value === 'string' ? sanitize(value) : ''
  return text.trim() === '' ? undefined : text
}

/**
 * The first claim that is a name after peerKey: the frame, the team origin's name (`stamped`), the protocol
 * body; else the origin's default. Every other claim is text of this frame, so the work stays linear in the
 * delivery.
 */
function senderOf(frame: Frame, protocol: Protocol | undefined, origin: SessionReceiveOrigin, stamped: string): string {
  const from = protocol?.from
  const claims = [
    peerKey(frame.attributes.get('teammate_id') ?? ''),
    peerKey(frame.attributes.get('from-name') ?? ''),
    peerKey(frame.attributes.get('from') ?? ''),
    stamped,
    typeof from === 'string' ? peerKey(from) : '',
  ]
  return claims.find(name => name !== '') ?? (origin.kind === 'coordinator' ? 'coordinator' : UNNAMED)
}

/**
 * The trust level of one sender name, from origin fields alone. A team mailbox entry is verified only
 * when the harness checked it and the frame names that same member; another session's or agent's
 * message that Claude Code delivered is local unless a plugin composed it; the rest is unverified.
 */
function trustOf(origin: SessionReceiveOrigin, peer: string, stamped: string): HighCommandTrust {
  if ('teammate' in origin) return origin.isVerified && peer === stamped ? 'verified' : 'unverified'
  const isPluginClaim = 'plugin' in origin && origin.plugin !== undefined
  return isPluginClaim || origin.kind === 'unclassified' ? 'unverified' : 'local'
}

/** The state an idle notification reports. */
function idleState(protocol: Protocol): string {
  if (textField(protocol.failureReason) !== undefined || protocol.idleReason === 'failed') return 'failed'
  return protocol.idleReason === 'interrupted' ? 'interrupted' : 'idle'
}

/**
 * Whether a peer prompt is a local agent's SendMessage to the main conversation: it holds an
 * `<agent-message>` frame and no frame of another kind. Claude Code 2.1.296 submits such a message as a
 * prompt and skips session.receive; a message from another session passes session.receive first.
 */
export function isAgentMessage(text: string): boolean {
  const { frames } = framesOf(sanitize(text).replace(FRAMING, ''))
  const names = new Set(frames.flatMap(frame => (frame.name === undefined ? [] : [frame.name])))
  return names.size === 1 && names.has('agent-message')
}

/**
 * The one sender that the `<agent-message>` frames of a prompt name, or undefined when they name none or
 * several. A mod beneath can rewrite such a prompt without its frame; the text that enters keeps this name.
 */
export function agentSenderOf(text: string, origin: SessionReceiveOrigin): string | undefined {
  const { frames } = framesOf(sanitize(text).replace(FRAMING, ''))
  const names = new Set(frames.flatMap(frame =>
    frame.name === 'agent-message' ? [senderOf(frame, protocolOf(frame.body), origin, '')] : []))
  const [name] = names
  return names.size === 1 && name !== UNNAMED ? name : undefined
}

/**
 * Splits one queued delivery into entries and peer reports. When `sender` is given, every frame and text of
 * the delivery is filed under it, and the names that they claim are ignored.
 */
export function parseDelivery(text: string, origin: SessionReceiveOrigin, sender?: string): { entries: NewEntry[]; reports: PeerReport[]; incomplete?: boolean } {
  const clean = sanitize(text).replace(FRAMING, '')
  const { frames, incomplete } = framesOf(clean)
  if (frames.length === 0 && origin.kind === 'unclassified') return { entries: [], reports: [], ...(incomplete ? { incomplete: true } : {}) }
  const entries: NewEntry[] = []
  const reports: PeerReport[] = []
  // The origin's name is the same for every frame, so it is keyed once.
  const stamped = 'teammate' in origin ? peerKey(origin.teammate) : ''
  for (const frame of frames.length > 0 ? frames : [{ attributes: new Map<string, string>(), body: unframed(clean) }]) {
    const protocol = protocolOf(frame.body)
    const peer = sender ?? senderOf(frame, protocol, origin, stamped)
    const trust = trustOf(origin, peer, stamped)
    const add = (kind: NewEntry['kind'], preferred: string | undefined, body: string): void => {
      const mark = isSuspicious(`${preferred ?? ''}\n${body}`) ? { isSuspicious: true as const } : {}
      entries.push({ peer, direction: 'in', kind, summary: summaryOf(preferred, body), ...capBody(body), trust, ...mark })
    }
    const address = frame.attributes.has('from-name') ? frame.attributes.get('from') : undefined
    if (address !== undefined) reports.push({ peer, address })
    if (protocol === undefined) {
      add('message', frame.attributes.get('summary'), frame.body)
    } else if (protocol.type === 'idle_notification') {
      const failure = textField(protocol.failureReason)
      const result = textField(protocol.result)
      reports.push({ peer, state: idleState(protocol) })
      if (failure !== undefined) add('failure', undefined, result === undefined ? failure : `${failure}\n\n${result}`)
      else if (result !== undefined) add('result', textField(protocol.summary), result)
    } else if (protocol.type === 'teammate_terminated') {
      reports.push({ peer, state: 'ended' })
    } else if (protocol.type === 'shutdown_approved') {
      reports.push({ peer, state: 'shut down' })
    } else {
      add('message', `[${sanitize(protocol.type)}]`, frame.body)
    }
  }
  return { entries, reports, ...(incomplete ? { incomplete: true } : {}) }
}
