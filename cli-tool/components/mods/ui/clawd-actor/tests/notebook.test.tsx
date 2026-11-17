import { test, expect, mock } from 'claude-code/testing'

const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 60 } as any
const shown = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).join('\n')
const PATH = '/home/me/.claude/clawd-notes.md'
const TEN = new Date(2026, 10, 14, 10, 0).getTime() // 10:00 local, the day the tests run on

/** A session at 10:00 with the notebook in memory (`files`); returns the clock, the band, the toasts and the files. */
const start = async ($: any, on: any, files: Record<string, string> = {}, isUnreadable = false, haiku = '') => {
  const toasts: string[] = []
  const asks: any[] = []
  on('model.complete', ($: any, e: any) => (asks.push(e), { value: { isAnswered: !!haiku, text: haiku } }))
  const clock = mock.clock(on, { now: TEN })
  mock.env(on, { HOME: '/home/me' })
  on('session.start', ($: any, e: any) => ({ cwd: e.cwd }))
  on('command.register', ($: any, e: any) => ({ value: { command: e.name } }))
  on('fs.exists', ($: any, e: any) => ({ value: e.path in files }))
  on('fs.read', ($: any, e: any) => {
    if (isUnreadable) throw new Error('EACCES')
    return { value: files[e.path] ?? '' }
  })
  on('fs.write', ($: any, e: any) => ((files[e.path] = e.text), { value: undefined }))
  on('ui.toast', ($: any, e: any) => (toasts.push(e.text), { value: undefined }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as any)
  const ui = await $.ui.mount({ plugin: 'clawd-actor', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  return { clock, ui, toasts, files, asks }
}
const clawd = async ($: any, clock: any, args: string) => {
  await $.command.run({ command: 'clawd', args } as any)
  await clock.advance(10)
}

test('/clawd note, plan, done and list keep the day in the markdown notebook', async ($, on) => {
  const { clock, ui, files } = await start($, on)
  await clawd($, clock, 'note ask PM about the field')
  await clawd($, clock, 'plan write tests; ship it')
  await clawd($, clock, 'done')
  expect(files[PATH]).toBe('# 2026-11-14\n\n## Notes\n- 10:00 ask PM about the field\n\n## Todo\n- [x] write tests\n- [ ] ship it\n')
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('1 to go')

  await clawd($, clock, 'list')
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('2. ship it')

  await clawd($, clock, 'done 2')
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('All done today!')
  await clawd($, clock, 'done 9')
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('no todo 9')
})

test('what the person wrote in the notebook stays put', async ($, on) => {
  const mine = '# 2026-11-13\n\nmy own thoughts\n'
  const { clock, files } = await start($, on, { [PATH]: mine })
  await clawd($, clock, 'note hi')
  expect(files[PATH]!.startsWith(mine)).toBe(true)
})

test('a reminder is called out 5 minutes ahead and when due, then ticked off', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock, ui, toasts, files } = await start($, on)
  await clawd($, clock, 'remind 10:06 standup') // close by: the mock clock runs every frame between
  expect(files[PATH]).toContain('- [ ] 10:06 standup')
  await clock.advance(30_000) // 10:00:30, six minutes ahead
  expect(toasts).toEqual([])
  await clock.advance(35_000) // 10:01:05, just after the check at 10:01
  expect(toasts).toEqual(['Clawd: In 5 min: standup'])
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('In 5 min: standup')
  await clock.set(TEN + 6 * 60_000 + 1000) // 10:06:01
  expect(toasts.at(-1)).toBe('Clawd: Now: standup')
  expect(files[PATH]).toContain('- [x] 10:06 standup')
  await clock.advance(60_000)
  expect(toasts.length).toBe(2) // once ahead, once due
})

test('every reminder due is called out, missed ones with their time', async ($, on) => {
  const md = '# 2026-11-14\n\n## Reminders\n- [ ] 08:00 coffee\n- [ ] 9:00 standup\n'
  const { clock, toasts, files } = await start($, on, { '/home/me/.claude/clawd-notes.md': md })
  await clock.advance(30_000)
  expect(toasts).toEqual(['Clawd: Missed at 08:00: coffee · Missed at 09:00: standup'])
  expect(files[PATH]).toContain('- [x] 08:00 coffee\n- [x] 9:00 standup')
})

test('a reminder set inside the five minutes is not warned again, only called when due', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock, toasts } = await start($, on)
  await clawd($, clock, 'remind 3m tea')
  await clock.advance(2 * 60_000)
  expect(toasts).toEqual([])
  await clock.set(TEN + 3 * 60_000 + 1000)
  expect(toasts).toEqual(['Clawd: Now: tea'])
})

test('a note that cleans down to nothing is not written', async ($, on) => {
  const { clock, ui, files } = await start($, on)
  await clawd($, clock, 'note \u0001')
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('came out empty')
  expect(files[PATH]).toBeUndefined()
})

test('a reminder for a time already past is refused, and nothing is written', async ($, on) => {
  const { clock, ui, files } = await start($, on)
  await clawd($, clock, 'remind 09:00 standup')
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('already passed')
  expect(files[PATH]).toBeUndefined()
})

test('a turn opens with the next todo in a bubble, at most every half hour', async ($, on) => {
  const { clock, ui } = await start($, on, { [PATH]: '# 2026-11-14\n\n## Todo\n- [x] a\n- [ ] b\n' })
  await $.turn.start({ text: 'hi', turnId: 't1' } as any)
  await clock.advance(10)
  await ui.redraw({ ...BAND, isWorking: true })
  expect(await shown(ui)).toContain('Next up: b')
  await clock.advance(7000)
  await $.turn.start({ text: 'again', turnId: 't2' } as any)
  await clock.advance(10)
  await ui.redraw({ ...BAND, isWorking: true })
  expect(await shown(ui)).not.toContain('Next up')
})

test('a notebook that will not open says so instead of writing over it', async ($, on) => {
  const { clock, ui, files } = await start($, on, { [PATH]: 'x' }, true)
  await clawd($, clock, 'note hi')
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('notebook will not open')
  expect(files[PATH]).toBe('x')
})

test('/clawd todo saves for later; /clawd plan offers picks from it and plan ok takes them on', async ($, on) => {
  const md = '# 2026-11-13\n\n## Todo\n- [ ] left over\n'
  const { clock, ui, files, asks } = await start($, on, { [PATH]: md }, false, '{"picks":[2],"why":"quick win"}')
  await clawd($, clock, 'todo reply to PM')
  expect(files[PATH]!.startsWith('# Inbox\n\n## Todo\n- [ ] reply to PM\n')).toBe(true)

  await clawd($, clock, 'plan')
  expect(asks[0].prompt).toContain('1. [left from 2026-11-13] left over')
  expect(asks[0].prompt).toContain('2. [inbox] reply to PM')
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('1. reply to PM')

  await clawd($, clock, 'plan ok')
  expect(files[PATH]).toContain('- [x] reply to PM → 11-14')
  expect(files[PATH]).toContain('# 2026-11-14\n\n## Todo\n- [ ] reply to PM\n')
  expect(files[PATH]).toContain('- [ ] left over') // not picked, still open
})

test('plan ok with nothing offered asks for a plan first', async ($, on) => {
  const { clock, ui } = await start($, on)
  await clawd($, clock, 'plan ok')
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('/clawd plan')
})

test('when Haiku does not answer, plan offers the oldest todos', async ($, on) => {
  const md = '# Inbox\n\n## Todo\n- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n'
  const { clock, ui } = await start($, on, { [PATH]: md })
  await clawd($, clock, 'plan')
  await ui.redraw(BAND)
  const text = await shown(ui)
  expect(text).toContain('1. a')
  expect(text).toContain('3. c')
  expect(text).not.toContain('4.')
})

test('a Chinese note, reminder and list get Chinese answers; the file keeps its English headings', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock, ui, toasts, files } = await start($, on)
  await clawd($, clock, 'note 等下要問 PM')
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('記好了')
  await clawd($, clock, 'remind 10分 站會')
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('10:10 會提醒你：站會')
  expect(files[PATH]).toContain('## Reminders\n- [ ] 10:10 站會')
  await clawd($, clock, 'list') // no text of its own: the notebook's language
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('今天還沒有待辦')
  await clock.set(TEN + 5 * 60_000 + 5000)
  expect(toasts).toEqual(['Clawd: 5 分鐘後：站會'])
})
