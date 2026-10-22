import { test, expect, mock } from 'claude-code/testing'

const BAND = { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 80 } as any
const shown = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).join('\n')

test('the session timer animates Clawd during a turn; it leaves when the turn ends', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as any)
  await $.turn.start({ text: 'hi', turnId: 't1' } as any)
  const ui = await $.ui.mount({ plugin: 'clawd-actor', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  const frames = new Set<string>()
  for (let i = 0; i < 12; i++) {
    frames.add(await shown(ui))
    await clock.advance(180)
  }
  console.log('distinct frames:', frames.size)
  expect(frames.size).toBeGreaterThan(1)

  await $.turn.complete({ reason: 'answered', turnId: 't1' } as any)
  await ui.redraw({ ...BAND, isWorking: false })
  expect(await shown(ui)).toBe('below')
})

test("a subagent's turn ending (a workflow agent's, say) does not stop the main turn's show", async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as any)
  await $.turn.start({ text: 'hi', turnId: 't1' } as any)
  const ui = await $.ui.mount({ plugin: 'clawd-actor', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  await $.turn.complete({ reason: 'answer', turnId: 'a1', agentId: 'agent-1' } as any)
  const frames = new Set<string>()
  for (let i = 0; i < 12; i++) {
    frames.add(await shown(ui))
    await clock.advance(180)
  }
  expect(frames.size).toBeGreaterThan(1)
})

test('a reload mid-turn (/reload-plugins) keeps the show going where it was', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  // what the module before the reload left in $.state: a turn running since frame 40
  const before = { isTurnRunning: true, turnBase: 40, seed: 1234, played: 3 }
  on('state.get', { key: 'show' }, () => ({ value: { value: before, version: 1 } }))
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as any) // the reloaded module's start, no turn.start
  const ui = await $.ui.mount({ plugin: 'clawd-actor', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  const frames = new Set<string>()
  for (let i = 0; i < 12; i++) {
    frames.add(await shown(ui))
    await clock.advance(180)
  }
  expect(frames.size).toBeGreaterThan(1)
})

test('isWorking on with no turn started keeps the band to the mods beneath', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as any)
  // a command runs (/reload-plugins, say): the engine says isWorking, no turn ever starts
  const ui = await $.ui.mount({ plugin: 'clawd-actor', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  for (let i = 0; i < 4; i++) {
    await clock.advance(180)
    await ui.redraw(BAND)
  }
  expect(await shown(ui)).toBe('below') // one still frame of Clawd would be the flash
})

test('a band mounted before turn.start animates once the turn starts', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as any)
  // mounted while no turn runs: the gate holds the band back, but it reads the frame anyway
  const ui = await $.ui.mount({ plugin: 'clawd-actor', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await shown(ui)).toBe('below')
  await $.turn.start({ text: 'hi', turnId: 't1' } as any)
  const frames = new Set<string>()
  for (let i = 0; i < 12; i++) {
    frames.add(await shown(ui))
    await clock.advance(180)
  }
  expect(frames.size).toBeGreaterThan(1) // the frame's writes keep redelivering the band all turn
})
