import { test, expect, mock } from 'claude-code/testing'
import { bubble, cells, clean, parseClawd } from '../hooks/chat'

const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 60 } as any
const shown = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).join('\n')

test('a lone action word acts, anything else chats, nothing at all asks for help', () => {
  expect(parseClawd('pet')).toEqual({ action: 'pet' })
  expect(parseClawd('  DANCE ')).toEqual({ action: 'disco' })
  expect(parseClawd('hi')).toEqual({ action: 'wave' })
  expect(parseClawd('hi there')).toEqual({ chat: 'hi there' })
  expect(parseClawd('   ')).toEqual({ help: true })
})

test('the bubble fits its width in any script and never carries escape sequences', () => {
  for (const text of ['Hello there, little friend of the terminal, how is your day going so far?', '你好呀！我正在看 Claude 幫你整理測試檔案，看起來很順利喔～', 'x'.repeat(200)])
    for (const width of [24, 40, 60]) {
      const lines = bubble(text, width)
      expect(lines.length).toBeLessThanOrEqual(5) // three lines of text and the two borders
      for (const l of lines) expect(cells(l)).toBeLessThanOrEqual(width)
      expect(new Set(lines.map(cells)).size).toBe(1) // a straight box
    }
  expect(bubble('a very long reply that will not fit on one short line at all', 24, 1)[1]).toContain('…')
  expect(clean('hi\u001b[31m there\u0007')).toBe('hi [31m there')
})

const start = async ($: any, on: any) => {
  const clock = mock.clock(on)
  on('session.start', ($: any, e: any) => ({ cwd: e.cwd }))
  on('command.register', ($: any, e: any) => ({ value: { command: e.name } }))
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as any)
  const ui = await $.ui.mount({ plugin: 'clawd-actor', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  return { clock, ui }
}
const settle = async (until: () => Promise<boolean>) => {
  for (let i = 0; i < 50 && !(await until()); i++) await new Promise(r => setTimeout(r, 10))
}

test('/clawd pet brings Clawd out between turns with hearts, then it goes', async ($, on) => {
  const { clock, ui } = await start($, on)
  expect(await shown(ui)).toBe('below') // no turn, no Clawd
  await $.command.run({ command: 'clawd', args: 'pet' } as any)
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('♥')
  await clock.advance(7000)
  await ui.redraw(BAND)
  expect(await shown(ui)).toBe('below')
})

test('/clawd with a message asks Haiku as Clawd and shows the answer in a bubble', async ($, on) => {
  const asked: any[] = []
  on('model.complete', ($, e) => (asked.push(e), { value: { isAnswered: true, text: 'Busy watching Claude, but hi!', usage: {} } }))
  const { clock, ui } = await start($, on)
  await $.command.run({ command: 'clawd', args: 'how are you?' } as any)
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('· · ·') // pondering first
  await clock.advance(200)
  await settle(async () => (await ui.redraw(BAND), (await shown(ui)).includes('Busy watching')))
  expect(await shown(ui)).toContain('Busy watching Claude, but hi!')
  expect(asked[0].model).toBe('haiku')
  expect(asked[0].prompt).toBe('how are you?')
  expect(String(asked[0].system)).toContain('You are Clawd')
})

test('when the model fails Clawd still answers', async ($, on) => {
  on('model.complete', () => ({ value: { isAnswered: false, reason: 'empty-reply', usage: {} } }))
  const { clock, ui } = await start($, on)
  await $.command.run({ command: 'clawd', args: 'hello there' } as any)
  await clock.advance(200)
  await settle(async () => (await ui.redraw(BAND), (await shown(ui)).includes('Try again')))
  expect(await shown(ui)).toContain('Try again?')
})
