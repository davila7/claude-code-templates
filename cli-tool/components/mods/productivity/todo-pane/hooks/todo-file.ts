// Pure todo.md logic. A file is kept as its raw lines (split on "\n"), so
// every line nobody touched is written back byte for byte.

export type Task = { index: number; isDone: boolean; text: string }
export type Line = ({ kind: 'task' } & Task) | { kind: 'other'; index: number; text: string }

// `- [ ] text`, `* [x] text`, `+ [X]`; indent kept, `]` ends the line or a space follows.
const TASK = /^(\s*[-*+] \[)([ xX])\]( (.*))?$/

const splitCr = (raw: string) =>
  raw.endsWith('\r') ? { body: raw.slice(0, -1), cr: '\r' } : { body: raw, cr: '' }

export const toLines = (file: string): string[] => file.split('\n')

export const toFile = (lines: readonly string[]): string => lines.join('\n')

// The '' after a file's final "\n" is no line of its own.
export const parse = (lines: readonly string[]): Line[] =>
  (lines.at(-1) === '' ? lines.slice(0, -1) : lines).map((raw, index) => {
    const { body } = splitCr(raw)
    const match = TASK.exec(body)

    return match
      ? { kind: 'task', index, isDone: match[2] !== ' ', text: match[4] ?? '' }
      : { kind: 'other', index, text: body }
  })

export const openCount = (lines: readonly string[]): number =>
  parse(lines).filter(line => line.kind === 'task' && !line.isDone).length

const rewrite = (lines: readonly string[], index: number, change: (raw: string) => string) =>
  lines.map((raw, i) => (i === index ? change(raw) : raw))

const withTask = (raw: string, change: (isDone: boolean, text: string) => [boolean, string]) => {
  const { body, cr } = splitCr(raw)
  const match = TASK.exec(body)
  if (!match) {
    return raw
  }
  const [isDone, text] = change(match[2] !== ' ', match[4] ?? '')

  return `${match[1]}${isDone ? 'x' : ' '}]${text === '' && match[3] === undefined ? '' : ` ${text}`}${cr}`
}

export const toggle = (lines: readonly string[], index: number): string[] =>
  rewrite(lines, index, raw => withTask(raw, (isDone, text) => [!isDone, text]))

export const setText = (lines: readonly string[], index: number, text: string): string[] =>
  rewrite(lines, index, raw => withTask(raw, isDone => [isDone, text]))

export const remove = (lines: readonly string[], index: number): string[] =>
  lines.filter((_, i) => i !== index)

// Appended after the last non-empty line, so a trailing newline stays the file's last byte.
// A file written with "\r\n" gets the new line in "\r\n" too.
export const add = (lines: readonly string[] | null, text: string): string[] => {
  if (lines === null || (lines.length === 1 && lines[0] === '')) {
    return [`- [ ] ${text}`, '']
  }
  const cr = lines.length > 1 ? splitCr(lines[0] ?? '').cr : ''
  if (lines[lines.length - 1] === '') {
    return [...lines.slice(0, -1), `- [ ] ${text}${cr}`, '']
  }
  // No final newline: the old last line gets the separator, the new one stays unterminated.
  return [...lines.slice(0, -1), `${lines[lines.length - 1]}${cr}`, `- [ ] ${text}`]
}
