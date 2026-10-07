import type { UltraApi } from './api'
import type { Args, EventName, EventResult, Frozen, Next, RenderInput, RenderNode, ThemeKey } from 'claude-code'
import type { UltraModSettings, UltraSet } from '../../types/index'

// Core registers events once; mods form an ordered middleware chain.
// when filters inputs, and disabled mods are skipped live.
// A gating handler that fails before next refuses the event.
// Other failures continue; failures after next reuse its result.
// band and pane contribute drawings; commands answer /ultra subcommands.
export type ModId = 'hud' | 'receipts' | 'guard' | 'secrets' | 'tests' | 'notify' | 'compact' | 'loops' | 'pins' | 'tidy'
export type ModEvent = Extract<EventName, 'session.start' | 'classic.SessionStart' | 'turn.start' | 'turn.complete' | 'session.end' | 'tool.call' | 'tool.check' | 'prompt.submit' | 'session.append' | 'prompt.compose' | 'classic.Notification' | 'command.run' | 'ui.render'>
export type ModNext<E extends ModEvent> = {
  (e: Frozen<Args<E>> | Args<E>): Promise<EventResult<E>>
  readonly called: boolean
  readonly event: E
  readonly signal: Next<E>['signal']
}
export type ModHandler<E extends ModEvent> = {
  when?: (e: Frozen<Args<E>>) => boolean
  gating?: boolean
  run: ($: UltraApi, e: Frozen<Args<E>>, next: ModNext<E>) => EventResult<E> | Promise<EventResult<E>>
}
export type BandPart = { node: RenderNode; columns: number }
export type BandContext = {
  $: UltraApi
  e: Frozen<RenderInput<'AbovePrompt'>>
  set: UltraSet
  settings: UltraModSettings
  columns: number
  contextColor: ThemeKey
}
export type PaneContext = {
  $: UltraApi
  e: Frozen<RenderInput<'Pane'>>
  set: UltraSet
  settings: UltraModSettings
}
export type SubcommandHandler = ($: UltraApi, args: string) => EventResult<'command.run'> | null | Promise<EventResult<'command.run'> | null>
export interface UltraMod {
  id: ModId
  hooks?: Partial<{ [E in ModEvent]: ModHandler<E>[] }>
  band?: (ctx: BandContext) => Promise<BandPart | null> | BandPart | null
  commands?: Record<string, SubcommandHandler>
  pane?: (ctx: PaneContext) => Promise<RenderNode | null> | RenderNode | null
}
