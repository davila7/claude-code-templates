import type { UltraApi } from './api'
import type { UltraMod } from './mod'
import type { SetsEngine } from './sets'
import { detectNotifier } from './notifier'
import { isSetName, setLabel, setNames, settingsFor } from './sets'

async function gitState(api: UltraApi): Promise<'available' | 'unavailable'> {
  try {
    return (await api.process.run(['git', '--version'])).exitCode === 0 ? 'available' : 'unavailable'
  } catch {
    return 'unavailable'
  }
}

export async function runCommand(api: UltraApi, args: string, sets: SetsEngine, mods: readonly UltraMod[], sync: () => Promise<void>) {
  const [command = '', ...rest] = args.trim().split(/\s+/)
  const value = rest.join(' ')
  if (!command) {
    await api.ui.open({ id: 'ultramod', title: 'Ultra Mod', focus: true, closeOnEscape: true })
    return { text: 'Controls opened.' }
  }
  if (command === 'set') {
    if (!isSetName(value)) return { text: `Choose a set: ${setNames.join(', ')}.` }
    const set = await sets.switch(api, value)
    await sync()
    return { text: `Set: ${setLabel(set)}.` }
  }
  if (command === 'sets') return { text: setNames.join('\n') }
  if (command === 'reset') {
    const set = await sets.reset(api)
    await sync()
    return { text: `Overrides reset: ${setLabel(set)}.` }
  }
  if (command === 'help') return { text: '/ultra [set <name> | sets | reset | doctor | help]\nOther mod commands: undo, allow, pin, pins, pins approve (when implemented and enabled).' }
  if (command === 'doctor') {
    const set = await sets.current(api)
    const [version, notifier, git] = await Promise.all([api.session.version(), detectNotifier(api), gitState(api)])
    const lines = [
      'Version 1.0.12',
      `Claude Code ${version.version}`,
      `Notifier: ${notifier}`,
      `Git: ${git}`,
      `Set: ${setLabel(set)}`,
      `Overrides: ${Object.keys(set.overrides).join(', ') || 'none'}`,
    ]
    for (const mod of mods) {
      const settings = await settingsFor(api, mod.id)
      lines.push(`${mod.id}: ${settings.enabled ? 'on' : 'off'} (${settings.mode})`)
    }
    return { text: lines.join('\n') }
  }
  for (const mod of mods) {
    const handler = mod.commands?.[command]
    if (handler && await sets.enabled(api, mod.id)) {
      const answer = await handler(api, value)
      if (answer !== null) return answer
    }
  }
  return { text: `Unknown command: ${command}. Run /ultra help.` }
}
