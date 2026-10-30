import type { AskOptions, EngineInterface } from 'claude-code'

export type UltraEnvName = 'OS' | 'HOME' | 'USERPROFILE' | 'WSL_DISTRO_NAME'

// Mods see only methods implemented by the facade.
export type UltraApi = {
  plugin: Pick<EngineInterface['plugin'], 'root'>
  ui: Pick<EngineInterface['ui'], 'open' | 'resolve'> & { ask: (question: string, options?: AskOptions) => Promise<string>; toast: (text: string) => void; log: (text: string) => void }
  session: Pick<EngineInterface['session'], 'root' | 'cwd' | 'model' | 'version' | 'compact'> & { usage: () => ReturnType<EngineInterface['session']['usage']> }
  process: Pick<EngineInterface['process'], 'run'>
  // The one file Ultra Mod writes is <project root>/.claude/pins.md.
  fs: { stat: (path: string) => ReturnType<EngineInterface['fs']['stat']>; exists: (path: string) => Promise<boolean>; read: (path: string) => Promise<string>; writePins: (root: string, text: string) => Promise<void> }
  store: Pick<EngineInterface['store'], 'get' | 'set'>
  clock: Pick<EngineInterface['clock'], 'now' | 'every' | 'after'>
  audio: { play: (clip: Parameters<EngineInterface['audio']['play']>[0]) => Promise<void> }
  command: Pick<EngineInterface['command'], 'register'>
  env: { get: (name: UltraEnvName) => ReturnType<EngineInterface['env']['get']> }
  state: Pick<EngineInterface['state'], 'get' | 'set'>
}
