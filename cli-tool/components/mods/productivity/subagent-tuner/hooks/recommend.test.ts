// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
import { expect, test } from 'claude-code/testing'

import { EFFORT_OPTIONS, INHERITED_TEXT, MODEL_OPTIONS, MORE_EFFORT_OPTIONS, MORE_MODEL_OPTIONS, fieldQuestion, mainDialog, parseChoiceText, readField, readMain } from './dialog'
import { headerLine } from './pane-view'
import { LONG_PROMPT_CHARS, bumpEffort, hasOpenField, hasOwnDefinition, patchFor, recommend, resolveDefault } from './recommend'

const TABLE = [
  { subagent_type: 'Explore', description: 'Find the config loader', model: 'haiku', effort: 'low' },
  { subagent_type: 'general-purpose', description: 'Search the repo for TODOs', model: 'haiku', effort: 'low' },
  { subagent_type: 'general-purpose', description: 'Research the SDK', model: 'haiku', effort: 'low' },
  { subagent_type: 'implementer', description: 'Do the ticket', model: 'sonnet', effort: 'medium' },
  { subagent_type: 'general-purpose', description: 'Fix the flaky test', model: 'sonnet', effort: 'medium' },
  { subagent_type: 'general-purpose', description: 'Build the parser', model: 'sonnet', effort: 'medium' },
  { subagent_type: 'code-reviewer', description: 'Look at it', model: 'opus', effort: 'high' },
  { subagent_type: 'general-purpose', description: 'Audit the auth flow', model: 'opus', effort: 'high' },
  { subagent_type: 'general-purpose', description: 'Verify the claim', model: 'opus', effort: 'high' },
  { subagent_type: 'general-purpose', description: 'Adversarial check', model: 'opus', effort: 'high' },
  { subagent_type: 'security-reviewer', description: 'Check', model: 'opus', effort: 'high' },
  // The agent type outranks the description; review outranks the rest on a tie.
  { subagent_type: 'implementer', description: 'Research a fix', model: 'sonnet', effort: 'medium' },
  { subagent_type: 'general-purpose', description: 'Review and fix the diff', model: 'opus', effort: 'high' },
  { subagent_type: 'general-purpose', description: 'Code review of the change', model: 'opus', effort: 'high' },
  { subagent_type: 'general-purpose', description: 'Review', model: 'opus', effort: 'high' },
] as const

test('the recommendation table', () => {
  for (const row of TABLE) {
    const { subagent_type, description } = row

    expect(recommend({ subagent_type, description })).toEqual({ model: row.model, effort: row.effort })
  }
})

test('an unknown kind inherits the parent', () => {
  expect(recommend({ subagent_type: 'general-purpose', description: 'Plan the week' })).toEqual({
    model: null,
    effort: null,
  })
  expect(recommend({})).toEqual({ model: null, effort: null })
  // The review words open on a word boundary: a preview is not a review.
  expect(recommend({ description: 'Preview the page' })).toEqual({ model: null, effort: null })
  expect(recommend({ description: 'Insecure defaults list' })).toEqual({ model: null, effort: null })
})

test('a long prompt bumps the effort one level, never past max', () => {
  const long = 'x'.repeat(LONG_PROMPT_CHARS + 1)
  const edge = 'x'.repeat(LONG_PROMPT_CHARS)

  expect(recommend({ subagent_type: 'Explore', prompt: long })).toEqual({ model: 'haiku', effort: 'medium' })
  expect(recommend({ subagent_type: 'implementer', prompt: long })).toEqual({ model: 'sonnet', effort: 'high' })
  expect(recommend({ subagent_type: 'code-reviewer', prompt: long })).toEqual({ model: 'opus', effort: 'xhigh' })
  expect(recommend({ subagent_type: 'Explore', prompt: edge })).toEqual({ model: 'haiku', effort: 'low' })
  expect(recommend({ description: 'Plan', prompt: long })).toEqual({ model: null, effort: null })
  expect(bumpEffort('max')).toBe('max')
})

test('what the call set is never overridden', () => {
  const choice = { model: 'haiku', effort: 'low' }

  expect(patchFor({}, choice)).toEqual({ model: 'haiku', effort: 'low' })
  expect(patchFor({ model: 'opus' }, choice)).toEqual({ effort: 'low' })
  expect(patchFor({ effort: 'max' }, choice)).toEqual({ model: 'haiku' })
  expect(patchFor({ model: 'opus', effort: 'max' }, choice)).toEqual({})
  expect(patchFor({}, { model: null, effort: null })).toEqual({})
  expect(hasOpenField({ model: 'opus', effort: 'max' })).toBe(false)
  expect(hasOpenField({ model: 'opus' })).toBe(true)
})

test('fix is a word: fixture and prefix are not fixes', () => {
  const none = { model: null, effort: null }

  expect(recommend({ description: 'Update the fixture data' })).toEqual(none)
  expect(recommend({ description: 'Rename the prefix' })).toEqual(none)
  expect(recommend({ description: 'Fix it' })).toEqual({ model: 'sonnet', effort: 'medium' })
  expect(recommend({ description: 'Fixing the loader' })).toEqual({ model: 'sonnet', effort: 'medium' })
  expect(recommend({ description: 'Several fixes' })).toEqual({ model: 'sonnet', effort: 'medium' })

  for (const text of ['Fixed the loader', 'Hotfix for prod', 'Bugfix round', 'bugfixes']) {
    expect(recommend({ description: text })).toEqual({ model: 'sonnet', effort: 'medium' })
  }
})

test('a default falls back to the recommendation per field', () => {
  const rec = { model: 'opus', effort: 'high' }

  expect(resolveDefault(null, rec)).toEqual(rec)
  expect(resolveDefault({ model: 'haiku', effort: null }, rec)).toEqual({ model: 'haiku', effort: 'high' })
  expect(resolveDefault({ model: null, effort: 'low' }, rec)).toEqual({ model: 'opus', effort: 'low' })
})

test('the first dialog carries the selection in its labels and what to do', () => {
  const call = { subagent_type: 'Explore', description: 'Explore README.md' }
  const dialog = mainDialog(call, { model: 'haiku', effort: 'low' })

  expect(dialog.question).toBe('Run Explore: Explore README.md?')
  expect(dialog.options).toEqual(['Run haiku/low', 'Run haiku/low + save default', 'Change model or effort', 'Cancel'])
  // A value the call set is only the preset of its field: nothing is hidden for it.
  expect(mainDialog({ ...call, model: 'sonnet' }, { model: 'sonnet', effort: 'low' }).options).toEqual([
    'Run sonnet/low',
    'Run sonnet/low + save default',
    'Change model or effort',
    'Cancel',
  ])
  expect(mainDialog(call, { model: null, effort: null }).options).toEqual(['Run as the model asked', 'Change model or effort', 'Cancel'])
  // Where the call set a field and the person inherits both, Run says what happens.
  expect(mainDialog({ ...call, model: 'opus' }, { model: null, effort: null }).options).toEqual([
    `Run ${INHERITED_TEXT}`,
    'Change model or effort',
    'Cancel',
  ])
  expect(mainDialog({ ...call, effort: 'low' }, { model: null, effort: null }).run).toBe(`Run ${INHERITED_TEXT}`)
  expect(mainDialog({ ...call, description: 'd'.repeat(300) }, { model: null, effort: null }).question.length).toBeLessThan(110)
})

test('the first dialog compares labels exactly and reads typed text', () => {
  const dialog = mainDialog({ subagent_type: 'x', description: 'd' }, { model: 'opus', effort: 'high' })

  expect(readMain(dialog, 'Run opus/high')).toEqual({ kind: 'run' })
  expect(readMain(dialog, 'Run opus/high + save default')).toEqual({ kind: 'save' })
  expect(readMain(dialog, 'Change model or effort')).toEqual({ kind: 'change' })
  expect(readMain(dialog, 'Cancel')).toEqual({ kind: 'cancel' })
  expect(readMain(dialog, 'cancel').kind).toBe('unreadable')
  expect(readMain(dialog, 'Run haiku/low').kind).toBe('unreadable')
  expect(readMain(dialog, '').kind).toBe('unreadable')
  expect(readMain(dialog, 'fable/max')).toEqual({ kind: 'typed', choice: { model: 'fable', effort: 'max' } })
  expect(parseChoiceText('opus/ultra')).toBeNull()
  expect(parseChoiceText('opus')).toBeNull()
})

test('the field dialogs: at most four options, a label, or a typed name', () => {
  expect(MODEL_OPTIONS).toEqual(['haiku', 'sonnet', 'opus', 'fable or inherit…'])
  expect(MORE_MODEL_OPTIONS).toEqual(['fable', 'inherit'])
  expect(EFFORT_OPTIONS).toEqual(['low', 'medium', 'high', 'xhigh, max or inherit…'])
  expect(MORE_EFFORT_OPTIONS).toEqual(['xhigh', 'max', 'inherit'])
  for (const options of [MODEL_OPTIONS, EFFORT_OPTIONS, MORE_MODEL_OPTIONS, MORE_EFFORT_OPTIONS]) {
    expect(options.length).toBeLessThanOrEqual(4)
  }
  expect(fieldQuestion({ subagent_type: 'Explore' }, 'model')).toBe('Model for Explore?')
  expect(fieldQuestion({ subagent_type: 'Explore' }, 'effort')).toBe('Effort for Explore?')
  expect(readField('model', 'sonnet')).toBe('sonnet')
  expect(readField('model', ' OPUS ')).toBe('opus')
  expect(readField('model', 'inherit')).toBeNull()
  expect(readField('model', 'gpt')).toBeUndefined()
  expect(readField('effort', 'xhigh, max or inherit…')).toBe('more')
  expect(readField('model', 'fable or inherit…')).toBe('more')
  expect(readField('effort', 'inherit')).toBeNull()
  expect(readField('model', 'fable')).toBe('fable')
  expect(readField('effort', 'MAX')).toBe('max')
  expect(readField('effort', 'ultra')).toBeUndefined()
})

test('the pane header is clipped to the room', () => {
  const entry = { id: 'a', subagentType: 'code-reviewer', description: 'Review the diff', model: null, effort: null, isCallSet: false }

  expect(headerLine(entry, 60)).toBe('code-reviewer · Review the diff')

  for (let columns = 5; columns <= 80; columns += 1) {
    expect(headerLine({ ...entry, description: 'd'.repeat(300) }, columns).length).toBeLessThanOrEqual(columns)
  }
})

// A type the engine offered as a built-in has no definition of its own; any other has one that may
// pin a model and an effort the tuner cannot see.
test('own definition: the offer cache says built-in, or says not', () => {
  const offers = new Map([['Plan', true], ['acme-reviewer', false], ['general-purpose', false]])

  expect(hasOwnDefinition('Plan', offers)).toBe(false)
  expect(hasOwnDefinition('acme-reviewer', offers)).toBe(true)
  // The cache outranks the known names: a user's agent may take a built-in's name.
  expect(hasOwnDefinition('general-purpose', offers)).toBe(true)
})

test('own definition: a type no offer was seen for is judged by its name', () => {
  const offers = new Map<string, boolean>()

  for (const name of ['general-purpose', 'Explore', 'Plan', 'claude', 'statusline-setup', 'claude-code-guide']) {
    expect(hasOwnDefinition(name, offers)).toBe(false)
  }

  expect(hasOwnDefinition('code-reviewer', offers)).toBe(true)
  expect(hasOwnDefinition('explore', offers)).toBe(true)
})

test('own definition: no subagent_type means general-purpose', () => {
  expect(hasOwnDefinition(undefined, new Map())).toBe(false)
  expect(hasOwnDefinition(undefined, new Map([['general-purpose', true]]))).toBe(false)
})
