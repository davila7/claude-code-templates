export type SandboxTunerKind = 'host' | 'path'

export type SandboxTunerCounts = {
  blocked: number      // reports of a block (network, or file write)
  refused: number      // host reports with reason "user denied"; part of blocked
  listed: number       // runs that named the host in allowed_domains
  inferred: number     // inferred blocks of a folder
}

export type SandboxTunerRecord = {
  key: string          // `${kind}:${target}`
  kind: SandboxTunerKind
  target: string       // host (lowercase) or absolute folder
  counts: SandboxTunerCounts
  ports: number[]      // hosts: distinct ports, newest last, at most 5
  sample: string       // the last host:port or absolute path seen; a folder keeps a protected or key file
  seenWith: string[]   // program names, newest last, at most 3
  sessions: string[]   // session ids, newest last, at most 20
  firstSeen: number
  lastSeen: number
  isHidden: boolean
}

export type SandboxTunerAction = 'allow' | 'deny'

export type SandboxTunerSettingsKey =
  | 'sandbox.network.allowedDomains'
  | 'sandbox.network.deniedDomains'
  | 'sandbox.filesystem.allowWrite'

export type SandboxTunerApplied = {
  id: string           // unique identifier for one settings addition
  recordKey: string
  action: SandboxTunerAction
  settingsKey: SandboxTunerSettingsKey
  entry: string
  file: string         // absolute path of the user settings file
  backup: string | null // absolute path of the backup; null when the file was new
  created: string[]    // dotted key paths that the apply created, outermost first
  appliedAt: number
  undoneAt: number | null
  applyState?: 'pending'
  undoState?: 'pending' | 'retry' | 'superseded'
}

export type SandboxTunerLatest = {
  recordKey: string
  detail: string       // host:port, or the absolute path
  reason: 'unlisted' | 'refused' | 'other' | 'write' | 'inferred' | 'operation'
  reasonText: string   // the report's reason in parentheses; '' when none
  command: string      // one line, at most 120 characters
  at: number
}

export type SandboxTunerNotice = { text: string; isError: boolean; at: number }

declare module 'claude-code' {
  interface PluginState {
    'sandbox-tuner': {
      backgroundTasks: string[]
      evidenceIncomplete: boolean
      records: SandboxTunerRecord[]
      applied: SandboxTunerApplied[]
      appliedOffset: number
      latest: SandboxTunerLatest | null
      dismissed: string | null
      notice: SandboxTunerNotice | null
      fault: string | null
    }
  }
}
