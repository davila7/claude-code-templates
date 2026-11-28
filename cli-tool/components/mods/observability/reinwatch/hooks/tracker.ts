import type { AgentStatus, TurnUsage } from 'claude-code'
import type { AgentRow, RowStatus, Tokens, TurnSummary } from '../types'
import { clean } from './clean'

// The record of the agents Claude runs: plain data and plain functions. Functions that depend on time take it as
// `now` and none reads a clock, so a test can replay any run exactly.

// `isCounted`: the call runs and its time counts. A call is made first and runs once its permission check is settled.
export type OpenCall = { agentId: string; isNested: boolean; isCounted: boolean }
export type Reported = { tokens: number; activeMs: number }
export type Tracker = {
  agents: Record<string, AgentRow>
  calls: Record<string, OpenCall>                  // open tool calls by tool_use_id
  // agentId → the fingerprint of the agent's last call and how many times in a row it was made. A different call
  // from the same agent starts the run over.
  repeats: Record<string, { key: string; count: number }>
  resumed: Record<string, true>                    // agentId → Allow resume was pressed here (and no Stop since)
  spawns: number[]                                 // start times inside the burst window
  runs: Record<string, number>                     // workflow runId → agents started
  fired: Record<string, true>                      // alert keys already raised
  burstActive: boolean                             // a burst was warned about and the starts in the window are still at the limit
  reported: Record<string, Reported>               // agentId → the totals already summarized; absent = never counted
}
export type SpawnInfo = { agentId: string; description: string; type: string; model: string; parentId?: string
  runId?: string; isTeammate: boolean; isResume: boolean }

// Tools that run another agent. That agent's work is counted on its own row, so the caller's clock does not run for them.
export const NESTED_TOOLS: ReadonlySet<string> = new Set(['Agent', 'Workflow'])

// Whether the engine's agent list is to be asked for now: never asked yet, the interval is over, or the clock was set
// back (waiting for it to catch up could take any time).
export function listDue(listedAt: number | null, now: number, every: number): boolean {
  return listedAt === null || now < listedAt || now - listedAt >= every
}

export function newTracker(): Tracker {
  return { agents: {}, calls: {}, repeats: {}, resumed: {}, spawns: [], runs: {}, fired: {}, burstActive: false, reported: {} }
}

// The row of an agent first met without its spawn, for example one already running when reinwatch loaded.
const placeholder = (id: string, now: number): AgentRow => ({
  id, description: '', type: '', model: '', isTeammate: false, status: 'running', isStopped: false, inTurn: true,
  firstSeenAt: now, lastActiveAt: now, activeMs: 0, busySince: null, busy: 0, openTools: 0,
  tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, turns: 0, failStreak: 0,
})

// Every event starts here: the agent's row (made on the spot when it has none), marked active now.
export function ensureAgent(t: Tracker, agentId: string, now: number): AgentRow {
  const row = t.agents[agentId] ?? (t.agents[agentId] = placeholder(agentId, now))
  row.lastActiveAt = now
  return row
}

// Time worked is the union of the busy intervals: the clock runs while a model call or a counted tool call is open,
// and overlapping work counts once. `busy` is how many of them are open; `busySince` is when the first began.
function startWork(row: AgentRow, now: number): void {
  if (row.busy === 0) row.busySince = now
  row.busy += 1
}

function stopWork(row: AgentRow, now: number): void {
  if (row.busy === 0) return   // an end that comes after its turn already closed the interval
  row.busy -= 1
  if (row.busy === 0) closeInterval(row, now)
}

// Moves the open interval into the closed time. A `now` read before an await can be older than the interval's start,
// so an interval never adds less than 0.
function closeInterval(row: AgentRow, now: number): void {
  if (row.busySince !== null) row.activeMs += Math.max(0, now - row.busySince)
  row.busySince = null
}

// Where a row rests between turns.
const restingStatus = (row: AgentRow): RowStatus => (row.isTeammate ? 'idle' : 'done')

// A stopped agent reads "stopping" while a tool it started still runs, and "stopped" once none does.
const stoppedStatus = (row: AgentRow): RowStatus => (row.openTools > 0 ? 'stopping' : 'stopped')

// The spawn's facts go onto the row, over a placeholder if an earlier event made one. What the row already counted stays.
export function noteSpawn(t: Tracker, s: SpawnInfo, now: number): AgentRow {
  const row = ensureAgent(t, s.agentId, now)
  row.description = s.description
  row.type = s.type
  row.model = s.model
  row.isTeammate = s.isTeammate
  // A field the spawn leaves out keeps what the row already has.
  if (s.parentId !== undefined) row.parentId = s.parentId
  if (s.runId !== undefined) row.runId = s.runId
  row.status = row.isStopped ? stoppedStatus(row) : 'running'
  // A resume is the same agent running again, so it adds neither to the burst window nor to its run's count.
  if (!s.isResume) {
    t.spawns.push(now)
    if (s.runId !== undefined) t.runs[s.runId] = (t.runs[s.runId] ?? 0) + 1
  }
  return row
}

export function turnStarted(t: Tracker, agentId: string, now: number): void {
  const row = ensureAgent(t, agentId, now)
  row.inTurn = true
  row.turns += 1
  row.status = row.isStopped ? stoppedStatus(row) : 'running'
}

export function turnEnded(t: Tracker, agentId: string, reason: 'answer' | 'aborted' | 'refusal' | 'error', now: number): void {
  const row = ensureAgent(t, agentId, now)
  closeInterval(row, now)
  row.busy = 0
  for (const [id, call] of Object.entries(t.calls)) if (call.agentId === agentId) delete t.calls[id]
  row.openTools = 0
  row.inTurn = false
  row.status = row.isStopped ? 'stopped' : reason === 'error' ? 'failed' : restingStatus(row)
}

export function stepStarted(t: Tracker, agentId: string, now: number): void {
  startWork(ensureAgent(t, agentId, now), now)
}

export function stepEnded(t: Tracker, agentId: string, usage: TurnUsage | null, now: number): void {
  const row = ensureAgent(t, agentId, now)
  stopWork(row, now)
  if (usage === null) return
  row.tokens.input += usage.input_tokens
  row.tokens.cacheWrite += usage.cache_creation_input_tokens
  row.tokens.cacheRead += usage.cache_read_input_tokens
  row.tokens.output += usage.output_tokens
  if (usage.model) row.model = usage.model
}

// Returns how many times in a row this agent has made this exact call, this one included.
export function toolStarted(t: Tracker, c: { agentId: string; toolUseId: string; tool: string; key: string }, now: number): number {
  const row = ensureAgent(t, c.agentId, now)
  // A call already open (the same tool_use_id seen again) changes nothing; report the run's count as it stands.
  if (t.calls[c.toolUseId] !== undefined) {
    const run = t.repeats[c.agentId]
    return run?.key === c.key ? run.count : 0
  }
  t.calls[c.toolUseId] = { agentId: c.agentId, isNested: NESTED_TOOLS.has(c.tool), isCounted: false }
  row.openTools += 1
  row.lastTool = clean(c.tool)
  const last = t.repeats[c.agentId]
  const run = last !== undefined && last.key === c.key ? { key: c.key, count: last.count + 1 } : { key: c.key, count: 1 }
  t.repeats[c.agentId] = run
  return run.count
}

// The call starts to run (its permission check is settled), so its time counts from now: the wait for a prompt, a
// classifier or a hook is left out. A nested call never counts, and a second signal for one call changes nothing.
export function toolRunning(t: Tracker, toolUseId: string, now: number): void {
  const call = t.calls[toolUseId]
  if (call === undefined) return
  const row = ensureAgent(t, call.agentId, now)
  if (call.isNested || call.isCounted) return
  call.isCounted = true
  startWork(row, now)
}

// An 'aborted' call (the hook below it threw, so how the tool went is unknown) changes nothing of the failure streak.
export function toolEnded(t: Tracker, toolUseId: string, outcome: 'ok' | 'error' | 'denied' | 'aborted', now: number): void {
  const call = t.calls[toolUseId]
  if (call === undefined) return
  delete t.calls[toolUseId]
  const row = ensureAgent(t, call.agentId, now)
  if (call.isCounted) stopWork(row, now)
  if (outcome === 'error') row.failStreak += 1
  else if (outcome === 'ok') row.failStreak = 0
  // Never below 0: a row read back after a reload starts with no open tools, though a call of it may have begun here.
  row.openTools = Math.max(0, row.openTools - 1)
  if (row.isStopped && row.openTools === 0) row.status = 'stopped'
}

// Returns the row as it stands, for the record of the Stop.
export function markStopped(t: Tracker, agentId: string, now: number): AgentRow {
  const row = ensureAgent(t, agentId, now)
  row.isStopped = true
  delete t.resumed[agentId]
  row.status = stoppedStatus(row)
  return row
}

export function allowResume(t: Tracker, agentId: string, now: number): void {
  const row = ensureAgent(t, agentId, now)
  row.isStopped = false
  t.resumed[agentId] = true
  row.status = row.inTurn ? 'running' : restingStatus(row)
}

// Closed busy time plus the interval still open.
export function activeMs(row: AgentRow, now: number): number {
  return row.activeMs + (row.busySince === null ? 0 : Math.max(0, now - row.busySince))
}

// New tokens: input, cache writes and output. Cache reads (the context read again from the cache on every step)
// are left out; they stay in `tokens.cacheRead` for the Details line.
export function newTokens(tokens: Tokens): number {
  return tokens.input + tokens.cacheWrite + tokens.output
}

// What the agents did since the last report: each row's tokens and time beyond what `reported` holds, an interval
// still open counted up to `now`. Whenever the work was done (in a main turn or between turns) it is reported once.
// A row with no new tokens or time is left out, and a row counted for the first time is a new agent.
// The baseline never moves back: a step closed with a clock read older than the last report holds less time than was
// reported, and that difference is neither taken back now nor counted again later.
// Null when no row did anything since the last report.
export function endMainTurn(t: Tracker, now: number): TurnSummary | null {
  let agents = 0
  let newAgents = 0
  let tokens = 0
  let workedMs = 0
  let longest: TurnSummary['longest'] | null = null
  const rows: TurnSummary['rows'] = []
  for (const [id, row] of Object.entries(t.agents)) {
    const before = t.reported[id]
    const rowTokens = Math.max(0, newTokens(row.tokens) - (before?.tokens ?? 0))
    const rowMs = Math.max(0, activeMs(row, now) - (before?.activeMs ?? 0))
    if (rowTokens === 0 && rowMs === 0) continue
    agents += 1
    if (before === undefined) newAgents += 1
    tokens += rowTokens
    workedMs += rowMs
    const total = { tokens: (before?.tokens ?? 0) + rowTokens, activeMs: (before?.activeMs ?? 0) + rowMs }
    rows.push({ id, tokens: rowTokens, activeMs: rowMs, totalTokens: total.tokens, totalActiveMs: total.activeMs })
    if (longest === null || rowMs > longest.activeMs) longest = { id, activeMs: rowMs }
    t.reported[id] = total
  }
  // The longest first (a stable sort: equal times stay in the order the agents were first seen).
  rows.sort((a, b) => b.activeMs - a.activeMs)
  return longest === null ? null : { agents, newAgents, tokens, activeMs: workedMs, longest, rows }
}

// After a reload, a row read back counts as reported up to what it holds: that work was summarized, or is past
// summarizing, in the instance that ran before. A row that has done nothing stays out, so its first work makes it new.
export function markReported(t: Tracker, row: AgentRow): void {
  const done = { tokens: newTokens(row.tokens), activeMs: activeMs(row, row.lastActiveAt) }
  if (done.tokens > 0 || done.activeMs > 0) t.reported[row.id] = done
}

// A row this instance made before the read-back is newer than the copy read back, so it stays; the copy adds what it
// lacks. Facts the kept row has no value for are filled in, the copy's tokens, time and turns are added, and the
// person's Stop from before the reload still holds. The copy's totals count as reported, as for a row read back alone.
export function foldReadBack(t: Tracker, mine: AgentRow, copy: AgentRow): void {
  // Unless Allow resume was pressed on this row in this instance: that is newer than the stored Stop.
  if (copy.isStopped && !mine.isStopped && !t.resumed[mine.id]) markStopped(t, mine.id, mine.lastActiveAt)
  if (mine.description === '') mine.description = copy.description
  if (mine.type === '') mine.type = copy.type
  if (mine.model === '') mine.model = copy.model
  if (mine.parentId === undefined && copy.parentId !== undefined) mine.parentId = copy.parentId
  if (mine.runId === undefined && copy.runId !== undefined) mine.runId = copy.runId
  if (copy.isTeammate) mine.isTeammate = true
  if (mine.lastTool === undefined && copy.lastTool !== undefined) mine.lastTool = copy.lastTool
  const before = t.reported[mine.id]
  markReported(t, copy)
  const now = t.reported[mine.id]
  if (before !== undefined && now !== undefined && now !== before) t.reported[mine.id] = { tokens: now.tokens + before.tokens, activeMs: now.activeMs + before.activeMs }
  mine.tokens.input += copy.tokens.input
  mine.tokens.cacheWrite += copy.tokens.cacheWrite
  mine.tokens.cacheRead += copy.tokens.cacheRead
  mine.tokens.output += copy.tokens.output
  mine.activeMs += copy.activeMs
  mine.turns += copy.turns
  // The row rested before it was known to be a teammate: it rests as one now.
  if (!mine.inTurn && !mine.isStopped && mine.status === 'done' && mine.isTeammate) mine.status = 'idle'
}

// The rows a reload read back, joined into this instance's tracker. This instance holds no open calls of a row read
// back, so nothing could close an interval it had open: fold it in up to the row's last event and start the row idle.
// Status and inTurn stay as they were. A row this instance lacks is adopted and counted as reported (what it holds was
// reported, or is past reporting, before the reload); a row it has is folded. It mutates the rows in `back` (and keeps
// them in the tracker), so callers pass a copy: state values are frozen.
export function adoptReadBack(t: Tracker, back: Record<string, AgentRow>): void {
  for (const [id, row] of Object.entries(back)) {
    if (row.busySince !== null) row.activeMs += Math.max(0, row.lastActiveAt - row.busySince)
    row.busy = 0
    row.busySince = null
    row.openTools = 0
    const mine = t.agents[id]
    if (mine === undefined) {
      t.agents[id] = row
      markReported(t, row)
      continue
    }
    foldReadBack(t, mine, row)
  }
}

// Ends the rows the engine's list says are over but that never got their turn.complete. A row with work or a tool
// still open, one the list does not name, one already at rest (not in a turn, such as an idle teammate) and one whose turns changed since
// `turnsBefore` (it began a turn while the answer was awaited) are left alone. Returns whether any row ended.
export function endListed(t: Tracker, listed: readonly { id: string; status: AgentStatus }[], turnsBefore: ReadonlyMap<string, number>, now: number): boolean {
  let ended = false
  for (const info of listed) {
    const row = t.agents[info.id]
    if (row === undefined || row.turns !== turnsBefore.get(info.id)) continue
    if (info.status !== 'completed' && info.status !== 'failed' && info.status !== 'killed') continue
    if (!row.inTurn || (row.status !== 'running' && row.status !== 'idle' && row.status !== 'stopping')) continue
    if (row.busy > 0 || row.busySince !== null || row.openTools > 0) continue
    turnEnded(t, info.id, info.status === 'failed' ? 'error' : 'answer', now)
    ended = true
  }
  return ended
}
