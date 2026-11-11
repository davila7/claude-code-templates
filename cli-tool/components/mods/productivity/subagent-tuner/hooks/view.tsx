// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
import type { Elements } from 'claude-code'

import type { SubagentTunerChoice as Choice, SubagentTunerMode as Mode } from '../types'
import type { Field } from './state'

export type Actions = {
  setMode: (mode: Mode) => unknown
  cycle: (field: Field) => unknown
  reset: () => unknown
}

export type BandData = {
  ui: Elements['terminal'] | Elements['desktop']
  columns: number
  mode: Mode
  saved: Choice | null
  actions: Actions
}

/** Marks the active mode in words, for where colour alone would not tell. */
export const ACTIVE_MARK = '*'
/** Trails a plain (unbracketed) cycler, which would otherwise look like text. */
export const CYCLER_MARK = '>'

type Layout = {
  lead: string
  manual: string
  between: string
  isBracketed: boolean
  isShort: boolean
  reset: string | null
}

/**
 * Richest first, each giving up something other than the mode's words before the
 * next: the word `default`, then brackets and the full effort name, then the
 * lead and Reset. `Man` is the last resort.
 */
const LAYOUTS: readonly Layout[] = [
  { lead: 'Tuner  ', manual: 'Manual', between: ' · default ', isBracketed: true, isShort: false, reset: 'Reset' },
  { lead: 'Tuner ', manual: 'Manual', between: ' · ', isBracketed: true, isShort: false, reset: '×' },
  { lead: 'Tuner ', manual: 'Manual', between: ' ', isBracketed: false, isShort: true, reset: '×' },
  { lead: '', manual: 'Manual', between: ' ', isBracketed: false, isShort: true, reset: null },
  { lead: '', manual: 'Man', between: ' ', isBracketed: false, isShort: true, reset: null },
]

/** The width of the smallest layout in its worst case; narrower than this nothing is drawn. */
export const MIN_COLUMNS = 31

const NONE_LABEL = 'rec.'

const nameOf = (value: string | null, isShort: boolean): string =>
  value === null ? NONE_LABEL : isShort && value === 'medium' ? 'med' : value

const cyclerLabel = (layout: Layout, value: string | null): string =>
  `${nameOf(value, layout.isShort)}${layout.isBracketed ? '' : CYCLER_MARK}`

// A bracketed Button is its label plus 4 cells, a plain one its label alone
// (reference.md:127); the active mode carries one more cell for its mark.
const buttonWidth = (label: string, isBracketed: boolean): number => label.length + (isBracketed ? 4 : 0)

/** The cells the layout needs for what is to be drawn now: the labels it holds, not the worst they could be. */
function neededWidth(layout: Layout, mode: Mode, saved: Choice | null): number {
  const manual = `${mode === 'manual' ? ACTIVE_MARK : ''}${layout.manual}`
  const auto = `${mode === 'auto' ? ACTIVE_MARK : ''}Auto`
  const cyclers =
    buttonWidth(cyclerLabel(layout, saved?.model ?? null), layout.isBracketed) +
    1 +
    buttonWidth(cyclerLabel(layout, saved?.effort ?? null), layout.isBracketed)
  const reset = layout.reset === null || saved === null ? 0 : 1 + buttonWidth(layout.reset, layout.isBracketed)

  return layout.lead.length + buttonWidth(manual, true) + buttonWidth(auto, true) + layout.between.length + cyclers + reset
}

/** The richest layout whose needed width fits; the smallest where none does. */
const layoutFor = (columns: number, mode: Mode, saved: Choice | null): Layout =>
  LAYOUTS.find(layout => neededWidth(layout, mode, saved) <= columns) ?? LAYOUTS[LAYOUTS.length - 1]!

export function bandView({ ui, columns, mode, saved, actions }: BandData) {
  const { Box, Button, Text } = ui
  const layout = layoutFor(columns, mode, saved)
  const plain = layout.isBracketed ? undefined : true
  const field = (name: Field) => (
    <Button
      key={`default-${name}`}
      label={cyclerLabel(layout, saved?.[name] ?? null)}
      plain={plain}
      onPress={() => actions.cycle(name)}
    />
  )

  return (
    <Box height={1} overflow="hidden">
      {layout.lead === '' ? null : <Text dimColor>{layout.lead}</Text>}
      <Box>
        <Button
          key="mode-manual"
          label={mode === 'manual' ? `${ACTIVE_MARK}${layout.manual}` : layout.manual}
          variant={mode === 'manual' ? 'primary' : undefined}
          onPress={() => actions.setMode('manual')}
        />
        <Button
          key="mode-auto"
          label={mode === 'auto' ? `${ACTIVE_MARK}Auto` : 'Auto'}
          variant={mode === 'auto' ? 'primary' : undefined}
          onPress={() => actions.setMode('auto')}
        />
      </Box>
      <Text dimColor>{layout.between}</Text>
      {field('model')}
      <Text dimColor>/</Text>
      {field('effort')}
      {layout.reset === null || saved === null ? null : (
        <Box>
          <Text> </Text>
          <Button key="reset" label={layout.reset} plain={plain} onPress={() => actions.reset()} />
        </Box>
      )}
    </Box>
  )
}
