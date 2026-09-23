/**
 * jev-pilot — the decision ledger: what each main-loop turn was decided
 * and what then happened, kept in the plugin's store so the thresholds can be
 * tuned from real sessions instead of defaults.
 *
 * Pure: the hooks read and write `$.store`; this module shapes the entries,
 * keeps the list bounded, and turns it into a report with suggestions. No
 * prompt text is recorded, only labels, numbers and outcomes.
 */

export interface LedgerEntry {
  /** When the turn started, ms since the epoch. */
  at: number
  /** Whether the decision model answered at all (false: timeout, error, no key). */
  answered: boolean
  /** How long the answer took, ms; null when it was not asked. */
  ms: number | null
  tier: string | null
  tierConfidence: number | null
  /** The rubric level acted on (0..4), after the close-call lean. */
  effortLevel: number | null
  effortConfidence: number | null
  /** The effort the engine built the turn with, and the one it started on. */
  startedFrom: string | null
  started: string | null
  /** What trouble raised it to mid-turn, or null. */
  raisedTo: string | null
  toolCalls: number
  /** The longest run of failed tool calls in the turn. */
  failures: number
  strategy: string | null
  strategyConfidence: number | null
  /** Whether strategy advice was attached to the prompt. */
  advised: boolean
  /** How the turn ended: answer, aborted, refusal, error. */
  outcome: string | null
  durationMs: number | null
  outputTokens: number | null
}

/** The most entries kept; the oldest go first. */
export const LEDGER_SIZE = 500

export const LEDGER_KEY = 'ledger'

/**
 * The stored list with `entry` appended, bounded to `size`. Whatever is in
 * the store that is not a list of entries (a first run, or a value some
 * older version wrote) starts a fresh list rather than being patched.
 */
export function appendEntry(stored: unknown, entry: LedgerEntry, size = LEDGER_SIZE): LedgerEntry[] {
  const list = Array.isArray(stored) ? stored.filter(isEntry) : []
  list.push(entry)
  return list.slice(-size)
}

function isEntry(value: unknown): value is LedgerEntry {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as LedgerEntry).at === 'number' &&
    typeof (value as LedgerEntry).answered === 'boolean'
  )
}

/** The entries in the store, or none. */
export function entriesOf(stored: unknown): LedgerEntry[] {
  return Array.isArray(stored) ? stored.filter(isEntry) : []
}

/** The settings a suggestion may change, as they are now. */
export interface TunableConfig {
  timeoutMs: number
  minDowngradeConfidence: number
  effortCloseMargin: number
}

export interface Suggestion {
  option: keyof TunableConfig
  from: number
  to: number
  why: string
}

/** Below this many turns, nothing is suggested: too few to tell noise from a pattern. */
export const MIN_TURNS_TO_SUGGEST = 20

const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max']

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] as number
}

function share(part: number, whole: number): string {
  return whole === 0 ? '—' : `${Math.round((100 * part) / whole)}%`
}

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * What the ledger says should change, each with its reason. Conservative by
 * design: one step at a time, only past MIN_TURNS_TO_SUGGEST turns, and only
 * where the evidence points one way.
 */
export function suggestions(entries: readonly LedgerEntry[], config: TunableConfig): Suggestion[] {
  if (entries.length < MIN_TURNS_TO_SUGGEST) return []
  const found: Suggestion[] = []

  // Answers that did not arrive in time: the turns ran unrouted.
  const asked = entries.filter((entry) => entry.ms !== null || !entry.answered)
  const missed = asked.filter((entry) => !entry.answered).length
  const p90 = percentile(
    entries.filter((entry) => entry.answered && entry.ms !== null).map((entry) => entry.ms as number),
    0.9,
  )
  if (asked.length > 0 && missed / asked.length > 0.1 && p90 !== null) {
    const to = Math.max(config.timeoutMs + 200, Math.ceil((p90 * 1.25) / 100) * 100)
    found.push({
      option: 'timeoutMs',
      from: config.timeoutMs,
      to,
      why: `${share(missed, asked.length)} of turns got no answer in time; answers that did arrive took up to ${Math.round(p90)} ms (90th percentile)`,
    })
  }

  // Turns started low that had to be raised: the start was too cheap.
  const startedLow = entries.filter((entry) => entry.started === 'low' || entry.started === 'medium')
  const raisedLow = startedLow.filter((entry) => entry.raisedTo !== null).length
  if (startedLow.length >= 10 && raisedLow / startedLow.length > 0.2) {
    if (config.minDowngradeConfidence < 0.9) {
      found.push({
        option: 'minDowngradeConfidence',
        from: config.minDowngradeConfidence,
        to: round2(Math.min(0.9, config.minDowngradeConfidence + 0.1)),
        why: `${share(raisedLow, startedLow.length)} of turns started at low or medium effort had to be raised mid-turn`,
      })
    }
    if (config.effortCloseMargin < 0.3) {
      found.push({
        option: 'effortCloseMargin',
        from: config.effortCloseMargin,
        to: round2(Math.min(0.3, config.effortCloseMargin + 0.05)),
        why: 'close calls between two effort levels should lean up more often',
      })
    }
  }

  // Turns started high that ran short and clean: the start may be too costly.
  const startedHigh = entries.filter((entry) => entry.started === 'xhigh' || entry.started === 'max')
  const easyHigh = startedHigh.filter(
    (entry) => entry.raisedTo === null && entry.failures === 0 && entry.toolCalls <= 2 && entry.outcome === 'answer',
  ).length
  // Evidence pointing both ways is no evidence: then the margin stays.
  const marginUp = found.some((suggestion) => suggestion.option === 'effortCloseMargin')
  if (startedHigh.length >= 10 && easyHigh / startedHigh.length > 0.6 && config.effortCloseMargin > 0 && !marginUp) {
    found.push({
      option: 'effortCloseMargin',
      from: config.effortCloseMargin,
      to: round2(Math.max(0, config.effortCloseMargin - 0.05)),
      why: `${share(easyHigh, startedHigh.length)} of turns started at xhigh or max finished in two tool calls or fewer, with no failures`,
    })
  }
  return found
}

/**
 * The report, as text for the model to show the person: what the ledger
 * holds, per starting effort, and what it suggests changing.
 */
export function summarize(entries: readonly LedgerEntry[], config: TunableConfig): string {
  if (entries.length === 0) {
    return 'The decision ledger is empty: no main-conversation turn has been recorded yet. Use Claude Code as usual and run this again later.'
  }
  const first = new Date(entries[0]!.at).toISOString().slice(0, 10)
  const answered = entries.filter((entry) => entry.answered)
  const latencies = answered.filter((entry) => entry.ms !== null).map((entry) => entry.ms as number)
  const lines = [
    `Decision ledger: ${entries.length} turns since ${first}.`,
    '',
    `Jev answered ${share(answered.length, entries.length)} of turns; latency median ${percentile(latencies, 0.5) ?? '—'} ms, 90th percentile ${percentile(latencies, 0.9) ?? '—'} ms.`,
    '',
    '| Started at | Turns | Raised mid-turn | Avg tool calls | Avg output tokens |',
    '|---|---|---|---|---|',
  ]
  for (const level of LEVELS) {
    const here = entries.filter((entry) => entry.started === level)
    if (here.length === 0) continue
    const raised = here.filter((entry) => entry.raisedTo !== null).length
    const tools = here.reduce((sum, entry) => sum + entry.toolCalls, 0) / here.length
    const withTokens = here.filter((entry) => entry.outputTokens !== null)
    const tokens =
      withTokens.length === 0
        ? '—'
        : String(Math.round(withTokens.reduce((sum, entry) => sum + (entry.outputTokens as number), 0) / withTokens.length))
    lines.push(`| ${level} | ${here.length} | ${share(raised, here.length)} | ${tools.toFixed(1)} | ${tokens} |`)
  }
  const unset = entries.filter((entry) => entry.started === null).length
  if (unset > 0) lines.push(`| (not set) | ${unset} | | | |`)

  const advised = entries.filter((entry) => entry.advised)
  if (advised.length > 0) {
    const counts = new Map<string, number>()
    for (const entry of advised) counts.set(entry.strategy ?? '?', (counts.get(entry.strategy ?? '?') ?? 0) + 1)
    lines.push(
      '',
      `Strategy advice attached on ${advised.length} turns: ${[...counts].map(([name, count]) => `${name} ${count}`).join(', ')}.`,
    )
  }

  const found = suggestions(entries, config)
  lines.push('')
  if (entries.length < MIN_TURNS_TO_SUGGEST) {
    lines.push(`No suggestions yet: they need at least ${MIN_TURNS_TO_SUGGEST} turns.`)
  } else if (found.length === 0) {
    lines.push('No change suggested: nothing in the ledger points one way.')
  } else {
    lines.push('Suggested changes:')
    for (const suggestion of found) {
      lines.push(`- \`${suggestion.option}\`: ${suggestion.from} → ${suggestion.to}, because ${suggestion.why}.`)
    }
  }
  return lines.join('\n')
}

/** The prompt `/jev-pilot:report` hands the model. */
export function reportPrompt(report: string, settingsPath: string, hasSuggestions: boolean): string {
  return [
    'Show the user this jev-pilot report exactly as written, as markdown:',
    '',
    report,
    '',
    hasSuggestions
      ? `Then offer to apply the suggested changes to the "jev-pilot" entry under "pluginConfigs" in ${settingsPath} ("options" object), one Edit, changing nothing else, and only after the user says yes. The change takes effect in the next session.`
      : 'Do not change any settings.',
  ].join('\n')
}
