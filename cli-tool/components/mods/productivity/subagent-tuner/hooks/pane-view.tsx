// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
import type { Elements } from 'claude-code'

import type { SubagentTunerPending as Pending } from '../types'
import { EFFORTS, MODELS } from './recommend'
import { INHERITED_TEXT } from './dialog'
import type { Field } from './state'

export const INHERIT_VALUE = 'inherit'

/** From this width the Model and Effort selectors share a row. */
export const SELECTORS_FROM = 52
/** From this width the three buttons share a row. */
export const BUTTONS_FROM = 50

export type PaneActions = {
  pick: (id: string, field: Field, value: string) => unknown
  run: (id: string) => unknown
  save: (id: string) => unknown
  cancel: (id: string) => unknown
}

export type PaneData = {
  ui: Elements['terminal'] | Elements['desktop']
  columns: number
  entry: Pending
  actions: PaneActions
}

const clip = (text: string, max: number): string =>
  max <= 0 ? '' : text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`

const LABEL: Record<Field, string> = { model: 'Model', effort: 'Effort' }

/** `<agent type> · <description>`, clipped to the room. */
export const headerLine = (entry: Pending, columns: number): string =>
  clip(`${entry.subagentType} · ${entry.description}`, columns)

function selector(data: PaneData, field: Field) {
  const { Select } = data.ui
  const current = data.entry[field] ?? INHERIT_VALUE

  // The preset (the call's value, else the default or recommendation) is just
  // the value the selector starts on: no mark, and every field is editable.
  return (
    <Select
      key={field}
      label={LABEL[field]}
      options={[...(field === 'model' ? MODELS : EFFORTS), INHERIT_VALUE].map(value => ({ value }))}
      value={current}
      onSelect={value => data.actions.pick(data.entry.id, field, value)}
    />
  )
}

// Plain Buttons draw their hotkey (`r: Run`).
// Inheriting both fields drops what the call set: Run says so.
const runLabel = (entry: Pending): string =>
  entry.model === null && entry.effort === null && entry.isCallSet ? `Run ${INHERITED_TEXT}` : 'Run'

function buttons(data: PaneData) {
  const { Button } = data.ui
  const { entry, actions } = data
  const id = entry.id

  return [
    <Button key="run" plain hotkey="r" label={runLabel(entry)} autoFocus onPress={() => actions.run(id)} />,
    <Button key="save" plain hotkey="d" label="Run and save as default" onPress={() => actions.save(id)} />,
    <Button key="cancel" plain hotkey="c" label="Cancel" onPress={() => actions.cancel(id)} />,
  ]
}

export function paneView(data: PaneData) {
  const { Box, Text } = data.ui
  const selectors = [selector(data, 'model'), selector(data, 'effort')]

  return (
    <Box flexDirection="column">
      <Text>{headerLine(data.entry, data.columns)}</Text>
      {data.columns >= SELECTORS_FROM ? (
        <Box gap={3}>{selectors}</Box>
      ) : (
        <Box flexDirection="column">{selectors}</Box>
      )}
      {data.columns >= BUTTONS_FROM ? (
        <Box gap={2}>{buttons(data)}</Box>
      ) : (
        <Box flexDirection="column">{buttons(data)}</Box>
      )}
    </Box>
  )
}
