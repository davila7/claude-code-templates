// /clawd: what the person said, how Clawd answers, and the speech bubble it answers in.
// Pure functions only, like scenes.ts.

import { FRAME_MS } from './scenes.ts'

/** `/clawd <word>` actions: free and instant, no model call. Each names the scene it plays. */
export const ACTIONS: Record<string, string> = { pet: 'pet', feed: 'feed', wave: 'wave', hi: 'wave', hello: 'wave', dance: 'disco' }
export const HELP = 'Try /clawd pet, feed, wave or dance, or just say something to me!'
const MAX_ASK = 500 // characters of a message passed on to the model
const MAX_LINES = 3 // of text in the bubble

export type Ask = { help: true } | { action: string } | { chat: string }

/** A lone action word plays that action; anything else is a chat message. */
export const parseClawd = (args: string): Ask => {
  const text = args.trim()
  if (!text) return { help: true }
  const word = text.toLowerCase()
  const action = Object.hasOwn(ACTIONS, word) ? ACTIONS[word] : undefined // not what every object inherits
  return action ? { action } : { chat: text.slice(0, MAX_ASK) }
}

/** The text with control characters (escape sequences included) and runs of whitespace made single spaces. */
export const clean = (text: string) => text.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim()

// Characters a terminal draws two columns wide: CJK, Hangul, full-width forms
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/
// and none: combining marks (an accent typed apart, Thai and Hindi vowel marks) sit on the character before
const ZERO = /[\p{Mn}\p{Me}]/u
/** Columns the text takes on a terminal. */
export const cells = (text: string) => [...text].reduce((n, ch) => n + (ZERO.test(ch) ? 0 : WIDE.test(ch) ? 2 : 1), 0)

/** Words, single wide characters (which may break anywhere) and spaces, in order. */
const tokens = (text: string) => text.match(new RegExp(`${WIDE.source}|[^\\s${WIDE.source.slice(1, -1)}]+|\\s+`, 'g')) ?? []

/** Wraps `text` into at most `maxLines` lines of `width` columns, the last ending in … when it runs over. */
const wrap = (text: string, width: number, maxLines: number) => {
  const lines: string[] = []
  let line = ''
  for (const token of tokens(text)) {
    if (/^\s+$/.test(token)) {
      if (line) line += ' '
      continue
    }
    // a word wider than a whole line is cut to fit
    const word = cells(token) > width ? [...token].slice(0, width - 1).join('') + '…' : token
    if (cells(line + word) > width) {
      lines.push(line.trimEnd())
      line = word
    } else line += word
  }
  if (line.trim()) lines.push(line.trimEnd())
  if (lines.length <= maxLines) return lines
  const last = [...lines[maxLines - 1]]
  while (cells(last.join('')) > width - 1) last.pop()
  return [...lines.slice(0, maxLines - 1), last.join('') + '…']
}

/** The speech bubble Clawd says `text` in: a box `width` columns wide at most, its tail pointing down. */
export const bubble = (text: string, width: number, maxLines = MAX_LINES): string[] => {
  const lines = wrap(clean(text), Math.max(8, width - 6), maxLines)
  const w = Math.max(4, ...lines.map(cells))
  const pad = (l: string) => l + ' '.repeat(w - cells(l))
  return [`╭${'─'.repeat(w + 2)}╮`, ...lines.map(l => `│ ${pad(l)} │`), `╰───┬${'─'.repeat(w - 2)}╯`]
}

/** Frames a reply stays up: long enough to read, 5 to 15 seconds. */
export const holdFrames = (text: string) => Math.round(Math.min(15_000, 5_000 + cells(text) * 60) / FRAME_MS)

/** Clawd's system prompt; `status` says what Claude is doing right now. */
export const persona = (status: string) =>
  [
    "You are Clawd, Claude Code's small orange pixel-art mascot. You live on a little stage above the",
    "user's prompt and act out what Claude is doing. Answer the user in one or two short sentences",
    '(25 words at most): warm, playful, a little silly. Plain text only: no markdown, no emoji.',
    "Answer in the user's language. You cannot do tasks or run anything: when asked for real work,",
    'say cheerfully that Claude is the one for that.',
    `Right now: ${status}`,
  ].join('\n')
