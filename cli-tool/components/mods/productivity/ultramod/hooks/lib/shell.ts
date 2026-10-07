// Shell parsing for the guard mods. Plain TypeScript, no imports: this runs
// inside the hooks environment where only web APIs exist.

function isSpace(c: string): boolean {
  return c === ' ' || c === '\t' || c === '\r' || c === '\n'
}

// Find the ) matching the ( that opens a $( ... ), honoring quotes, escapes
// and nesting. Returns -1 when unterminated.
function findCloseParen(src: string, open: number): number {
  let depth = 0
  let i = open
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === "'") {
      const j = src.indexOf("'", i + 1)
      if (j === -1) return -1
      i = j + 1
      continue
    }
    if (c === '"') {
      i++
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\') i++
        i++
      }
      i++
      continue
    }
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

// Find the closing backtick of a `...` substitution.
function findCloseBacktick(src: string, open: number): number {
  let i = open
  const n = src.length
  while (i < n) {
    const c = src[i]
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
    if (c === '`') return i
    i++
  }
  return -1
}

// Read a heredoc delimiter after << or <<- and return where the mark ends.
function readHeredocMark(src: string, i: number): { end: number; delim: string } {
  const n = src.length
  let j = i
  while (j < n && (src[j] === '-' || src[j] === '+')) j++
  if (j < n && (src[j] === "'" || src[j] === '"')) {
    const q = src.charAt(j)
    const k = src.indexOf(q, j + 1)
    if (k === -1) return { end: n, delim: '' }
    return { end: k + 1, delim: src.slice(j + 1, k) }
  }
  let delim = ''
  while (j < n && /[A-Za-z0-9_./]/.test(src.charAt(j))) {
    delim += src[j]
    j++
  }
  return { end: j, delim }
}

// Find where a heredoc body ends: the line equal to the delimiter, leading
// tabs allowed for <<-. Returns the index just past the terminator line.
function findHeredocEnd(src: string, bodyStart: number, delim: string): number {
  const n = src.length
  if (delim === '') return n
  let i = bodyStart
  while (i <= n) {
    const nl = src.indexOf('\n', i)
    const lineEnd = nl === -1 ? n : nl
    if (src.slice(i, lineEnd).replace(/^\t+/, '') === delim) return Math.min(n, lineEnd + 1)
    if (nl === -1) return n
    i = nl + 1
  }
  return n
}

interface ScanResult {
  parts: string[]
  subs: string[]
}

// Split one level into simple commands, extracting $( ) and ` ` bodies.
// depth caps recursion into nested substitutions.
function scan(src: string, depth: number): ScanResult {
  const parts: string[] = []
  const subs: string[] = []
  let cur = ''
  const push = () => {
    const t = cur.trim()
    if (t !== '') parts.push(t)
    cur = ''
  }
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src.charAt(i)
    if (isSpace(c)) {
      if (c === '\n') push()
      else cur += c
      i++
      continue
    }
    if (c === "'") {
      const j = src.indexOf("'", i + 1)
      const end = j === -1 ? n : j
      cur += src.slice(i, end + 1)
      i = end + 1
      continue
    }
    if (c === '\\' && i + 1 < n) {
      if (src[i + 1] === '\n') {
        i += 2
        continue
      }
      cur += c + src[i + 1]
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
        if (src[j] === '$' && src[j + 1] === '(' && depth < 3) {
          const close = findCloseParen(src, j + 1)
          if (close !== -1) {
            subs.push(src.slice(j + 2, close))
            inner += src.slice(j, close + 1)
            j = close + 1
            continue
          }
        }
        if (src[j] === '`' && depth < 3) {
          const close = findCloseBacktick(src, j + 1)
          if (close !== -1) {
            subs.push(src.slice(j + 1, close))
            inner += src.slice(j, close + 1)
            j = close + 1
            continue
          }
        }
        inner += src[j]
        j++
      }
      cur += '"' + inner + '"'
      i = j + 1
      continue
    }
    if (c === '$' && src[i + 1] === '(' && depth < 3) {
      const close = findCloseParen(src, i + 1)
      if (close !== -1) {
        subs.push(src.slice(i + 2, close))
        cur += src.slice(i, close + 1)
        i = close + 1
        continue
      }
    }
    if (c === '`' && depth < 3) {
      const close = findCloseBacktick(src, i + 1)
      if (close !== -1) {
        subs.push(src.slice(i + 1, close))
        cur += src.slice(i, close + 1)
        i = close + 1
        continue
      }
    }
    if ((c === '&' && src[i + 1] === '&') || (c === '|' && src[i + 1] === '|')) {
      push()
      i += 2
      continue
    }
    if (c === '&') {
      // A single top-level & backgrounds the command and splits like ;. The
      // redirect forms keep their ampersand: &> and &>> ahead, >& behind as
      // in 2>&1 and >&2.
      const prev = cur.length > 0 ? cur.charAt(cur.length - 1) : ''
      if (src[i + 1] !== '>' && prev !== '>') {
        push()
        i++
        continue
      }
    }
    if (c === ';' || c === '|' || c === '(' || c === ')') {
      push()
      i++
      continue
    }
    if (c === '<') {
      if (src[i + 1] === '<' && src[i + 2] !== '<') {
        // Heredoc: the body belongs to this command, newlines inside do
        // not split, so SQL inside it stays attached to its carrier.
        const mark = readHeredocMark(src, i + 2)
        const bodyEnd = findHeredocEnd(src, mark.end, mark.delim)
        cur += src.slice(i, bodyEnd)
        i = bodyEnd
        continue
      }
      if (src[i + 1] === '<') {
        cur += '<<<'
        i += 3
        continue
      }
    }
    cur += c
    i++
  }
  push()
  return { parts, subs }
}

// If simple is sh -c '<body>' (combined flags like -lc allowed), return the
// body. Returns null for anything else.
function dashCArgument(simple: string): string | null {
  const words = tokens(simple)
  if (words.length < 2) return null
  const head = baseName(words[0] ?? '')
  const shells = ['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish', 'csh']
  if (shells.includes(head)) {
    for (let i = 1; i < words.length - 1; i++) {
      const w = words[i] ?? ''
      if (w === '--') return null
      if (/^-[a-zA-Z]*c$/.test(w)) return words[i + 1] ?? null
      if (w.startsWith('-')) continue
      return null
    }
    return null
  }
  // Handle wrappers like env, /usr/bin/env that run a shell with -c
  if (head === 'env' || head === '/usr/bin/env') {
    // Find the shell name and -c flag
    for (let i = 1; i < words.length - 1; i++) {
      const w = words[i] ?? ''
      if (shells.includes(baseName(w))) {
        // Found shell, look for -c in remaining args
        for (let j = i + 1; j < words.length - 1; j++) {
          const w2 = words[j] ?? ''
          if (w2 === '--') return null
          if (/^-[a-zA-Z]*c$/.test(w2)) return words[j + 1] ?? null
          if (w2.startsWith('-')) continue
          return null
        }
      }
    }
  }
  return null
}

/**
 * Split a shell line into simple commands on &&, ||, ;, |, a single & and
 * newlines, respecting quotes, backslash escapes and heredoc bodies. Redirect
 * operators (&>, 2>&1, >&2) stay attached. The inner commands
 * of $( ... ), backticks and sh -c '...' are included as their own entries.
 */
export function splitCommand(cmd: string): string[] {
  const top = scan(cmd, 0)
  const out: string[] = []
  const expand = (text: string, depth: number) => {
    const r = scan(text, depth)
    for (const p of r.parts) {
      out.push(p)
      const body = dashCArgument(p)
      if (body !== null && depth < 2) expand(body, depth + 1)
    }
    for (const s of r.subs) expand(s, depth + 1)
  }
  for (const p of top.parts) {
    out.push(p)
    const body = dashCArgument(p)
    if (body !== null) expand(body, 1)
  }
  for (const s of top.subs) expand(s, 1)
  return out
}

/**
 * Shell-like word split with quotes and escapes removed. Redirect operators
 * (>, >>, <, 2>, &>) stand as their own tokens.
 */
export function tokens(simple: string): string[] {
  const words: string[] = []
  let cur = ''
  let started = false
  const push = () => {
    if (started) {
      words.push(cur)
      cur = ''
      started = false
    }
  }
  let i = 0
  const n = simple.length
  while (i < n) {
    const c = simple.charAt(i)
    if (isSpace(c)) {
      push()
      i++
      continue
    }
    if (c === "'") {
      const j = simple.indexOf("'", i + 1)
      const end = j === -1 ? n : j
      cur += simple.slice(i + 1, end)
      started = true
      i = end + 1
      continue
    }
    if (c === '"') {
      let j = i + 1
      while (j < n && simple[j] !== '"') {
        if (simple[j] === '\\' && j + 1 < n) {
          if (simple[j + 1] !== '\n') cur += simple[j + 1]
          j += 2
          continue
        }
        cur += simple[j]
        j++
      }
      started = true
      i = j + 1
      continue
    }
    if (c === '\\' && i + 1 < n) {
      if (simple[i + 1] !== '\n') cur += simple[i + 1]
      i += 2
      continue
    }
    if (c === '>' || c === '<' || (c === '&' && (simple[i + 1] === '>' || simple[i + 1] === '<'))) {
      let j = i
      while (j < n && (simple[j] === '>' || simple[j] === '<' || simple[j] === '&')) j++
      const op = simple.slice(i, j)
      // A file descriptor number glues onto the operator: 2>, 1>>.
      if ((op === '>' || op === '>>') && started && /^\d+$/.test(cur)) {
        words.push(cur + op)
        cur = ''
        started = false
        i = j
        continue
      }
      if (op.length > 1 && started && cur === '&') {
        words.push(cur + op)
        cur = ''
        started = false
        i = j
        continue
      }
      push()
      words.push(op)
      i = j
      continue
    }
    if (c === '|') {
      push()
      i++
      continue
    }
    cur += c
    started = true
    i++
  }
  push()
  return words
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

/**
 * Tokens of a simple command with wrapper prefixes stripped: sudo, nohup and
 * env with VAR=value pairs. Bare env (the dump) is kept as the head.
 */
export function commandTokens(simple: string): string[] {
  const t = tokens(simple)
  let i = 0
  while (i < t.length) {
    const b = baseName(t[i] ?? '')
    if (b === 'sudo' || b === 'nohup') {
      i++
      continue
    }
    if (b === 'env') {
      let j = i + 1
      while (j < t.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t[j] ?? '')) j++
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
