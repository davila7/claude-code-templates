/** One thinking block, as it streamed in. */
export type Thought = { kind: 'thought'; id: string; at: number; text: string }

/** A place in a parent's timeline where a subagent was spawned. */
export type AgentRef = { kind: 'agent'; id: string }

export type Item = Thought | AgentRef

export type Agent = {
  id: string
  /** The agent type: Explore, Plan, general-purpose, a plugin's agent. */
  type: string
  /** The Agent call's short description of the task. */
  description: string
  /** The agent that spawned it; null when main did. */
  parent: string | null
  startedAt: number
  /** null while it runs. */
  endedAt: number | null
  items: Item[]
}

/** One main-session turn: its own thoughts and the agents it spawned. */
export type Turn = {
  id: string
  prompt: string
  startedAt: number
  endedAt: number | null
  items: Item[]
}

export type Tree = { turns: Turn[]; agents: Record<string, Agent> }

declare module 'claude-code' {
  interface PluginState {
    'thinking-pane': {
      tree: Shaped<Tree>
      /** Cards the person opened or closed by hand, by agent id. */
      toggled: Record<string, boolean>
      /** Bumped each second while an agent runs, so its timer redraws. */
      tick: number
      /** The agent page shown: ids from main down to that agent; empty is main. */
      page: string[]
    }
  }
}
