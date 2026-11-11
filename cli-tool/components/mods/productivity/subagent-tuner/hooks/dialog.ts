// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
import type { SubagentTunerChoice as Choice } from '../types'
import type { Field } from './state'
import { EFFORTS, MODELS, describeChoice } from './recommend'
import type { AgentRequest } from './recommend'

// The native dialogs, asked in a chain where the pick pane cannot be seated. The
// engine's dialog takes at most four options and compares labels exactly.

export const CHANGE_LABEL = 'Change model or effort'
export const CANCEL_LABEL = 'Cancel'
export const MORE_MODEL_LABEL = 'fable or inherit…'
export const MORE_EFFORT_LABEL = 'xhigh, max or inherit…'
const INHERIT_NAME = 'inherit'

/** What Run says where the selection inherits both fields although the call set one. */
export const INHERITED_TEXT = 'with inherited model and effort'

// Each field dialog holds at most four options (the engine's limit): the fourth
// opens the rest, so that every value, inherit included, can be clicked.
export const MODEL_OPTIONS: readonly string[] = ['haiku', 'sonnet', 'opus', MORE_MODEL_LABEL]
export const MORE_MODEL_OPTIONS: readonly string[] = ['fable', INHERIT_NAME]
export const EFFORT_OPTIONS: readonly string[] = ['low', 'medium', 'high', MORE_EFFORT_LABEL]
export const MORE_EFFORT_OPTIONS: readonly string[] = ['xhigh', 'max', INHERIT_NAME]

const DESCRIPTION_CHARS = 60
const TYPE_CHARS = 30


const clip = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`)

const agentOf = (call: AgentRequest): string => clip(call.subagent_type ?? 'general-purpose', TYPE_CHARS)

export const headerFor = (call: AgentRequest): string => `${agentOf(call)} · ${clip(call.description ?? '', DESCRIPTION_CHARS)}`

// The selection is the whole answer in Manual: a value the call set is only its
// preset. An empty selection leaves the call as made only where it set nothing.
export const shows = (call: AgentRequest, choice: Choice): string => {
  if (choice.model !== null || choice.effort !== null) {
    return describeChoice(choice)
  }

  return call.model === undefined && call.effort === undefined ? 'as the model asked' : INHERITED_TEXT
}

/** The first dialog: run with what is selected, save it, change it, or cancel. */
export type MainDialog = {
  question: string
  run: string
  /** Absent only where nothing is selected: there is no default to keep. */
  save: string | null
  options: readonly string[]
}

export function mainDialog(call: AgentRequest, current: Choice): MainDialog {
  const run = `Run ${shows(call, current)}`
  const save = current.model !== null || current.effort !== null ? `${run} + save default` : null

  return {
    question: `Run ${agentOf(call)}: ${clip(call.description ?? '', DESCRIPTION_CHARS)}?`,
    run,
    save,
    options: [run, ...(save === null ? [] : [save]), CHANGE_LABEL, CANCEL_LABEL],
  }
}

export const fieldQuestion = (call: AgentRequest, field: Field): string =>
  `${field === 'model' ? 'Model' : 'Effort'} for ${agentOf(call)}?`

/** `model/effort` or `model effort` typed under Other, each checked against the known names. */
export function parseChoiceText(text: string): Choice | null {
  const match = /^\s*([a-z]+)\s*[/\s]\s*([a-z]+)\s*$/i.exec(text)
  const model = match?.[1]?.toLowerCase()
  const effort = match?.[2]?.toLowerCase()

  if (model === undefined || effort === undefined) {
    return null
  }

  const isKnown = (MODELS as readonly string[]).includes(model) && (EFFORTS as readonly string[]).includes(effort)

  return isKnown ? { model, effort } : null
}

export type MainReading =
  | { kind: 'run' | 'save' | 'change' | 'cancel' }
  | { kind: 'typed'; choice: Choice }
  /** Neither an option nor a model/effort: nothing is started. */
  | { kind: 'unreadable'; problem: string }

/** Labels are compared exactly; free text is the dialog's Other. */
export function readMain(dialog: MainDialog, text: string): MainReading {
  if (text === dialog.run) {
    return { kind: 'run' }
  }

  if (dialog.save !== null && text === dialog.save) {
    return { kind: 'save' }
  }

  if (text === CHANGE_LABEL) {
    return { kind: 'change' }
  }

  if (text === CANCEL_LABEL) {
    return { kind: 'cancel' }
  }

  const typed = parseChoiceText(text)

  return typed !== null
    ? { kind: 'typed', choice: typed }
    : { kind: 'unreadable', problem: `Subagent tuner: could not read "${clip(text, 30)}" as model/effort; nothing was started` }
}

/**
 * A value of one field from a field dialog, or text typed under Other that names
 * one (or inherit). `undefined` where it names none; `'more'` where the dialog's
 * fourth option was chosen.
 */
export function readField(field: Field, text: string): string | null | 'more' | undefined {
  if (text === (field === 'model' ? MORE_MODEL_LABEL : MORE_EFFORT_LABEL)) {
    return 'more'
  }

  const name = text.trim().toLowerCase()

  if (name === INHERIT_NAME) {
    return null
  }

  return ((field === 'model' ? MODELS : EFFORTS) as readonly string[]).includes(name) ? name : undefined
}
