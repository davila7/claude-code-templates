import type { ElementTable, RenderElement } from 'claude-code'

import type { BandPart, PaneModel, Row } from './view'

type Ui = Pick<ElementTable, 'Box' | 'Text' | 'Button'>

const PART_STYLES: Readonly<Record<BandPart['tone'], { color?: string; dimColor?: boolean }>> = {
  plain: {},
  failed: { color: 'red' },
  done: { dimColor: true },
}

/** The band: one line of counts and snippets, Open and Hide, and what other mods drew beneath. */
export function bandTree(ui: Ui, parts: readonly BandPart[], actions: { open: () => void; hide: () => void }, below: RenderElement): RenderElement {
  const { Box, Text, Button } = ui
  return (
    <Box flexDirection="column">
      <Box key="band" flexDirection="row" gap={1}>
        <Box flexGrow={1}>
          <Text wrap="truncate-end">
            {parts.map(part => (
              <Text {...PART_STYLES[part.tone]}>{part.text}</Text>
            ))}
          </Text>
        </Box>
        <Button key="open" label="Open" hotkey="j" onPress={actions.open} />
        <Button key="hide" label="Hide" hotkey="h" dimColor onPress={actions.hide} />
      </Box>
      {below}
    </Box>
  )
}

const TONE_STYLES: Readonly<Record<Row['tone'], { color?: string; dimColor?: boolean }>> = {
  running: { color: 'cyan' },
  completed: { color: 'green' },
  failed: { color: 'red' },
  stopped: { color: 'yellow' },
  gone: { dimColor: true },
}

const EMPTY = 'No background work yet. Jobs show here when Claude runs a command in the background, starts a Monitor, a background agent, or a workflow.'

function rowTree(ui: Ui, row: Row): RenderElement {
  const { Box, Text } = ui
  return (
    <Box key={`job:${row.id}`} flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text {...TONE_STYLES[row.tone]}>{row.glyph}</Text>
        <Text bold wrap="truncate-end">
          {row.title}
        </Text>
        <Text dimColor>{row.kind}</Text>
        <Text>{row.age}</Text>
        {row.bar === undefined ? null : <Text color="cyan">{row.bar}</Text>}
        {row.progress === undefined ? null : <Text>{row.progress}</Text>}
        {row.eta === undefined ? null : <Text {...(row.isSlow ? { color: 'yellow' } : {})}>{row.eta}</Text>}
        {row.flag === undefined ? null : <Text color="yellow">{row.flag}</Text>}
        {row.note === undefined ? null : <Text dimColor>{row.note}</Text>}
      </Box>
      {row.last === undefined ? null : (
        <Text dimColor wrap="truncate-end">
          {`  └ ${row.last}`}
        </Text>
      )}
    </Box>
  )
}

/** The pane: counts and buttons, then running and finished jobs; the empty text only when it has nothing to list. */
export function paneTree(ui: Ui, model: PaneModel, actions: { clear: () => void; close: () => void }): RenderElement {
  const { Box, Text, Button } = ui
  const isEmpty = model.header === '' && model.running.length === 0 && model.ended.length === 0
  return (
    <Box flexDirection="column">
      <Box key="header" flexDirection="row" gap={1}>
        <Box flexGrow={1}>
          {isEmpty ? (
            <Text wrap="wrap">{EMPTY}</Text>
          ) : (
            <Text bold wrap="truncate-end">
              {model.header}
            </Text>
          )}
        </Box>
        <Button key="clear" label="Clear finished" hotkey="c" dimColor onPress={actions.clear} />
        <Button key="close" label="Close" hotkey="x" role="dismiss" onPress={actions.close} />
      </Box>
      {model.running.length === 0 ? null : (
        <Text bold dimColor>
          Running
        </Text>
      )}
      {model.running.map(row => rowTree(ui, row))}
      {model.ended.length === 0 ? null : (
        <Text bold dimColor>
          Finished
        </Text>
      )}
      {model.ended.map(row => rowTree(ui, row))}
    </Box>
  )
}

/** What the pane draws when its hook failed: the cause, in red. */
export function failedPaneTree(ui: Ui, text: string): RenderElement {
  const { Text } = ui
  return (
    <Text color="red" wrap="wrap">
      {text}
    </Text>
  )
}
