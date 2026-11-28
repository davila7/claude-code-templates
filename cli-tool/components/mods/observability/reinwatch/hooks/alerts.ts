import type { Alert, AlertKind, AgentRow, Settings } from '../types'
import { clean } from './clean'
import { formatDuration, formatTokens, label } from './format'
import { activeMs, newTokens, type Tracker } from './tracker'

// The warning rules: plain functions over the tracker. Each warning is raised once per key, and `t.fired` remembers it.

// Returns the alert only the first time its key is seen. The text is one plain line (a tool or run name came from outside);
// the key is kept as it came.
// With `remember: false` the key is neither checked nor recorded: the caller has its own once-only rule (the burst's
// `burstActive`), and a key that is new every time would only pile up in `fired`.
// A muted kind (`s.muted`) is never raised and never remembered.
function raise(t: Tracker, s: Settings, key: string, kind: AlertKind, agentId: string | undefined, at: number, text: string,
  opts: { remember?: boolean } = {}): Alert[] {
  if (s.muted.has(kind)) return []
  if (opts.remember !== false) {
    if (t.fired[key]) return []
    t.fired[key] = true
  }
  const plain = clean(text)
  return [agentId === undefined ? { key, kind, at, text: plain } : { key, kind, agentId, at, text: plain }]
}

function longAlert(t: Tracker, row: AgentRow, s: Settings, now: number): Alert[] {
  const ms = activeMs(row, now)
  if (ms <= s.activeMs) return []
  return raise(t, s, `long:${row.id}`, 'long', row.id, now,
    `"${label(row)}" has worked ${formatDuration(ms)} (limit ${formatDuration(s.activeMs)})`)
}

export function checkAgent(t: Tracker, agentId: string, s: Settings, now: number, lastCall?: { tool: string; count: number }): Alert[] {
  const row = t.agents[agentId]
  if (row === undefined) return []
  const out = longAlert(t, row, s, now)
  const n = newTokens(row.tokens)
  if (n > s.tokenLimit) {
    out.push(...raise(t, s, `tokens:${agentId}`, 'tokens', agentId, now,
      `"${label(row)}" has used ${formatTokens(n)} tokens (limit ${formatTokens(s.tokenLimit)})`))
  }
  if (lastCall !== undefined && lastCall.count >= s.repeatCount) {
    out.push(...raise(t, s, `repeat:${agentId}`, 'repeat', agentId, now,
      `"${label(row)}" made the same ${lastCall.tool} call ${lastCall.count} times in a row`))
  }
  if (row.failStreak >= s.failStreak) {
    out.push(...raise(t, s, `failures:${agentId}`, 'failures', agentId, now,
      `"${label(row)}" had ${row.failStreak} tool failures in a row`))
  }
  return out
}

export function checkSpawn(t: Tracker, runId: string | undefined, s: Settings, now: number): Alert[] {
  const out: Alert[] = []
  // Drop the starts at or before the window's edge; the rest are the starts inside the window. Note that this prunes
  // `t.spawns` in place: the tracker keeps only the starts still inside the window after the call.
  t.spawns = t.spawns.filter(at => at > now - s.burstWindowMs)
  const n = t.spawns.length
  // One warning per continuous burst: it fires when the count reaches the limit, and only a check that finds the
  // count below the limit again ends the burst, so a later one can warn.
  if (n < s.burstCount) t.burstActive = false
  else if (!t.burstActive) {
    t.burstActive = true
    out.push(...raise(t, s, `burst:${now}`, 'burst', undefined, now, `${n} agents started within ${formatDuration(s.burstWindowMs)}`, { remember: false }))
  }
  if (runId !== undefined) {
    const started = t.runs[runId] ?? 0
    if (started >= s.burstCount) {
      out.push(...raise(t, s, `run:${runId}`, 'run', undefined, now, `Workflow run ${runId} has started ${started} agents`))
    }
  }
  return out
}

// The dismissed keys worth keeping: each once, and only if its alert is still kept or it is the newest summary's key
// (`summary:<at>`, the largest `at`). A key whose alert was trimmed away
// can never match again within one instance, so it is dropped. After a reload `fired` is rebuilt from the alerts read
// back, so a trimmed key can be raised again.
export function pruneDismissed(dismissed: readonly string[], alerts: readonly Alert[]): string[] {
  const summaryAt = (key: string): number | null => {
    const m = /^summary:(\d+)$/.exec(key)
    return m === null ? null : Number(m[1])
  }
  let newest: number | null = null
  for (const key of dismissed) {
    const at = summaryAt(key)
    if (at !== null && (newest === null || at > newest)) newest = at
  }
  const out: string[] = []
  for (const key of dismissed) {
    if (out.includes(key)) continue
    const at = summaryAt(key)
    if (at === null ? alerts.some(a => a.key === key) : at === newest) out.push(key)
  }
  return out
}

// The long-running check for every row that is working now; the other kinds are decided at their own events.
export function checkAll(t: Tracker, s: Settings, now: number): Alert[] {
  const out: Alert[] = []
  for (const row of Object.values(t.agents)) {
    if (row.busy > 0) out.push(...longAlert(t, row, s, now))
  }
  return out
}
