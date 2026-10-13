import { test, expect, mock } from 'claude-code/testing'
import { isNewer } from '../hooks/register'

test('versions compare part by part', () => {
  expect(isNewer('0.5.0', '0.4.0')).toBe(true)
  expect(isNewer('1.10.0', '1.9.2')).toBe(true)
  expect(isNewer('1.0', '0.9.9')).toBe(true)
  expect(isNewer('0.4.0', '0.4.0')).toBe(false)
  expect(isNewer('0.3.9', '0.4.0')).toBe(false)
})

/** Starts a session of 0.4.0, the last one having run `seen`, with main at `latest`; returns the toasts. */
const startSession = async ($: any, on: any, seen: string | undefined, latest: string) => {
  const toasts: string[] = []
  const stored: Record<string, unknown> = seen ? { version: seen } : {}
  const clock = mock.clock(on)
  on('session.start', ($: any, e: any) => ({ cwd: e.cwd }))
  on('fs.read', ($: any, e: any) => ({ value: e.path.endsWith('/.claude-plugin/plugin.json') ? JSON.stringify({ version: '0.4.0' }) : '' }))
  on('store.get', ($: any, e: any) => ({ value: stored[e.key] }))
  on('store.set', ($: any, e: any) => ((stored[e.key] = e.value), { value: undefined }))
  on('http.fetch', ($: any, e: any) => ({
    value: { status: 200, ok: true, headers: {}, text: JSON.stringify(e.url.includes('/releases/') ? { name: 'clawd-actor 0.4.0 — disco' } : { version: latest }) },
  }))
  on('ui.toast', ($: any, e: any) => (toasts.push(e.text), { value: undefined }))
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as any)
  await clock.advance(2500)
  for (let i = 0; i < 50 && toasts.length === 0; i++) await new Promise(r => setTimeout(r, 10))
  await new Promise(r => setTimeout(r, 50)) // room for a second toast, which must not come
  return { toasts, stored }
}

for (const [latest, expected] of [['99.0.0', 1], ['0.0.1', 0]] as const)
  test(`a session start toasts only when main is newer (main at ${latest})`, async ($, on) => {
    const { toasts } = await startSession($, on, '0.4.0', latest)
    expect(toasts.length).toBe(expected)
    if (expected) expect(toasts[0]).toContain('/clawd-actor:update')
  })

test('the first session after an update says what is new, once', async ($, on) => {
  const { toasts, stored } = await startSession($, on, '0.3.0', '99.0.0')
  expect(toasts).toEqual(["clawd-actor updated to 0.4.0: disco. What's new: https://github.com/BrianHuang813/clawd-actor/releases"])
  expect(stored.version).toBe('0.4.0') // the next session is no longer "after an update"
})

test('a first install says nothing about updates it never had', async ($, on) => {
  const { toasts, stored } = await startSession($, on, undefined, '0.0.1')
  expect(toasts.length).toBe(0)
  expect(stored.version).toBe('0.4.0')
})
