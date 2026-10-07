import type { UltraApi } from './api'
import type { UltraMod } from './mod'
import type { SetsEngine } from './sets'
import { isSetName, setLabel, setNames, settingsFor } from './sets'

export async function runCommand($: UltraApi, args: string, sets: SetsEngine, mods: readonly UltraMod[], sync: () => Promise<void>) {
  const [command = '', ...rest] = args.trim().split(/\s+/)
  const value = rest.join(' ')
  if (!command) {
    await $.ui.open({ id: 'ultramod', title: 'Ultra Mod', focus: true, closeOnEscape: true })
    return { text: 'Controls opened.' }
  }
  if (command === 'set') {
    if (!isSetName(value)) return { text: `Choose a set: ${setNames.join(', ')}.` }
    const set = await sets.switch($, value)
    await sync()
    return { text: `Set: ${setLabel(set)}.` }
  }
  if (command === 'sets') return { text: setNames.join('\n') }
  if (command === 'reset') {
    const set = await sets.reset($)
    await sync()
    return { text: `Overrides reset: ${setLabel(set)}.` }
  }
  if (command === 'help') return { text: '/ultra [set <name> | sets | reset | doctor | help]\nOther mod commands: undo, allow, pin, pins (when implemented and enabled).' }
  if (command === 'doctor') {
    const set = await sets.current($)
    const [version, platform, git] = await Promise.all([
      $.session.version(), $.env.get('OS'), $.process.run(['git', '--version']).then(result => result.exitCode === 0 ? 'available' : 'unavailable', () => 'unavailable'),
    ])
    const windows = platform === 'Windows_NT'
    const candidates = windows ? ['powershell'] : ['notify-send', 'osascript']
    let notifier = 'toast'
    for (const candidate of candidates) {
      const found = await $.process.run(windows ? ['where', candidate] : ['which', candidate]).then(result => result.exitCode === 0, () => false)
      if (found) { notifier = candidate; break }
    }
    const lines = [
      'Version 1.0.0',
      `Claude Code ${version.version}`,
      `Notifier: ${notifier}`,
      `Git: ${git}`,
      `Set: ${setLabel(set)}`,
      `Overrides: ${Object.keys(set.overrides).join(', ') || 'none'}`,
    ]
    for (const mod of mods) {
      const settings = await settingsFor($, mod.id)
      lines.push(`${mod.id}: ${settings.enabled ? 'on' : 'off'} (${settings.mode})`)
    }
    return { text: lines.join('\n') }
  }
  for (const mod of mods) {
    const handler = mod.commands?.[command]
    if (handler && await sets.enabled($, mod.id)) {
      const answer = await handler($, value)
      if (answer !== null) return answer
    }
  }
  return { text: `Unknown command: ${command}. Run /ultra help.` }
}
