// The session state contract of the arrester mod: one journal under $.state.
// Self-contained: no imports.

/** What a blocked call would have done to a path. */
export type ArresterAccess = 'read' | 'write' | 'destroy'

/** The guard that blocked a call. */
export type ArresterSource = 'hook' | 'rule' | 'classifier' | 'user'

/** A path as written, and its real path when a symbolic link leads elsewhere. */
export type ArresterPlace = { path: string; real?: string }

/** Explicit shell glob matching options. */
export type ArresterGlobOptions = { dot?: true; nocase?: true }

/** A blocked path and access; a find selection limits names, file types, and depth; descend includes selected directories' contents. */
export type ArresterTarget = ArresterPlace & { glob?: string; globOptions?: ArresterGlobOptions; access: ArresterAccess; entry?: true; selection?: { parentOperand?: string; parentGlob?: true; names?: string[]; file?: true; minDepth?: number; maxDepth?: number; descend?: boolean } }

/** A guard path; with `changeOnly`, only a write or a deletion touches it. */
export type ArresterGuard = ArresterPlace & { changeOnly?: true }

/** One simple command of a blocked call: its retry skeleton and its complete bounded flags. */
export type ArresterSegment = { skeleton: string; flags: string[]; flagsComplete: boolean; preview?: true }

/** One tool call that a guard blocked. */
export type ArresterBlock = {
  /** `b1`, `b2`, … in the order blocks open. */
  id: string
  source: ArresterSource
  /** The tool as the model named it. */
  tool: string
  /** One line, at most 120 characters. */
  summary: string
  /** The guard's reason, at most 300 characters. */
  reason: string
  /** The settings rule, for source `rule`. */
  rule?: string
  /** The blocked call's id: one block per call. */
  toolUseId: string
  /** `$.session.turns()` when the block opened. */
  turn: number
  /** When the block opened, ms since the epoch. */
  at: number
  /** When a workaround of it was last caught; `at` at first. */
  lastHitAt: number
  /** The whole-command skeleton; empty when the call has none. */
  skeleton: string
  /** SHA-256 identity of complete syntax-preserving tool input and context, 71 ASCII bytes. */
  exact?: string
  /** Why fuzzy retry coverage is unavailable. */
  retryLimited?: string
  /** Whether the flags are complete; false when they passed the storage limits and were dropped. */
  flagsComplete: boolean
  /** The complete flags of the whole call, at most 256. */
  flags: string[]
  /** Each non-trivial segment, at most 16. */
  segments: ArresterSegment[]
  /** At most 256. */
  targets: ArresterTarget[]
  /** Why capture could not analyze the whole call. */
  incomplete?: string
  /** The subagent that made the blocked call. */
  agentId?: string
}

/** A tool call as the journal shows it: its tool, its summary, and the subagent that made it. */
export type ArresterCall = { tool: string; summary: string; agentId?: string }

/** A call waiting on the user in hold mode. */
export type ArresterHeld = ArresterCall & { toolUseId: string; blockIds: string[]; since: number }

/** What Arrester did. */
export type ArresterAction = 'stopped' | 'allowed-once' | 'refused' | 'unanswered' | 'cleared'

/** One entry of the decision log; `call` is absent for `cleared`. */
export type ArresterDecision = { at: number; action: ArresterAction; blockIds: string[]; call?: ArresterCall; detail: string }

/** Everything Arrester keeps for the session. */
export type ArresterJournal = {
  /** The number of the last block id given. */
  seq: number
  /** Open blocks, oldest first, at most 50. */
  blocks: ArresterBlock[]
  /** The latest capacity eviction; protection ended before normal expiry. */
  eviction?: { blockId: string; at: number; toolUseId: string }
  /** Calls waiting on the user. */
  held: ArresterHeld[]
  /** Newest last, at most 50. */
  decisions: ArresterDecision[]
  /** Guard paths, refreshed when a block opens. */
  guards: ArresterGuard[]
  /** The ids of the last 100 calls that opened a block, newest last: a call opens one block, also when it was cleared in between. */
  recorded: string[]
}

declare module 'claude-code' {
  interface PluginState {
    arrester: { journal: ArresterJournal }
  }
}
