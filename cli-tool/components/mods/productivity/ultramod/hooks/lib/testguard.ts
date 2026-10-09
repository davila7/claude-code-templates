// Test integrity detection from SPEC 4.5. Plain TypeScript, no imports.
import { splitCommand, commandTokens, baseName, tokens } from './shell'

/**
 * True for test file paths: *.test.*, *.spec.*, __tests__/, tests/, test/
 * segments, test_*.py, *_test.py, *_test.go, *Test.java, *Tests.cs,
 * *_spec.rb.
 */
export function isTestPath(path: string): boolean {
  const p = path.replace(/\\/g, '/')
  const segs = p.split('/').filter((s) => s !== '' && s !== '.')
  for (const seg of segs) {
    if (seg === '__tests__' || seg === 'test' || seg === 'tests') return true
  }
  const base = segs.length > 0 ? (segs[segs.length - 1] ?? '') : ''
  if (/^(test|spec)\.(ts|tsx|js|jsx|py|go|rs|java|kt|scala|swift|php|rb|cs)$/.test(base)) return true
  if (/\.(test|spec)\.[A-Za-z0-9]+$/.test(base)) return true
  if (/^test_.*\.(py|rs)$/.test(base)) return true
  if (/(_test|_spec)\.(py|rb|go|rs|cpp|cc)$/.test(base)) return true
  if (/([a-z0-9])Test(s)?\.java$/.test(base)) return true
  if (/([a-z0-9])Tests\.cs$/.test(base)) return true
  if (/([a-z0-9])Test\.(kt|scala|groovy|swift|php)$/.test(base)) return true
  return false
}

const MARKERS = [
  '.skip(',
  '.skip.each',
  'xit(',
  'xdescribe(',
  'xtest(',
  '.only(',
  '.only.each',
  '.todo(',
  '@pytest.mark.skipif',
  '@pytest.mark.skip',
  '@pytest.mark.xfail',
  '@unittest.skip',
  't.Skip(',
  '#[ignore]',
  '@Disabled',
  '@Ignore',
  '@skip',
  'pending(',
]

function countOccurrences(text: string, needle: string): number {
  return positions(text, needle).length
}

function positions(text: string, needle: string): number[] {
  const found: number[] = []
  if (needle === '') return found
  let i = text.indexOf(needle)
  while (i !== -1) {
    found.push(i)
    i = text.indexOf(needle, i + needle.length)
  }
  return found
}

// Occurrences of needle that sit inside an occurrence of inside. A marker's
// trailing call parenthesis may fall just past the longer marker, as in
// .skip( inside @unittest.skip(, so the parenthesis is allowed to overhang.
function coveredCountIn(text: string, needle: string, inside: string): number {
  const spans = positions(text, inside).map(start => ({ start, end: start + inside.length }))
  const needed = needle.endsWith('(') ? needle.length - 1 : needle.length
  return positions(text, needle).filter(pos => spans.some((span) => {
    const overlap = Math.min(pos + needle.length, span.end) - Math.max(pos, span.start)
    return overlap >= needed
  })).length
}

/**
 * The skip or focus markers present in after more times than in before.
 * A longer marker contains a shorter one, so @pytest.mark.skipif would also
 * count @pytest.mark.skip and @unittest.skip would also count .skip(. The edit
 * is reported once, under the marker that actually names it.
 */
export function addedMarkers(before: string, after: string): string[] {
  const added: string[] = []
  for (const m of MARKERS) {
    if (countOccurrences(after, m) > countOccurrences(before, m)) added.push(m)
  }
  return added.filter(m => !added.some(other => coversNewOccurrence(m, other, before, after)))
}

// True when every new occurrence of short sits inside a new occurrence of long.
function coversNewOccurrence(short: string, long: string, before: string, after: string): boolean {
  if (short === long) return false
  const addedCount = countOccurrences(after, short) - countOccurrences(before, short)
  if (addedCount <= 0) return false
  const covered = coveredCountIn(after, short, long) - coveredCountIn(before, short, long)
  return covered >= addedCount
}

function countAssertions(text: string): number {
  let n = countOccurrences(text, 'expect(')
  n += countOccurrences(text, 'assert')
  n += countOccurrences(text, 'require.')
  n += countWord(text, 'should')
  return n
}

function countWord(text: string, word: string): number {
  const re = new RegExp('\\b' + word + '\\b', 'g')
  const found = text.match(re)
  return found === null ? 0 : found.length
}

/**
 * How many fewer assertions after has than before (expect(, assert,
 * assertEquals, should, require.). 0 when none dropped.
 */
export function assertionDrop(before: string, after: string): number {
  const d = countAssertions(before) - countAssertions(after)
  return d > 0 ? d : 0
}

// Operands of a deleting command: flags are dropped, and everything after a
// bare -- is an operand even when it starts with a dash.
function pathArgs(args: string[]): string[] {
  const out: string[] = []
  let skipValue = false
  let optionsDone = false
  for (const a of args) {
    if (skipValue) {
      skipValue = false
      continue
    }
    if (!optionsDone) {
      if (a === '--') {
        optionsDone = true
        continue
      }
      if (a.startsWith('-') && a.length > 1) {
        if (a === '-s' || a === '--size') skipValue = true
        continue
      }
    }
    out.push(a)
  }
  return out
}

// Git options that come before the subcommand and take the next word as a value.
const GIT_VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env', '--exec-path'])

// The git subcommand and its arguments, past the global options.
function gitSubcommand(args: string[]): { name: string; rest: string[] } | null {
  let i = 0
  while (i < args.length) {
    const a = args[i] ?? ''
    if (GIT_VALUE_OPTIONS.has(a)) i += 2
    else if (a.startsWith('-')) i++
    else return { name: a, rest: args.slice(i + 1) }
  }
  return null
}

// Redirections that truncate their target: >, N> and &> (>> appends).
const TRUNCATING = /^(\d*>|&>)$/

// >& 2 and >& - duplicate or close a descriptor; any other word is a file.
const FD_TARGET = /^(\d+-?|-)$/

/**
 * Test paths removed by a bash command: rm, git rm, unlink, truncate -s 0
 * and > file, 2> file and &> file redirections.
 */
export function bashDeletesTests(cmd: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (p: string) => {
    if (!seen.has(p)) {
      seen.add(p)
      out.push(p)
    }
  }
  for (const simple of splitCommand(cmd)) {
    const words = commandTokens(simple)
    if (words.length === 0) continue
    const head = baseName(words[0] ?? '')
    const args = words.slice(1)
    const git = head === 'git' ? gitSubcommand(args) : null
    if (head === 'rm' || head === 'unlink' || head === 'shred') {
      for (const p of pathArgs(args)) {
        if (isTestPath(p)) add(p)
      }
    } else if (git !== null && git.name === 'rm') {
      for (const p of pathArgs(git.rest)) {
        if (isTestPath(p)) add(p)
      }
    } else if (head === 'truncate') {
      const hasS0 = args.some((a, i) => (a === '-s' || a === '--size') && args[i + 1] === '0') || args.some((a) => a === '-s0' || a === '--size=0')
      if (hasS0) {
        for (const p of pathArgs(args)) {
          if (isTestPath(p)) add(p)
        }
      }
    }
    // > file empties the file (>> appends and does not). Any command can
    // carry one, rm and git rm included.
    const plain = tokens(simple)
    for (let i = 0; i < plain.length - 1; i++) {
      const op = plain[i] ?? ''
      const target = plain[i + 1] ?? ''
      if (TRUNCATING.test(op) || (op === '>&' && !FD_TARGET.test(target))) {
        if (isTestPath(target)) add(target)
      }
    }
  }
  return out
}
