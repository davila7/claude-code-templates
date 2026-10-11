// Reads one Bash call into sightings.

import type { SandboxTunerKind, SandboxTunerLatest } from '../types'
import { absolutePath, folderTarget, isGuardedPath, plainText, programName, splitHost } from './names'
import { recordKey } from './records'

type Counter = 'blocked' | 'listed' | 'inferred'
type BlockReason = SandboxTunerLatest['reason']
export type Sighting = {
  kind: SandboxTunerKind
  target: string
  counter: Counter
  reason: BlockReason | null
  reasonText: string
  ports: readonly number[]
  detail: string
  program: string
}
type Gate = 'sandbox-on' | 'sandbox-required'
export type GatedSighting = { gate: Gate; sighting: Sighting }
type CallSightings = { reports: Sighting[]; gated: GatedSighting[]; unknownLine: string | null; observation?: { operation: string; detail: string } }
export type SandboxFacts = { isEnabled: boolean; allowsUnsandboxed: boolean }
export type BashCall = { command: string; isBackground: boolean; isUnsandboxed: boolean; allowedDomains: readonly string[] }
export type BashOutcome = { backgroundTaskId?: string; isDenied: boolean; isError: boolean; isReadOnly?: boolean; isUnsandboxed?: boolean; text: string; stderr: string }

const SCAN_LIMIT = 200_000
// No host, path, or reason that the sandbox reports is longer than the longest path a file system takes, or holds a
// character that the engine refuses to draw. Such a one is noise, such as output that imitates a report.
const SIGHTING_TEXT_LIMIT = 4096
const PATH_LIMIT = 3
const UNKNOWN_LIMIT = 80
const OPEN_TAG = '<sandbox_violations>'
const CLOSE_TAG = '</sandbox_violations>'
const NETWORK = /^deny network-outbound (\S+) \((.*)\)$/
const MAC_LINE = /^\S+\(\d+\) deny\(\d+\) \S/
const MAC_FILE = /^\S+\(\d+\) deny\(\d+\) file-/
const MAC_WRITE = /^\S+\(\d+\) deny\(\d+\) file-write-[a-z-]+\s+(\/.*)$/
const LINUX_WRITE = /^deny [a-z0-9_]+ (\/.*)$/
const EXIT_CODE = /^Exit code \d+/
const PERMISSION_ERROR = /operation not permitted|read-only file system/i
const SOCKET_WORDS = /\b(?:listen|connect|socket)\b/i
const PATH_START = /(?:^|[\s'"‘`(])\/(?!\/)/g
const PATH_CANDIDATE = /(?:^|[\s'"‘`(])(\/(?!\/)[^\s'"’`:,)]+)(?=[:'"’`,)]|$)/g
const DEVICE_PATH = /^\/(?:dev|proc|sys)\//

function fits(sighting: Sighting): boolean {
  const text = `${sighting.detail}${sighting.reasonText}`
  return text.length <= SIGHTING_TEXT_LIMIT && plainText(text) === text
}

function distinct<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter(item => {
    const key = keyOf(item)
    const isNew = !seen.has(key)
    seen.add(key)
    return isNew
  })
}

/** A line that must speak for its target: a refusal keeps Deny, and a protected or key file keeps Allow away. */
function isWeighty(sighting: Sighting): boolean {
  return sighting.reason === 'refused' || (sighting.kind === 'path' && isGuardedPath(sighting.detail))
}

/**
 * One sighting per target and counter, however many lines of the call name the target. It keeps the ports of
 * every line, and it leads with the first weighty line, so the order of the lines does not change the verdict.
 */
function combine(sightings: readonly Sighting[]): Sighting[] {
  const byKey = new Map<string, Sighting>()
  for (const sighting of sightings) {
    const key = `${recordKey(sighting)}:${sighting.counter}`
    const held = byKey.get(key)
    const lead = held === undefined || (!isWeighty(held) && isWeighty(sighting)) ? sighting : held
    byKey.set(key, { ...lead, ports: distinct([...(held?.ports ?? []), ...sighting.ports], String) })
  }
  return [...byKey.values()]
}

function capPaths(sightings: readonly Sighting[]): Sighting[] {
  const unique = combine(sightings)
  const paths = unique.filter(sighting => sighting.kind === 'path').slice(0, PATH_LIMIT)
  return unique.filter(sighting => sighting.kind !== 'path' || paths.includes(sighting))
}

function hostDetail(host: string, port: number | null): string {
  return port === null ? host : `${host}:${port}`
}

function hostSighting(text: string, counter: 'blocked' | 'listed', reason: BlockReason | null, reasonText: string, program: string): Sighting {
  const { host, port } = splitHost(text)
  return { kind: 'host', target: host, counter, reason, reasonText, ports: port === null ? [] : [port], detail: hostDetail(host, port), program }
}

function pathSighting(path: string, counter: 'blocked' | 'inferred', home: string | undefined, program: string): Sighting {
  const reason: BlockReason = counter === 'blocked' ? 'write' : 'inferred'
  return { kind: 'path', target: folderTarget(path, home), counter, reason, reasonText: '', ports: [], detail: path, program }
}

function reportLines(sources: readonly string[]): string[] {
  const lines = sources.flatMap(source => source.split(OPEN_TAG).slice(1).flatMap(part => part.split(CLOSE_TAG, 1).join('').split('\n')))
  return distinct(lines.map(line => line.trim()).filter(line => line !== ''), line => line)
}

function reportSighting(line: string, home: string | undefined, program: string): Sighting | null {
  const network = NETWORK.exec(line)
  if (network !== null) {
    const [, reported = '', reasonText = ''] = network
    const reason: BlockReason = /user denied/i.test(reasonText) ? 'refused' : reasonText.includes('allowed_domains') ? 'unlisted' : 'other'
    return hostSighting(reported, 'blocked', reason, reasonText, program)
  }
  const [, path] = MAC_WRITE.exec(line) ?? LINUX_WRITE.exec(line) ?? []
  return path === undefined ? null : pathSighting(path, 'blocked', home, program)
}

/** A report line about a file of any operation: the report then speaks for the call's file blocks. */
function isFileLine(line: string): boolean {
  return MAC_FILE.test(line) || LINUX_WRITE.test(line)
}

/** A report line of a form Sandbox Tuner knows: one it counts, or one it knows and ignores (a read, a lookup, a socket). */
function isKnownLine(line: string): boolean {
  return NETWORK.test(line) || MAC_LINE.test(line) || LINUX_WRITE.test(line)
}

/**
 * The path of a permission error: the last path on the line. When a later path does not parse (it holds a space),
 * that one may be the path that was blocked, so the line names none rather than an earlier path in its place.
 */
function inferredPath(line: string, cwd: string | undefined): string | null {
  if (!PERMISSION_ERROR.test(line) || SOCKET_WORDS.test(line)) return null
  const last = Array.from(line.matchAll(PATH_CANDIDATE)).at(-1)
  if (last === undefined && cwd !== undefined) {
    const relative = /(?:^|: )['"]?((?:\.\.?\/)?[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)+)['"]?: (?:Operation not permitted|Read-only file system)$/i.exec(line)?.[1]
    return relative === undefined ? null : absolutePath(relative, cwd)
  }
  if (last === undefined || last.index !== Array.from(line.matchAll(PATH_START)).at(-1)?.index) return null
  const [, candidate = ''] = last
  const path = candidate.replace(/\.$/, '')
  return DEVICE_PATH.test(path) ? null : path
}

/** The host and write-folder sightings of one Bash call. */
export function readCall(call: BashCall, outcome: BashOutcome, home: string | undefined, cwd?: string): CallSightings {
  if (outcome.isDenied || (call.isBackground && !outcome.backgroundTaskId)) return { reports: [], gated: [], unknownLine: null }
  const ran = !outcome.isError || EXIT_CODE.test(outcome.text)
  const sources = [outcome.text, outcome.stderr].map(source => source.slice(-SCAN_LIMIT))
  const program = programName(call.command)
  const lines = reportLines(sources)
  const reports = capPaths(lines.flatMap(line => reportSighting(line, home, program) ?? []))
  const listed = ran
    ? combine(call.allowedDomains.filter(entry => !entry.includes('*')).map(entry => hostSighting(entry.trim(), 'listed', null, '', program)))
    : []
  if (outcome.backgroundTaskId !== undefined) {
    return { reports: [], gated: outcome.isError ? [] : listed.filter(fits).map(sighting => ({ gate: 'sandbox-on', sighting })), unknownLine: null }
  }
  const isUnsandboxed = outcome.isUnsandboxed ?? call.isUnsandboxed
  // Without a reported override, strict sandbox mode can have ignored the requested override.
  const canInfer = ran && !outcome.isReadOnly && outcome.isUnsandboxed !== true && !lines.some(isFileLine)
  const inferred = canInfer
    ? capPaths(sources.flatMap(source => source.split('\n')).flatMap(line => {
        const path = inferredPath(line, cwd)
        return path === null ? [] : [pathSighting(path, 'inferred', home, program)]
      }))
    : []
  return {
    reports: reports.filter(fits),
    gated: [
      ...listed.map((sighting): GatedSighting => ({ gate: 'sandbox-on', sighting })),
      ...inferred.map((sighting): GatedSighting => ({ gate: isUnsandboxed ? 'sandbox-required' : 'sandbox-on', sighting })),
    ].filter(({ sighting }) => fits(sighting)),
    observation: lines.flatMap(line => {
      if (reportSighting(line, home, program) !== null) return []
      const operation = /^\S+\(\d+\) deny\(\d+\) (\S+)/.exec(line)?.[1] ?? 'unknown'
      return [{ operation, detail: plainText(line.slice(0, UNKNOWN_LIMIT)) }]
    }).at(-1),
    unknownLine: lines.find(line => !isKnownLine(line))?.slice(0, UNKNOWN_LIMIT) ?? null,
  }
}

export function keepGated(gated: readonly GatedSighting[], facts: SandboxFacts): Sighting[] {
  return gated
    .filter(({ gate }) => facts.isEnabled && (gate === 'sandbox-on' || !facts.allowsUnsandboxed))
    .map(({ sighting }) => sighting)
}

export function latestOf(sightings: readonly Sighting[], command: string, now: number): SandboxTunerLatest | null {
  const block = [...sightings].reverse().find((sighting): sighting is Sighting & { reason: BlockReason } => sighting.reason !== null)
  return block === undefined
    ? null
    : { recordKey: recordKey(block), detail: block.detail, reason: block.reason, reasonText: block.reasonText, command, at: now }
}
