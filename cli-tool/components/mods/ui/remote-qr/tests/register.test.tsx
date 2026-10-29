import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

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

// Stands in for the session file and records what the mod writes to its state.
function fakeSession(on: On, bridge: () => string | undefined, sleep = async () => {}) {
  const written: unknown[] = []
  const reads: Array<string | undefined> = []
  let onRead: () => void = () => {}
  let onWrite: () => void = () => {}
  const wrote = new Promise<void>(resolve => (onWrite = resolve))
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
  on('state.set', (_, e, next) => {
    written.push(e.value)
    onWrite()
    return next(e)
  })
  const nextRead = () => new Promise<void>(resolve => (onRead = resolve))
  return { written, wrote, nextRead }
}

test('connecting shows the QR Code above the prompt', async ($, on) => {
  let bridge: string | undefined
  const { written, wrote } = fakeSession(on, () => bridge)
  on('command.run', () => {
    bridge = 'session_01AbCdEfGhIjKlMnOpQrStUv'
    return { text: '' }
  })

  await $.command.run(RUN)
  await wrote

  expect(written).toEqual(['https://claude.ai/code/session_01AbCdEfGhIjKlMnOpQrStUv'])
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
  bridge = 'session_01AbCdEfGhIjKlMnOpQrStUv'
  let didRead = false
  void nextRead().then(() => (didRead = true))
  release()
  // The loop must stop: either before reading again, or after reading the
  // connected id without writing it. Give a loop that runs on time to write.
  for (let i = 0; i < 5000 && !didRead; i++) await Promise.resolve()
  for (let i = 0; i < 2000; i++) await Promise.resolve()

  expect(written).toEqual([])
})
