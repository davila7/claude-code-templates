// Drawings: the band, the pane, and the text report.

import type { BoxProps, ButtonProps, ElementConstructor, RenderElement, RenderNode, TextProps } from 'claude-code'

import type { SandboxTunerApplied, SandboxTunerLatest, SandboxTunerNotice, SandboxTunerRecord } from '../types'
import { cutText, plainText } from './names'
import { isUndoUnresolved } from './records'
import { fileInfo } from './settings-file'
import type { Context, Rated, Verdict } from './verdicts'
import {
  APPLIED_NEXT, APPLIED_PREVIOUS, APPLY_HINT, NO_BLOCKS, SANDBOX_OFF, STILL_BLOCKED, appliedLine, countsSentence, countsSummary, displayTarget, explanation, lastProblem, moreRows,
  openedLine, reformatSentence, reportHeadline, settingsHeader, undoSentence, verdictSentences,
} from './words'

type Kit = { Box: ElementConstructor<BoxProps>; Text: ElementConstructor<TextProps>; Button: ElementConstructor<ButtonProps> }
type BandModel = { explanation: string; counts: string; sentences: string[]; error: string | null; canAllow: boolean; canDeny: boolean }
type BandActions = { allow: () => void; deny: () => void; open: () => void; dismiss: () => void }

// Sandbox Tuner's own cap on one problem text, so that a long cause leaves the pane lists their room in TEXT_BUDGET.
const TEXT_LIMIT = 10_000

/** A problem text that a drawing can show, cut to TEXT_LIMIT: its cause can hold any characters at any length. */
export function drawable(text: string): string {
  return cutText(plainText(text), TEXT_LIMIT)
}

function fixActions(verdict: Verdict): { canAllow: boolean; canDeny: boolean } {
  return { canAllow: verdict.status === 'ready', canDeny: 'deny' in verdict && verdict.deny !== null }
}

function displaySentences(record: SandboxTunerRecord, verdict: Verdict, context: Context): string[] {
  return [...verdictSentences(record, verdict, context), ...(verdict.status === 'covered' ? [STILL_BLOCKED] : [])]
}

export function buildBand(latest: SandboxTunerLatest, record: SandboxTunerRecord, verdict: Verdict, context: Context, notice: SandboxTunerNotice | null): BandModel {
  return {
    ...buildObservation(latest, notice),
    counts: countsSentence(record),
    sentences: displaySentences(record, verdict, context),
    ...fixActions(verdict),
  }
}

export function buildObservation(latest: SandboxTunerLatest, notice: SandboxTunerNotice | null): BandModel {
  return {
    explanation: explanation(latest), counts: '', sentences: [], canAllow: false, canDeny: false,
    error: notice !== null && notice.isError && notice.at >= latest.at ? notice.text : null,
  }
}

// No band Button has a hotkey: a bare digit typed into an empty prompt would press it (types ButtonProps.hotkey).
export function bandTree(kit: Kit, model: BandModel, actions: BandActions, beneath: RenderElement): RenderElement {
  const { Box, Text, Button } = kit
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" paddingX={1}>
        <Text wrap="wrap">{model.explanation}</Text>
        <Text dimColor>{model.counts}</Text>
        {model.sentences.map(sentence => (
          <Text wrap="wrap">{sentence}</Text>
        ))}
        {model.error === null ? null : (
          <Text color="red" wrap="wrap">
            {drawable(model.error)}
          </Text>
        )}
        <Box gap={2}>
          {model.canAllow ? <Button key="band-allow" label="Allow" variant="primary" onPress={actions.allow} /> : null}
          {model.canDeny ? <Button key="band-deny" label="Deny" onPress={actions.deny} /> : null}
          <Button key="band-open" label="Open Sandbox Tuner" onPress={actions.open} />
          <Button key="band-dismiss" label="Dismiss" role="dismiss" onPress={actions.dismiss} />
        </Box>
      </Box>
      {beneath}
    </Box>
  )
}

const ROW_LIMIT = 25
// The engine refuses a drawing past 100,000 characters of text, keys, and labels, and draws its own in place of the
// pane. A pane list ends with `+<n> more` past ROW_LIMIT rows, or once its next row would pass this budget.
const TEXT_BUDGET = 90_000

const SECTIONS = [
  { kind: 'host', title: 'Hosts' },
  { kind: 'path', title: 'Write folders' },
] as const

type RecordRow = { key: string; target: string; summary: string; sentences: string[]; canAllow: boolean; canDeny: boolean; canHide: boolean }
type PaneSection = { title: string; rows: RecordRow[] }
type AppliedRow = { id: string; line: string; undo: string | null; retry: boolean }

// `reformatted`: the settings files of the journal that are not in the 2-space JSON format, so an Undo re-formats them.
type PaneInput = { rated: readonly Rated[]; applied: readonly SandboxTunerApplied[]; reformatted: readonly string[]; appliedOffset: number; notice: SandboxTunerNotice | null; fault: string | null; isSandboxOn: boolean; context: Context; now: number }
type PaneModel = { header: string; isSandboxOn: boolean; notice: SandboxTunerNotice | null; fault: string | null; sections: PaneSection[]; hidden: { key: string; target: string }[]; applied: AppliedRow[]; appliedOffset: number }
type PaneActions = { allow: (key: string) => void; deny: (key: string) => void; hide: (key: string) => void; unhide: (key: string) => void; undo: (id: string) => void; moveApplied: (delta: number) => void }

function visible(rated: readonly Rated[]): Rated[] {
  return rated.filter(({ record }) => !record.isHidden)
}

/** A journal entry whose row offers Undo: a change still in place, or a removal not yet confirmed. */
export function canUndo(entry: SandboxTunerApplied): boolean {
  return entry.undoneAt === null || isUndoUnresolved(entry)
}

function recordRow({ record, verdict }: Rated, context: Context, now: number): RecordRow {
  return {
    key: record.key,
    target: displayTarget(record, context.home),
    summary: countsSummary(record, now),
    sentences: displaySentences(record, verdict, context),
    ...fixActions(verdict),
    canHide: verdict.status !== 'covered',
  }
}

export function buildPane(input: PaneInput): PaneModel {
  const { context, now } = input
  const shown = visible(input.rated)
  return {
    header: settingsHeader(context.file),
    isSandboxOn: input.isSandboxOn,
    notice: input.notice,
    fault: input.fault,
    appliedOffset: Math.max(0, Math.min(input.appliedOffset, input.applied.length - 1)),
    sections: SECTIONS.map(({ kind, title }) => ({
      title,
      rows: shown.filter(({ record }) => record.kind === kind).map(rated => recordRow(rated, context, now)),
    })).filter(section => section.rows.length > 0),
    hidden: input.rated.filter(({ record }) => record.isHidden).map(({ record }) => ({ key: record.key, target: displayTarget(record, context.home) })),
    applied: [...input.applied].reverse().map(entry => {
      const file = fileInfo(entry.file, context.home)
      const reformat = input.reformatted.includes(entry.file) ? [reformatSentence(file)] : []
      return {
        id: entry.id,
        line: appliedLine(entry, now),
        retry: isUndoUnresolved(entry),
        undo: canUndo(entry) ? [undoSentence(entry, file), ...reformat].join(' ') : null,
      }
    }),
  }
}

/** The characters of a drawing that count against the engine's text bound: its text, keys, and labels. */
function textSize(node: RenderNode): number {
  if (typeof node === 'string') return node.length
  const props: Readonly<Record<string, unknown>> = 'props' in node ? (node.props ?? {}) : {}
  const own = [props.key, props.label].reduce<number>((sum, value) => sum + (typeof value === 'string' ? value.length : 0), 0)
  return 'children' in node ? (node.children ?? []).reduce((sum, child) => sum + textSize(child), own) : own
}

export function paneTree(kit: Kit, model: PaneModel, actions: PaneActions): RenderElement {
  const { Box, Text, Button } = kit
  const head = (
    <Box flexDirection="column">
      <Text bold>{model.header}</Text>
      {model.isSandboxOn ? null : <Text color="yellow" wrap="wrap">{SANDBOX_OFF}</Text>}
      {model.notice === null ? null : <Text color={model.notice.isError ? 'red' : 'green'} wrap="wrap">{drawable(model.notice.text)}</Text>}
      {model.fault === null ? null : <Text color="red" wrap="wrap">{drawable(lastProblem(model.fault))}</Text>}
    </Box>
  )
  let room = TEXT_BUDGET - textSize(head)
  // Draws the rows that fit, in order, and counts the others as `+<n> more`.
  const list = <T,>(key: string, title: string, rows: readonly T[], draw: (row: T) => RenderElement, offset = 0, move?: (delta: number) => void): RenderElement => {
    const drawn: RenderElement[] = []
    for (const row of rows.slice(offset, offset + ROW_LIMIT)) {
      const element = draw(row)
      const size = textSize(element)
      if (size > room) break
      room -= size
      drawn.push(element)
    }
    return (
      <Box key={key} flexDirection="column">
        <Text bold>{title}</Text>
        {drawn}
        {rows.length > offset + drawn.length ? <Text dimColor>{moreRows(rows.length - offset - drawn.length)}</Text> : null}
        {move === undefined ? null : (
          <Box gap={2}>
            {offset > 0 ? <Button key="applied-previous" label={APPLIED_PREVIOUS} onPress={() => move(-Math.min(offset, ROW_LIMIT))} /> : null}
            {offset + drawn.length < rows.length ? <Button key="applied-next" label={APPLIED_NEXT} onPress={() => move(drawn.length)} /> : null}
          </Box>
        )}
      </Box>
    )
  }
  // Undo rows take their room first: they are the way back from every write.
  const applied = model.applied.length === 0 ? null : list('applied', 'Applied', model.applied, row => (
    <Box key={`applied:${row.id}`} flexDirection="column">
      <Text>{row.line}</Text>
      {row.undo === null ? null : (
        <Box gap={2}>
          <Text dimColor wrap="wrap">{row.undo}</Text>
          <Button key={`undo:${row.id}`} label={row.retry ? 'Retry Undo' : 'Undo'} onPress={() => actions.undo(row.id)} />
        </Box>
      )}
    </Box>
  ), model.appliedOffset, actions.moveApplied)
  const sections = model.sections.map(section => list(`section:${section.title}`, section.title, section.rows, row => (
    <Box key={`row:${row.key}`} flexDirection="column" marginTop={1}>
      <Text wrap="truncate-end">
        <Text bold>{row.target}</Text>
        <Text dimColor>{`  ${row.summary}`}</Text>
      </Text>
      {row.sentences.map(sentence => (
        <Text wrap="wrap">{sentence}</Text>
      ))}
      <Box gap={2}>
        {row.canAllow ? <Button key={`allow:${row.key}`} label="Allow" variant="primary" onPress={() => actions.allow(row.key)} /> : null}
        {row.canDeny ? <Button key={`deny:${row.key}`} label="Deny" onPress={() => actions.deny(row.key)} /> : null}
        {row.canHide ? <Button key={`hide:${row.key}`} label="Hide" onPress={() => actions.hide(row.key)} /> : null}
      </Box>
    </Box>
  )))
  const hidden = model.hidden.length === 0 ? null : list('hidden', 'Hidden', model.hidden, row => (
    <Box key={`hidden:${row.key}`} gap={2}>
      <Text>{row.target}</Text>
      <Button key={`unhide:${row.key}`} label="Unhide" onPress={() => actions.unhide(row.key)} />
    </Box>
  ))
  const isEmpty = model.sections.length === 0 && model.hidden.length === 0 && model.applied.length === 0
  return (
    <Box flexDirection="column" gap={1}>
      {head}
      {isEmpty ? <Text dimColor>{NO_BLOCKS}</Text> : null}
      {sections}
      {hidden}
      {applied}
    </Box>
  )
}

function statusCount(rated: readonly Rated[], status: Verdict['status']): number {
  return rated.filter(({ verdict }) => verdict.status === status).length
}

export function reportText(rated: readonly Rated[], context: Context, isSandboxOn: boolean, now: number): string {
  if (rated.length === 0) return NO_BLOCKS
  const shown = visible(rated)
  const lines = [
    reportHeadline({ ready: statusCount(shown, 'ready'), waiting: statusCount(shown, 'waiting'), 'no-fix': statusCount(shown, 'no-fix'), covered: statusCount(shown, 'covered') }),
    settingsHeader(context.file),
    ...(isSandboxOn ? [] : [SANDBOX_OFF]),
  ]
  for (const { kind, title } of SECTIONS) {
    const rows = shown.filter(({ record }) => record.kind === kind).slice(0, ROW_LIMIT)
    if (rows.length === 0) continue
    lines.push('', title)
    for (const { record, verdict } of rows) {
      lines.push(`- ${displayTarget(record, context.home)}: ${countsSummary(record, now)}`, ...displaySentences(record, verdict, context).map(sentence => `  ${sentence}`))
    }
  }
  return [...lines, '', APPLY_HINT].join('\n')
}

export function summaryLine(rated: readonly Rated[]): string {
  const shown = visible(rated)
  return openedLine(statusCount(shown, 'ready'), shown.length)
}
