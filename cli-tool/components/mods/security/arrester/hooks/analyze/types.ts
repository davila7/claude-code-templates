// Types the analysis modules share. Pure: no `$`.

import type { ArresterTarget } from '../../types/index'

/** What a tool call does to one path; `name` is a path that an MCP call names, whose access Arrester cannot know. */
export type EffectKind = 'list' | 'read' | 'write' | 'destroy' | 'name'

/** One path effect: its glob or find selection, access, reach below the path, and final-entry removal. */
export type Effect = { path: string; glob?: string; globOptions?: ArresterTarget['globOptions']; kind: EffectKind; recursive: boolean; entry?: true; selection?: ArresterTarget['selection'] }

/** One simple command's retry skeleton and its flags, sorted and each once. */
export type Segment = { skeleton: string; flags: string[]; preview?: true }

/** Code in an older script that Arrester could not read, and so did not count. */
export type Ignored = { path: string; reason: string }

/** What the analysis of one call or one piece of code found; `bypass` names a launch flag or a plugin command that can turn guards off, or a nested `claude` run. */
export type Analysis = { effects: Effect[]; segments: Segment[]; opaque?: string; ignored?: Ignored; bypass?: string }

/** Where a call runs: the session's current folder and the home folder. */
export type Context = { cwd: string; home: string | undefined }

/** How a script read went: no such file, its text, or the reason it cannot be read; `isOld` when the file last changed before the oldest open block opened. */
export type ScriptRead = 'missing' | { text: string; isOld: boolean } | { unreadable: string; isOld: boolean }

/** The only I/O the analysis does: reading a script that a call runs, and noticing an abandoned dispatch; `capture` when the analysis records a block, where an older interpreter script is not scanned. */
export type Io = { readScript: (path: string) => Promise<ScriptRead>; signal: AbortSignal; capture?: true }
