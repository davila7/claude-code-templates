import type { EngineInterface } from 'claude-code'

export type UltraEnvName = 'OS' | 'HOME' | 'USERPROFILE' | 'WSL_DISTRO_NAME' | 'TERM_PROGRAM'

// Mods see only methods implemented by the facade.
export type UltraApi = {
  ui: Pick<EngineInterface['ui'], 'ask' | 'toast' | 'status' | 'log' | 'invalidate' | 'open' | 'close' | 'resolve'>
  session: Pick<EngineInterface['session'], 'root' | 'cwd' | 'id' | 'usage' | 'model' | 'version' | 'compact'>
  process: Pick<EngineInterface['process'], 'run'>
  fs: Pick<EngineInterface['fs'], 'read' | 'write' | 'stat' | 'exists'>
  store: Pick<EngineInterface['store'], 'get' | 'set' | 'delete' | 'keys'>
  clock: Pick<EngineInterface['clock'], 'now' | 'every' | 'after'>
  audio: Pick<EngineInterface['audio'], 'play'>
  command: Pick<EngineInterface['command'], 'register'>
  env: { get: (name: UltraEnvName) => ReturnType<EngineInterface['env']['get']> }
  state: Pick<EngineInterface['state'], 'get' | 'set'>
}
