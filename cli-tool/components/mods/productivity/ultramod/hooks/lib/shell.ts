// Shell parsing for the guard mods. Plain TypeScript, no imports: this runs
// inside the hooks environment where only web APIs exist.

function isSpace(c: string): boolean {
  return c === ' ' || c === '\t' || c === '\r' || c === '\n'
}

// Characters that never start anything on their own: a run of them is copied
// in one slice.
function plainEnd(src: string, from: number): number {
  let k = from
  const n = src.length
  while (k < n) {
    const ch = src.charCodeAt(k)
    // space tab lf cr " $ & ' ( ) ; < > \ ` { | }
    if (ch === 32 || ch === 9 || ch === 10 || ch === 13 || ch === 34 || ch === 36 || ch === 38 || ch === 39 || ch === 40 || ch === 41 || ch === 59 || ch === 60 || ch === 62 || ch === 92 || ch === 96 || ch === 123 || ch === 124 || ch === 125) break
    k++
  }
  return k
}

// Skip an ANSI-C string $'...': quote is the index of its opening quote.
// Backslash escapes the next character. Returns the index just past the
// closing quote, or -1 when unterminated.
function skipAnsiC(src: string, quote: number): number {
  const n = src.length
  let i = quote + 1
  while (i < n) {
    const c = src.charAt(i)
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === "'") return i + 1
    i++
  }
  return -1
}

// Is the # at index i the start of a comment? Only at the start of a word.
function startsWord(src: string, i: number): boolean {
  if (i === 0) return true
  const p = src.charAt(i - 1)
  return isSpace(p) || ';|&(<>'.indexOf(p) !== -1
}

// Find the closer of the construct opened at open, in one pass with a stack of
// contexts, so quotes inside a substitution inside a quote are read the way
// the shell reads them. open points at the ( of $( or <(, at the { of ${, or
// at the backtick of a `...` substitution. Returns -1 when unterminated.
function findClose(src: string, open: number): number {
  const n = src.length
  // P paren, B brace, T backtick, D double quote
  const kinds: string[] = []
  const depths: number[] = []
  // Per context: case words waiting for their in, and case ... esac open. The
  // ) that ends a case pattern does not close the substitution.
  const waits: number[] = []
  const opens: number[] = []
  const enter = (kind: string) => {
    kinds.push(kind)
    depths.push(1)
    waits.push(0)
    opens.push(0)
  }
  const leave = () => {
    kinds.pop()
    depths.pop()
    waits.pop()
    opens.pop()
  }
  const first = src.charAt(open)
  enter(first === '(' ? 'P' : first === '{' ? 'B' : 'T')
  let i = open + 1
  while (i < n) {
    const kind = kinds[kinds.length - 1]
    const c = src.charAt(i)
    if (kind === 'D') {
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === '"') leave()
      else if (c === '$' && src.charAt(i + 1) === '(') {
        enter('P')
        i++
      } else if (c === '$' && src.charAt(i + 1) === '{') {
        enter('B')
        i++
      } else if (c === '`') enter('T')
      i++
      continue
    }
    if (kind === 'T') {
      // Backticks end at the first one not escaped: quotes and comments inside
      // are read later, from the unescaped text.
      if (c === '`') {
        leave()
        if (kinds.length === 0) return i
      } else if (c === '\\') i++
      i++
      continue
    }
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === "'") {
      const j = src.indexOf("'", i + 1)
      if (j === -1) return -1
      i = j + 1
      continue
    }
    if (c === '"') {
      enter('D')
      i++
      continue
    }
    if (c === '$') {
      const d = src.charAt(i + 1)
      if (d === "'") {
        const j = skipAnsiC(src, i + 1)
        if (j === -1) return -1
        i = j
        continue
      }
      if (d === '(') {
        enter('P')
        i += 2
        continue
      }
      if (d === '{') {
        enter('B')
        i += 2
        continue
      }
    }
    if (c === '`') {
      enter('T')
      i++
      continue
    }
    if (c === '#' && kind === 'P' && startsWord(src, i)) {
      const nl = src.indexOf('\n', i)
      if (nl === -1) return -1
      i = nl
      continue
    }
    if (kind === 'P' && c >= 'a' && c <= 'z' && startsWord(src, i)) {
      let e = i + 1
      while (e < n && /[A-Za-z0-9_.\/=-]/.test(src.charAt(e))) e++
      const word = src.slice(i, e)
      const last = waits.length - 1
      if (word === 'case') waits[last] = (waits[last] ?? 0) + 1
      else if (word === 'in' && (waits[last] ?? 0) > 0) {
        waits[last] = (waits[last] ?? 0) - 1
        opens[last] = (opens[last] ?? 0) + 1
      } else if (word === 'esac' && (opens[last] ?? 0) > 0) opens[last] = (opens[last] ?? 0) - 1
      i = e
      continue
    }
    if (kind === 'P' || kind === 'B') {
      const up = kind === 'P' ? '(' : '{'
      const down = kind === 'P' ? ')' : '}'
      const last = depths.length - 1
      if (c === up) depths[last] = (depths[last] ?? 0) + 1
      else if (c === down && kind === 'P' && depths[last] === 1 && (opens[last] ?? 0) > 0) {
        // the ) after a case pattern
      } else if (c === down) {
        depths[last] = (depths[last] ?? 1) - 1
        if (depths[last] === 0) {
          leave()
          if (kinds.length === 0) return i
        }
      }
    }
    i++
  }
  return -1
}

// Inside backticks, \` \\ and \$ stand for ` \ and $.
function unbacktick(text: string): string {
  if (text.indexOf('\\') === -1) return text
  let out = ''
  let from = 0
  for (let i = 0; i < text.length; i++) {
    if (text.charAt(i) !== '\\') continue
    const d = text.charAt(i + 1)
    if (d === '`' || d === '\\' || d === '$') {
      out += text.slice(from, i)
      from = i + 1
      i++
    }
  }
  return out + text.slice(from)
}

// Command substitutions inside text that the shell expands (a heredoc body
// without a quoted delimiter): the bodies of $( ) and backticks. A closer that
// never comes takes the rest of the text, so nothing after it goes unchecked.
function expansionsIn(text: string): string[] {
  const out: string[] = []
  const n = text.length
  let j = 0
  while (j < n) {
    const c = text.charAt(j)
    if (c === '\\') {
      j += 2
      continue
    }
    const paren = c === '$' && text.charAt(j + 1) === '('
    if (paren || c === '`') {
      const close = findClose(text, paren ? j + 1 : j)
      if (close === -1) {
        out.push(text.slice(paren ? j + 2 : j + 1))
        break
      }
      const body = text.slice(paren ? j + 2 : j + 1, close)
      out.push(paren ? body : unbacktick(body))
      j = close + 1
      continue
    }
    j++
  }
  return out
}

// ANSI-C escapes inside $'...'.
function decodeAnsiC(body: string): string {
  let out = ''
  const n = body.length
  let i = 0
  while (i < n) {
    const c = body.charAt(i)
    if (c !== '\\' || i + 1 >= n) {
      out += c
      i++
      continue
    }
    const d = body.charAt(i + 1)
    const simple: Record<string, string> = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', v: '\v', '\\': '\\', "'": "'", '"': '"', '?': '?' }
    if (simple[d] !== undefined) {
      out += simple[d]
      i += 2
      continue
    }
    const hex = d === 'x' ? /^[0-9a-fA-F]{1,2}/.exec(body.slice(i + 2, i + 4)) : d === 'u' ? /^[0-9a-fA-F]{1,4}/.exec(body.slice(i + 2, i + 6)) : d === 'U' ? /^[0-9a-fA-F]{1,8}/.exec(body.slice(i + 2, i + 10)) : null
    if (hex !== null && hex !== undefined) {
      const code = parseInt(hex[0], 16)
      out += code <= 0x10ffff ? String.fromCodePoint(code) : ''
      i += 2 + hex[0].length
      continue
    }
    const oct = /^[0-7]{1,3}/.exec(body.slice(i + 1, i + 4))
    if (oct !== null) {
      out += String.fromCharCode(parseInt(oct[0], 8) & 0xff)
      i += 1 + oct[0].length
      continue
    }
    out += c + d
    i += 2
  }
  return out
}

// Read a heredoc delimiter after << or <<- and return where the mark ends.
// The word gets shell quote removal ('..', "..", \x and $'..' anywhere in it),
// the way the shell reads it: <<\EOF, <<E'O'F and <<"EOF" all end at EOF.
// quoted tells whether the body is taken literally (no expansions).
function readHeredocMark(src: string, i: number): { end: number; delim: string; quoted: boolean; dash: boolean } {
  const n = src.length
  let j = i
  let dash = false
  if (src.charAt(j) === '-') {
    dash = true
    j++
  }
  while (j < n && (src[j] === ' ' || src[j] === '\t')) j++
  let delim = ''
  let quoted = false
  while (j < n) {
    const c = src.charAt(j)
    if (isSpace(c) || ';|&()<>'.indexOf(c) !== -1) break
    if (c === "'") {
      const k = src.indexOf("'", j + 1)
      quoted = true
      if (k === -1) return { end: n, delim: '', quoted, dash }
      delim += src.slice(j + 1, k)
      j = k + 1
      continue
    }
    if (c === '"') {
      quoted = true
      let k = j + 1
      while (k < n && src.charAt(k) !== '"') {
        if (src.charAt(k) === '\\' && k + 1 < n) k++
        delim += src.charAt(k)
        k++
      }
      j = k + 1
      continue
    }
    if (c === '\\') {
      quoted = true
      if (j + 1 < n && src.charAt(j + 1) !== '\n') delim += src.charAt(j + 1)
      j += 2
      continue
    }
    if (c === '$' && src.charAt(j + 1) === "'") {
      const k = skipAnsiC(src, j + 1)
      quoted = true
      if (k === -1) return { end: n, delim: '', quoted, dash }
      delim += decodeAnsiC(src.slice(j + 2, k - 1))
      j = k
      continue
    }
    delim += c
    j++
  }
  return { end: Math.min(j, n), delim, quoted, dash }
}

// Find where a heredoc body ends: the line equal to the delimiter, leading
// tabs allowed for <<-. Returns the index just past the terminator line, or -1
// when no line matches.
function findHeredocEnd(src: string, bodyStart: number, delim: string, dash: boolean): number {
  const n = src.length
  if (delim === '') return -1
  let i = bodyStart
  while (i <= n) {
    const nl = src.indexOf('\n', i)
    const lineEnd = nl === -1 ? n : nl
    let line = src.slice(i, lineEnd)
    if (dash) line = line.replace(/^\t+/, '')
    if (line === delim) return Math.min(n, lineEnd + 1)
    if (nl === -1) return -1
    i = nl + 1
  }
  return -1
}

interface ScanResult {
  parts: string[]
  subs: string[]
  // Simple commands joined by a real |, one list per pipeline, in order.
  groups: string[][]
  // A substitution sat deeper than the scan follows.
  overflow: boolean
}

// A heredoc body: it belongs to the part at index owner and spans src[start, end).
interface Heredoc {
  owner: number
  start: number
  end: number
}

// A ( or { group. feed is the pipeline group whose output the group reads, or -1.
interface Frame {
  brace: boolean
  feed: number
  from: number
}

// Split one level into simple commands, extracting $( ) and ` ` bodies.
// depth caps recursion into nested substitutions; a substitution past the cap
// sets overflow so the caller can fail closed. A closer that never comes
// hands the rest of the text over as a body, so the scan stays linear and
// nothing after it goes unchecked.
function scan(src: string, depth: number): ScanResult {
  const parts: string[] = []
  const subs: string[] = []
  const index: number[][] = []
  let overflow = false
  const addSub = (text: string) => {
    if (depth < 3) subs.push(text)
    else overflow = true
  }
  let cur = ''
  // The last character added and whether cur holds more than blanks, kept
  // beside it because reading a string built by appends costs a copy each time.
  let last = ''
  let dirty = false
  const add = (text: string) => {
    cur += text
    if (text !== '') last = text.charAt(text.length - 1)
  }
  // True right after a | (not ||): the next command joins the open pipeline.
  let joinNext = false
  // ( and { groups. A group that reads a pipe feeds every command in it.
  const frames: Frame[] = []
  // The part range and end of the group that closed last, for a following |.
  let closed = null as { from: number; to: number; end: number } | null
  const push = () => {
    const t = cur.trim()
    if (t !== '') {
      const at = parts.length
      parts.push(t)
      const f = frames[frames.length - 1]
      const feed = f !== undefined ? f.feed : -1
      const open = index[index.length - 1]
      if (feed >= 0) {
        index[feed]?.push(at)
        if (!joinNext) index.push([at])
      } else if (joinNext && open !== undefined) open.push(at)
      else index.push([at])
      joinNext = false
    }
    cur = ''
    last = ''
    dirty = false
  }
  const parentFeed = () => {
    const f = frames[frames.length - 1]
    return f !== undefined ? f.feed : -1
  }
  const openFrame = (brace: boolean) => {
    frames.push({ brace, feed: joinNext && index.length > 0 ? index.length - 1 : parentFeed(), from: parts.length })
  }
  const closeFrame = (brace: boolean, end: number) => {
    const f = frames[frames.length - 1]
    if (f === undefined || f.brace !== brace) return
    frames.pop()
    closed = { from: f.from, to: parts.length, end }
  }
  // Heredoc bodies start on the line after the declaration. The rest of the
  // declaration line is ordinary command text, so the bodies are skipped when
  // the scan reaches that line break and handed back to their owners.
  let pending: { from: number; bodies: Heredoc[] } | null = null
  // True at the start of a word, where a # begins a comment.
  let ws = true
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src.charAt(i)
    if (pending !== null && i === pending.from) {
      push()
      let last = i
      for (const b of pending.bodies) {
        if (b.owner < parts.length) parts[b.owner] += src.slice(b.start, b.end)
        last = b.end
      }
      for (const b of pending.bodies) {
        if (b.owner < parts.length) parts[b.owner] = (parts[b.owner] ?? '').trimEnd()
      }
      pending = null
      i = last
      ws = true
      continue
    }
    if (isSpace(c)) {
      if (c === '\n') {
        push()
        i++
      } else {
        // a run of blanks at once
        let j = i + 1
        while (j < n && (src.charAt(j) === ' ' || src.charAt(j) === '\t')) j++
        add(src.slice(i, j))
        i = j
      }
      ws = true
      continue
    }
    if (c === '#' && ws) {
      // A comment runs to the end of the line and is never executed.
      const nl = src.indexOf('\n', i)
      i = nl === -1 ? n : nl
      continue
    }
    // blank: nothing but spaces so far, the position where { and } are words
    const blank = !dirty
    ws = false
    dirty = true
    if (c === "'") {
      const j = src.indexOf("'", i + 1)
      const end = j === -1 ? n : j
      add(src.slice(i, end + 1))
      i = end + 1
      continue
    }
    if (c === '\\' && i + 1 < n) {
      if (src[i + 1] === '\n') {
        i += 2
        ws = last === '' || isSpace(last)
        continue
      }
      add(c + src[i + 1])
      i += 2
      continue
    }
    if (c === '"') {
      let j = i + 1
      let inner = ''
      while (j < n && src[j] !== '"') {
        if (src[j] === '\\' && j + 1 < n) {
          if (src.charAt(j + 1) !== '\n') inner += src.charAt(j) + src.charAt(j + 1)
          j += 2
          continue
        }
        const paren = src[j] === '$' && src[j + 1] === '('
        if ((paren || src[j] === '`') && depth >= 3) overflow = true
        else if (paren || src[j] === '`') {
          const open = paren ? j + 1 : j
          const close = findClose(src, open)
          if (close === -1) {
            addSub(paren ? src.slice(j + 2) : unbacktick(src.slice(j + 1)))
            inner += src.slice(j)
            j = n
            break
          }
          const body = src.slice(open + 1, close)
          addSub(paren ? body : unbacktick(body))
          inner += src.slice(j, close + 1)
          j = close + 1
          continue
        }
        inner += src[j]
        j++
      }
      add('"' + inner + '"')
      i = j + 1
      continue
    }
    if (c === '$' && src[i + 1] === "'") {
      const end = skipAnsiC(src, i + 1)
      const stop = end === -1 ? n : end
      add(src.slice(i, stop))
      i = stop
      continue
    }
    // Past the depth the scan follows, a substitution is left as text: its
    // ( ) still split commands, and the overflow tells the caller.
    const procSub = (c === '<' || c === '>') && src[i + 1] === '('
    const subStart = (c === '$' && src[i + 1] === '(') || procSub || c === '`'
    if (subStart && depth >= 3) overflow = true
    else if (c === '$' && src[i + 1] === '{' && depth < 3) {
      // A parameter expansion: a # inside is not a comment, but a command
      // substitution inside still runs.
      const close = findClose(src, i + 1)
      const stop = close === -1 ? n : close + 1
      const inner = src.slice(i + 2, close === -1 ? n : close)
      if (close === -1 || inner.indexOf('$(') !== -1 || inner.indexOf('`') !== -1) addSub(inner)
      add(src.slice(i, stop))
      i = stop
      continue
    } else if (subStart) {
      const open = c === '$' || procSub ? i + 1 : i
      const close = findClose(src, open)
      const stop = close === -1 ? n : close + 1
      const body = src.slice(open + 1, close === -1 ? n : close)
      addSub(c === '`' ? unbacktick(body) : body)
      add(src.slice(i, stop))
      i = stop
      continue
    }
    if ((c === '&' && src[i + 1] === '&') || (c === '|' && src[i + 1] === '|')) {
      push()
      joinNext = false
      ws = true
      i += 2
      continue
    }
    if (c === '&') {
      // A single top-level & backgrounds the command and splits like ;. The
      // redirect forms keep their ampersand: &> and &>> ahead, >& behind as
      // in 2>&1 and >&2.
      const prev = last
      if (src[i + 1] !== '>' && prev !== '>') {
        push()
        joinNext = false
        ws = true
        i++
        continue
      }
    }
    if (c === '|') {
      push()
      // A group that just closed is the producer of this pipe.
      if (closed !== null && src.slice(closed.end, i).trim() === '') {
        const range: number[] = []
        for (let k = closed.from; k < closed.to; k++) range.push(k)
        index.push(range)
        closed = null
      }
      joinNext = true
      ws = true
      i++
      // |& pipes stderr too
      if (src[i] === '&' && src[i + 1] !== '>') i++
      continue
    }
    if (c === ';') {
      push()
      joinNext = false
      ws = true
      i++
      continue
    }
    if (c === ')') {
      push()
      joinNext = false
      closeFrame(false, i + 1)
      ws = true
      i++
      continue
    }
    if (c === '(' && src[i + 1] === '(') {
      // ((...)) is arithmetic, where << shifts and starts no heredoc. It is
      // also read as nested subshells, which bash falls back to, so the
      // inside is checked as commands too.
      const close = findClose(src, i)
      if (close === -1) {
        // never closes: the rest is its inside
        addSub(src.slice(i + 2))
        add(src.slice(i))
        i = n
        continue
      }
      if (src.charAt(close - 1) === ')') {
        const inner = src.slice(i + 2, close - 1)
        addSub(inner)
        for (const e of expansionsIn(inner)) addSub(e)
        add(src.slice(i, close + 1))
        i = close + 1
        continue
      }
    }
    if (c === '(') {
      push()
      openFrame(false)
      ws = true
      i++
      continue
    }
    if (c === '{' && isSpace(src.charAt(i + 1)) && blank) {
      openFrame(true)
    }
    if (c === '}' && (i + 1 >= n || isSpace(src.charAt(i + 1)) || ';|&)<>'.indexOf(src.charAt(i + 1)) !== -1) && blank) {
      closeFrame(true, i + 1)
    }
    if (c === '<') {
      if (src[i + 1] === '<' && src[i + 2] !== '<') {
        // Heredoc: the body belongs to this command, newlines inside do
        // not split, so SQL inside it stays attached to its carrier.
        const mark = readHeredocMark(src, i + 2)
        add(src.slice(i, mark.end))
        i = mark.end
        if (mark.delim === '') continue
        if (pending !== null && pending.from < i) pending = null
        const from: number = pending !== null ? pending.from : src.indexOf('\n', i)
        if (from === -1) continue
        const prev = pending !== null ? pending.bodies[pending.bodies.length - 1] : undefined
        const first = prev === undefined
        const start = prev !== undefined ? prev.end : from + 1
        let end = findHeredocEnd(src, start, mark.delim, mark.dash)
        const text = src.slice(start, end === -1 ? n : end)
        if (end === -1) {
          // No terminator: either the body runs to the end, or the delimiter
          // was read differently than the shell does. Check the body as
          // commands too, so a command in it is not lost.
          end = n
          addSub(text)
        } else if (!mark.quoted) {
          for (const e of expansionsIn(text)) addSub(e)
        }
        if (pending === null) pending = { from, bodies: [] }
        pending.bodies.push({ owner: parts.length, start: first ? from : start, end })
        continue
      }
      if (src[i + 1] === '<') {
        add('<<<')
        i += 3
        ws = true
        continue
      }
    }
    const e = plainEnd(src, i)
    if (e > i) {
      add(src.slice(i, e))
      i = e
      continue
    }
    add(c)
    ws = c === '<' || c === '>'
    i++
  }
  push()
  const groups = index.map((g) => g.map((k) => parts[k] ?? ''))
  return { parts, subs, groups, overflow }
}

const SHELLS = ['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish', 'csh', 'tcsh', 'ash']

// What a command hands to a shell: a command string (-c, eval), a script to
// read (a file, source, or a substitution), or nothing, so the shell reads
// its standard input.
export type ShellRun = { kind: 'body'; body: string } | { kind: 'script'; path: string } | { kind: 'stdin' }

/**
 * If simple runs a shell (sh, bash and friends, with wrappers like sudo and
 * env stripped), eval, trap, source or the . builtin, say what it runs. Combined
 * flags like -lc count. Returns null for any other command.
 */
export function shellInvocation(simple: string): ShellRun | null {
  const words = commandArgv(simple)
  const head = baseName(words[0] ?? '')
  if (head === 'eval') return words.length > 1 ? { kind: 'body', body: words.slice(1).join(' ') } : null
  // trap 'cmd' SIGNAL: the first word is a command string, run on the signal.
  if (head === 'trap') {
    const action = words[1]
    return words.length > 2 && action !== undefined && !action.startsWith('-') ? { kind: 'body', body: action } : null
  }
  if (head === 'source' || head === '.') return words.length > 1 ? { kind: 'script', path: words[1] ?? '' } : null
  if (!SHELLS.includes(head)) return null
  let stdin = false
  for (let i = 1; i < words.length; i++) {
    const w = words[i] ?? ''
    if (w === '--') {
      const path = words[i + 1]
      return path === undefined || stdin ? { kind: 'stdin' } : { kind: 'script', path }
    }
    if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(w)) {
      // sh -c -- 'cmd': the -- ends the options before the command string
      const body = words[i + 1] === '--' ? words[i + 2] : words[i + 1]
      return body === undefined ? null : { kind: 'body', body }
    }
    // these take an option name or a file
    if (w === '-o' || w === '+o' || w === '-O' || w === '+O' || w === '--rcfile' || w === '--init-file') {
      i++
      continue
    }
    if (w === '-') return { kind: 'stdin' }
    if (/^-[a-zA-Z]*s/.test(w)) stdin = true
    if (w.startsWith('-') || w.startsWith('+')) continue
    return stdin ? { kind: 'stdin' } : { kind: 'script', path: w }
  }
  return { kind: 'stdin' }
}

interface Analysis {
  simples: string[]
  pipelines: string[][]
  // Something sat deeper than the parser follows, so the line was not fully
  // read. A guard should treat it as a hit.
  incomplete: boolean
}

// What a command writes to its output, as text a following shell could run:
// echo and printf arguments, or what cat is fed by a heredoc or here-string.
export function emittedText(simple: string): string[] {
  const info = lexInfo(simple, true)
  const words = stripWrappers(plainWords(info.words))
  const head = baseName(words[0] ?? '')
  const args = words.slice(1)
  if (head === 'echo') {
    let k = 0
    while (k < args.length && /^-[neE]+$/.test(args[k] ?? '')) k++
    return [args.slice(k).join(' ')]
  }
  if (head === 'printf') return [args.join(' '), args.slice(1).join(' ')]
  if (head === 'cat') {
    const out: string[] = []
    const hs = hereStringIn(info.words)
    if (hs !== null) out.push(hs)
    if (info.nl !== -1) out.push(simple.slice(info.nl + 1))
    return out
  }
  return []
}

function plainWords(words: Word[]): string[] {
  const out: string[] = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w === undefined) continue
    if (w.op) {
      i++
      continue
    }
    out.push(w.text)
  }
  return out
}

// The word after a <<< operator.
function hereStringIn(words: Word[]): string | null {
  for (let i = 0; i + 1 < words.length; i++) {
    const w = words[i]
    if (w !== undefined && w.op && w.text.endsWith('<<<')) return words[i + 1]?.text ?? null
  }
  return null
}

function walk(root: string, subsOnly: boolean): Analysis {
  const simples: string[] = []
  const pipelines: string[][] = []
  let incomplete = false
  // A body the line hands to a shell. Only two levels of them are followed.
  const body = (text: string, depth: number) => {
    if (depth < 2) visit(text, depth + 1, true, false)
    else incomplete = true
  }
  // isBody: text is run by a shell. printing: text is the substitution that
  // makes up the whole body of eval or sh -c, so what its commands print is
  // the command that runs: eval "$(echo 'rm -rf x')".
  const visit = (text: string, depth: number, isBody: boolean, printing: boolean) => {
    const r = scan(text, depth)
    if (r.overflow) incomplete = true
    for (const g of r.groups) pipelines.push(g)
    for (const p of r.parts) {
      simples.push(p)
      if (printing) {
        // the output becomes a body of the text the substitution sits in
        for (const t of emittedText(p)) body(t, depth - 1)
      }
      const run = shellInvocation(p)
      if (run === null) continue
      if (run.kind === 'body') body(run.body, depth)
      else if (run.kind === 'stdin') {
        const info = lexInfo(p, true)
        const hs = hereStringIn(info.words)
        if (hs !== null) body(hs, depth)
        if (info.nl !== -1) body(p.slice(info.nl + 1), depth)
      }
    }
    // A shell that reads a pipe runs what the commands before it print.
    for (const g of r.groups) {
      let seen = 0
      for (let k = 1; k < g.length; k++) {
        if (shellInvocation(g[k] ?? '')?.kind !== 'stdin') continue
        for (let j = seen; j < k; j++) {
          for (const t of emittedText(g[j] ?? '')) body(t, depth)
        }
        seen = k
      }
    }
    const printSubs = isBody && r.parts.length === 1 && /^(\$\(|`)/.test(r.parts[0] ?? '')
    for (const s of r.subs) visit(s, depth + 1, false, printSubs)
  }
  if (subsOnly) {
    const r = scan(root, 0)
    if (r.overflow) incomplete = true
    for (const s of r.subs) visit(s, 1, false, false)
  } else visit(root, 0, false, false)
  return { simples, pipelines, incomplete }
}

/**
 * The simple commands and pipelines of a shell line, plus whether the line
 * was read completely. Substitutions and sh -c bodies are included. A line
 * nests deeper than the parser follows reports incomplete: the guard treats
 * that as a hit instead of letting it through.
 */
export function analyzeCommand(cmd: string): Analysis {
  return walk(cmd, false)
}

/**
 * Split a shell line into simple commands on &&, ||, ;, |, a single & and
 * newlines, respecting quotes, backslash escapes, comments and heredoc
 * bodies. Redirect operators (&>, 2>&1, >&2) stay attached. The inner
 * commands of $( ... ), backticks and sh -c '...' are included as their own
 * entries.
 */
export function splitCommand(cmd: string): string[] {
  return walk(cmd, false).simples
}

/**
 * The pipelines of a shell line: each list holds the simple commands joined by
 * a real | (or |&), in order. Substitutions and sh -c bodies are included as
 * their own pipelines. A ( ) or { } group that reads a pipe holds the commands
 * inside it in that pipeline, and one that feeds a pipe is the pipe's producer.
 */
export function splitPipelines(cmd: string): string[][] {
  return walk(cmd, false).pipelines
}

/**
 * The simple commands that run inside the substitutions of text: $( ),
 * backticks and <( ). Used for a word such as "$(curl x)".
 */
export function substitutionCommands(text: string): string[] {
  return walk(text, true).simples
}

interface Word {
  text: string
  // An unquoted redirect operator such as >, 2>, &> or >&.
  op: boolean
}

// Quoted braces, commas and dots are swapped for private characters while a
// word is read, so brace expansion only sees the unquoted ones.
const MARKS = ['\uE000', '\uE001', '\uE002', '\uE003']
function lit(text: string): string {
  return text.replace(/[{},.]/g, (ch) => MARKS['{},.'.indexOf(ch)] ?? ch)
}
function unmark(text: string): string {
  return text.replace(/[\uE000-\uE003]/g, (ch) => '{},.'.charAt(ch.charCodeAt(0) - 0xe000))
}

// One word of brace expansion work: how many steps may still be spent.
interface Fuel {
  left: number
}

// Split inner at commas that are not inside nested braces. Returns the pieces.
function splitAlternatives(inner: string): string[] {
  const out: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < inner.length; i++) {
    const c = inner.charAt(i)
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === ',' && depth === 0) {
      out.push(inner.slice(from, i))
      from = i + 1
    }
  }
  out.push(inner.slice(from))
  return out
}

// {1..5}, {a..e}, {01..10}, {1..10..2}
function sequenceOf(inner: string): string[] | null {
  const m = /^(-?\d+|[A-Za-z])\.\.(-?\d+|[A-Za-z])(?:\.\.(-?\d+))?$/.exec(inner)
  if (m === null) return null
  const a = m[1] ?? ''
  const b = m[2] ?? ''
  const numeric = /^-?\d+$/.test(a)
  if (numeric !== /^-?\d+$/.test(b)) return null
  const from = numeric ? parseInt(a, 10) : a.charCodeAt(0)
  const to = numeric ? parseInt(b, 10) : b.charCodeAt(0)
  let step = m[3] !== undefined ? Math.abs(parseInt(m[3], 10)) : 1
  if (step === 0) step = 1
  if (Math.abs(to - from) / step > 1000) return null
  const width = numeric && (/^-?0\d/.test(a) || /^-?0\d/.test(b)) ? Math.max(a.length, b.length) : 0
  const out: string[] = []
  const dir = from <= to ? 1 : -1
  for (let v = from; dir === 1 ? v <= to : v >= to; v += dir * step) {
    out.push(numeric ? String(v).padStart(width, '0') : String.fromCharCode(v))
  }
  return out
}

// Brace expansion the way the shell does it. Returns null when the work
// budget runs out, and the caller keeps the word as written.
function expandBraces(word: string, fuel: Fuel): string[] | null {
  fuel.left -= word.length
  if (fuel.left < 0) return null
  // Match every { with its } in one pass.
  const match = new Map<number, number>()
  const stack: number[] = []
  for (let i = 0; i < word.length; i++) {
    const c = word.charAt(i)
    if (c === '{') stack.push(i)
    else if (c === '}') {
      const o = stack.pop()
      if (o !== undefined) match.set(o, i)
    }
  }
  for (let start = word.indexOf('{'); start !== -1; start = word.indexOf('{', start + 1)) {
    const end = match.get(start)
    if (end === undefined) continue
    const inner = word.slice(start + 1, end)
    const alts = splitAlternatives(inner)
    let items: string[] | null = null
    let recurse = false
    if (alts.length > 1) {
      items = alts
      recurse = true
    } else items = sequenceOf(inner)
    if (items === null) continue
    const pre = word.slice(0, start)
    const posts = expandBraces(word.slice(end + 1), fuel)
    if (posts === null) return null
    const out: string[] = []
    for (const it of items) {
      const mids = recurse ? expandBraces(it, fuel) : [it]
      if (mids === null) return null
      for (const mid of mids) {
        for (const post of posts) {
          fuel.left--
          if (fuel.left < 0) return null
          out.push(pre + mid + post)
        }
      }
    }
    return out
  }
  return [word]
}

interface Lexed {
  words: Word[]
  // Index of the first line break outside quotes and substitutions: a heredoc
  // body starts after it. -1 when there is none.
  nl: number
}

// risk mode: comments are dropped, a file descriptor glues onto any redirect
// operator (so 2>&1 is one operator and "2 >&1" is a word and an operator),
// and the words stop at the first line break, where a heredoc body begins.
const lexCache = [new Map<string, Lexed>(), new Map<string, Lexed>()]

// The same simple command is read by several checks in a row, so the result
// is kept for a while. The cache is dropped when it grows.
function lexInfo(simple: string, risk: boolean): Lexed {
  const cache = lexCache[risk ? 1 : 0] as Map<string, Lexed>
  const known = cache.get(simple)
  if (known !== undefined) return known
  const lexed = lexRead(simple, risk)
  if (cache.size >= 1024) cache.clear()
  cache.set(simple, lexed)
  return lexed
}

function lexRead(simple: string, risk: boolean): Lexed {
  const words: Word[] = []
  let cur = ''
  let started = false
  let nl = -1
  const fuel: Fuel = { left: 20000 }
  const push = () => {
    if (!started) return
    let variants: string[] | null = [cur]
    if (cur.indexOf('{') !== -1 && cur.length <= 4096) variants = expandBraces(cur, fuel) ?? [cur]
    for (const v of variants) words.push({ text: unmark(v), op: false })
    cur = ''
    started = false
  }
  let i = 0
  const n = simple.length
  // Append a construct that runs to its closer, or to the end of the text.
  const construct = (open: number, from: number): void => {
    const close = findClose(simple, open)
    const stop = close === -1 ? n : close + 1
    cur += lit(simple.slice(from, stop))
    started = true
    i = stop
  }
  while (i < n) {
    const c = simple.charAt(i)
    if (isSpace(c)) {
      if (c === '\n') {
        if (nl === -1) nl = i
        if (risk) {
          push()
          break
        }
      }
      push()
      i++
      continue
    }
    if (risk && c === '#' && !started) {
      const end = simple.indexOf('\n', i)
      i = end === -1 ? n : end
      continue
    }
    if (c === "'") {
      const j = simple.indexOf("'", i + 1)
      const end = j === -1 ? n : j
      cur += lit(simple.slice(i + 1, end))
      started = true
      i = end + 1
      continue
    }
    if (c === '"') {
      let j = i + 1
      while (j < n && simple[j] !== '"') {
        if (simple[j] === '\\' && j + 1 < n) {
          if (simple[j + 1] !== '\n') cur += lit(simple.charAt(j + 1))
          j += 2
          continue
        }
        const paren = simple[j] === '$' && (simple[j + 1] === '(' || simple[j + 1] === '{')
        if (paren || simple[j] === '`') {
          const open = paren ? j + 1 : j
          const close = findClose(simple, open)
          const stop = close === -1 ? n : close + 1
          cur += lit(simple.slice(j, stop))
          j = stop
          continue
        }
        // blanks and operators are ordinary inside quotes
        let k = j
        while (k < n) {
          const ch = simple.charCodeAt(k)
          if (ch === 34 || ch === 92 || ch === 36 || ch === 96) break
          k++
        }
        cur += lit(simple.slice(j, Math.max(k, j + 1)))
        j = Math.max(k, j + 1)
      }
      started = true
      i = j + 1
      continue
    }
    if (c === '$' && simple[i + 1] === "'") {
      const end = skipAnsiC(simple, i + 1)
      const stop = end === -1 ? n : end
      cur += lit(decodeAnsiC(simple.slice(i + 2, end === -1 ? n : end - 1)))
      started = true
      i = stop
      continue
    }
    if (c === '$' && simple[i + 1] === '"') {
      i++
      continue
    }
    if (c === '$') {
      // an unquoted $IFS splits the word like a blank
      const m = /^\$(?:\{IFS\}|IFS(?![A-Za-z0-9_]))/.exec(simple.slice(i, i + 8))
      if (m !== null) {
        push()
        i += m[0].length
        continue
      }
    }
    if (c === '$' && (simple[i + 1] === '(' || simple[i + 1] === '{')) {
      construct(i + 1, i)
      continue
    }
    if (c === '`') {
      construct(i, i)
      continue
    }
    if ((c === '<' || c === '>') && simple[i + 1] === '(') {
      construct(i + 1, i)
      continue
    }
    if (c === '\\' && i + 1 < n) {
      if (simple[i + 1] !== '\n') cur += lit(simple.charAt(i + 1))
      started = true
      i += 2
      continue
    }
    if (c === '>' || c === '<' || (c === '&' && (simple[i + 1] === '>' || simple[i + 1] === '<'))) {
      let j = i
      while (j < n && (simple[j] === '>' || simple[j] === '<' || simple[j] === '&')) j++
      const op = simple.slice(i, j)
      // A file descriptor number glues onto the operator: 2>, 1>>.
      const glue = risk ? op.startsWith('>') || op.startsWith('<') : op === '>' || op === '>>'
      if (glue && started && /^\d+$/.test(cur)) {
        words.push({ text: cur + op, op: true })
        cur = ''
        started = false
        i = j
        continue
      }
      if (op.length > 1 && started && cur === '&') {
        words.push({ text: cur + op, op: true })
        cur = ''
        started = false
        i = j
        continue
      }
      push()
      words.push({ text: op, op: true })
      i = j
      continue
    }
    if (c === '|') {
      push()
      i++
      continue
    }
    const e = plainEnd(simple, i)
    if (e > i) {
      cur += simple.slice(i, e)
      started = true
      i = e
      continue
    }
    cur += c
    started = true
    i++
  }
  push()
  return { words, nl }
}

/**
 * Shell-like word split with quotes and escapes removed and brace expansion
 * applied. Redirect operators (>, >>, <, 2>, &>) stand as their own tokens.
 */
export function tokens(simple: string): string[] {
  return lexInfo(simple, false).words.map((w) => w.text)
}

/**
 * The words the program receives: quotes removed, comments dropped, and every
 * redirect operator with its target left out, so `2> /dev/null` and `>&2`
 * are not arguments. A quoted > stays a word. A heredoc body is not part of it.
 */
export function argv(simple: string): string[] {
  return plainWords(lexInfo(simple, true).words)
}

/**
 * Does the command read text that sits in the command itself: a heredoc body
 * after its line, or a <<< here-string? A heredoc inside a quoted $( ) belongs
 * to the command in there, not to this one.
 */
export function hasStdinText(simple: string): boolean {
  const info = lexInfo(simple, true)
  return info.nl !== -1 || hereStringIn(info.words) !== null
}

/**
 * A simple command without its heredoc body: the text up to the first line
 * break outside quotes.
 */
export function commandLine(simple: string): string {
  const nl = lexInfo(simple, true).nl
  return nl === -1 ? simple : simple.slice(0, nl)
}

/**
 * Collapse whitespace and trim. Used for loop signatures.
 */
export function normalize(cmd: string): string {
  return cmd.replace(/\s+/g, ' ').trim()
}

/**
 * Basename of a path-like token, so /bin/rm and rm match.
 */
export function baseName(token: string): string {
  const i = token.lastIndexOf('/')
  return i === -1 ? token : token.slice(i + 1)
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/

// Wrappers that run the command after them: the flags that take a value and
// how many plain words (a duration) come before the command.
const WRAPPERS: Record<string, { value: readonly string[]; lead?: number }> = {
  sudo: {
    value: ['-u', '-g', '-h', '-p', '-C', '-D', '-R', '-T', '-U', '-r', '-t', '--user', '--group', '--host', '--prompt', '--chdir', '--role', '--type', '--other-user', '--close-from'],
  },
  doas: { value: ['-u', '-C'] },
  nohup: { value: [] },
  exec: { value: ['-a'] },
  command: { value: [] },
  builtin: { value: [] },
  time: { value: [] },
  setsid: { value: [] },
  nice: { value: ['-n', '--adjustment'] },
  ionice: { value: ['-c', '-n', '-p', '--class', '--classdata'] },
  timeout: { value: ['-s', '-k', '--signal', '--kill-after'], lead: 1 },
}

// Reserved words that start a command list or a group: the command follows
// them, so `if x; then rm -rf a; fi` runs rm and `{ rm -rf a; }` does too.
const KEYWORDS = ['if', 'then', 'elif', 'else', 'do', 'while', 'until', '!', '{', 'coproc']

function stripWrappers(t: string[]): string[] {
  let i = 0
  while (i < t.length) {
    const b = baseName(t[i] ?? '')
    if (KEYWORDS.indexOf(t[i] ?? '') !== -1) {
      i++
      continue
    }
    if (t[i] === 'function') {
      // function name { body: the body runs when the function is called.
      i += 2
      if (t[i] === '{') i++
      continue
    }
    if (ASSIGNMENT.test(t[i] ?? '')) {
      // VAR=value in front of a command; a line of only assignments stays.
      let k = i
      while (k < t.length && ASSIGNMENT.test(t[k] ?? '')) k++
      if (k >= t.length) break
      i = k
      continue
    }
    const w = WRAPPERS[b]
    if (w !== undefined) {
      let j = i + 1
      while (j < t.length) {
        const f = t[j] ?? ''
        if (f === '--') {
          j++
          break
        }
        if (!f.startsWith('-') || f === '-') break
        j += !f.includes('=') && w.value.indexOf(f) !== -1 ? 2 : 1
      }
      j += w.lead ?? 0
      i = j
      continue
    }
    if (b === 'env') {
      let j = i + 1
      while (j < t.length) {
        const f = t[j] ?? ''
        if (ASSIGNMENT.test(f) || f === '-i' || f === '--ignore-environment') j++
        else if (f === '-u' || f === '-C' || f === '--unset' || f === '--chdir') j += 2
        else break
      }
      if (j > i + 1 && j >= t.length) {
        // pairs but no command: env prints the environment
        return t.slice(i)
      }
      if (j < t.length) {
        i = j
        continue
      }
      // bare env alone: kept as the head, the dump case
    }
    break
  }
  return t.slice(i)
}

/**
 * Tokens of a simple command with wrapper prefixes stripped: sudo, nohup, env
 * with VAR=value pairs, VAR=value assignments and similar. Bare env (the
 * dump) is kept as the head.
 */
export function commandTokens(simple: string): string[] {
  return stripWrappers(tokens(simple))
}

/**
 * commandTokens over argv: redirects and comments are gone too, so a
 * redirect in front of the command does not hide it.
 */
export function commandArgv(simple: string): string[] {
  return stripWrappers(argv(simple))
}
