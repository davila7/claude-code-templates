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
function fakeSession(on: On, bridge: () => string | undefined) {
  const written: unknown[] = []
  let onWrite: () => void = () => {}
  const wrote = new Promise<void>(resolve => (onWrite = resolve))
  on('clock.sleep', () => ({ value: undefined }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/home/u' : undefined }))
  on('session.id', () => ({ value: 'local-1' }))
  on('fs.list', () => ({ value: FILES }))
  on('fs.read', () => ({
    value: JSON.stringify({ sessionId: 'local-1', bridgeSessionId: bridge() }),
  }))
  on('state.set', (_, e, next) => {
    written.push(e.value)
    onWrite()
    return next(e)
  })
  return { written, wrote }
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
