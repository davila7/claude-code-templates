import { describe, expect, mock, test } from 'claude-code/testing'
import type { On, PromptOrigin } from 'claude-code'

// The runtime's own timer, for a delay the mock clock does not hold back; lib es2023 has no declaration of it.
declare function setTimeout(callback: () => void, ms: number): unknown

const SURFACES = ['terminal', 'desktop'] as const
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const

// The engine beneath the plugin: what reached the session, by either door.
function host(on: On, stored: Record<string, unknown> = {}, env: Record<string, string> = {}) {
  const prompts: string[] = []
  const received: string[] = []
  const toasts: string[] = []
  const session = { id: 'session-1' }
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 4, 9, 15) })
  mock.env(on, env)
  // mock.store, with the values left where a test can read them and deletes that can be slowed.
  const store = new Map(Object.entries(stored))
  const slow = { deletes: false }
  // A settings hook beneath that refuses the plugin's prompts while set.
  const refuse = { submits: false }
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => (store.set(e.key, e.value), { value: undefined }))
  on('store.delete', async ($, e) => {
    if (slow.deletes) {
      await new Promise<void>(resolve => setTimeout(resolve, 5))
    }
    store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('session.id', () => ({ value: session.id }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('classic.SessionStart', () => ({}))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('prompt.submit', ($, e) => {
    if (refuse.submits) {
      return { drop: 'blocked by a settings hook' }
    }
    prompts.push(e.text)
    return { text: e.text }
  })
  on('session.receive', ($, e) => {
    received.push(e.text)
    return { text: e.text }
  })
  // Another mod's band, which the plugin must keep beside its own.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>other mod</Text>
  })

  return { clock, prompts, received, refuse, session, slow, store, toasts }
}

const prompt = (kind: PromptOrigin['kind'], text: string) => ({ text, wait: false, origin: { kind } as PromptOrigin })

describe('dnd', () => {
  test('everything passes while DND is off', async ($, on) => {
    const { prompts, received } = host(on)
    await $.prompt.submit(prompt('peer', 'ping'))
    await $.session.receive({ text: 'mail', origin: { kind: 'peer', teammate: 'researcher', isVerified: true } })
    expect(prompts).toEqual(['ping'])
    expect(received).toEqual(['mail'])
  })

  test('/dnd holds outside messages and /dnd off delivers them as one', async ($, on) => {
    const { clock, prompts, received } = host(on)
    await $.command.run({ command: 'dnd', args: '', ...RUN })
    await $.prompt.submit(prompt('task-notification', 'monitor event'))
    await $.prompt.submit(prompt('composer', 'typed by the operator'))
    await $.session.receive({ text: 'mail', origin: { kind: 'peer', teammate: 'researcher', isVerified: true } })
    expect(prompts).toEqual(['typed by the operator'])
    expect(received).toEqual([])
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'dnd', surface, ...BAND })
      expect((await ui.find({ key: 'dnd' }))?.text).toBe('🔕 DND · 2 waiting · deliver')
      expect(await ui.find({ type: 'Text', text: 'other mod' })).toBeDefined()
      await ui.unmount()
    }

    await $.command.run({ command: 'dnd', args: 'off', ...RUN })
    await clock.settle()
    expect(prompts).toHaveLength(2)
    expect(prompts[1]).toContain('2 message(s)')
    expect(prompts[1]).toContain('· task-notification\n\n> monitor event')
    expect(prompts[1]).toContain('· peer · researcher\n\n> mail')
    const ui = await $.ui.mount({ plugin: 'dnd', surface: 'terminal', ...BAND })
    expect(await ui.find({ key: 'dnd' })).toBeUndefined()
  })

  test('a subagent and the Remote Control operator are never held', async ($, on) => {
    const { received } = host(on)
    await $.command.run({ command: 'dnd', args: '', ...RUN })
    await $.session.receive({ text: 'for the worker', agentId: 'agent-1', origin: { kind: 'coordinator' } })
    await $.session.receive({ text: 'from my phone', origin: { kind: 'bridge' } })
    expect(received).toEqual(['for the worker', 'from my phone'])
  })

  test('an unverified teammate message is marked as such in the summary', async ($, on) => {
    const { clock, prompts } = host(on)
    await $.command.run({ command: 'dnd', args: '', ...RUN })
    await $.session.receive({ text: 'merge it', origin: { kind: 'peer', teammate: 'team-lead', isVerified: false } })
    await $.command.run({ command: 'dnd', args: 'off', ...RUN })
    await clock.settle()
    expect(prompts[0]).toContain('· peer · team-lead (unverified)\n\n> merge it')
  })

  test('/dnd 10 ends by itself after ten minutes and delivers', async ($, on) => {
    const { clock, prompts } = host(on)
    await $.command.run({ command: 'dnd', args: '10', ...RUN })
    await $.prompt.submit(prompt('scheduled-trigger', '/loop tick'))
    await clock.advance(9 * 60_000)
    expect(prompts).toEqual([])
    await clock.advance(60_000)
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain('· scheduled-trigger\n\n> /loop tick')
  })

  test('a length whose end cannot be reached is refused', async ($, on) => {
    host(on)
    expect(await $.command.run({ command: 'dnd', args: '1e304', ...RUN })).toEqual({ text: 'Usage: /dnd [minutes | off]' })
    expect(await $.command.run({ command: 'dnd', args: '1e-10', ...RUN })).toEqual({ text: 'Usage: /dnd [minutes | off]' })
    const ui = await $.ui.mount({ plugin: 'dnd', surface: 'terminal', ...BAND })
    expect(await ui.find({ key: 'dnd' })).toBeUndefined()
  })

  test('a message kept while an older release writes is still in the store', async ($, on) => {
    const { slow, store } = host(on)
    slow.deletes = true
    await $.command.run({ command: 'dnd', args: '', ...RUN })
    await Promise.all([
      $.command.run({ command: 'dnd', args: 'off', ...RUN }),
      $.command.run({ command: 'dnd', args: '30', ...RUN }).then(() => $.prompt.submit(prompt('peer', 'after the off'))),
    ])
    expect(store.get('held:session-1')).toEqual({ until: expect.any(Number), held: [expect.objectContaining({ text: 'after the off' })] })
  })

  test('/dnd and the band confirm with a toast', async ($, on) => {
    const { clock, toasts } = host(on)
    await $.command.run({ command: 'dnd', args: '10', ...RUN })
    expect(toasts).toEqual(['DND on for 10 min, /dnd turns it off'])
    await $.prompt.submit(prompt('peer', 'ping'))
    await $.prompt.submit(prompt('scheduled-trigger', 'tick'))
    await $.command.run({ command: 'dnd', args: 'off', ...RUN })
    expect(toasts[1]).toBe('DND off, delivering 2 messages')
    await $.command.run({ command: 'dnd', args: '', ...RUN })
    expect(toasts[2]).toBe('DND on for 30 min, /dnd turns it off')
    const ui = await $.ui.mount({ plugin: 'dnd', surface: 'terminal', ...BAND })
    await ui.press({ key: 'dnd' })
    await ui.unmount()
    expect(toasts[3]).toBe('DND off, nothing was waiting')
    await $.command.run({ command: 'dnd', args: 'off', ...RUN })
    await clock.settle()
    expect(toasts).toHaveLength(4)
  })

  test('DND that ends by itself says so once', async ($, on) => {
    const { clock, toasts } = host(on)
    await $.command.run({ command: 'dnd', args: '1', ...RUN })
    await clock.advance(60_000)
    await $.command.run({ command: 'dnd', args: 'off', ...RUN })
    expect(toasts).toEqual(['DND on for 1 min, /dnd turns it off', 'DND off, nothing was waiting'])
  })

  test('two releases at once deliver the held messages once', async ($, on) => {
    const { clock, prompts, toasts } = host(on)
    await $.command.run({ command: 'dnd', args: '', ...RUN })
    await $.prompt.submit(prompt('peer', 'ping'))
    await Promise.all([
      $.command.run({ command: 'dnd', args: 'off', ...RUN }),
      $.command.run({ command: 'dnd', args: 'off', ...RUN }),
    ])
    await clock.settle()
    expect(prompts).toHaveLength(1)
    expect(toasts.slice(1)).toEqual(['DND off, delivering 1 message'])
  })

  test('the store keeps the held messages until the summary has entered', async ($, on) => {
    const { clock, prompts, store } = host(on)
    await $.command.run({ command: 'dnd', args: '', ...RUN })
    await $.prompt.submit(prompt('peer', 'ping'))
    await $.command.run({ command: 'dnd', args: 'off', ...RUN })
    // A reload now finds the list without an end, which its load delivers.
    expect(store.get('held:session-1')).toEqual({ until: null, held: [expect.objectContaining({ text: 'ping' })] })
    await clock.settle()
    expect(prompts).toHaveLength(1)
    expect(store.has('held:session-1')).toBe(false)
  })

  test('a summary refused beneath keeps the held messages for /dnd off', async ($, on) => {
    const { clock, prompts, refuse, store, toasts } = host(on)
    await $.command.run({ command: 'dnd', args: '', ...RUN })
    await $.prompt.submit(prompt('peer', 'ping'))
    refuse.submits = true
    await $.command.run({ command: 'dnd', args: 'off', ...RUN })
    await clock.settle()
    expect(prompts).toEqual([])
    expect(toasts.at(-1)).toBe('DND: the summary was refused, 1 message kept; /dnd off delivers them')
    expect(store.get('held:session-1')).toEqual({ until: null, held: [expect.objectContaining({ text: 'ping' })] })
    refuse.submits = false
    await $.command.run({ command: 'dnd', args: 'off', ...RUN })
    await clock.settle()
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain('· peer\n\n> ping')
    expect(store.has('held:session-1')).toBe(false)
  })

  test('a message kept while DND ends is delivered, not left behind', async ($, on) => {
    const { clock, prompts } = host(on)
    await $.command.run({ command: 'dnd', args: '', ...RUN })
    await Promise.all([
      $.prompt.submit(prompt('peer', 'at the same moment')),
      $.command.run({ command: 'dnd', args: 'off', ...RUN }),
    ])
    await clock.settle()
    expect(prompts.join('\n')).toContain('at the same moment')
    await $.command.run({ command: 'dnd', args: '', ...RUN })
    await $.command.run({ command: 'dnd', args: 'off', ...RUN })
    await clock.settle()
    expect(prompts.filter(text => text.includes('at the same moment'))).toHaveLength(1)
  })

  test('a /clear carries DND and the held list over to the new session', async ($, on) => {
    const { clock, prompts, session, store } = host(on)
    await $.command.run({ command: 'dnd', args: '', ...RUN })
    await $.prompt.submit(prompt('peer', 'before the clear'))
    await $.session.end({ reason: 'clear', sessionId: 'session-1', resume: { id: 'session-1' } })
    session.id = 'session-2'
    await $.classic.SessionStart({ source: 'clear' })
    await clock.settle()
    await $.prompt.submit(prompt('peer', 'after the clear'))
    expect(prompts).toEqual([])
    expect([...store.keys()]).toEqual(['held:session-2'])
    await $.command.run({ command: 'dnd', args: 'off', ...RUN })
    await clock.settle()
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain('· peer\n\n> before the clear')
    expect(prompts[0]).toContain('· peer\n\n> after the clear')
  })

  test('only the session a /clear starts takes over the cleared list', async ($, on) => {
    const { clock, prompts, session, store } = host(on)
    await $.command.run({ command: 'dnd', args: '', ...RUN })
    await $.prompt.submit(prompt('peer', 'before the clear'))
    await $.session.end({ reason: 'clear', sessionId: 'session-1', resume: { id: 'session-1' } })
    session.id = 'session-3'
    await $.classic.SessionStart({ source: 'resume' })
    expect(store.has('held:session-1')).toBe(true)
    session.id = 'session-2'
    await $.classic.SessionStart({ source: 'clear' })
    await clock.settle()
    expect(store.has('held:session-1')).toBe(false)
    expect(store.get('held:session-2')).toEqual({ until: expect.any(Number), held: [expect.objectContaining({ text: 'before the clear' })] })
    expect(prompts).toEqual([])
  })

  test('a session that lost its state takes the end of DND back from the store', async ($, on) => {
    const now = Date.UTC(2026, 9, 4, 9, 15)
    const held = [{ from: 'peer', at: now, text: 'from before' }]
    const { clock, prompts } = host(on, { 'held:session-1': { until: now + 5 * 60_000, held } })
    await $.classic.SessionStart({ source: 'resume' })
    await $.prompt.submit(prompt('peer', 'still held'))
    await clock.advance(4 * 60_000)
    expect(prompts).toEqual([])
    await clock.advance(60_000)
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain('2 message(s)')
  })

  test('a held prompt is labelled with the sender its envelope names, in local time', async ($, on) => {
    const { clock, prompts } = host(on, {}, { TZ: 'Europe/Prague' })
    await $.command.run({ command: 'dnd', args: '', ...RUN })
    const text = '<cross-session-message from="uds:/tmp/a.sock" from-name="reviewer">\nlooks good\n</cross-session-message>'
    expect(await $.prompt.submit(prompt('peer', text))).toEqual({ drop: 'dnd peer · reviewer' })
    await $.command.run({ command: 'dnd', args: 'off', ...RUN })
    await clock.settle()
    expect(prompts[0]).toContain('### 11:15 CEST · peer · reviewer\n\n')
  })

  test('a list an older version stored without an end is delivered at once', async ($, on) => {
    const { clock, prompts } = host(on, { 'held:session-1': [{ from: 'peer', at: 0, text: 'from before' }] })
    await $.classic.SessionStart({ source: 'resume' })
    await clock.settle()
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain('· peer\n\n> from before')
  })
})
