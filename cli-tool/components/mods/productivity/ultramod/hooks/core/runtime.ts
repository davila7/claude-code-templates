import type { UltraApi } from './api'
import type { Args, Frozen, PluginOptions, PromptComposeSection, RenderInput, RenderNode } from 'claude-code'
import type { AfterTool, AppendRow, CommandAnswer, RowContent, Step, ToolCall, ToolResult, UltraMod } from './mod'
import { runCommand } from './commands'
import { renderPane } from './pane'
import { createSets } from './sets'
import type { SetsEngine } from './sets'
import { bandRows } from '../mods/hud'
import type { HudMod } from '../mods/hud'
import { createMods } from '../mods/index'

// What the hooks in register.tsx call. Each function takes the facade, runs
// the enabled mods in order and hands back a plain value; none of them sees
// the engine's `$` or `next`, so every answer a hook gives is written in
// register.tsx itself.
//
// Failure rules: a check that fails refuses the tool call (fail closed);
// any other step that fails is skipped and the rest go on (fail open).

export type Runtime = {
  sets: SetsEngine
  mods: readonly UltraMod[]
  hud: HudMod
}

export function createRuntime(options: PluginOptions = {}): Runtime {
  const sets = createSets(options)
  const { mods, hud } = createMods(sets)
  return { sets, mods, hud }
}

export const REFUSED = 'Ultra Mod could not complete its safety check. Retry after checking /ultra doctor.'

// The steps of one kind whose mod is on and whose filter takes the event.
async function steps<E>(api: UltraApi, runtime: Runtime, kind: 'watch' | 'turnComplete' | 'append' | 'compose', e: E): Promise<{ mod: UltraMod; step: Step<E, unknown> }[]> {
  const out: { mod: UltraMod; step: Step<E, unknown> }[] = []
  for (const mod of runtime.mods) {
    const step = mod[kind] as unknown as Step<E, unknown> | undefined
    if (!step) continue
    try {
      if (!await runtime.sets.enabled(api, mod.id)) continue
      if (step.when && !step.when(e)) continue
    } catch {
      continue
    }
    out.push({ mod, step })
  }
  return out
}

// Runs one lifecycle kind in mod order; a failing step is skipped.
type LifecycleKind = 'sessionStart' | 'sessionRestart' | 'turnStart' | 'sessionEnd' | 'notification'

async function each(api: UltraApi, runtime: Runtime, kind: LifecycleKind, e: unknown): Promise<void> {
  for (const mod of runtime.mods) {
    const step = mod[kind] as unknown as Step<unknown, unknown> | undefined
    if (!step) continue
    try {
      if (!await runtime.sets.enabled(api, mod.id)) continue
      if (step.when && !step.when(e)) continue
      await step.run(api, e)
    } catch {
      // One mod's failure leaves the others running.
    }
  }
}

// The set is read before any mod step, as the hooks used to do through the dispatcher.
export async function ready(api: UltraApi, runtime: Runtime): Promise<void> {
  await runtime.sets.ensure(api)
}

const register = (api: UltraApi) =>
  api.command.register({ name: 'ultra', description: 'Control Ultra Mod and switch sets', argumentHint: '[set <name> | sets | reset | doctor | help]', immediate: true })

export async function sessionStart(api: UltraApi, runtime: Runtime, e: Frozen<Args<'session.start'>>): Promise<void> {
  runtime.hud.stop()
  await runtime.sets.hydrate(api)
  await register(api)
  await ready(api, runtime)
  await each(api, runtime, 'sessionStart', e)
}

// classic.SessionStart: a cleared, resumed or forked conversation starts over.
export async function sessionRestart(api: UltraApi, runtime: Runtime, e: Frozen<Args<'classic.SessionStart'>>): Promise<void> {
  if (['clear', 'resume', 'fork'].includes(e.source)) {
    runtime.hud.stop()
    await runtime.sets.hydrate(api)
    await register(api)
  }
  await ready(api, runtime)
  await each(api, runtime, 'sessionRestart', e)
}

export async function turnStart(api: UltraApi, runtime: Runtime, e: Frozen<Args<'turn.start'>>): Promise<void> {
  try {
    await runtime.hud.start(api, e)
  } catch {
    runtime.hud.stop()
  }
  await ready(api, runtime)
  await each(api, runtime, 'turnStart', e)
}

// The lines to show under the answer, joined; null when there are none.
export async function turnComplete(api: UltraApi, runtime: Runtime, e: Frozen<Args<'turn.complete'>>): Promise<string | null> {
  try {
    await runtime.hud.complete(api, e)
  } catch {
    runtime.hud.stop()
  }
  await ready(api, runtime)
  const lines: string[] = []
  for (const { step } of await steps(api, runtime, 'turnComplete', e)) {
    try {
      const line = await step.run(api, e)
      if (typeof line === 'string' && line !== '') lines.push(line)
    } catch {
      // A failed mod adds no line.
    }
  }
  return lines.length ? lines.join('\n') : null
}

// The text under the answer: a line already there from a plugin beneath
// stays, and the receipt goes after it.
export function underAnswer(below: string, answer: string, line: string): string {
  return below && below !== answer ? `${below}\n${line}` : line
}

export async function sessionEnd(api: UltraApi, runtime: Runtime, e: Frozen<Args<'session.end'>>): Promise<void> {
  runtime.hud.stop()
  await ready(api, runtime)
  await each(api, runtime, 'sessionEnd', e)
}

// tool.call before the call runs: the first refusal in mod order, or null.
// A check that fails refuses, since the call has not run yet.
export async function checkTool(api: UltraApi, runtime: Runtime, e: ToolCall): Promise<string | null> {
  await ready(api, runtime)
  for (const mod of runtime.mods) {
    const step = mod.check
    if (!step) continue
    try {
      if (!await runtime.sets.enabled(api, mod.id)) continue
      if (step.when && !step.when(e)) continue
      const refusal = await step.run(api, e)
      if (refusal !== null) return refusal
    } catch {
      return REFUSED
    }
  }
  return null
}

// What the watchers changed in a tool result: the refusal text and the
// context lines, as they should now read. Null when nothing changed.
export type ToolChange = { deny: string | undefined; context: readonly string[] }

// tool.call around a call that every check let through: the watchers start
// in mod order before the call and see its result in reverse order, as
// nested middleware would. A failing watcher leaves the result as it was.
export async function watchTool(api: UltraApi, runtime: Runtime, e: ToolCall): Promise<(result: ToolResult) => Promise<ToolChange | null>> {
  const afters: AfterTool[] = []
  try {
    await ready(api, runtime)
    for (const { step } of await steps(api, runtime, 'watch', e)) {
      try {
        const after = await step.run(api, e)
        if (typeof after === 'function') afters.push(after as AfterTool)
      } catch {
        // A watcher that fails before the call only misses this one.
      }
    }
  } catch {
    // Without the set no watcher runs; the call goes on as it is.
  }
  return async result => {
    let out = result
    for (const after of afters.reverse()) {
      try {
        out = await after(out)
      } catch {
        // Keep the result the failed watcher was given.
      }
    }
    if (out.deny === result.deny && sameLines(out.context, result.context)) return null
    return { deny: out.deny, context: out.context ?? [] }
  }
}

function sameLines(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  const left = a ?? []
  const right = b ?? []
  return left.length === right.length && left.every((line, index) => line === right[index])
}

// session.append: the row's content with secrets masked, or null to store it as it is.
export async function maskRow(api: UltraApi, runtime: Runtime, e: AppendRow): Promise<RowContent | null> {
  await ready(api, runtime)
  let content: RowContent | null = null
  for (const { step } of await steps(api, runtime, 'append', e)) {
    try {
      const input = content === null ? e : { ...e, message: { ...e.message, content } }
      const rewritten = await step.run(api, input as AppendRow)
      if (rewritten !== null) content = rewritten as RowContent
    } catch {
      // A failed mod leaves the row as the mods before it left it.
    }
  }
  return content
}

// prompt.compose: the sections the mods add after the others.
export async function composeSections(api: UltraApi, runtime: Runtime, e: Frozen<Args<'prompt.compose'>>): Promise<PromptComposeSection[]> {
  await ready(api, runtime)
  const added: PromptComposeSection[] = []
  for (const { step } of await steps(api, runtime, 'compose', e)) {
    try {
      const section = await step.run(api, e)
      if (section) added.push(section as PromptComposeSection)
    } catch {
      // A failed mod adds nothing.
    }
  }
  return added
}

export async function notification(api: UltraApi, runtime: Runtime, e: Frozen<Args<'classic.Notification'>>): Promise<void> {
  await ready(api, runtime)
  await each(api, runtime, 'notification', e)
}

// /ultra and its subcommands.
export async function ultraCommand(api: UltraApi, runtime: Runtime, args: string): Promise<CommandAnswer> {
  await ready(api, runtime)
  return runCommand(api, args, runtime.sets, runtime.mods, () => runtime.hud.sync(api))
}

// The Ultra Mod pane.
export function pane(api: UltraApi, runtime: Runtime, e: Frozen<RenderInput<'Pane'>>): ReturnType<typeof renderPane> {
  return renderPane(api, e, runtime.sets, runtime.mods, () => runtime.hud.sync(api))
}

// The rows Ultra Mod draws above the prompt, or null; a drawing that fails draws nothing.
export async function band(api: UltraApi, runtime: Runtime, e: Frozen<RenderInput<'AbovePrompt'>>): Promise<RenderNode[] | null> {
  try {
    return await bandRows(api, e, runtime.sets, runtime.mods)
  } catch {
    return null
  }
}
