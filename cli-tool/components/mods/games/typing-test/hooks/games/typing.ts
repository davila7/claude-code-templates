// Typing test: pure logic, drawn by the Typing module in ../surface.tsx. Lines of code and prose to
// retype; speed is words per minute at five characters a word.

export const LINES = [
  'const total = items.reduce((sum, item) => sum + item.price, 0)',
  'if (!response.ok) throw new Error(`request failed: ${response.status}`)',
  'git commit -m "fix: retry the upload when the connection drops"',
  'for (const [key, value] of Object.entries(config)) console.log(key, value)',
  'The quick brown fox jumps over the lazy dog while the build runs.',
  'export function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)) }',
  'SELECT name, count(*) FROM orders GROUP BY name ORDER BY 2 DESC LIMIT 10;',
  'Small, well-named functions are easier to read than clever ones.',
  'docker run --rm -it -v "$PWD":/app -w /app node:22 npm test',
  'def mean(xs): return sum(xs) / len(xs) if xs else 0.0',
]

export type TypingGame = { text: string; typed: string; errors: number; done: boolean }

export const newTyping = (rand = Math.random, maxLength = Infinity): TypingGame => {
  const fits = LINES.filter(l => l.length <= maxLength)
  const pool = fits.length ? fits : LINES
  return { text: pool[Math.floor(rand() * pool.length)], typed: '', errors: 0, done: false }
}

// one key: a printable character is typed (a wrong one counts as an error and stays until
// backspaced), backspace removes the last character; the line is done when typed exactly
export function press(g: TypingGame, key: string): TypingGame {
  if (g.done) return g
  if (key === 'backspace' || key === 'delete') return { ...g, typed: g.typed.slice(0, -1) }
  if ([...key].length !== 1 || key < ' ') return g
  const typed = g.typed + key
  if (typed.length > g.text.length) return g
  const errors = g.errors + (key === g.text[typed.length - 1] ? 0 : 1)
  return { ...g, typed, errors, done: typed === g.text }
}

export const wpm = (chars: number, ms: number) => (ms > 0 ? Math.round((chars / 5) / (ms / 60_000)) : 0)
export const accuracy = (g: TypingGame) => (g.typed.length ? Math.max(0, Math.round(100 * (1 - g.errors / (g.typed.length + g.errors)))) : 100)
