/**
 * session-chats: the record of messages between Claude Code sessions, and how
 * to read it back. No `$` here: the hooks module hands in what it read.
 *
 * Each session that runs the mod keeps its own log under `log:<sessionId>` in
 * the mod's store (so two sessions never write the same key), and the pane
 * merges every log into conversations: one per pair of sessions, whichever
 * side wrote it. A side is known by its session id once the live-session
 * registry (`~/.claude/sessions/<pid>.json`) names it; before that, by the
 * name or address SendMessage used.
 */

/** One end of a conversation. */
export type Side = {
  /** The session id `claude --resume` takes. */
  id?: string
  /** The name ListAgents shows and SendMessage addresses (`demob-74`). */
  name?: string
  /** The address a reply goes to (`uds:/tmp/cc-socks/1421.sock`, `session_…`). */
  address?: string
  /** The session's working directory, where `claude --resume` must run. */
  cwd?: string
}

export type Msg = { at: number; from: 'self' | 'peer'; text: string }

export type Chat = { peer: Side; firstAt: number; lastAt: number; messages: Msg[] }

/** What one session keeps: who it is and whom it talked to. */
export type Log = { v: 1; self: Side; updatedAt: number; chats: Chat[] }

/** A row of the engine's live-session registry. */
export type Live = {
  pid: number
  sessionId: string
  cwd: string
  name?: string
  socket?: string
  status?: string
  kind?: string
  tmux?: string
}

export type Limits = { messages: number; chars: number; chats: number }
export const LIMITS: Limits = { messages: 40, chars: 600, chats: 200 }

/** A message as the pane shows it: who wrote it, by the conversation's own sides. */
export type Line = { at: number; by: 'a' | 'b'; text: string }

/** One conversation, merged from every log that holds it; `a` is this session when it is one of the two. */
export type Conversation = { key: string; a: Side; b: Side; firstAt: number; lastAt: number; lines: Line[] }

// ---------------------------------------------------------------------------
// reading what the engine hands over

const ENVELOPE = /^\s*<cross-session-message\b([^>]*)>\n?([\s\S]*?)\n?<\/cross-session-message>\s*$/

/** The sender and body of a delivered cross-session message; undefined for anything else. */
export function parseEnvelope(text: string): { from: string; name?: string; body: string } | undefined {
  const m = ENVELOPE.exec(text)
  if (!m) return undefined
  const attrs = attributes(m[1]!)
  if (!attrs.from) return undefined
  return { from: attrs.from, name: attrs['from-name'] || undefined, body: m[2]! }
}

function attributes(src: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of src.matchAll(/([\w-]+)="([^"]*)"/g)) out[m[1]!] = unescape(m[2]!)
  return out
}

function unescape(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

/** The registry's rows, from the text of each `sessions/<pid>.json`; a file that does not parse is skipped. */
export function parseRegistry(files: readonly string[]): Live[] {
  const out: Live[] = []
  for (const text of files) {
    try {
      const j = JSON.parse(text) as Record<string, unknown>
      if (typeof j.sessionId !== 'string' || typeof j.cwd !== 'string' || typeof j.pid !== 'number') continue
      out.push({
        pid: j.pid,
        sessionId: j.sessionId,
        cwd: j.cwd,
        name: str(j.name),
        socket: str(j.messagingSocketPath),
        status: str(j.status),
        kind: str(j.kind),
        tmux: str(j.tmux),
      })
    } catch {
      // a file mid-write, or not ours
    }
  }
  return out
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

/** SendMessage's `to` without the ` [ref]` a listing may add. */
export function bareAddress(to: string): string {
  return to.replace(/\s*\[[^\]]*\]\s*$/, '').trim()
}

/** The registry row a name or an address belongs to. */
export function findLive(live: readonly Live[], to: string): Live | undefined {
  const t = bareAddress(to)
  const socket = t.startsWith('uds:') ? t.slice(4) : undefined
  return live.find(l => (socket ? l.socket === socket : l.name === t || l.sessionId === t))
}

/** The registry row of this session (several share an id only when one inherited it). */
export function findSelf(live: readonly Live[], id: string, cwd: string): Live | undefined {
  const mine = live.filter(l => l.sessionId === id)
  return mine.find(l => l.cwd === cwd) ?? mine[0]
}

/** A side from a registry row. */
export function sideOf(l: Live): Side {
  return { id: l.sessionId, name: l.name, address: l.socket ? `uds:${l.socket}` : undefined, cwd: l.cwd }
}

/** Whether `to` reads as another session, not a subagent or teammate of this one. */
export function looksLikeSession(to: string, live: readonly Live[]): boolean {
  const t = bareAddress(to)
  if (/^(uds:|session_|cse_|bridge:)/.test(t)) return true
  return findLive(live, t) !== undefined
}

// ---------------------------------------------------------------------------
// writing the log

export function emptyLog(self: Side, now: number): Log {
  return { v: 1, self, updatedAt: now, chats: [] }
}

/** A stored value read back as a log, or undefined when it is not one. */
export function asLog(v: unknown): Log | undefined {
  if (!v || typeof v !== 'object') return undefined
  const l = v as Partial<Log>
  if (l.v !== 1 || !l.self || !Array.isArray(l.chats)) return undefined
  return l as Log
}

function sameSide(x: Side, y: Side): boolean {
  if (x.id && y.id) return x.id === y.id
  if (x.address || y.address) return !!x.address && x.address === y.address
  return !!x.name && x.name === y.name
}

function mergeSide(old: Side, add: Side): Side {
  return { id: add.id ?? old.id, name: add.name ?? old.name, address: add.address ?? old.address, cwd: add.cwd ?? old.cwd }
}

/** Text a peer wrote, without terminal control sequences (newlines and tabs kept). */
export function clean(text: string): string {
  return text
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)?/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '')
}

/** The log with one more message to or from `peer`; the newest conversations and messages are kept. */
export function record(log: Log, self: Side, peer: Side, msg: Msg, now: number, limits: Limits = LIMITS): Log {
  const raw = clean(msg.text)
  const text = Array.from(raw).length > limits.chars ? Array.from(raw).slice(0, limits.chars - 1).join('') + '…' : raw
  const chats = log.chats.slice()
  const i = chats.findIndex(c => sameSide(c.peer, peer))
  const m: Msg = { ...msg, text }
  if (i >= 0) {
    const c = chats[i]!
    chats[i] = { peer: mergeSide(c.peer, peer), firstAt: c.firstAt, lastAt: Math.max(c.lastAt, msg.at), messages: [...c.messages, m].slice(-limits.messages) }
  } else {
    chats.push({ peer, firstAt: msg.at, lastAt: msg.at, messages: [m] })
  }
  chats.sort((x, y) => y.lastAt - x.lastAt)
  return { v: 1, self: mergeSide(log.self, self), updatedAt: now, chats: chats.slice(0, limits.chats) }
}

// ---------------------------------------------------------------------------
// reading it back

export function sideKey(s: Side): string {
  return s.id ? `id:${s.id}` : s.address ? `a:${s.address}` : `n:${s.name ?? '?'}`
}

/**
 * Every log merged into conversations, newest first. A message both sides
 * logged (the sender's `self` line, the receiver's `peer` line) is kept once.
 * With `selfId`, a conversation this session is part of has it as `a`.
 */
export function conversations(logs: readonly Log[], selfId?: string): Conversation[] {
  // a side known by its socket in one log and by id in another is the same session
  const byName = new Map<string, Side>()
  const note = (s: Side) => {
    if (s.id && s.address) byName.set(`a:${s.address}`, { ...byName.get(`a:${s.address}`), ...s })
  }
  for (const l of logs) {
    note(l.self)
    for (const c of l.chats) note(c.peer)
  }
  const full = (s: Side): Side => (s.id ? s : byName.get(sideKey(s)) ? mergeSide(s, byName.get(sideKey(s))!) : s)

  const out = new Map<string, Conversation>()
  for (const l of logs) {
    const self = full(l.self)
    for (const c of l.chats) {
      const peer = full(c.peer)
      const ks = sideKey(self)
      const kp = sideKey(peer)
      if (ks === kp) continue
      const [first, second] = ks < kp ? [self, peer] : [peer, self]
      const key = `${sideKey(first)}|${sideKey(second)}`
      let conv = out.get(key)
      if (!conv) {
        conv = { key, a: first, b: second, firstAt: c.firstAt, lastAt: c.lastAt, lines: [] }
        out.set(key, conv)
      } else {
        conv.a = mergeSide(conv.a, first)
        conv.b = mergeSide(conv.b, second)
        conv.firstAt = Math.min(conv.firstAt, c.firstAt)
        conv.lastAt = Math.max(conv.lastAt, c.lastAt)
      }
      const selfIsA = sideKey(conv.a) === ks
      for (const m of c.messages) {
        const by: 'a' | 'b' = (m.from === 'self') === selfIsA ? 'a' : 'b'
        const dupe = conv.lines.some(x => x.by === by && x.text === m.text && Math.abs(x.at - m.at) < 120_000)
        if (!dupe) conv.lines.push({ at: m.at, by, text: m.text })
      }
    }
  }
  const list = [...out.values()]
  for (const c of list) {
    c.lines.sort((x, y) => x.at - y.at)
    if (selfId && c.b.id === selfId) {
      ;[c.a, c.b] = [c.b, c.a]
      c.lines = c.lines.map(x => ({ ...x, by: x.by === 'a' ? 'b' : 'a' }))
    }
  }
  return list.sort((x, y) => y.lastAt - x.lastAt)
}

/** Logs not written for `days` dropped, the store's own key names returned. */
export function stale(entries: readonly [string, Log][], now: number, days: number): string[] {
  return entries.filter(([, l]) => now - l.updatedAt > days * 86_400_000).map(([k]) => k)
}

// ---------------------------------------------------------------------------
// opening a session again

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/

/** Whether `claude --resume` can take this side from this machine. */
export function canResume(s: Side): s is Side & { id: string; cwd: string } {
  // no backslash in a POSIX path: fish reads it as an escape inside single quotes
  return !!s.id && ID.test(s.id) && !!s.cwd && s.cwd.startsWith('/') && !/[\\\x00-\x1f\x7f]/.test(s.cwd)
}

/** A single-quoted shell word. */
export function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

/** The line that resumes a side in a shell. */
export function resumeCommand(s: Side & { id: string; cwd: string }): string {
  return `cd ${shq(s.cwd)} && claude --resume ${s.id}`
}

/** A value tmux will not expand: `#(...)` and `#{...}` run or read formats. */
export function tmuxLiteral(s: string): string {
  return s.replace(/#/g, '##')
}

/** A tmux window name: letters, digits, `.`, `_`, `-`. */
export function windowName(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 24) || 'session'
}

/** An AppleScript string literal. */
export function appleQuote(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

// ---------------------------------------------------------------------------
// drawing helpers

/** `text` cut to `width` cells with an ellipsis. */
export function fit(text: string, width: number): string {
  const w = Math.max(1, Math.floor(width))
  const chars = Array.from(text)
  return chars.length <= w ? text : chars.slice(0, Math.max(0, w - 1)).join('') + '…'
}

/** `text` cut or padded to exactly `width` cells. */
export function cell(text: string, width: number, align: 'left' | 'right' = 'left'): string {
  const t = fit(text, width)
  const pad = ' '.repeat(Math.max(0, width - Array.from(t).length))
  return align === 'left' ? t + pad : pad + t
}

/** `3m`, `2h`, `5d`: how long ago. */
export function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86_400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86_400)}d`
}

/** The end of a path, home shortened to `~` and cut at the front. */
export function shortPath(path: string | undefined, home: string, width: number): string {
  if (!path) return ''
  const p = home && (path === home || path.startsWith(home + '/')) ? `~${path.slice(home.length)}` : path
  const chars = Array.from(p)
  return chars.length <= width ? p : '…' + chars.slice(chars.length - width + 1).join('')
}

/** What a side is called in the pane. */
export function label(s: Side): string {
  const raw = s.name ?? (s.id ? s.id.slice(0, 8) : s.address?.replace(/^uds:.*\//, '') ?? 'unknown')
  // a peer names itself: no control bytes, and short
  return Array.from(clean(raw)).slice(0, 60).join('') || 'unknown'
}

/** The message on one line. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** A short stable id for an element key. */
export function hash(s: string): string {
  let h1 = 5381
  for (let i = 0; i < s.length; i++) h1 = ((h1 << 5) + h1 + s.charCodeAt(i)) | 0
  return (h1 >>> 0).toString(36)
}
