// Every text Arrester shows or sends: the reasons Claude reads, the question,
// the transcript lines, the status line, the /arrester output, the
// diagnostics, and the reading of block messages in tool results. Pure: no `$`.

import type { HookFailure } from 'claude-code'

import type { Call } from './analyze/call'
import { sortedJson } from './analyze/call'
import type { EffectKind, Ignored } from './analyze/types'
import { blocksOf, shown } from './match'
import type { Finding } from './match'
import type { ArresterBlock, ArresterCall, ArresterDecision, ArresterHeld, ArresterJournal, ArresterSource } from '../types/index'

/** The menu line of `/arrester`. */
export const COMMAND_DESCRIPTION = 'Show the calls Arrester keeps blocked, or close blocks with clear'
/** The hint after `/arrester` in the menu. */
export const ARGUMENT_HINT = '[history [page] | clear [id]]'
/** What `/arrester` prints for input it does not take. */
export const USAGE = 'Usage: /arrester, /arrester history [1-5], /arrester clear, or /arrester clear <id>'
/** The options and the chip of the hold question. */
export const DENY = 'Deny'
export const ALLOW_ONCE = 'Allow once'
export const HEADER = 'Arrester'

/** How a hold ended without "Allow once". */
type HoldEnd = { kind: 'refused' } | { kind: 'typed'; text: string } | { kind: 'unanswered'; cause: string }

const MAX_SUMMARY = 120
const MAX_REASON = 300
const MAX_QUESTION = 600
const LABELS: Readonly<Record<ArresterSource, string>> = { hook: 'settings hook', rule: 'deny rule', classifier: 'auto mode classifier', user: 'user rejection' }
const VERBS: Readonly<Record<EffectKind, string>> = { destroy: 'deletes or discards', write: 'writes', read: 'reads', list: 'lists' }
const REJECTED = "The user doesn't want to proceed with this tool use."
const HOOK_ERROR = /^PreToolUse:\S+ hook error: \[/
const HOOK_PREFIX = /^PreToolUse:\S+ hook error: /
const COMMAND_END = ']: '
const CLASSIFIER = 'Permission for this action was denied by the Claude Code auto mode classifier. Reason: '
const ADVICE = '. If you have other tasks'
const STOP = 'Do not try another way to get the same result.'

/** `text` on one line, cut to `max` characters with `…`. */
function line(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`
}

/** A call in one line of at most 120 characters: its command or path, else its input as JSON. */
export function summarize(call: Call): string {
  const input = call.input
  const main = [input.command, input.file_path, input.notebook_path, input.pattern, input.url].find(value => typeof value === 'string')
  const text = typeof main === 'string' ? `${main} ${typeof input.path === 'string' ? input.path : ''}` : sortedJson(input) ?? '[input exceeds analysis limit]'
  return line(text, MAX_SUMMARY)
}

/** A guard's reason as a block keeps it: one line of at most 300 characters, without the hook error prefix, and without the hook command when the prefix names one. */
export function storedReason(reason: string): string {
  const hook = blockOfText(reason)
  return line(hook?.source === 'hook' ? hook.reason : reason.replace(HOOK_PREFIX, ''), MAX_REASON)
}

/** The tool, summary, and subagent of a call, as the journal shows it. */
export function viewOf(call: Call): ArresterCall {
  const view = { tool: call.tool, summary: summarize(call) }
  return call.agentId === undefined ? view : { ...view, agentId: call.agentId }
}

/** The message of something thrown or rejected. */
export function causeOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** A hook failure as the diagnostics name it: its kind and its message. */
export function failureOf(failure: HookFailure): string {
  return failure.message === undefined ? failure.kind : `${failure.kind}: ${failure.message}`
}

/** Whether an auto mode denial carries a classifier verdict; the two no-verdict reasons do not. */
export function hasVerdict(reason: string): boolean {
  return !reason.startsWith('Classifier unavailable') && !reason.startsWith('Auto mode could not evaluate this action')
}

/** The block a tool result's text reports, read from the stable prefixes only: the user's rejection; a settings hook's exit-code-2 error, whose reason follows the first `]: ` after the hook command; or a classifier verdict, which ends before the advice that follows it. */
export function blockOfText(text: string): { source: ArresterSource; reason: string } | undefined {
  if (text.startsWith(REJECTED)) return { source: 'user', reason: text }
  const hook = HOOK_ERROR.exec(text)
  if (hook !== null) {
    const rest = text.slice(hook[0].length)
    const end = rest.indexOf(COMMAND_END)
    return { source: 'hook', reason: end < 0 ? rest : rest.slice(end + COMMAND_END.length) }
  }
  if (!text.startsWith(CLASSIFIER)) return undefined
  const rest = text.slice(CLASSIFIER.length)
  const end = rest.indexOf(ADVICE)
  const verdict = end < 0 ? rest : rest.slice(0, end)
  return hasVerdict(verdict) ? { source: 'classifier', reason: verdict } : undefined
}

/** One finding in words. */
export function phrase(finding: Finding): string {
  if (finding.rule === 'retry' && finding.block.source === 'user') return 'it repeats the call the user rejected'
  if (finding.rule === 'retry') return 'it repeats the blocked command with other flags or argument order'
  if (finding.rule === 'opaque') return `Arrester cannot fully analyze this call (${finding.reason})`
  if (finding.rule === 'guard') {
    if ('bypass' in finding) return `it runs claude ${finding.bypass}, which can turn off guards`
    if (finding.relation === 'contains') return `it ${VERBS[finding.kind]} ${finding.path}, which contains the guard file ${finding.guard}`
    return `it ${finding.kind === 'read' || finding.kind === 'list' ? 'reads or lists' : 'changes'} ${finding.path}, a guard file`
  }
  const where = finding.relation === 'same' ? '' : `, which ${finding.relation === 'inside' ? 'is inside' : 'contains'} ${finding.target}`
  return `it ${VERBS[finding.kind]} ${finding.path}${where} (blocked: ${finding.access})`
}

/** Who blocked a call: the guard, with the rule for a deny rule. */
function label(block: ArresterBlock): string {
  return block.rule === undefined ? LABELS[block.source] : `${LABELS[block.source]} ${block.rule}`
}

/** How long ago a moment was, in whole minutes. */
function ago(ms: number): string {
  return `${Math.max(0, Math.floor(ms / 60_000))} min ago`
}

/** A call in a line: its tool, the subagent that made it, and its summary. */
function who(call: ArresterCall): string {
  return `${call.tool}${call.agentId === undefined ? '' : ` in agent ${call.agentId}`}: ${call.summary}`
}

/** The Blocked and Match lines of a reason: the blocks the first three findings name, and those findings. */
function evidence(found: readonly Finding[], now: number): string[] {
  const shownFindings = found.slice(0, 3)
  return [
    ...blocksOf(shownFindings).map(block => `Blocked: ${block.id}, ${label(block)}, ${ago(now - block.at)}: ${block.tool} \`${block.summary}\`. Reason: ${block.reason}`),
    `Match: ${shownFindings.map(finding => line(phrase(finding), 600)).join('; ')}.`,
  ]
}

/** The reason Claude reads when Arrester stops a workaround. */
export function denyReason(found: readonly Finding[], now: number): string {
  const blocks = blocksOf(found.slice(0, 3))
  const close = blocks.length === 1 ? `The user can close this block with /arrester clear ${blocks.map(block => block.id).join('')}.` : 'The user can close these blocks with /arrester clear.'
  return [
    'Arrester stopped this call. It looks like a workaround of a call that a guard blocked.',
    ...evidence(found, now),
    `${STOP} Stop, tell the user what was blocked and why, and wait for their instructions. ${close}`,
  ].join('\n')
}

/** The reason Claude reads when a hold ends in a refusal. */
export function heldReason(end: HoldEnd, found: readonly Finding[], now: number): string {
  const first =
    end.kind === 'refused'
      ? 'Arrester held this call and the user chose Deny.'
      : end.kind === 'typed'
        ? `Arrester held this call and the user did not allow it. The user answered: "${line(end.text, MAX_REASON)}".`
        : `Arrester held this call and got no answer (${end.cause}), so it refused it.`
  return [first, ...evidence(found, now), `${STOP} Wait for the user's instructions.`].join('\n')
}

/** The reason Claude reads when the check itself failed while blocks are open. */
export function uncheckedReason(cause: string): string {
  return `Arrester could not check this call against its open blocks (${cause}), so it refused it. Tell the user. The user can close the blocks with /arrester clear.`
}

/** The hold question, at most 600 characters, the summaries cut first; it ends with its question mark. */
export function question(call: Call, first: Finding, now: number): string {
  const block = first.block
  const ask = (room: number): string => [
    `Arrester held a ${call.tool} call in ${call.agentId === undefined ? 'the main session' : `agent ${call.agentId}`}. It may get the same result as block ${block.id} (${label(block)}, ${ago(now - block.at)}: ${line(block.summary, room)}).`,
    `Call: ${line(summarize(call), room)}`,
    `Why: ${phrase(first)}.`,
    'Allow this call once?',
  ].join('\n')
  const fits = [MAX_SUMMARY, 60, 20].map(ask).find(text => text.length <= MAX_QUESTION)
  if (fits !== undefined) return fits
  const tail = '\nAllow this call once?'
  return `${ask(20).slice(0, MAX_QUESTION - tail.length - 1)}…${tail}`
}

/** The transcript line of a stop or of the end of a hold; Claude does not read it. */
export function decisionLine(decision: ArresterDecision, call: ArresterCall): string {
  const ids = decision.blockIds.join(', ')
  if (decision.action === 'stopped') return `stopped ${who(call)} (workaround of ${ids}: ${line(decision.detail, 1500)})`
  if (decision.action === 'allowed-once') return `allowed once ${who(call)} (held for ${ids})`
  if (decision.action === 'refused') return `refused ${who(call)} (held for ${ids}; the user answered: ${line(decision.detail, 1500)})`
  return `refused ${who(call)} (held for ${ids}; no answer: ${line(decision.detail, 1500)})`
}

/** The status line: open blocks and held calls, or nothing when there are none. */
export function statusLine(open: number, held: number, evicted?: string): string | undefined {
  if (open === 0 && held === 0 && evicted === undefined) return undefined
  const blocks = `${open} open block${open === 1 ? '' : 's'}`
  const current = held === 0 ? blocks : `${blocks} · ${held} held`
  return evicted === undefined ? current : `${current} · ${evicted} evicted, protection lost`
}

/** The `/arrester` text: the options, the open blocks, the held calls, and the last ten decisions. */
export function statusText(journal: ArresterJournal, open: readonly ArresterBlock[], response: string, minutes: number, now: number): string {
  const recent = journal.decisions.slice(-10)
  return [
    `response: ${response} · a block stays open ${minutes} min after it opens or after its last target or retry match`,
    '',
    ...(journal.eviction === undefined ? [] : [`Capacity: ${evictionText(journal.eviction.blockId)} (${ago(now - journal.eviction.at)})`, '']),
    `Open blocks (${open.length})`,
    ...open.flatMap(block => [
      `  ${block.id}  ${ago(now - block.at)}, turn ${block.turn}  ${label(block)}  ${block.tool}${block.agentId === undefined ? '' : ` in agent ${block.agentId}`}: ${block.summary}`,
      `      reason: ${block.reason}`,
      ...(block.retryLimited === undefined ? [] : [`      retry coverage: ${block.retryLimited}`]),
      ...(block.source === 'user' && block.exact === undefined ? ['      exact retry identity unavailable: the tool input exceeds the serialization limits, so this block matches no retry'] : []),
      ...(block.incomplete === undefined ? [] : [`      incomplete capture: ${block.incomplete}`]),
      `      targets: ${block.targets.length === 0 ? 'none (retries only)' : block.targets.slice(0, 32).map(target => `${line(shown(target.path, target.glob), 240)} (${target.access})`).join(', ') + (block.targets.length > 32 ? `; ${block.targets.length - 32} more retained targets` : '')}`,
    ]),
    '',
    `Held calls (${journal.held.length})`,
    ...journal.held.map(held => `  ${ago(now - held.since)}  ${held.blockIds.join(', ')}  ${who(held)}`),
    '',
    `Recent decisions (${recent.length})`,
    ...recent.map(decision => `  ${ago(now - decision.at)}  ${decision.action.padEnd(12)} ${decision.blockIds.join(', ')}  ${decision.call === undefined ? '' : `${who(decision.call)}   `}${decision.detail}`),
    '',
    'Close blocks with /arrester clear [id].',
  ].join('\n')
}

/** What `/arrester clear` prints. */
export function clearedText(closed: readonly string[], id: string | undefined): string {
  if (id !== undefined) return closed.length === 0 ? `No open block ${id}.` : `Closed block ${id}.`
  return `Closed ${closed.length} block${closed.length === 1 ? '' : 's'}.`
}

/** What `/arrester clear` prints for an origin that is not the user's own. */
export function clearRefused(kind: string): string {
  return `/arrester clear needs the user at the prompt; this request came from ${kind}.`
}

/** Diagnostic: the check failed while blocks are open. */
export function couldNotCheck(tool: string, failure: string, open: number | undefined, cause?: string): string {
  const because = open === undefined ? `the open blocks could not be read${cause === undefined ? '' : ` (${cause})`}` : `${open} block${open === 1 ? ' is' : 's are'} open`
  return `arrester: tool.call: could not check ${tool} (${failure}); refused it because ${because}`
}

/** Diagnostic: the hook failed and no block was open. */
export function hookFailedNoBlock(failure: string): string {
  return `arrester: tool.call: hook failed (${failure}); no block was open, so the call went on`
}

/** Diagnostic: a capture point could not record a block. */
export function couldNotRecord(event: string, tool: string, failure: string): string {
  return `arrester: ${event}: could not record the block for ${tool} (${failure}); workarounds of it will not be caught`
}

/** Diagnostic: a settings source could not be read while guards were computed. */
export function couldNotReadSettings(event: string, source: string, message: string): string {
  return `arrester: ${event}: could not read ${source} settings (${message}); hook files named there are not guarded`
}

/** Diagnostic: a script exists but could not be read. */
export function couldNotReadScript(event: string, path: string, message: string): string {
  return `arrester: ${event}: could not read the script ${path} (${message})`
}

/** Diagnostic: a path could not be placed on the file system. */
export function couldNotResolve(event: string, path: string, message: string): string {
  return `arrester: ${event}: could not resolve ${path} (${message}); compared as written`
}

/** Diagnostic: the `/arrester` hook failed. */
export function commandFailed(failure: string): string {
  return `arrester: command.run: /arrester failed (${failure})`
}

/** Diagnostic: `/arrester` could not be registered. */
export function couldNotRegister(message: string): string {
  return `arrester: session.start: could not register /arrester (${message})`
}

/** Diagnostic: the status line could not be refreshed. */
export function couldNotSync(event: string, message: string): string {
  return `arrester: ${event}: could not refresh the status line (${message})`
}

/** Diagnostic: the hold question got no answer. */
export function holdUnanswered(message: string): string {
  return `arrester: tool.call: the hold got no answer (${message}); the call was refused`
}

/** Diagnostic: an auto mode denial without a classifier verdict. */
export function noVerdict(reason: string): string {
  return `arrester: classic.PermissionDenied: no classifier verdict (${reason}); no block opened`
}

/** Diagnostic: HOME is not set, so `~` paths resolve to nothing. */
export function homeUnset(event: string): string {
  return `arrester: ${event}: HOME is not set; ~ paths do not resolve; shell deletions may be stopped as unreadable`
}

/** Diagnostic: a stop or a hold could not be saved in the journal; what Arrester did to the call stands. */
export function couldNotSave(tool: string, action: string, message: string): string {
  return `arrester: tool.call: could not save the ${action} record for ${tool} (${message}); /arrester and the status line may not show it`
}

/** Diagnostic: code in a script older than the open blocks could not be read, so it was not counted. */
export function notCounted(ignored: Ignored): string {
  return `arrester: tool.call: ${ignored.path} changed before the open blocks, so code in it that Arrester cannot read (${ignored.reason}) was not counted`
}

/** Diagnostic: a reload ended a hold before the user answered it. */
export function holdEnded(held: ArresterHeld): string {
  return `arrester: session.start: a reload ended the hold of ${who(held)} (held for ${held.blockIds.join(', ')}); Arrester did not decide that call`
}

/** Omits the name supplied by the host on transcript and command rows. */
export function hostText(text: string): string {
  return text.replace(/^arrester: /, '')
}

/** Diagnostic: capture retained only the effects that analysis could read. */
export function incompleteCapture(event: string, reason: string): string {
  return `arrester: ${event}: incomplete capture (${reason}); some targets may be missing`
}

/** A bounded capacity notice names the block whose protection ended. */
function evictionText(id: string): string {
  return `${id} evicted at the 50-block capacity; its protection is lost`
}

/** Ten clipped decisions per page, newest page first, covering all retained history. */
export function historyText(journal: ArresterJournal, page: number, now: number): string {
  const decisions = journal.decisions.slice(-50).reverse()
  const pages = Math.max(1, Math.ceil(decisions.length / 10))
  if (!Number.isInteger(page) || page < 1 || page > pages) return USAGE
  const rows = decisions.slice((page - 1) * 10, page * 10)
  return [
    `Decision history: page ${page}/${pages} (${decisions.length} retained)`,
    ...rows.map(decision => line(`${ago(now - decision.at)} ${decision.action} ${decision.blockIds.join(', ')} ${decision.call === undefined ? '' : who(decision.call)} ${decision.detail}`, 160)),
    'Use /arrester history <page>. Older evicted decisions are unavailable.',
  ].join('\n')
}

/** Diagnostic: a successful capture evicted a block before its normal expiry. */
export function evictionNotice(event: string, id: string): string {
  return `arrester: ${event}: ${evictionText(id)}`
}

/** Diagnostic: a successful capture could not retain complete fuzzy retry coverage. */
export function retryNotice(event: string, id: string, reason: string): string {
  return `arrester: ${event}: ${id}: ${reason}`
}
