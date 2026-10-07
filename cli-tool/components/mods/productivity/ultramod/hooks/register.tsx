import type { Args, EngineInterface, EventResult, Frozen, Next, PluginState, Register, ResolveInput } from 'claude-code'
import type { UltraApi } from './core/api'
import type { ModEvent } from './core/mod'
import { runCommand } from './core/commands'
import { createDispatcher, engineNext, refuse } from './core/dispatcher'
import { renderPane } from './core/pane'
import { createSets } from './core/sets'
import { createMods } from './mods/index'

// Keep raw engine calls here so the validator can account for every capability.
function createApi($: EngineInterface): UltraApi {
  return {
    state: {
      get: ((ref: Parameters<UltraApi['state']['get']>[0]) => {
        if (ref.plugin !== 'ultramod') throw new Error('Ultra Mod can only read its own state.')
        if (ref.key === 'set') return $.state.get({ plugin: 'ultramod', key: 'set' })
        if (ref.key === 'turn') return $.state.get({ plugin: 'ultramod', key: 'turn' })
        if (ref.key === 'receipts') return $.state.get({ plugin: 'ultramod', key: 'receipts' })
        if (ref.key === 'allow') return $.state.get({ plugin: 'ultramod', key: 'allow' })
        if (ref.key === 'guard-approved') return $.state.get({ plugin: 'ultramod', key: 'guard-approved' })
        if (ref.key === 'compact') return $.state.get({ plugin: 'ultramod', key: 'compact' })
        throw new Error('Ultra Mod state key is not declared in the facade.')
      }) as UltraApi['state']['get'],
      set: ((...args: Parameters<UltraApi['state']['set']>) => {
        const [ref, value, options] = args
        if (ref.plugin !== 'ultramod') throw new Error('Ultra Mod can only write its own state.')
        if (ref.key === 'set') return $.state.set({ plugin: 'ultramod', key: 'set' }, value as PluginState['ultramod']['set'], options)
        if (ref.key === 'turn') return $.state.set({ plugin: 'ultramod', key: 'turn' }, value as PluginState['ultramod']['turn'], options)
        if (ref.key === 'receipts') return $.state.set({ plugin: 'ultramod', key: 'receipts' }, value as PluginState['ultramod']['receipts'], options)
        if (ref.key === 'allow') return $.state.set({ plugin: 'ultramod', key: 'allow' }, value as PluginState['ultramod']['allow'], options)
        if (ref.key === 'guard-approved') return $.state.set({ plugin: 'ultramod', key: 'guard-approved' }, value as PluginState['ultramod']['guard-approved'], options)
        if (ref.key === 'compact') return $.state.set({ plugin: 'ultramod', key: 'compact' }, value as PluginState['ultramod']['compact'], options)
        throw new Error('Ultra Mod state key is not declared in the facade.')
      }) as UltraApi['state']['set'],
    },
    store: {
      get: (...args: Parameters<UltraApi['store']['get']>) => $.store.get(...args),
      set: (...args: Parameters<UltraApi['store']['set']>) => $.store.set(...args),
      delete: (...args: Parameters<UltraApi['store']['delete']>) => $.store.delete(...args),
      keys: (...args: Parameters<UltraApi['store']['keys']>) => $.store.keys(...args),
    },
    clock: {
      now: (...args: Parameters<UltraApi['clock']['now']>) => $.clock.now(...args),
      every: (...args: Parameters<UltraApi['clock']['every']>) => $.clock.every(...args),
      after: (...args: Parameters<UltraApi['clock']['after']>) => $.clock.after(...args),
    },
    ui: {
      ask: (...args: Parameters<UltraApi['ui']['ask']>) => $.ui.ask(...args),
      toast: (...args: Parameters<UltraApi['ui']['toast']>) => $.ui.toast(...args),
      status: (...args: Parameters<UltraApi['ui']['status']>) => $.ui.status(...args),
      log: (...args: Parameters<UltraApi['ui']['log']>) => $.ui.log(...args),
      invalidate: (...args: Parameters<UltraApi['ui']['invalidate']>) => $.ui.invalidate(...args),
      open: (...args: Parameters<UltraApi['ui']['open']>) => $.ui.open(...args),
      close: (...args: Parameters<UltraApi['ui']['close']>) => $.ui.close(...args),
      resolve: <E extends ResolveInput>(e: E) => $.ui.resolve(e),
    },
    session: {
      root: (...args: Parameters<UltraApi['session']['root']>) => $.session.root(...args),
      cwd: (...args: Parameters<UltraApi['session']['cwd']>) => $.session.cwd(...args),
      id: (...args: Parameters<UltraApi['session']['id']>) => $.session.id(...args),
      usage: (...args: Parameters<UltraApi['session']['usage']>) => $.session.usage(...args),
      model: (...args: Parameters<UltraApi['session']['model']>) => $.session.model(...args),
      version: (...args: Parameters<UltraApi['session']['version']>) => $.session.version(...args),
      compact: (...args: Parameters<UltraApi['session']['compact']>) => $.session.compact(...args),
    },
    process: {
      run: (...args: Parameters<UltraApi['process']['run']>) => $.process.run(...args),
    },
    fs: {
      write: (...args: Parameters<UltraApi['fs']['write']>) => $.fs.write(...args),
      stat: (...args: Parameters<UltraApi['fs']['stat']>) => $.fs.stat(...args),
      exists: (...args: Parameters<UltraApi['fs']['exists']>) => $.fs.exists(...args),
      read: ((...args: Parameters<UltraApi['fs']['read']>) => $.fs.read(...args)) as UltraApi['fs']['read'],
    },
    audio: {
      play: (...args: Parameters<UltraApi['audio']['play']>) => $.audio.play(...args),
    },
    command: {
      register: (...args: Parameters<UltraApi['command']['register']>) => $.command.register(...args),
    },
    env: {
      get: name => {
        if (name === 'OS') return $.env.get('OS')
        if (name === 'HOME') return $.env.get('HOME')
        if (name === 'USERPROFILE') return $.env.get('USERPROFILE')
        if (name === 'WSL_DISTRO_NAME') return $.env.get('WSL_DISTRO_NAME')
        if (name === 'TERM_PROGRAM') return $.env.get('TERM_PROGRAM')
        throw new Error('Ultra Mod environment name is not declared in the facade.')
      },
    },
  }
}

type Runtime = ReturnType<typeof createMods> & { sets: ReturnType<typeof createSets>; dispatcher: ReturnType<typeof createDispatcher> }
async function lifecycle<E extends ModEvent>($: UltraApi, event: E, e: Frozen<Args<E>>, runtime: Runtime) {
  const { sets, hud } = runtime
  if (event === 'session.start' || event === 'classic.SessionStart') {
    const input = e as Args<'classic.SessionStart'>
    if (event === 'session.start' || ['clear', 'resume', 'fork'].includes(input.source)) {
      hud.stop()
      await sets.hydrate($)
      await $.command.register({ name: 'ultra', description: 'Control Ultra Mod and switch sets', argumentHint: '[set <name> | sets | reset | doctor | help]', immediate: true })
    }
  }
  try {
    if (event === 'turn.start') await hud.start($, e as Frozen<Args<'turn.start'>>)
    if (event === 'turn.complete') await hud.complete($, e as Frozen<Args<'turn.complete'>>)
  } catch {
    hud.stop()
  }
  if (event === 'session.end') hud.stop()
}
export async function dispatch<E extends ModEvent>($: UltraApi, event: E, e: Frozen<Args<E>>, next: Next<E>, runtime: Runtime): Promise<EventResult<E>> {
  await lifecycle($, event, e, runtime)
  await runtime.sets.ensure($)
  return runtime.dispatcher.dispatch($, event, e, engineNext(event, next))
}
export const register: Register = (on, options) => {
  const sets = createSets(options)
  const { mods, hud } = createMods(sets)
  const dispatcher = createDispatcher(mods, sets)
  const runtime = { sets, mods, hud, dispatcher }

  on('session.start', ($, e, next) => dispatch(createApi($), 'session.start', e, next, runtime))
  on('classic.SessionStart', ($, e, next) => dispatch(createApi($), 'classic.SessionStart', e, next, runtime))
  on('turn.start', ($, e, next) => dispatch(createApi($), 'turn.start', e, next, runtime))
  on('turn.complete', ($, e, next) => dispatch(createApi($), 'turn.complete', e, next, runtime))
  on('session.end', ($, e, next) => dispatch(createApi($), 'session.end', e, next, runtime))
  on('command.run', { command: 'ultra' }, async ($, e, next) => {
    const api = createApi($)
    await sets.ensure(api)
    return dispatcher.dispatch(api, 'command.run', e, engineNext('command.run', next), input => runCommand(api, input.args, sets, mods, () => hud.sync(api)))
  })
  on('ui.render', { component: ['AbovePrompt', 'Pane'] }, async ($, e, next) => {
    const api = createApi($)
    const downstream = engineNext('ui.render', next as Next<'ui.render'>)
    return dispatcher.dispatch(api, 'ui.render', e, downstream, input => input.component === 'Pane' && input.requestId === 'ultramod' ? renderPane(api, input, sets, mods, () => hud.sync(api)) : downstream(input))
  })

  // Literal registrations are required by the engine's source validator.
  if (dispatcher.events.has('tool.call')) on('tool.call', ($, e, next) => dispatch(createApi($), 'tool.call', e, next, runtime)).catch(async ($, e, next) => next.called || !await dispatcher.hasGate(createApi($), 'tool.call') ? next(e) : refuse('tool.call'))
  if (dispatcher.events.has('tool.check')) on('tool.check', ($, e, next) => dispatch(createApi($), 'tool.check', e, next, runtime)).catch(async ($, e, next) => await dispatcher.hasGate(createApi($), 'tool.check') ? refuse('tool.check') : next(e))
  if (dispatcher.events.has('prompt.submit')) on('prompt.submit', ($, e, next) => dispatch(createApi($), 'prompt.submit', e, next, runtime)).catch(async ($, e, next) => next.called || !await dispatcher.hasGate(createApi($), 'prompt.submit') ? next(e) : refuse('prompt.submit'))
  if (dispatcher.events.has('session.append')) on('session.append', ($, e, next) => dispatch(createApi($), 'session.append', e, next, runtime)).catch(async ($, e, next) => next.called || !await dispatcher.hasGate(createApi($), 'session.append') ? next(e) : refuse('session.append'))
  if (dispatcher.events.has('prompt.compose')) on('prompt.compose', ($, e, next) => dispatch(createApi($), 'prompt.compose', e, next, runtime))
  if (dispatcher.events.has('classic.Notification')) on('classic.Notification', ($, e, next) => dispatch(createApi($), 'classic.Notification', e, next, runtime))
}
