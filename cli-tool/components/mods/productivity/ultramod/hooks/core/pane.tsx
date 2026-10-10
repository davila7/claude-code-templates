import type { UltraApi } from './api'
import type { Frozen, RenderInput, RenderNode } from 'claude-code'
import type { ModId, UltraMod } from './mod'
import { hudRow } from '../mods/hud'
import type { SetsEngine } from './sets'
import { modIds, setLabel, setNames } from './sets'
import type { UltraModSettings, UltraSetName } from '../../types/index'

// One sentence per mod and mode: what the mod does now, said once, with no
// separate mode column to repeat it.
const sentences: Record<ModId, Record<string, string>> = {
  guard: { ask: 'Asks before risky commands run.', deny: 'Refuses risky commands.', log: 'Runs risky commands and logs them.', off: 'Risky commands run without a check.' },
  secrets: { on: 'Blocks secret files and redacts leaks.', strict: 'Blocks secret files and env dumps.', off: 'Secret reads are not blocked.' },
  tests: { ask: 'Asks before an edit weakens tests.', deny: 'Refuses edits that weaken tests.', off: 'Edits to tests go unchecked.' },
  tidy: { ask: 'Asks before a new doc file is written.', deny: 'Refuses new docs outside the allowlist.', off: 'New documentation files are allowed.' },
  loops: { nudge: 'Stops retry loops with a suggestion.', warn: 'Warns on repeat failures.', off: 'Repeat failures pass silently.' },
  receipts: { tools: 'A receipt after each turn that used tools.', always: 'A receipt after every turn.', issues: 'A receipt when a turn had a problem.', off: 'No receipts are shown.' },
  compact: { 'warn+offer': 'Warns at 70% and offers to compact.', warn: 'Warns when context passes 70%.', auto: 'Compacts on its own at 88%.', off: 'Context usage is not watched.' },
  notify: { on: 'Notices when a turn finishes or waits.', off: 'No notices are sent.' },
  pins: { 'if file': 'Adds .claude/pins.md rules to the prompt.', off: 'Pinned rules are not read.' },
  hud: { full: 'Shows context, limits, turns and cost.', compact: 'One compact line of context and limits.', off: 'Nothing is drawn above the prompt.' },
}
const line = (id: ModId, settings: UltraModSettings) =>
  sentences[id]?.[settings.enabled ? settings.mode : 'off'] ?? null

// One line under the picker: what the active set is for, in one dim sentence.
const setNotes: Record<UltraSetName, string> = {
  essentials: 'Everyday work. Asks before risky commands, shows receipts.',
  strict: 'Production code. A receipt every turn, env dumps blocked.',
  flow: 'Fewest interruptions. Compact HUD, receipts on issues.',
  marathon: 'Long unattended runs. Refuses risky commands, auto-compacts.',
  quiet: 'Safety only, nothing drawn. Guard, secrets and pins only.',
}

export async function renderPane(api: UltraApi, e: Frozen<RenderInput<'Pane'>>, sets: SetsEngine, mods: readonly UltraMod[], sync: () => Promise<void>) {
  const set = await sets.current(api)
  const { Box, Text, Button } = api.ui.resolve(e)
  const columns = Math.max(0, Math.floor(e.props.bodyColumns))
  const pick = async (name: string) => {
    const selected = setNames.find(one => one === name)
    if (selected) { await sets.switch(api, selected); await sync() }
  }
  const picker = (
    <Box key="set-picker" flexDirection="row" flexWrap="wrap" gap={1}>
      {setNames.map((name, index) => (
        <Button key={`set-${name}`} plain label={name} hotkey={String(index + 1)} dimColor={name !== set.name} onPress={() => pick(name)} />
      ))}
    </Box>
  )
  // A row keeps its name cell, its state and one sentence; the sentence is
  // dropped whole when the pane is too narrow to show it whole.
  const grid = modIds.map(id => {
    const settings = set.mods[id]
    const state = settings.enabled ? 'on' : 'off'
    const text = line(id, settings)
    const used = 10 + 1 + state.length + 4 + 1
    return <Box key={`mod-${id}`} flexDirection="row" gap={1}>
      <Box key={`name-${id}`} width={10}><Text>{id}</Text></Box>
      <Button key={`toggle-${id}`} label={state} onPress={async () => { await sets.toggle(api, id); await sync() }} />
      {text !== null && used + text.length <= columns ? <Text dimColor>{text}</Text> : null}
    </Box>
  })
  const sections: RenderNode[] = []
  for (const mod of mods) {
    if (!set.mods[mod.id].enabled || !mod.pane) continue
    try {
      const section = await mod.pane({ api, e, set, settings: set.mods[mod.id] })
      if (section !== null) sections.push(section)
    } catch { /* A section cannot prevent opening the controls. */ }
  }
  const hud = set.mods.hud.enabled
    ? <Box key="hud-row" flexDirection="row" width={columns} flexWrap="nowrap">{(await hudRow(api, e, set, columns)).nodes}</Box>
    : null
  // The footer names the keys the open pane really holds: Tab walks the rows,
  // Enter presses the focused button, digits 1-5 press the picker, Escape closes.
  return <Box flexDirection="column">
    <Text bold>{`Ultra Mod · ${setLabel(set)}`}</Text>
    {picker}
    <Text dimColor>{setNotes[set.name]}</Text>
    <Box key="mod-grid" flexDirection="column">{grid}</Box>
    {hud}
    {sections}
    <Text dimColor>Tab moves · Enter toggles · 1-5 switch set · Esc closes</Text>
  </Box>
}
