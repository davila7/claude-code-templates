export type Frame = number
/** The turn's show, which a hot reload keeps: whether a turn runs, the frame it started on, the rotation's seed and acts played. */
export type Show = { isTurnRunning: boolean; turnBase: number; seed: number; played: number }

declare module 'claude-code' {
  interface PluginState {
    'clawd-actor': { frame: Frame; show: Show }
  }
}
