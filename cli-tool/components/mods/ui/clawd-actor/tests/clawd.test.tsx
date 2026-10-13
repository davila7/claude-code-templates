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
