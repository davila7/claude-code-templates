// One message held back while Do Not Disturb is on.
export type Held = { from: string; at: number; text: string }
// until: when DND ends, epoch ms, or null while it is off; held: what waits for it.
export type Dnd = { until: number | null; held: Held[] }

declare module 'claude-code' {
  interface PluginState {
    // One value, so the end and the held list change together.
    dnd: { state: Dnd }
  }
}
