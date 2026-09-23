// What `sudus wake` printed, read into one record, and what the status line and the face say
// about it. Pure functions: no engine, no I/O, so tests/verdict.test.ts runs them alone.

import type { Expression } from './faces.ts'

export type Verdict =
  | {
      kind: 'verdict'
      verdict: 'Resolvable' | 'Waiting' | 'Done'
      action: string | null
      target: string | null
      party: string | null
      question: string | null
      reason: string
      predicate: string
      layout: string | null
      exit: number
    }
  | { kind: 'line'; line: string; exit: number }
  | { kind: 'missing'; detail: string }

// Wake prints `key: value` lines: verdict; `action: <word> <target>` for Resolvable,
// `commitment: <slug>` for Done, `party:` and the escalation's `question:` for Waiting; reason,
// predicate, and a `layout:` line on a project still on the former layout. An exit of 3 is one
// line naming a repair or a skill; 4 is Waiting with no developer to answer.
export function parseWake(stdout: string, exitCode: number): Verdict {
  const lines = stdout.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0)
  const fields = new Map<string, string>()
  for (const line of lines) {
    const m = /^([a-z]+): (.*)$/.exec(line)
    if (m) fields.set(m[1]!, m[2]!)
  }
  const verdict = fields.get('verdict')
  if (verdict === 'Resolvable' || verdict === 'Waiting' || verdict === 'Done') {
    const act = fields.get('action') ?? null
    const sp = act === null ? -1 : act.indexOf(' ')
    return {
      kind: 'verdict',
      verdict,
      action: act === null ? null : sp < 0 ? act : act.slice(0, sp),
      target: fields.get('commitment') ?? (act === null || sp < 0 ? null : act.slice(sp + 1)),
      party: fields.get('party') ?? null,
      question: fields.get('question') ?? null,
      reason: fields.get('reason') ?? '',
      predicate: fields.get('predicate') ?? '',
      layout: fields.get('layout') ?? null,
      exit: exitCode,
    }
  }
  const line = lines.find(l => l.startsWith('sudus:')) ?? lines[0]
  if (line !== undefined) return { kind: 'line', line, exit: exitCode }
  return { kind: 'missing', detail: `sudus wake printed nothing (exit ${exitCode})` }
}

// The face for a verdict: thinking while a turn runs; idle with work to do; sad while the
// developer owes an answer; mad when no one can answer; sick on a repair or outside a project;
// happy at Done.
export function expressionOf(v: Verdict, isTurnRunning: boolean): Expression {
  if (isTurnRunning) return 'thinking'
  if (v.kind === 'missing') return 'sick'
  if (v.kind === 'line') return 'sick'
  if (v.verdict === 'Done') return 'happy'
  if (v.verdict === 'Waiting') return v.exit === 4 ? 'mad' : 'sad'
  return 'idle'
}

// A tiny ASCII face for the status line, keyed to the same expression as the picture.
export const ASCII_FACE: Record<Expression, string> = {
  idle: '(o_o)',
  happy: '(^_^)',
  sad: '(;_;)',
  mad: '(>_<)',
  sick: '(x_x)',
  thinking: '(o_o)?',
}

const STATUS_MAX = 120

// One line under the prompt. ASCII only; the reason is cut to fit.
export function statusTextOf(v: Verdict, isTurnRunning: boolean, withFace: boolean): string {
  const face = withFace ? `${ASCII_FACE[expressionOf(v, isTurnRunning)]} ` : ''
  let text: string
  if (v.kind === 'missing') text = `Sudus | ${v.detail}`
  else if (v.kind === 'line') text = `Sudus | ${v.line}`
  else if (v.verdict === 'Done') text = v.target ? `Sudus | Done | ${v.target}` : 'Sudus | Done'
  else if (v.verdict === 'Waiting') text = `Sudus | Waiting for the ${v.party ?? 'developer'} | ${v.question ?? v.reason}`
  else text = `Sudus | Resolvable | ${v.action ?? ''} ${v.target ?? ''} | ${v.reason}`.replace(/\s+\|/g, ' |')
  const full = face + text
  return full.length <= STATUS_MAX ? full : full.slice(0, STATUS_MAX - 3) + '...'
}

// Whether a Bash command can change the verdict: any sudus or cairn invocation, or a git commit.
export function changesVerdict(command: string): boolean {
  return /(^|[\s;&|(])(sudus|cairn)(\s|$)/.test(command) || /\bgit\s+(commit|checkout|switch|reset|revert|merge|rebase|pull|stash)\b/.test(command)
}
