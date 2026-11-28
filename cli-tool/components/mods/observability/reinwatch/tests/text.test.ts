import { expect, test } from 'claude-code/testing'
import { clean } from '../hooks/clean'
import { breakdownLine, costOf, cut, formatCost, formatDuration, formatTokens, label, limitLine, plural, statusLabel, statusLine, summaryLine } from '../hooks/format'
import { redact } from '../hooks/redact'
import type { AgentRow, TurnSummary } from '../types'

const MIN = 60_000
const NOW = 10_000_000
const key = (...parts: string[]) => parts.join('')   // fake secrets are assembled, never literal
// A finished agent with nothing counted; a test overrides only the fields it is about.
const row = (partial: Partial<AgentRow>): AgentRow => ({
  id: 'a1', description: '', type: '', model: '', isTeammate: false, status: 'done', isStopped: false, inTurn: false,
  firstSeenAt: 0, lastActiveAt: 0, activeMs: 0, busySince: null, busy: 0, openTools: 0,
  tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, turns: 0, failStreak: 0,
  ...partial,
})

test('redact masks key-like strings and leaves words', () => {
  expect(redact(`Use ${key('sk', '-ant-', 'a'.repeat(20))} now`)).toBe('Use [redacted] now')
  for (const fake of [key('gh', 'p_', 'A'.repeat(36)), key('github', '_pat_', 'B'.repeat(30)), key('AK', 'IA', 'Q'.repeat(16)),
    key('xo', 'xb-', '1'.repeat(12)), key('-----BEGIN ', 'RSA PRIVATE KEY-----'), 'f'.repeat(32)]) expect(redact(fake)).toBe('[redacted]')
  expect(redact('f'.repeat(31))).toBe('f'.repeat(31))
  expect(redact('Research mod APIs')).toBe('Research mod APIs')
})

test('formatTokens', () => {
  expect(formatTokens(0)).toBe('0')
  expect(formatTokens(999)).toBe('999')
  expect(formatTokens(1000)).toBe('1k')
  expect(formatTokens(12_345)).toBe('12.3k')
  expect(formatTokens(999_999)).toBe('1M')
  expect(formatTokens(1_800_000)).toBe('1.8M')
  expect(formatTokens(5_000_000)).toBe('5M')
})

test('formatDuration', () => {
  expect(formatDuration(0)).toBe('0s')
  expect(formatDuration(45_000)).toBe('45s')
  expect(formatDuration(59_999)).toBe('59s')
  expect(formatDuration(60_000)).toBe('1m')
  expect(formatDuration(1_560_000)).toBe('26m')
  expect(formatDuration(3_900_000)).toBe('1h 5m')
  expect(formatDuration(7_200_000)).toBe('2h')
})

test('label falls back and shortens', () => {
  expect(label({ id: 'a1', description: 'Research mod APIs', type: 'Explore' })).toBe('Research mod APIs')
  expect(label({ id: 'a1', description: '', type: 'Explore' })).toBe('Explore')
  expect(label({ id: '1a2b3c4d5e6f', description: '', type: '' })).toBe('agent 1a2b3c4d')
  const shortened = label({ id: 'a1', description: 'abcdefghij'.repeat(7), type: '' })
  expect(shortened).toHaveLength(60)
  expect(shortened).toEndWith('…')
  expect(shortened).toBe(`${'abcdefghij'.repeat(5)}abcdefghi…`)   // the first 59 characters stay
})

test('statusLine', () => {
  // The tokens are spread over the four fields; cache reads are the one field left out of the count.
  const running = [
    row({ id: 'a1', status: 'running', activeMs: 12 * MIN, tokens: { input: 100_000, cacheWrite: 200_000, cacheRead: 800_000, output: 100_000 } }),
    row({ id: 'a2', status: 'running', activeMs: 3 * MIN, tokens: { input: 0, cacheWrite: 0, cacheRead: 500_000, output: 0 } }),
    row({ id: 'a3', status: 'running', activeMs: 1 * MIN, tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 100_000 } }),
  ]
  expect(statusLine([], 0, NOW)).toBeUndefined()
  expect(statusLine(running, 0, NOW)).toBe('agents 3 running · 500k tok · 12m active')
  expect(statusLine(running, 2, NOW)).toBe('agents 3 running · 500k tok · 12m active · 2 warnings')
  expect(statusLine([row({ id: 'a1', status: 'done' }), row({ id: 'a2', status: 'done' })], 1, NOW)).toBe('reinwatch: 1 warning')
})

test('summaryLine', () => {
  const turn: TurnSummary = { agents: 5, newAgents: 2, tokens: 3_200_000, activeMs: 41 * MIN, longest: { id: 'a1', activeMs: 26 * MIN }, rows: [] }
  expect(summaryLine(turn, 'Research mod APIs')).toBe('5 agents · 3.2M tok · 41m active combined · longest: "Research mod APIs" 26m active')
  expect(summaryLine({ ...turn, agents: 1 }, 'Research mod APIs')).toStartWith('1 agent · ')
})

test('breakdownLine', () => {
  expect(breakdownLine({ label: 'job a1', tokens: 1000, activeMs: 2000 })).toBe('"job a1" · 1k tok · 2s active')
})

// Rules the tests above do not reach.

test('each named key pattern masks by itself, from its smallest size up', () => {
  // These keys are all shorter than the 32 characters of the generic run, so only their own pattern can catch them.
  const masked = (...parts: string[]) => {
    const fake = key(...parts)
    expect(redact(fake)).toBe('[redacted]')
    expect(redact(`${fake} ${fake}`)).toBe('[redacted] [redacted]')   // every key in a text, not only the first
  }
  const kept = (...parts: string[]) => expect(redact(key(...parts))).toBe(key(...parts))
  const chars = (n: number) => 'aZ09'.repeat(n).slice(0, n)   // n lower case letters, capitals and digits
  const caps = (n: number) => 'Q0Z9'.repeat(n).slice(0, n)    // n capitals and digits
  masked('sk', '-', `${chars(6)}_-`)   // 8 after the prefix, with the two extra characters its class allows
  kept('sk', '-', `${chars(5)}_-`)
  for (const kind of ['p', 'o', 'u', 's', 'r']) {
    masked('gh', `${kind}_`, chars(20))
    kept('gh', `${kind}_`, chars(19))
  }
  masked('github', '_pat_', `${chars(19)}_`)
  kept('github', '_pat_', `${chars(18)}_`)
  masked('AK', 'IA', caps(16))
  kept('AK', 'IA', caps(15))
  kept('AK', 'IA', 'q0z9'.repeat(4))   // 16 long, but an access key id has no lower case
  for (const kind of ['a', 'b', 'p', 'o', 's', 'r']) {
    masked('xo', `x${kind}-`, `${chars(4)}-${chars(5)}`)
    kept('xo', `x${kind}-`, `${chars(4)}-${chars(4)}`)
  }
  masked('-----BEGIN ', 'PRIVATE KEY-----')
})

test('the generic run takes base64 and url-safe characters, and a space or a dot ends it', () => {
  const run = (middle: string) => `${'f'.repeat(15)}${middle}${'f'.repeat(16)}`   // 32 characters, if the middle one counts
  for (const mark of ['+', '/', '=', '_', '-']) expect(redact(run(mark))).toBe('[redacted]')
  for (const mark of [' ', '.']) expect(redact(run(mark))).toBe(run(mark))
  expect(redact('aZ09'.repeat(8))).toBe('[redacted]')   // capitals and digits count too
  expect(redact(`${'f'.repeat(32)} ${'f'.repeat(32)}`)).toBe('[redacted] [redacted]')   // every run, not only the first
  const sentence = 'Research the mod APIs and summarise what a hooks module can do'
  expect(redact(sentence)).toBe(sentence)
})

test('a text that is already masked stays as it is', () => {
  const once = redact(`Use ${key('sk', '-ant-', 'a'.repeat(20))} and ${'f'.repeat(40)} now`)
  expect(once).toBe('Use [redacted] and [redacted] now')
  expect(redact(once)).toBe(once)
})

test('formatTokens rounds to a tenth, and moves up to M instead of showing 1000k', () => {
  expect(formatTokens(1049)).toBe('1k')   // rounds to 1.0, and the ".0" is dropped
  expect(formatTokens(12_360)).toBe('12.4k')
  expect(formatTokens(999_940)).toBe('999.9k')
  expect(formatTokens(999_960)).toBe('1M')
  expect(formatTokens(1_000_000)).toBe('1M')
  expect(formatTokens(1_234_567)).toBe('1.2M')
  expect(formatTokens(1_860_000)).toBe('1.9M')
  expect(formatTokens(12_300_000)).toBe('12.3M')
})

test('formatDuration drops what it does not show instead of rounding it up', () => {
  expect(formatDuration(119_999)).toBe('1m')
  expect(formatDuration(3_599_999)).toBe('59m')
  expect(formatDuration(3_600_000)).toBe('1h')
  expect(formatDuration(3_660_000)).toBe('1h 1m')
  expect(formatDuration(5_460_000)).toBe('1h 31m')   // 91 minutes: the hour is not rounded up to 2
  expect(formatDuration(7_259_999)).toBe('2h')
  expect(formatDuration(93_660_000)).toBe('26h 1m')   // hours do not turn into days
})

test('label keeps sixty characters whole, and shortens a type as it shortens a description', () => {
  expect(label({ id: 'a1', description: 'x'.repeat(60), type: '' })).toBe('x'.repeat(60))
  expect(label({ id: 'a1', description: 'x'.repeat(61), type: '' })).toBe(`${'x'.repeat(59)}…`)
  expect(label({ id: 'a1', description: '', type: 'y'.repeat(70) })).toBe(`${'y'.repeat(59)}…`)
})

test('plural', () => {
  expect(plural(1, 'agent')).toBe('1 agent')
  expect(plural(2, 'agent')).toBe('2 agents')
  expect(plural(0, 'warning')).toBe('0 warnings')
})

test('statusLabel says why a stopping agent has not stopped, and otherwise names the state', () => {
  expect(statusLabel(row({ status: 'stopping' }))).toBe('stopping (a tool is still running)')
  for (const status of ['running', 'idle', 'done', 'failed', 'stopped'] as const) expect(statusLabel(row({ status }))).toBe(status)
})

test('statusLine counts only the running and stopping rows', () => {
  const rows = [
    row({ id: 'r', status: 'running', activeMs: 2 * MIN, tokens: { input: 300, cacheWrite: 0, cacheRead: 0, output: 0 } }),
    row({ id: 's', status: 'stopping', activeMs: 5 * MIN, tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 200 } }),
    ...(['idle', 'done', 'failed', 'stopped'] as const).map((status) =>
      row({ id: status, status, activeMs: 90 * MIN, tokens: { input: 9_000_000, cacheWrite: 0, cacheRead: 0, output: 0 } })),
  ]
  expect(statusLine(rows, 0, NOW)).toBe('agents 2 running · 500 tok · 5m active')
  expect(statusLine(rows.slice(2), 0, NOW)).toBeUndefined()
  expect(statusLine(rows.slice(2), 2, NOW)).toBe('reinwatch: 2 warnings')
  expect(statusLine([row({ status: 'running' })], 1, NOW)).toBe('agents 1 running · 0 tok · 0s active · 1 warning')
})

test('statusLine time is the longest of the rows, with the interval still open counted up to now', () => {
  const rows = [
    row({ id: 'a1', status: 'running', activeMs: 2 * MIN, busySince: NOW - 3 * MIN }),   // 2m closed and 3m open
    row({ id: 'a2', status: 'running', activeMs: 4 * MIN }),
  ]
  expect(statusLine(rows, 0, NOW)).toBe('agents 2 running · 0 tok · 5m active')
})

// A key starts a word, the generic run goes first, a label is cut whole.

test('sk- inside a longer word is not the start of a key', () => {
  // "task-", "risk-" and "disk-" all end in the sk- of an sk- key.
  for (const text of ['Fix task-scheduler-agent retries', 'Run disk-usage-checker now', 'Assess risk-register-entries soon']) {
    expect(redact(text)).toBe(text)
  }
})

test('the other key shapes also count only at the start of a word', () => {
  // Each is shorter than the generic run, and has a letter glued before it.
  const glued = (...parts: string[]) => `x${key(...parts)}`
  for (const text of [glued('gh', 'p_', 'A'.repeat(20)), glued('AK', 'IA', 'Q'.repeat(16)), glued('xo', 'xb-', '1'.repeat(10))]) {
    expect(redact(text)).toBe(text)
  }
})

test('a key after a space, an equals sign or a quote is still masked', () => {
  const fake = key('sk', '-ant-', 'a'.repeat(20))
  // "KEY=" and this key make 31 key characters, one short of the generic run, so only the sk- shape is at work.
  expect(redact(`KEY=${fake}`)).toBe('KEY=[redacted]')
  expect(redact(`token ${fake}`)).toBe('token [redacted]')
  expect(redact(`"${fake}"`)).toBe('"[redacted]"')
})

test('a key id with more key characters glued on is masked whole', () => {
  // The AKIA shape alone takes 20 characters and would leave the tail; the generic run, applied first, takes all 40.
  expect(redact(key('AK', 'IA', 'Q'.repeat(16), 'x'.repeat(20)))).toBe('[redacted]')
  // First means before every named shape: an sk- key takes letters, digits, _ and - only, so it would leave this tail of slashes.
  expect(redact(key('sk', '-', 'a'.repeat(8), '/'.repeat(24)))).toBe('[redacted]')
})

test('label cuts by code points, so an emoji is never split', () => {
  const smile = '\u{1F600}'
  // 70 code points, the 59th an emoji: the label keeps it whole, then the ellipsis.
  expect(label({ id: 'a1', description: `${'x'.repeat(58)}${smile}${'y'.repeat(11)}`, type: '' })).toBe(`${'x'.repeat(58)}${smile}…`)
  // The limit counts code points: sixty emoji are 120 UTF-16 units and still fit, sixty-one do not.
  expect(label({ id: 'a1', description: smile.repeat(60), type: '' })).toBe(smile.repeat(60))
  expect(label({ id: 'a1', description: smile.repeat(61), type: '' })).toBe(`${smile.repeat(59)}…`)
})

test('a key glued after an underscore is still masked', () => {
  // 3 + 24 = 27 characters in all, so the generic run does not catch it; `\b` would not see a word start after the underscore.
  expect(redact(`my_${key('gh', 'p_', 'A'.repeat(20))}`)).toBe('my_[redacted]')
})

test('clean makes one plain line: control characters and spaces become one space, direction controls go', () => {
  expect(clean('Fix\ntests')).toBe('Fix tests')
  expect(clean('a\u001b[31mb')).toBe('a [31mb')
  expect(clean('a\u0000\u0007\u007f\u009bb')).toBe('a b')
  expect(clean('a \t\r\n b')).toBe('a b')
  expect(clean('ab\u202Ecd\u2066ef\u200Fgh\u061C')).toBe('abcdefgh')
  expect(clean('a\u2028b\u2029c\u00a0d\u3000e')).toBe('a b c d e')
  expect(clean('  \n ')).toBe('')
  // Letters of any script, emoji, combining marks and the joiner inside an emoji stay.
  const plain = '日本語 🙂 e\u0301 👨\u200d👩\u200d👧'
  expect(clean(plain)).toBe(plain)
  // Every character the engine refuses in a drawn text is gone (C0, DEL and C1).
  for (let code = 0; code <= 0x9f; code += 1) {
    if (code < 0x20 || code >= 0x7f) expect(clean(`a${String.fromCharCode(code)}b`)).toBe('a b')
  }
  expect(clean(clean('a\n\u202Eb \u0007'))).toBe(clean('a\n\u202Eb \u0007'))
})

test('label shows a description on one plain line, and falls back when nothing readable is left', () => {
  expect(label({ id: 'abcdefghij', description: 'Fix\u001b[2J\ntests', type: 'Explore' })).toBe('Fix [2J tests')
  expect(label({ id: 'abcdefghij', description: '\u0000\n\u202E', type: 'Explore' })).toBe('Explore')
  expect(label({ id: 'abcdefghij', description: '', type: '\u001b' })).toBe('agent abcdefgh')
  // Cut after cleaning: sixty characters of text stay whole, however many controls came with them.
  expect(label({ id: 'x', description: '\u202E'.repeat(100) + 'a'.repeat(60), type: '' })).toBe('a'.repeat(60))
})

test('a value given to a name that ends in a secret word is masked, and the name stays', () => {
  expect(redact('login with password=hunter2 now')).toBe('login with password=[redacted] now')
  expect(redact('DB_PASSWORD: hunter2')).toBe('DB_PASSWORD: [redacted]')
  expect(redact('API_KEY="a b c" then')).toBe('API_KEY=[redacted] then')
  expect(redact('{"client_secret": "abc"}')).toBe('{"client_secret": [redacted]}')
  expect(redact('api-key=abc&x=1')).toBe('api-key=[redacted]&x=1')
  for (const text of ['Count tokens: 500 lines', 'password_hint=blue', 'the secret is out', 'token usage report']) expect(redact(text)).toBe(text)
  const once = redact('token=abc secret: xyz')
  expect(once).toBe('token=[redacted] secret: [redacted]')
  expect(redact(once)).toBe(once)
})

test('the user part of a URL is masked', () => {
  expect(redact('clone https://bob:hunter2@example.com/r.git')).toBe('clone https://[redacted]@example.com/r.git')
  expect(redact('postgres://app:pw@db:5432/main')).toBe('postgres://[redacted]@db:5432/main')
  const kept = 'see https://example.com/a@b and mail bob@example.com'
  expect(redact(kept)).toBe(kept)
  const once = redact('ssh://git@host/x')
  expect(once).toBe('ssh://[redacted]@host/x')
  expect(redact(once)).toBe(once)
})

test('AWS temporary key ids are masked like the long-lived ones', () => {
  const temp = ['AS', 'IA', 'Q'.repeat(16)].join('')
  expect(redact(`key ${temp} here`)).toBe('key [redacted] here')
  expect(redact(`x${temp}`)).toBe(`x${temp}`)   // only at the start of a word, like the other named shapes
})

test('secret key names and a quote that never closes are masked too', () => {
  expect(redact('SECRET_KEY=hunter2')).toBe('SECRET_KEY=[redacted]')
  expect(redact('secret-key: hunter2 and secret_key_base=abc')).toBe('secret-key: [redacted] and secret_key_base=[redacted]')
  expect(redact('AWS_SECRET_ACCESS_KEY=abc')).toBe('AWS_SECRET_ACCESS_KEY=[redacted]')
  expect(redact('set password="hunter2 and more')).toBe('set password=[redacted]')
  expect(redact("set token='abc def")).toBe('set token=[redacted]')
  const once = redact('SECRET_KEY=hunter2 password="x y')
  expect(once).toBe('SECRET_KEY=[redacted] password=[redacted]')
  expect(redact(once)).toBe(once)
})

test('masking a very long text stays fast', () => {
  // One unbroken run of scheme characters; the dots keep the generic rule out, so the text comes back as it is.
  const long = 'abc.'.repeat(25_000)
  const before = Date.now()
  expect(redact(long)).toBe(long)
  expect(Date.now() - before).toBeLessThan(2000)
})

test('a URL glued after other scheme characters is still masked', () => {
  expect(redact('git+ssh://git@host/x')).toBe('git+ssh://[redacted]@host/x')
  expect(redact('1https://bob:pw@host')).toBe('1https://[redacted]@host')
  expect(redact('KEY=https://bob:pw@host')).toBe('KEY=https://[redacted]@host')
})

test('cut keeps the first code points and never splits an emoji', () => {
  const smile = '\u{1F600}'
  expect(cut('abcdef', 3)).toBe('abc')
  expect(cut('abc', 3)).toBe('abc')
  expect(cut(smile.repeat(5), 3)).toBe(smile.repeat(3))
  expect(cut('', 3)).toBe('')
})

test('costOf prices cache writes at 1.25x input and cache reads at 0.1x', () => {
  const t = (input: number, cacheWrite: number, cacheRead: number, output: number) => ({ input, cacheWrite, cacheRead, output })
  expect(Math.round(costOf(t(1_000_000, 0, 0, 100_000), { input: 3, output: 15 }) * 1e9) / 1e9).toBe(4.5)
  expect(Math.round(costOf(t(0, 1_000_000, 0, 0), { input: 4, output: 20 }) * 1e9) / 1e9).toBe(5)
  expect(Math.round(costOf(t(0, 0, 1_000_000, 0), { input: 4, output: 20 }) * 1e9) / 1e9).toBe(0.4)
  expect(costOf(t(0, 0, 0, 0), { input: 4, output: 20 })).toBe(0)
})

test('formatCost: two decimals, $0.00 below half a cent, no decimals from 1000 with a separator', () => {
  expect(formatCost(0.42, '$')).toBe('$0.42')
  expect(formatCost(0.004, '$')).toBe('$0.00')
  expect(formatCost(0, '$')).toBe('$0.00')
  expect(formatCost(0.005, '$')).toBe('$0.01')
  expect(formatCost(999.994, '€')).toBe('€999.99')
  expect(formatCost(999.995, '$')).toBe('$1,000')
  expect(formatCost(999.994, '$')).toBe('$999.99')
  expect(formatCost(1000, '$')).toBe('$1,000')
  expect(formatCost(1234.56, '$')).toBe('$1,235')
  expect(formatCost(1234567, '¥')).toBe('¥1,234,567')
})

test('the 5-hour limit line shows a move up of a whole point, in whole percent', () => {
  expect(limitLine(34, 41.2)).toBe('5h limit 34% → 41% this turn')
  expect(limitLine(34.4, 34.6)).toBe('5h limit 34% → 35% this turn')
  expect(limitLine(34.2, 34.4)).toBeNull()
  expect(limitLine(41, 41)).toBeNull()
  // The window started over during the turn: what moved is not known.
  expect(limitLine(90, 3)).toBeNull()
})
