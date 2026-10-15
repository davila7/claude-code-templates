// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { ABORTER, BUILD, CHANGE, CUSTOM, MAIN, REVIEW, SAVE_LABEL, SEARCH, UNTOUCHED, drawn, engine, offerAgent, start } from './harness'

test('chain: the first dialog names the agent and carries the selection and what to do', async ($, on) => {
  const { asked, seen, diagnostics } = engine(on)

  await start($)
  await $.tool.call(REVIEW)

  expect(asked).toHaveLength(1)
  expect(asked[0]).toEqual({
    question: 'Run code-reviewer: Review the diff?',
    header: 'Subagent',
    labels: ['Run opus/high', 'Run opus/high + save default', 'Change model or effort', 'Cancel'],
  })
  expect(seen[0]).toMatchObject({ model: 'opus', effort: 'high' })
  expect(diagnostics).toEqual(['Subagent tuner: pane unavailable: no shell to wait in'])
})

test('manual: Cancel denies with the exact text and runs nothing', async ($, on) => {
  const { seen } = engine(on, { reply: () => 'Cancel' })

  await start($)

  expect(await $.tool.call(REVIEW)).toMatchObject({ deny: 'cancelled by user' })
  expect(seen).toEqual([])
})

test('manual: free text is read as model/effort or model effort', async ($, on) => {
  const answers = ['sonnet/xhigh', 'Haiku  max']
  const { seen } = engine(on, { reply: () => answers.shift()! })

  await start($)
  await $.tool.call(REVIEW)
  await $.tool.call(BUILD)

  expect(seen[0]).toMatchObject({ model: 'sonnet', effort: 'xhigh' })
  expect(seen[1]).toMatchObject({ model: 'haiku', effort: 'max' })
})

test('manual: free text that is no choice starts nothing, and says why', async ($, on) => {
  const texts = ['gpt/ultra', 'cancel', '   ']
  const { seen, toasts } = engine(on, { reply: () => texts.shift()! })

  await start($)

  for (let call = 0; call < 3; call += 1) {
    expect(await $.tool.call(REVIEW)).toMatchObject({ deny: 'could not read the answer; nothing was started' })
  }

  expect(seen).toEqual([])
  expect(toasts).toHaveLength(3)
  expect(toasts[0]).toBe('Subagent tuner: could not read "gpt/ultra" as model/effort; nothing was started')
})

test('manual: typed fable is a model', async ($, on) => {
  const { seen } = engine(on, { reply: () => 'fable/low' })

  await start($)
  await $.tool.call(REVIEW)

  expect(seen[0]).toMatchObject({ model: 'fable', effort: 'low' })
})

test('manual: the save option is offered where the call set a field, and the label shows the call\'s value', async ($, on) => {
  const { asked } = engine(on)

  await start($)
  await $.tool.call({ ...REVIEW, model: 'sonnet' })

  expect(asked[0]!.labels).toEqual(['Run sonnet/high', 'Run sonnet/high + save default', 'Change model or effort', 'Cancel'])
})

test('manual: the save option stores the recommendation as the default', async ($, on) => {
  const { seen, store } = engine(on, { reply: (_q, labels) => labels[1]! })

  await start($)
  await $.tool.call(BUILD)

  expect(seen[0]).toMatchObject({ model: 'sonnet', effort: 'medium' })
  expect(store.get('saved')).toEqual({ model: 'sonnet', effort: 'medium' })
})

test('manual: a typed answer replaces what the call set (the person decides)', async ($, on) => {
  const { seen } = engine(on, { reply: () => 'haiku/low' })

  await start($)
  await $.tool.call({ ...REVIEW, model: 'opus' })

  expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'low' })
})

test('manual: a dismissed dialog fails open to the default or recommendation', async ($, on) => {
  const { seen, toasts } = engine(on, { reply: () => ({ dismissed: true }) })

  await start($)
  await $.tool.call(REVIEW)

  expect(seen[0]).toMatchObject({ model: 'opus', effort: 'high' })
  expect(toasts).toEqual(['Subagent (no answer) -> opus/high'])
})

// A -p run or an SDK host draws nothing: nobody there chose a mode or a default,
// and a model changed behind its back would skew what the run measures.
for (const mode of ['manual', 'auto'] as const) {
  test(`where nothing draws (-p) the call goes through untouched: ${mode}`, async ($, on) => {
    const { seen, asked, toasts } = engine(on, { surfaces: [], store: { mode, saved: { model: 'haiku', effort: 'low' } } })

    await start($)
    await $.tool.call(REVIEW)

    expect(asked).toEqual([])
    expect(seen).toEqual([UNTOUCHED(REVIEW.description)])
    expect(toasts).toEqual([])
  })
}

test('three concurrent calls each get their own answer, none lost or crossed', async ($, on) => {
  const delays: Record<string, number> = { 'Review the diff': 300, 'Build the parser': 100, 'Search the repo': 200 }
  const answers: Record<string, string> = {
    'Review the diff': 'Cancel',
    'Build the parser': 'haiku/max',
    'Search the repo': 'opus high',
  }
  const { clock, seen, asked } = engine(on, {
    reply: async question => {
      const description = Object.keys(delays).find(one => question.includes(one))!

      await clock.sleep(delays[description]!)

      return answers[description]!
    },
  })

  await start($)

  const calls = [$.tool.call(REVIEW), $.tool.call(BUILD), $.tool.call(SEARCH)]

  await clock.advance(1000)

  const results = await Promise.all(calls)

  expect(asked).toHaveLength(3)
  // Results come back in call order, each for its own call.
  expect(results[0]).toMatchObject({ deny: 'cancelled by user' })
  expect(results[1]).toMatchObject({ result: { ok: true } })
  expect(results[2]).toMatchObject({ result: { ok: true } })
  // The engine saw them as their dialogs finished: Build (100) before Search (200).
  expect(seen).toEqual([
    { model: 'haiku', effort: 'max', description: 'Build the parser' },
    { model: 'opus', effort: 'high', description: 'Search the repo' },
  ])
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`manual asks where the band can be drawn: ${surface}`, async ($, on) => {
    const { asked } = engine(on, { surfaces: [surface] })

    await start($)
    await $.tool.call(REVIEW)

    expect(asked).toHaveLength(1)
  })
}

for (const surfaces of [['vscode'], ['mobile'], ['vscode', 'mobile']] as const) {
  test(`manual never asks where the band cannot be drawn: ${surfaces.join('+') || 'none'}`, async ($, on) => {
    const { asked, seen, toasts } = engine(on, { surfaces })

    await start($)
    await $.tool.call(REVIEW)

    expect(asked).toEqual([])
    expect(seen[0]).toMatchObject({ model: 'opus', effort: 'high' })
    expect(toasts).toEqual(['Subagent -> opus/high'])
  })
}

test('a long agent type does not stretch the question', async ($, on) => {
  const { asked } = engine(on)

  await start($)
  await $.tool.call({ ...REVIEW, subagent_type: 'x'.repeat(309) })

  expect(asked[0]!.question.length).toBeLessThan(140)
})

test('a dismissed dialog applies the saved default, not the recommendation', async ($, on) => {
  const { seen } = engine(on, { store: { saved: { model: 'haiku', effort: 'low' } }, reply: () => ({ dismissed: true }) })

  await start($)
  await $.tool.call(REVIEW)

  expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'low' })
})

test('a launch that fails after it began is not started twice', async ($, on) => {
  const { seen } = engine(on, { store: { mode: 'auto' }, agentThrows: true })

  await start($)
  await $.tool.call(REVIEW).catch(() => undefined)

  expect(seen).toHaveLength(1)
})

// The fallback dialog: fixed options, asked where the pane cannot be shown (the
// engine mock has no process hook here, so no sentinel can be made).

test('dialog: Run and save as default stores the selection, over a saved default', async ($, on) => {
  const { seen, store } = engine(on, {
    store: { saved: { model: 'haiku', effort: 'low' } },
    reply: (_question, labels) => labels.find(label => label.includes('save default'))!,
  })

  await start($)
  await $.tool.call(REVIEW)

  // The preset is the saved default: saving it again changes nothing.
  expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'low' })
  expect(store.get('saved')).toEqual({ model: 'haiku', effort: 'low' })
})

test('dialog: Run leaves a partial default exactly as it was, and applies it per field', async ($, on) => {
  const { seen, store } = engine(on, { store: { saved: { model: 'sonnet', effort: null } } })

  await start($)
  await $.tool.call(REVIEW)

  expect(seen[0]).toMatchObject({ model: 'sonnet', effort: 'high' })
  expect(store.get('saved')).toEqual({ model: 'sonnet', effort: null })
})

test('chain: the presets are the saved default per field, else the recommendation, else inherit', async ($, on) => {
  const { asked } = engine(on, { store: { saved: { model: 'haiku', effort: null } }, reply: () => 'Cancel' })

  await start($)
  await $.tool.call(REVIEW)
  await $.tool.call({ tool: 'Agent', description: 'Plan the week', prompt: 'p' })

  expect(asked[0]!.labels[0]).toBe('Run haiku/high')
  expect(asked[1]!.labels[0]).toBe('Run haiku/inherit')
})

test('chain: with no recommendation and no default the label says so', async ($, on) => {
  const { asked, seen } = engine(on)

  await start($)
  await $.tool.call({ tool: 'Agent', description: 'Plan the week', prompt: 'p' })

  expect(asked[0]!.labels).toEqual(['Run as the model asked', CHANGE, 'Cancel'])
  expect(seen[0]).toEqual(UNTOUCHED('Plan the week'))
})

test('chain: Change model or effort asks Model, then Effort, then the first dialog again with the new values', async ($, on) => {
  const { asked, seen } = engine(on, { script: [CHANGE, 'sonnet', 'medium', MAIN] })

  await start($)
  await $.tool.call(REVIEW)

  expect(asked.map(one => one.header)).toEqual(['Subagent', 'Model', 'Effort', 'Subagent'])
  expect(asked[1]).toMatchObject({ question: 'Model for code-reviewer?', labels: ['haiku', 'sonnet', 'opus', 'fable or inherit…'] })
  expect(asked[2]).toMatchObject({ question: 'Effort for code-reviewer?', labels: ['low', 'medium', 'high', 'xhigh, max or inherit…'] })
  expect(asked[3]!.labels[0]).toBe('Run sonnet/medium')
  expect(seen).toEqual([{ model: 'sonnet', effort: 'medium', description: 'Review the diff' }])
})

test('chain: more than one change is allowed, each shown in the labels', async ($, on) => {
  const { asked, seen } = engine(on, { script: [CHANGE, 'haiku', 'low', CHANGE, 'fable', 'high', MAIN] })

  await start($)
  await $.tool.call(REVIEW)

  expect(asked.filter(one => one.header === 'Subagent').map(one => one.labels[0])).toEqual(['Run opus/high', 'Run haiku/low', 'Run fable/high'])
  expect(seen[0]).toMatchObject({ model: 'fable', effort: 'high' })
})

for (const high of ['xhigh', 'max']) {
  test(`chain: the effort dialog's fourth option opens the last one: ${high}`, async ($, on) => {
    const { asked, seen } = engine(on, { script: [CHANGE, 'opus', 'xhigh, max or inherit…', high, MAIN] })

    await start($)
    await $.tool.call(REVIEW)

    expect(asked.map(one => one.header)).toEqual(['Subagent', 'Model', 'Effort', 'Effort', 'Subagent'])
    expect(asked[3]!.labels).toEqual(['xhigh', 'max', 'inherit'])
    expect(asked[4]!.labels[0]).toBe(`Run opus/${high}`)
    expect(seen[0]).toMatchObject({ model: 'opus', effort: high })
  })
}

test('chain: fable is reached by the Model dialog\'s fourth option', async ($, on) => {
  const { asked, seen } = engine(on, { script: [CHANGE, 'fable or inherit…', 'fable', 'low', MAIN] })

  await start($)
  await $.tool.call(REVIEW)

  expect(asked.map(one => one.header)).toEqual(['Subagent', 'Model', 'Model', 'Effort', 'Subagent'])
  expect(asked[2]!.labels).toEqual(['fable', 'inherit'])
  expect(seen[0]).toMatchObject({ model: 'fable', effort: 'low' })
})

test('chain: inherit is clickable in both dialogs: the label and the launch drop both fields', async ($, on) => {
  const { asked, seen } = engine(on, { script: [CHANGE, 'fable or inherit…', 'inherit', 'xhigh, max or inherit…', 'inherit', MAIN] })

  await start($)
  await $.tool.call({ ...REVIEW, model: 'opus' })

  expect(asked.at(-1)!.labels[0]).toBe('Run with inherited model and effort')
  expect(seen[0]!.model).toBeUndefined()
  expect(seen[0]!.effort).toBeUndefined()
})

test('chain: inherit/inherit says "as the model asked" only where the call set nothing', async ($, on) => {
  const bare = { tool: 'Agent', description: 'Plan the week', prompt: 'p' } as const
  const none = engine(on, { script: [CHANGE, 'haiku', 'low', CHANGE, 'fable or inherit…', 'inherit', 'xhigh, max or inherit…', 'inherit', MAIN] })

  await start($)
  await $.tool.call(bare)

  const runs = none.asked.filter(one => one.header === 'Subagent').map(one => one.labels[0])

  expect(runs).toEqual(['Run as the model asked', 'Run haiku/low', 'Run as the model asked'])
  expect(none.seen[0]).toEqual(UNTOUCHED('Plan the week'))
})

test('chain: a model the call set is the preset, and Change opens the Model dialog with all four models', async ($, on) => {
  const { asked, seen } = engine(on, { script: [CHANGE, 'haiku', 'low', MAIN] })

  await start($)
  await $.tool.call({ ...REVIEW, model: 'opus' })

  expect(asked.map(one => one.header)).toEqual(['Subagent', 'Model', 'Effort', 'Subagent'])
  expect(asked[0]!.labels).toEqual(['Run opus/high', 'Run opus/high + save default', CHANGE, 'Cancel'])
  expect(asked[1]!.labels).toEqual(['haiku', 'sonnet', 'opus', 'fable or inherit…'])
  expect(asked[3]!.labels[0]).toBe('Run haiku/low')
  expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'low' })
})

test('chain: an effort the call set is the preset, and Change opens the Effort dialog', async ($, on) => {
  const { asked, seen } = engine(on, { script: [CHANGE, 'haiku', 'medium', MAIN] })

  await start($)
  await $.tool.call({ ...REVIEW, effort: 'max' })

  expect(asked.map(one => one.header)).toEqual(['Subagent', 'Model', 'Effort', 'Subagent'])
  expect(asked[0]!.labels[0]).toBe('Run opus/max')
  expect(asked[2]!.labels).toEqual(['low', 'medium', 'high', 'xhigh, max or inherit…'])
  expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'medium' })
})

test('chain: Run and save stores exactly the final selection even where a field came from the call', async ($, on) => {
  const { seen, store } = engine(on, { script: [CHANGE, 'sonnet', 'low', labels => labels.find(label => label.includes('save default'))!] })

  await start($)
  await $.tool.call({ ...REVIEW, model: 'opus' })

  expect(seen[0]).toMatchObject({ model: 'sonnet', effort: 'low' })
  expect(store.get('saved')).toEqual({ model: 'sonnet', effort: 'low' })
})

test('chain: save from the call\'s own preset stores what the label shows', async ($, on) => {
  const { seen, store } = engine(on, { reply: SAVE_LABEL })

  await start($)
  await $.tool.call({ ...REVIEW, model: 'fable' })

  expect(seen[0]).toMatchObject({ model: 'fable', effort: 'high' })
  expect(store.get('saved')).toEqual({ model: 'fable', effort: 'high' })
})

test('chain: picking inherit for a field the call set drops it from the call', async ($, on) => {
  const { seen } = engine(on, { script: [CHANGE, 'inherit', 'low', MAIN] })

  await start($)
  await $.tool.call({ ...REVIEW, model: 'opus' })

  expect(seen[0]).toMatchObject({ effort: 'low' })
  expect(seen[0]!.model).toBeUndefined()
})

test('chain: Run and save stores exactly the final selection', async ($, on) => {
  const { seen, store } = engine(on, { script: [CHANGE, 'haiku', 'low', labels => labels.find(label => label.includes('save default'))!] })

  await start($)
  await $.tool.call(REVIEW)

  expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'low' })
  expect(store.get('saved')).toEqual({ model: 'haiku', effort: 'low' })
})

test('chain: Cancel denies, after a change too, and starts nothing', async ($, on) => {
  const { seen, store } = engine(on, { script: [CHANGE, 'haiku', 'low', 'Cancel'] })

  await start($)

  expect(await $.tool.call(REVIEW)).toMatchObject({ deny: 'cancelled by user' })
  expect(seen).toEqual([])
  expect(store.has('saved')).toBe(false)
})

for (const [at, script, expected] of [
  [1, [{ dismissed: true }], { model: 'opus', effort: 'high' }],
  [5, [CHANGE, 'haiku', 'low', { dismissed: true }], { model: 'haiku', effort: 'low' }],
] as const) {
  test(`chain: the first dialog dismissed fails open, launching once (step ${at})`, async ($, on) => {
    const { seen, toasts } = engine(on, { script })

    await start($)
    await $.tool.call(REVIEW)

    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject(expected)
    expect(toasts.at(-1)).toContain('(no answer)')
  })
}

// A field dialog dismissed discards the whole change: back to the first dialog
// with the selection as it was before Change.
for (const [at, script] of [
  [2, [CHANGE, { dismissed: true }]],
  [3, [CHANGE, 'haiku', { dismissed: true }]],
  [4, [CHANGE, 'haiku', 'xhigh, max or inherit…', { dismissed: true }]],
  [6, [CHANGE, 'fable or inherit…', { dismissed: true }]],
] as const) {
  test(`chain: a field dialog dismissed returns to the first dialog with the original selection (step ${at})`, async ($, on) => {
    const { asked, seen, toasts } = engine(on, { script })

    await start($)
    await $.tool.call(REVIEW)

    const first = asked.filter(one => one.header === 'Subagent')

    expect(first).toHaveLength(2)
    expect(first[1]!.labels[0]).toBe('Run opus/high')
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ model: 'opus', effort: 'high' })
    expect(toasts).toEqual([])
  })
}

test('chain: typed text in the first dialog is a model/effort, or starts nothing', async ($, on) => {
  const typed = engine(on, { script: ['sonnet/low'] })

  await start($)
  await $.tool.call(REVIEW)
  expect(typed.seen[0]).toMatchObject({ model: 'sonnet', effort: 'low' })
})

test('chain: unreadable text in the first dialog starts nothing and says so', async ($, on) => {
  const { seen, toasts } = engine(on, { script: ['gibberish'] })

  await start($)

  expect(await $.tool.call(REVIEW)).toMatchObject({ deny: 'could not read the answer; nothing was started' })
  expect(seen).toEqual([])
  expect(toasts[0]).toContain('could not read "gibberish"')
})

test('chain: text typed in the field dialogs is a value of that field', async ($, on) => {
  const { seen } = engine(on, { script: [CHANGE, 'Haiku', 'MAX', MAIN] })

  await start($)
  await $.tool.call(REVIEW)

  expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'max' })
})

test('chain: text that names no value is asked once more, then the previous value stays', async ($, on) => {
  const { asked, seen } = engine(on, { script: [CHANGE, 'gpt', 'gpt', 'ultra', 'high', MAIN] })

  await start($)
  await $.tool.call(REVIEW)

  // Model: asked twice, then opus stays. Effort: 'ultra' then 'high'.
  expect(asked.map(one => one.header)).toEqual(['Subagent', 'Model', 'Model', 'Effort', 'Effort', 'Subagent'])
  expect(seen[0]).toMatchObject({ model: 'opus', effort: 'high' })
})

test('chain: a second attempt that is readable is taken', async ($, on) => {
  const { seen } = engine(on, { script: [CHANGE, 'gpt', 'haiku', 'low', MAIN] })

  await start($)
  await $.tool.call(REVIEW)

  expect(seen[0]).toMatchObject({ model: 'haiku', effort: 'low' })
})

test('chain: several launches at once keep their own selection (the mock does not serialize dialogs)', async ($, on) => {
  const turns: Record<string, number> = {}
  const { seen, asked } = engine(on, {
    reply: (question, labels) => {
      const agent = ['code-reviewer', 'implementer', 'Explore'].find(one => question.includes(one))!
      const turn = (turns[agent] = (turns[agent] ?? 0) + 1)

      if (agent === 'code-reviewer') {
        return turn === 1 ? CHANGE : question.startsWith('Model') ? 'fable' : question.startsWith('Effort') ? 'low' : labels[0]!
      }

      return agent === 'Explore' ? 'Cancel' : labels[0]!
    },
  })

  await start($)

  const results = await Promise.all([$.tool.call(REVIEW), $.tool.call(BUILD), $.tool.call(SEARCH)])

  expect(results[2]).toMatchObject({ deny: 'cancelled by user' })
  expect(seen.find(one => one.description === 'Review the diff')).toMatchObject({ model: 'fable', effort: 'low' })
  expect(seen.find(one => one.description === 'Build the parser')).toMatchObject({ model: 'sonnet', effort: 'medium' })
  expect(seen).toHaveLength(2)
  expect(asked.length).toBeGreaterThanOrEqual(6)
})

test('chain: Run and save stores a partial selection exactly (the model only)', async ($, on) => {
  const { seen, store } = engine(on, {
    store: { saved: { model: 'haiku', effort: null } },
    script: [CHANGE, 'sonnet', 'xhigh, max or inherit…', 'inherit', labels => labels.find(label => label.includes('save default'))!],
  })

  await start($)
  await $.tool.call({ tool: 'Agent', description: 'Plan the week', prompt: 'p' })

  expect(seen[0]).toMatchObject({ model: 'sonnet' })
  expect(seen[0]!.effort).toBeUndefined()
  expect(store.get('saved')).toEqual({ model: 'sonnet', effort: null })
})

test('chain: a dispatch aborted while a dialog was open starts nothing', { plugins: [ABORTER] }, async ($, on) => {
  let release!: () => void
  const gate = new Promise<void>(done => {
    release = done
  })
  const { clock, seen } = engine(on, {
    reply: async (_question, labels) => {
      await gate

      return labels[0]!
    },
  })

  await start($)

  const call = $.tool.call(REVIEW)

  await clock.settle()
  await clock.advance(1000)
  expect(await call).toMatchObject({ deny: 'abandoned' })
  release()
  await clock.settle()

  expect(seen).toEqual([])
})

test('chain: a custom agent is preselected as inherit, and Run starts the call unchanged', async ($, on) => {
  const { asked, seen } = engine(on)

  await start($)
  await offerAgent($, 'acme-reviewer')
  await $.tool.call(CUSTOM)

  expect(asked[0]!.labels).toEqual(['Run as the model asked', CHANGE, 'Cancel'])
  expect(seen).toEqual([UNTOUCHED('Review the diff')])
})
