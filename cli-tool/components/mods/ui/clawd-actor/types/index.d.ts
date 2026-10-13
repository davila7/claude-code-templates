export type Frame = number

declare module 'claude-code' {
  interface PluginState {
    'clawd-actor': { frame: Frame }
  }
}
