import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { qrText } from '../hooks/qr'

const RUN = {
  command: 'remote-control',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 80 },
} as const

const FILES = [
  { name: '1.json', kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false },
  { name: '1.abc.key', kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false },
]

const BRIDGE = 'session_01AbCdEfGhIjKlMnOpQrStUv'
const URL = `https://claude.ai/code/${BRIDGE}`
const CODE = (qrText(URL) ?? '').split('\n')
const WIDTH = Array.from(CODE[0] ?? '').length
const HEIGHT = CODE.length + 1
const SCAN = 'Scan with your phone to continue there '
const HINT = `Enlarge the terminal to ${WIDTH}×${HEIGHT} to show the QR Code `
const OTHER = 'other mod'
const BAND = { plugin: 'remote-qr', component: 'AbovePrompt' } as const

const bandProps = (size: { columns?: number; maxRows?: number; bodyRows?: number } = {}) => ({
  hasSurvey: false,
  isWorking: false,
  maxRows: size.maxRows ?? 40,
  bodyColumns: size.columns ?? 80,
  scroll: { offset: 0, bodyRows: size.bodyRows ?? 39 },
  view: {},
})

const texts = async (ui: { findAll: (q: { type: 'Text' }) => Promise<Array<{ text?: string }>> }) =>
  (await ui.findAll({ type: 'Text' })).map(t => t.text)

// Stands for another mod drawing at the same site.
const otherMod = (on: On) =>
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{OTHER}</Text>
  })

const settle = async () => {
  for (let i = 0; i < 7000; i++) await Promise.resolve()
}

type Around = { get?: () => Promise<void>; set?: () => Promise<void> }

// Stands in for the session file and records what the mod writes to its state.
function fakeSession(on: On, bridge: () => string | undefined, sleep = async () => {}, around: Around = {}) {
  const written: unknown[] = []
  const reads: Array<string | undefined> = []
  let onRead: () => void = () => {}
  let onWrite: () => void = () => {}
  on('clock.sleep', async () => {
    await sleep()
    return { value: undefined }
  })
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/home/u' : undefined }))
  on('session.id', () => ({ value: 'local-1' }))
  on('fs.list', () => ({ value: FILES }))
  on('fs.read', () => {
    reads.push(bridge())
    onRead()
    return { value: JSON.stringify({ sessionId: 'local-1', bridgeSessionId: bridge() }) }
  })
  on('state.get', async (_, e, next) => {
    const held = await next(e)
    await around.get?.()
    return held
  })
  on('state.set', async (_, e, next) => {
    await around.set?.()
    written.push(e.value)
    onWrite()
    return next(e)
  })
  const nextRead = () => new Promise<void>(resolve => (onRead = resolve))
  const nextWrite = () => new Promise<void>(resolve => (onWrite = resolve))
  return { written, nextRead, nextWrite }
}

// A session in which each /remote-control connects and so writes the link.
function connecting($: { command: { run: (input: typeof RUN) => Promise<unknown> } }, on: On) {
  let bridge: string | undefined
  const session = fakeSession(on, () => bridge)
  on('command.run', () => {
    bridge = BRIDGE
    return { text: '' }
  })
  const connect = async () => {
    bridge = undefined
    const wrote = session.nextWrite()
    await $.command.run(RUN)
    await wrote
  }
  return { ...session, connect }
}

test('connecting shows the QR Code above the prompt, and Close takes it down', async ($, on) => {
  const { written, connect } = connecting($, on)
  otherMod(on)

  await connect()
  expect(written).toEqual([URL])

  for (const surface of ['terminal', 'desktop'] as const) {
    if (surface !== 'terminal') await connect()
    const ui = await $.ui.mount({ ...BAND, surface, props: bandProps() })
    expect(await texts(ui)).toEqual([SCAN, ...CODE, OTHER])

    await ui.press({ key: 'close' })
    expect(await texts(ui)).toEqual([OTHER])
    await ui.unmount()
  }
})

test('a code that does not fit is replaced by the size it needs', async ($, on) => {
  const { connect } = connecting($, on)
  otherMod(on)
  await connect()

  for (const size of [{ columns: WIDTH - 1 }, { bodyRows: HEIGHT - 1 }]) {
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: bandProps(size) })
    expect(await texts(ui)).toEqual([HINT, OTHER])
    expect(await ui.find({ key: 'close' })).toBeDefined()
    await ui.unmount()
  }
})

test('a code that just fits is drawn', async ($, on) => {
  const { connect } = connecting($, on)
  otherMod(on)
  await connect()

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: bandProps({ columns: WIDTH, bodyRows: HEIGHT }) })

  expect(await texts(ui)).toEqual([SCAN, ...CODE, OTHER])
  await ui.unmount()
})

test('already connected (the menu) shows nothing', async ($, on) => {
  const { written } = fakeSession(on, () => 'session_old')
  on('command.run', () => ({ text: 'Remote Control disconnected.' }))

  const ran = await $.command.run(RUN)

  expect(ran.text).toBe('Remote Control disconnected.')
  expect(written).toEqual([])
})

test('a message sent before the bridge connects keeps the code hidden', async ($, on) => {
  let bridge: string | undefined
  let release = () => {}
  let fellAsleep = () => {}
  const asleep = new Promise<void>(resolve => (fellAsleep = resolve))
  const { written, nextRead } = fakeSession(on, () => bridge, () => {
    fellAsleep()
    return new Promise<void>(resolve => (release = resolve))
  })
  on('command.run', () => ({ text: '' }))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  await $.command.run(RUN)
  await asleep
  await $.prompt.submit({ text: 'next message', wait: false, origin: { kind: 'composer' } })
  bridge = BRIDGE
  let didRead = false
  void nextRead().then(() => (didRead = true))
  release()
  // The loop must stop: either before reading again, or after reading the
  // connected id without writing it. Give a loop that runs on time to write.
  for (let i = 0; i < 5000 && !didRead; i++) await Promise.resolve()
  for (let i = 0; i < 2000; i++) await Promise.resolve()

  expect(written.filter(Boolean)).toEqual([])
})

test('Close ends a wait still in progress', async ($, on) => {
  let bridge: string | undefined
  let release = () => {}
  let fellAsleep = () => {}
  const asleep = new Promise<void>(resolve => (fellAsleep = resolve))
  const { nextWrite } = fakeSession(on, () => bridge, () => {
    fellAsleep()
    return new Promise<void>(resolve => (release = resolve))
  })
  let connects = true
  on('command.run', () => {
    if (connects) bridge = BRIDGE
    return { text: '' }
  })
  otherMod(on)

  // An earlier connection leaves its code up while a second run waits.
  const wrote = nextWrite()
  await $.command.run(RUN)
  await wrote
  connects = false
  bridge = undefined
  await $.command.run(RUN)
  await asleep

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: bandProps() })
  await ui.press({ key: 'close' })
  bridge = BRIDGE
  release()
  await settle()

  await ui.redraw()
  expect(await texts(ui)).toEqual([OTHER])
  await ui.unmount()
})

// The dismissal lands on each side of the check inside the wait's write.
for (const during of ['get', 'set'] as const) {
  test(`a message sent during the write, at state.${during}, still dismisses the code`, async ($, on) => {
    let bridge: string | undefined
    let raced = false
    let finish = () => {}
    const finished = new Promise<void>(resolve => (finish = resolve))
    fakeSession(on, () => bridge, undefined, {
      [during]: async () => {
        if (raced) return
        raced = true
        await $.prompt.submit({ text: 'next message', wait: false, origin: { kind: 'composer' } })
        finish()
      },
    })
    on('command.run', () => {
      bridge = BRIDGE
      return { text: '' }
    })
    on('prompt.submit', (_, e) => ({ text: e.text }))
    otherMod(on)

    await $.command.run(RUN)
    await finished
    await settle()

    const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: bandProps() })
    expect(await texts(ui)).toEqual([OTHER])
    await ui.unmount()
  })
}
