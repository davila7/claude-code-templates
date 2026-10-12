// One tool call as Arrester reads it: the call taken from the
// input of any event that carries one, its effects on paths, and its retry
// skeleton and flags. Pure apart from `io.readScript`, which the shell
// analysis uses.

import { absolute, expandHome, foldPath, MAX_PATH, PATH_TOO_LONG } from './paths'
import { analyzeShell, MAX_EFFECTS, OPAQUE } from './shell'
import type { Analysis, Context, Effect, EffectKind, Io } from './types'

/** A tool call: the tool as the model named it, its arguments, the call's id, and the subagent that made it. */
export type Call = { tool: string; input: Readonly<Record<string, unknown>>; toolUseId: string | undefined; agentId: string | undefined }

/** What a call does, with its whole skeleton and its flags for the retry rule. */
export type CallAnalysis = Analysis & { skeleton: string; flags: string[]; exact?: string }

const MAX_SKELETON = 1_000
const INPUT_LIMIT = 'tool input exceeds the serialization depth or work limit'
const RESERVED = new Set(['tool', 'tool_use_id', 'agentId', 'consent', 'requestMeta'])
const NOISE = new Set(['description', 'timeout', 'timeout_ms', 'run_in_background', 'dangerouslyDisableSandbox', 'allowed_domains'])
const SANDBOX_OFF = 'dangerouslyDisableSandbox'
const FILE_TOOLS = new Map<string, { field: string; kind: EffectKind; recursive: boolean }>([
  ['Read', { field: 'file_path', kind: 'read', recursive: false }],
  ['Write', { field: 'file_path', kind: 'write', recursive: false }],
  ['Edit', { field: 'file_path', kind: 'write', recursive: false }],
  ['NotebookEdit', { field: 'notebook_path', kind: 'write', recursive: false }],
  ['LSP', { field: 'filePath', kind: 'read', recursive: false }],
  ['SendFile', { field: 'files', kind: 'read', recursive: false }],
  ['SendUserFile', { field: 'files', kind: 'read', recursive: false }],
  ['Grep', { field: 'path', kind: 'read', recursive: true }],
  ['Glob', { field: 'path', kind: 'list', recursive: true }],
])

/** The start of a local `file:` URI, before its path: `file:/`, `file:///`, or `file://localhost/`, in any case. */
const FILE_URI = /^file:(?:\/\/(?:localhost)?(?=\/)|(?=\/(?!\/)))/i

/** True for a plain object, the shape tool arguments and settings values arrive in. */
export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The call in a `tool.call` or `classic.PreToolUse` input, whose arguments sit beside `tool`, `tool_use_id`, `agentId`, `consent`, and `requestMeta`. */
export function envelopeCall(e: Readonly<Record<string, unknown>>): Call {
  const input: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(e)) if (!RESERVED.has(key)) input[key] = value
  return { tool: String(e.tool), input, toolUseId: typeof e.tool_use_id === 'string' ? e.tool_use_id : undefined, agentId: typeof e.agentId === 'string' ? e.agentId : undefined }
}

/** The call in a `tool.check` or `classic.PermissionDenied` input, whose arguments arrive as one value of unknown shape. */
export function inputCall(tool: string, input: unknown, toolUseId: string | undefined, agentId?: string): Call {
  return { tool, input: isRecord(input) ? input : {}, toolUseId, agentId }
}

/** The effects, segments, opaque reason, whole skeleton, and flags of a call; a Bash call that leaves the sandbox carries the flag `dangerouslyDisableSandbox`. */
export async function analyzeCall(call: Call, ctx: Context, io: Io): Promise<CallAnalysis> {
  const identity = exactIdentity(call, ctx)
  const command = call.tool === 'Bash' || call.tool === 'Monitor' ? call.input.command : undefined
  if (typeof command !== 'string') {
    const effects = toolEffects(call, ctx)
    const skeleton = toolSkeleton(call)
    return { ...identity, ...effects, opaque: effects.opaque ?? identity.opaque ?? (skeleton === undefined ? INPUT_LIMIT : undefined), segments: [], skeleton: skeleton === undefined ? '' : fingerprint(skeleton), flags: [] }
  }
  const shell = await analyzeShell(command, ctx, io)
  const off = call.input.dangerouslyDisableSandbox === true ? [SANDBOX_OFF] : []
  const segments = shell.segments.map(segment => ({ ...segment, skeleton: fingerprint(segment.skeleton), flags: [...segment.flags, ...off].sort() }))
  const flags = [...new Set(segments.flatMap(segment => segment.flags))].sort()
  return { ...identity, ...shell, opaque: shell.opaque ?? identity.opaque, segments, skeleton: fingerprint(segments.map(segment => segment.skeleton).sort().join(' ; ')), flags }
}

/** The effects of a file tool on the paths its input names, opaque past the distinct-effect, input-work, or supported path-length limits; a Grep or Glob call without a path searches the current folder. An MCP tool names the paths in its input, and a ReadMcpResourceTool call reads the file of a local `file:` URI. */
function toolEffects(call: Call, ctx: Context): Pick<Analysis, 'effects' | 'opaque'> {
  if (call.tool.startsWith('mcp__')) return namedPaths(call.input, ctx.home)
  if (call.tool === 'ReadMcpResourceTool') {
    const path = typeof call.input.uri === 'string' && FILE_URI.test(call.input.uri.trim()) ? namedPath(call.input.uri, ctx.home) : undefined
    return { effects: path === undefined ? [] : [{ path, kind: 'read', recursive: false }] }
  }
  const touch = FILE_TOOLS.get(call.tool)
  if (touch === undefined) return { effects: [] }
  const given = call.input[touch.field]
  const value = touch.recursive && (given === undefined || given === '') ? '.' : given
  if (Array.isArray(value) && value.length > 16_384) return { effects: [], opaque: OPAQUE.tooMany }
  const names = Array.isArray(value) ? value.filter((name): name is string => typeof name === 'string') : typeof value === 'string' ? [value] : []
  const effects: Effect[] = []
  const seen = new Set<string>()
  let work = 0
  for (const name of names) {
    work += name.length
    if (work > 4_000_000) return { effects, opaque: OPAQUE.tooMany }
    const expanded = expandHome(name, ctx.home)
    const path = expanded === undefined ? undefined : absolute(expanded, ctx.cwd)
    if (path !== undefined && path.length > MAX_PATH) return { effects, opaque: PATH_TOO_LONG }
    if (path !== undefined && !seen.has(path)) {
      if (effects.length >= MAX_EFFECTS) return { effects, opaque: OPAQUE.tooMany }
      seen.add(path)
      effects.push({ path, kind: touch.kind, recursive: touch.recursive })
    }
  }
  return { effects }
}

/** The `name` effects of an MCP tool's input: each string, value or key, that `namedPath` reads as a path, each once, in the order of the input; opaque past the serialization budgets of `sortedJson` or past MAX_EFFECTS paths. */
function namedPaths(input: unknown, home: string | undefined): Pick<Analysis, 'effects' | 'opaque'> {
  const effects: Effect[] = []
  const seen = new Set<string>()
  const pending: { value: unknown; depth: number }[] = [{ value: input, depth: 0 }]
  let nodes = 0
  let remaining = 4_000_000
  const name = (text: string): string | undefined => {
    remaining -= text.length
    if (remaining < 0) return INPUT_LIMIT
    const path = namedPath(text, home)
    if (path === undefined || seen.has(path)) return undefined
    if (effects.length >= MAX_EFFECTS) return OPAQUE.tooMany
    seen.add(path)
    effects.push({ path, kind: 'name', recursive: false })
    return undefined
  }
  while (pending.length > 0) {
    const { value, depth } = pending.pop()!
    if (++nodes > 16_384 || depth > 64) return { effects, opaque: INPUT_LIMIT }
    const children: unknown[] = []
    if (typeof value === 'string') {
      const opaque = name(value)
      if (opaque !== undefined) return { effects, opaque }
    } else if (Array.isArray(value)) {
      if (value.length + nodes + pending.length > 16_384) return { effects, opaque: INPUT_LIMIT }
      children.push(...value)
    } else if (isRecord(value)) {
      for (const key in value) if (Object.prototype.hasOwnProperty.call(value, key)) {
        if (children.length + nodes + pending.length >= 16_384) return { effects, opaque: INPUT_LIMIT }
        const opaque = name(key)
        if (opaque !== undefined) return { effects, opaque }
        children.push(value[key])
      }
    }
    for (let i = children.length - 1; i >= 0; i -= 1) pending.push({ value: children[i], depth: depth + 1 })
  }
  return { effects }
}

/** The path that a string names, trimmed: an absolute path, a `~/` path, or a local `file:` URI with its `%` escapes decoded, folded; undefined for anything else, for text over more than one line, and for a path longer than MAX_PATH. */
function namedPath(text: string, home: string | undefined): string | undefined {
  const word = text.trim()
  if (/[\r\n]/.test(word)) return undefined
  const uri = FILE_URI.exec(word)
  const path = uri !== null ? unescaped(word.slice(uri[0].length)) : word.startsWith('/') ? word : word.startsWith('~/') ? expandHome(word, home) : undefined
  if (path === undefined || !path.startsWith('/')) return undefined
  const folded = foldPath(path)
  return folded.length > MAX_PATH ? undefined : folded
}

/** Text with each run of `%` escapes decoded as UTF-8; a run that does not decode stays as written. */
function unescaped(text: string): string {
  return text.replace(/(?:%[0-9A-Fa-f]{2})+/g, run => {
    try {
      return decodeURIComponent(run)
    } catch {
      return run
    }
  })
}

/** `tool:<name>:` and the input as JSON with sorted keys, less the fields that do not change what the call does. */
function toolSkeleton(call: Call): string | undefined {
  const kept = keptInput(call, key => !NOISE.has(key) && !(call.tool === 'WebFetch' && key === 'prompt'))
  const text = kept === undefined ? undefined : sortedJson(kept)
  return text === undefined ? undefined : `tool:${call.tool}:${text}`
}

/** Filters top-level input fields with bounded key enumeration before serialization. */
function keptInput(call: Call, keep: (key: string) => boolean): Record<string, unknown> | undefined {
  const entries: [string, unknown][] = []
  let count = 0
  let size = 0
  for (const key in call.input) if (Object.prototype.hasOwnProperty.call(call.input, key)) {
    size += key.length
    if (++count > 16_384 || size > 4_000_000) return undefined
    if (keep(key)) entries.push([key, call.input[key]])
  }
  return Object.fromEntries(entries)
}

/** Serializes sorted JSON iteratively, returning no identity when depth, entries, or text exceed the budget. */
export function sortedJson(value: unknown): string | undefined {
  type Task = { value: unknown; depth: number } | { text: string }
  const pending: Task[] = [{ value, depth: 0 }]
  const output: string[] = []
  let nodes = 0
  let remaining = 4_000_000
  while (pending.length > 0) {
    const task = pending.pop()!
    if ('text' in task) {
      remaining -= task.text.length
      if (remaining < 0) return undefined
      output.push(task.text)
      continue
    }
    if (++nodes > 16_384 || task.depth > 64) return undefined
    const item = task.value
    if (Array.isArray(item)) {
      if (item.length + nodes + pending.length > 16_384) return undefined
      output.push('[')
      remaining -= 1
      pending.push({ text: ']' })
      for (let i = item.length - 1; i >= 0; i -= 1) {
        pending.push({ value: item[i], depth: task.depth + 1 })
        if (i > 0) pending.push({ text: ',' })
      }
    } else if (isRecord(item)) {
      const keys: string[] = []
      for (const key in item) if (Object.prototype.hasOwnProperty.call(item, key)) {
        if (keys.length + nodes + pending.length >= 16_384 || key.length > remaining) return undefined
        remaining -= key.length
        keys.push(key)
      }
      keys.sort()
      output.push('{')
      remaining -= 1
      pending.push({ text: '}' })
      for (let i = keys.length - 1; i >= 0; i -= 1) {
        const key = keys[i]!
        pending.push({ value: item[key], depth: task.depth + 1 }, { text: `${JSON.stringify(key)}:` })
        if (i > 0) pending.push({ text: ',' })
      }
    } else {
      if (typeof item === 'string' && item.length > remaining) return undefined
      if (typeof item === 'bigint') return undefined
      pending.push({ text: JSON.stringify(item) ?? 'null' })
    }
  }
  return output.join('')
}

/** A skeleton as Arrester keeps it: whole up to 1,000 characters, else its first 200, its length, and a 32-bit FNV-1a hash of all of it. */
function fingerprint(skeleton: string): string {
  if (skeleton.length <= MAX_SKELETON) return skeleton
  let hash = 0x811c9dc5
  for (let i = 0; i < skeleton.length; i += 1) hash = Math.imul(hash ^ skeleton.charCodeAt(i), 0x01000193) >>> 0
  return `${skeleton.slice(0, 200)}…#${skeleton.length}:${hash.toString(16)}`
}

/** Hashes complete syntax-preserving input and context into a bounded exact-retry identity. */
function exactIdentity(call: Call, ctx: Context): { exact?: string; opaque?: string } {
  const shell = call.tool === 'Bash' || call.tool === 'Monitor'
  const kept = keptInput(call, key => key !== 'requestMeta' && !(shell && ['description', 'timeout', 'timeout_ms'].includes(key)))
  const text = kept === undefined ? undefined : sortedJson({ tool: call.tool, cwd: ctx.cwd, home: ctx.home, input: kept })
  return text === undefined ? { opaque: INPUT_LIMIT } : { exact: `sha256:${digest(text)}` }
}

/** The SHA-256 round constants. */
const ROUNDS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

/** Rotates one 32-bit word right. */
function rotate(word: number, bits: number): number {
  return word >>> bits | word << (32 - bits)
}

/** SHA-256 over every UTF-8 byte, using one fixed-size compression buffer. */
function digest(text: string): string {
  const state = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const words = new Int32Array(64)
  let offset = 0
  let bytes = 0
  const put = (byte: number): void => {
    words[offset >>> 2] = words[offset >>> 2]! | byte << (24 - (offset % 4) * 8)
    offset += 1
    bytes += 1
    if (offset !== 64) return
    for (let i = 16; i < 64; i += 1) {
      const a = words[i - 15]!
      const b = words[i - 2]!
      words[i] = words[i - 16]! + (rotate(a, 7) ^ rotate(a, 18) ^ a >>> 3) + words[i - 7]! + (rotate(b, 17) ^ rotate(b, 19) ^ b >>> 10)
    }
    let [a, b, c, d, e, f, g, h] = state as [number, number, number, number, number, number, number, number]
    for (let i = 0; i < 64; i += 1) {
      const first = h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + ROUNDS[i]! + words[i]!
      const second = (rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))
      h = g
      g = f
      f = e
      e = d + first | 0
      d = c
      c = b
      b = a
      a = first + second | 0
    }
    const next = [a, b, c, d, e, f, g, h]
    for (let i = 0; i < 8; i += 1) state[i] = state[i]! + next[i]! | 0
    words.fill(0, 0, 16)
    offset = 0
  }
  for (const ch of text) {
    const point = ch.codePointAt(0)!
    if (point < 128) put(point)
    else if (point < 2048) {
      put(0xc0 | point >>> 6)
      put(0x80 | point & 63)
    } else if (point < 65536) {
      put(0xe0 | point >>> 12)
      put(0x80 | point >>> 6 & 63)
      put(0x80 | point & 63)
    } else {
      put(0xf0 | point >>> 18)
      put(0x80 | point >>> 12 & 63)
      put(0x80 | point >>> 6 & 63)
      put(0x80 | point & 63)
    }
  }
  const length = bytes
  put(128)
  while (offset !== 56) put(0)
  for (const half of [Math.floor(length / 0x20000000), length * 8 >>> 0]) for (const shift of [24, 16, 8, 0]) put(half >>> shift & 255)
  return state.map(word => (word >>> 0).toString(16).padStart(8, '0')).join('')
}
