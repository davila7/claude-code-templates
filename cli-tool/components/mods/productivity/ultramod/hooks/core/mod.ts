import type { UltraApi } from './api'
import type { Args, EventResult, Frozen, PromptComposeSection, RenderInput, RenderNode, ThemeKey } from 'claude-code'
import type { UltraModSettings, UltraSet } from '../../types/index'

// Every engine hook lives in register.tsx. A mod is plain data and functions
// that the hooks there call in mod order; none of them sees the engine's `$`
// or `next`. A mod answers with a value (a refusal text, a line, a rewritten
// row) and register.tsx turns that value into the hook's return.
// band and pane contribute drawings; commands answer /ultra subcommands.
export type ModId = 'hud' | 'receipts' | 'guard' | 'secrets' | 'tests' | 'notify' | 'compact' | 'loops' | 'pins' | 'tidy'

export type ToolCall = Frozen<Args<'tool.call'>>
export type ToolResult = EventResult<'tool.call'>
export type AppendRow = Frozen<Args<'session.append'>>
export type RowContent = AppendRow['message']['content']

// A step that runs for the events its filter accepts.
export type Step<E, R> = {
  when?: (e: E) => boolean
  run: (api: UltraApi, e: E) => R | Promise<R>
}

// What a mod does with the result of a tool call it watched: the result,
// unchanged or with lines added for Claude.
export type AfterTool = (result: ToolResult) => ToolResult | Promise<ToolResult>

export type BandPart = { node: RenderNode; columns: number }
export type BandContext = {
  api: UltraApi
  e: Frozen<RenderInput<'AbovePrompt'>>
  set: UltraSet
  settings: UltraModSettings
  columns: number
  contextColor: ThemeKey
}
export type PaneContext = {
  api: UltraApi
  e: Frozen<RenderInput<'Pane'>>
  set: UltraSet
  settings: UltraModSettings
}
export type CommandAnswer = { text: string }
export type SubcommandHandler = (api: UltraApi, args: string) => CommandAnswer | null | Promise<CommandAnswer | null>

export interface UltraMod {
  id: ModId
  // tool.call before the call runs: the refusal text Claude reads, or null to
  // let the call through. A step that fails refuses the call.
  check?: Step<ToolCall, string | null>
  // tool.call around a call every check let through: what to do with its
  // result, or null to leave it alone. A step that fails is skipped.
  watch?: Step<ToolCall, AfterTool | null>
  sessionStart?: Step<Frozen<Args<'session.start'>>, void>
  // classic.SessionStart, for a cleared, resumed or forked conversation.
  sessionRestart?: Step<Frozen<Args<'classic.SessionStart'>>, void>
  turnStart?: Step<Frozen<Args<'turn.start'>>, void>
  // turn.complete: a line to show under the answer, or null.
  turnComplete?: Step<Frozen<Args<'turn.complete'>>, string | null | void>
  sessionEnd?: Step<Frozen<Args<'session.end'>>, void>
  // session.append: the row's content rewritten, or null to store it as is.
  append?: Step<AppendRow, RowContent | null>
  // prompt.compose: a section to add after the others, or null.
  compose?: Step<Frozen<Args<'prompt.compose'>>, PromptComposeSection | null>
  // classic.Notification: work done while Claude Code tells the person it waits.
  notification?: Step<Frozen<Args<'classic.Notification'>>, void>
  band?: (ctx: BandContext) => Promise<BandPart | null> | BandPart | null
  commands?: Record<string, SubcommandHandler>
  pane?: (ctx: PaneContext) => Promise<RenderNode | null> | RenderNode | null
}
