import type { UltraApi } from './api'
import type { Args, EventResult, Frozen, Next } from 'claude-code'
import type { ModEvent, ModHandler, ModNext, UltraMod } from './mod'
import type { SetsEngine } from './sets'

export type GatingEvent = 'tool.call' | 'tool.check' | 'prompt.submit' | 'session.append'
export function refuse<E extends GatingEvent>(event: E): EventResult<E> {
  const reason = 'Ultra Mod could not complete its safety check. Retry after checking /ultra doctor.'
  const answer = event === 'tool.check' ? { decision: 'deny', reason } : event === 'prompt.submit' ? { drop: reason } : { deny: reason }
  return answer as EventResult<E>
}

export function createDispatcher(mods: readonly UltraMod[], sets: Pick<SetsEngine, 'enabled'>) {
  const events = new Set(mods.flatMap(mod => Object.keys(mod.hooks ?? {}) as ModEvent[]))
  async function dispatch<E extends ModEvent>($: UltraApi, event: E, e: Frozen<Args<E>>, next: ModNext<E>, answer?: (input: Frozen<Args<E>>) => Promise<EventResult<E>>): Promise<EventResult<E>> {
    const links: { mod: UltraMod; handler: ModHandler<E> }[] = []
    for (const mod of mods) {
      for (const handler of mod.hooks?.[event] ?? []) links.push({ mod, handler })
    }
    const run = async (index: number, input: Frozen<Args<E>>): Promise<EventResult<E>> => {
      const link = links[index]
      if (!link) return answer ? answer(input) : next(input)
      let continuation: Promise<EventResult<E>> | undefined
      const forward = Object.assign(
        (rewritten: Frozen<Args<E>> | Args<E>) => continuation ??= run(index + 1, rewritten as Frozen<Args<E>>),
        { event, signal: next.signal },
      )
      Object.defineProperty(forward, 'called', { get: () => continuation !== undefined })
      try {
        if (!await sets.enabled($, link.mod.id) || link.handler.when && !link.handler.when(input)) return forward(input)
        return await link.handler.run($, input, forward as ModNext<E>)
      } catch {
        // A permission verdict executes nothing, so a broken guard can still deny it.
        if (link.handler.gating && event === 'tool.check') return refuse('tool.check') as EventResult<E>
        // Reuse downstream work so a failed observer never repeats a tool.
        if (continuation) return continuation
        if (link.handler.gating && isGatingEvent(event)) return refuse(event) as EventResult<E>
        return forward(input)
      }
    }
    return run(0, e)
  }
  return {
    events,
    dispatch,
    hasGate: async ($: UltraApi, event: ModEvent) => {
      for (const mod of mods) {
        if (!mod.hooks?.[event]?.some(handler => handler.gating)) continue
        try { if (await sets.enabled($, mod.id)) return true } catch { return true }
      }
      return false
    },
  }
}

export const isGatingEvent = (event: ModEvent): event is GatingEvent => event === 'tool.call' || event === 'tool.check' || event === 'prompt.submit' || event === 'session.append'
export function engineNext<E extends ModEvent>(event: E, next: Next<E>): ModNext<E> {
  let called = false
  const forward = Object.assign((e: Frozen<Args<E>> | Args<E>) => { called = true; return next(e as Args<E>) as Promise<EventResult<E>> }, { event, signal: next.signal })
  Object.defineProperty(forward, 'called', { get: () => called })
  return forward as ModNext<E>
}
