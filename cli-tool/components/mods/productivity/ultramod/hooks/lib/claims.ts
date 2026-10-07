// Receipts claim checking from SPEC 4.2: which commands count as test, build,
// typecheck or lint runs, and which English phrases claim they pass.
// Plain TypeScript, no imports.
import { splitCommand, commandTokens, baseName } from './shell'

export type CommandKind = 'test' | 'build' | 'typecheck' | 'lint'

const RANK: Record<CommandKind, number> = { test: 4, typecheck: 3, build: 2, lint: 1 }

const NPM_FAMILY = ['npm', 'pnpm', 'yarn', 'bun']

const DIRECT_TOOLS: Record<string, CommandKind> = {
  vitest: 'test',
  jest: 'test',
  pytest: 'test',
  'py.test': 'test',
  rspec: 'test',
  phpunit: 'test',
  gotestsum: 'test',
  eslint: 'lint',
  ruff: 'lint',
  'golangci-lint': 'lint',
  tsc: 'typecheck',
  'tsc-watch': 'typecheck',
}

// Classify an npm-family run script name.
function npmFamilyKind(sub: string | undefined): CommandKind | null {
  if (sub === undefined) return null
  if (sub === 'test' || /^test[-:_]/.test(sub)) return 'test'
  if (sub === 'build' || /^build[-:_]/.test(sub)) return 'build'
  if (sub === 'lint' || /^lint[-:_]/.test(sub)) return 'lint'
  if (sub === 'typecheck' || sub === 'type-check' || /^typecheck[-:_]/.test(sub)) return 'typecheck'
  return null
}

// The tool word that matters after a wrapper (npx, python -m, uv run, and
// subcommand-based tools like go, cargo, make, mvn, gradlew, deno, dotnet),
// prefixed with the wrapper name.
function wrappedTool(words: string[]): string | undefined {
  const head = baseName(words[0] ?? '')
  const args = words.slice(1)
  const firstArg = args.find((a) => !a.startsWith('-'))
  switch (head) {
    case 'npx':
    case 'bunx':
      if (args[0] === 'dlx') return args[1]
      return firstArg
    case 'yarn':
      if (args[0] === 'dlx') return args[1]
      return firstArg
    case 'pnpm':
      if (args[0] === 'exec') {
        // Handle pnpm exec -- separator
        const dashDashIdx = args.indexOf('--')
        const searchArgs = dashDashIdx !== -1 ? args.slice(dashDashIdx + 1) : args.slice(1)
        return searchArgs.find((a) => !a.startsWith('-'))
      }
      if (args[0] === 'dlx') return args[1]
      return undefined
    case 'uv':
    case 'pipenv':
    case 'poetry':
    case 'pdm':
    case 'hatch':
      if (args[0] === 'run') return args.find((a, i) => i > 0 && !a.startsWith('-'))
      return undefined
    case 'python':
    case 'python3':
    case 'py': {
      const m = args.indexOf('-m')
      if (m !== -1) return args[m + 1]
      return undefined
    }
    case 'node':
      if (args.indexOf('--test') !== -1) return 'node:--test'
      return undefined
    case 'make':
      return firstArg === undefined ? undefined : 'make:' + firstArg
    case 'go':
      return firstArg === undefined ? undefined : 'go:' + firstArg
    case 'cargo':
      return firstArg === undefined ? undefined : 'cargo:' + firstArg
    case 'gradlew':
    case 'gradle':
      return firstArg === undefined ? undefined : 'gradle:' + firstArg
    case 'mvn':
      for (const a of args) {
        if (a.startsWith('-')) continue
        return 'mvn:' + a
      }
      return undefined
    case 'deno':
      return firstArg === undefined ? undefined : 'deno:' + firstArg
    case 'dotnet':
      return firstArg === undefined ? undefined : 'dotnet:' + firstArg
    default:
      return undefined
  }
}

function classifyWord(word: string | undefined): CommandKind | null {
  if (word === undefined || word === '') return null
  const colon = word.indexOf(':')
  if (colon !== -1) {
    const t = word.slice(colon + 1)
    switch (word.slice(0, colon)) {
      case 'node':
        return t === '--test' ? 'test' : null
      case 'make':
        if (t === 'test' || t === 'check') return 'test'
        if (t === 'build') return 'build'
        if (t === 'lint') return 'lint'
        return null
      case 'go':
        if (t === 'test') return 'test'
        if (t === 'build') return 'build'
        if (t === 'vet') return 'lint'
        return null
      case 'cargo':
        if (t === 'test') return 'test'
        if (t === 'build') return 'build'
        if (t === 'clippy') return 'lint'
        return null
      case 'gradle':
        if (t === 'test' || t === 'check') return 'test'
        if (t === 'build') return 'build'
        return null
      case 'mvn':
        return t === 'test' ? 'test' : null
      case 'deno':
        if (t === 'test') return 'test'
        if (t === 'lint') return 'lint'
        return null
      case 'dotnet':
        if (t === 'test') return 'test'
        if (t === 'build') return 'build'
        return null
      default:
        return null
    }
  }
  return DIRECT_TOOLS[word] ?? null
}

function classifySimple(simple: string): CommandKind | null {
  const words = commandTokens(simple)
  if (words.length === 0) return null
  // A command that only prints help is nothing.
  if (words.some((w) => w === '--help')) return null
  const head = baseName(words[0] ?? '')
  const args = words.slice(1)

  if (NPM_FAMILY.indexOf(head) !== -1) {
    const runIdx = args.indexOf('run')
    if (runIdx !== -1) {
      const k = npmFamilyKind(args[runIdx + 1])
      if (k !== null) return k
    }
    const execIdx = args.indexOf('exec')
    if (execIdx !== -1) {
      const k = classifyWord(args.find((a, i) => i > execIdx && !a.startsWith('-')))
      if (k !== null) return k
    }
    if (args[0] === 'test') return 'test'
    const k = npmFamilyKind(args.find((a) => !a.startsWith('-')))
    if (k !== null) return k
    // yarn vitest run, pnpm vitest: the tool itself is the argument
    return classifyWord(wrappedTool(words))
  }

  const direct = DIRECT_TOOLS[head]
  if (direct !== undefined) return direct

  return classifyWord(wrappedTool(words))
}

/**
 * The strongest kind a command stands for (test > typecheck > build > lint),
 * or null. Covers npm/pnpm/yarn/bun run scripts, npx, vitest, jest, pytest
 * (python -m and uv run), go test, cargo test and clippy, gradlew/mvn test,
 * make test/check, rspec, phpunit, deno test, dotnet test, tsc, eslint and
 * ruff. --help answers null.
 */
export function commandKind(cmd: string): CommandKind | null {
  let best: CommandKind | null = null
  for (const simple of splitCommand(cmd)) {
    const k = classifySimple(simple)
    if (k !== null && (best === null || RANK[k] > RANK[best])) best = k
  }
  return best
}

export interface Claims {
  tests: boolean
  build: boolean
  typecheck: boolean
  lint: boolean
}

// Positive claim patterns, checked with a guard against conditional and
// negated context before any of them counts.
const CLAIM_PATTERNS: { kind: keyof Claims; re: RegExp }[] = [
  { kind: 'tests', re: /\ball\s+(?:\d+\s+)?tests?\s+(?:pass|passed|passing)\b/gi },
  { kind: 'tests', re: /\btests?\s+(?:are|is)\s+passing\b/gi },
  { kind: 'tests', re: /\btests?\s+now\s+pass\b/gi },
  { kind: 'tests', re: /\bthe\s+test\s+suite\s+passes\b/gi },
  { kind: 'tests', re: /\bevery\s+test\s+passes\b/gi },
  { kind: 'tests', re: /\btests?\s+passed\b/gi },
  { kind: 'tests', re: /\btests?\s+pass\b/gi },
  { kind: 'tests', re: /\btests?\s+(?:are|is)\s+green\b/gi },
  { kind: 'tests', re: /\ball\s+checks?\s+pass\b/gi },
  { kind: 'tests', re: /\bci\s+passes?\b/gi },
  { kind: 'tests', re: /\bpipeline\s+passed?\b/gi },
  { kind: 'build', re: /\bbuilds?\s+cleanly\b/gi },
  { kind: 'build', re: /\bbuild\s+(?:succeeds|succeeded|passes|passed)\b/gi },
  { kind: 'build', re: /\bthe\s+build\s+passes\b/gi },
  { kind: 'build', re: /\bbuild\s+is\s+(?:green|successful)\b/gi },
  { kind: 'build', re: /\bthe\s+build\s+is\s+green\b/gi },
  { kind: 'typecheck', re: /\btype[- ]?checks?\s+passes?\b/gi },
  { kind: 'typecheck', re: /\btype[- ]?check(?:ing)?\s+passed\b/gi },
  { kind: 'typecheck', re: /\bno\s+type\s+errors\b/gi },
  { kind: 'typecheck', re: /\btype\s+checking\s+is\s+clean\b/gi },
  { kind: 'lint', re: /\blint\s+is\s+clean\b/gi },
  { kind: 'lint', re: /\blint(?:ing)?\s+(?:is\s+)?clean\b/gi },
  { kind: 'lint', re: /\blint\s+passes\b/gi },
  { kind: 'lint', re: /\bno\s+lint\s+(?:errors|issues|problems)\b/gi },
]

// A conditional or negated lead-in ending just before the claim.
const GUARD =
  /\b(if|once|when|unless|until|after|before|should|would|could|might|may|hopes?|expects?|expected|assuming|provided|in\s+case|so\s+that|verify|confirm|to\s+confirm|make\s+sure|be\s+sure|not|no|never|n't|cannot|can't|won't|don't|doesn't|didn't|isn't|aren't)\s+(\w+\s+){0,3}$/i

/**
 * Which passing claims an answer makes in precise English: tests, build,
 * typecheck, lint. Negations and conditions ("tests do not pass", "if the
 * tests pass", "once tests pass", "make sure the tests pass", "should pass")
 * never count.
 */
export function claimsIn(answer: string): Claims {
  const result: Claims = { tests: false, build: false, typecheck: false, lint: false }
  for (const p of CLAIM_PATTERNS) {
    p.re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = p.re.exec(answer)) !== null) {
      const prefix = answer.slice(Math.max(0, m.index - 45), m.index)
      if (GUARD.test(prefix)) continue
      result[p.kind] = true
    }
  }
  return result
}
