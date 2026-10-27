// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
import type { Elements } from 'claude-code'

import type { SubagentTunerPending as Pending } from '../types'
import { EFFORTS, MODELS } from './recommend'
import { INHERITED_TEXT } from './dialog'
import type { Field } from './state'

export const INHERIT_VALUE = 'inherit'

/** From this width the Model and Effort selectors share a row. */
export const SELECTORS_FROM = 52
/** The three buttons share a row from this width, or from the width their labels need, if more. */
export const BUTTONS_FROM = 50
const BUTTONS_GAP = 2

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

type ButtonKey = 'run' | 'save' | 'cancel'

const buttonSpecs = (entry: Pending): { key: ButtonKey; hotkey: string; label: string }[] => [
  { key: 'run', hotkey: 'r', label: runLabel(entry) },
  { key: 'save', hotkey: 'd', label: 'Run and save as default' },
  { key: 'cancel', hotkey: 'c', label: 'Cancel' },
]

// The width of the row: each plain Button draws `<hotkey>: <label>`, plus the gaps.
const buttonsRowWidth = (entry: Pending): number => {
  const specs = buttonSpecs(entry)

  return specs.reduce((sum, one) => sum + one.hotkey.length + 2 + one.label.length, 0) + BUTTONS_GAP * (specs.length - 1)
}

function buttons(data: PaneData) {
  const { Button } = data.ui
  const { entry, actions } = data

  return buttonSpecs(entry).map(({ key, hotkey, label }) => (
    <Button key={key} plain hotkey={hotkey} label={label} autoFocus={key === 'run' ? true : undefined} onPress={() => actions[key](entry.id)} />
  ))
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
      {data.columns >= Math.max(BUTTONS_FROM, buttonsRowWidth(data.entry)) ? (
        <Box gap={BUTTONS_GAP}>{buttons(data)}</Box>
      ) : (
        <Box flexDirection="column">{buttons(data)}</Box>
      )}
    </Box>
  )
}
