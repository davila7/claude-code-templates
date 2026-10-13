import { test, expect, mock } from 'claude-code/testing'
import { isNewer } from '../hooks/register'

test('versions compare part by part', () => {
  expect(isNewer('0.5.0', '0.4.0')).toBe(true)
  expect(isNewer('1.10.0', '1.9.2')).toBe(true)
  expect(isNewer('1.0', '0.9.9')).toBe(true)
  expect(isNewer('0.4.0', '0.4.0')).toBe(false)
  expect(isNewer('0.3.9', '0.4.0')).toBe(false)
})

for (const [latest, expected] of [['99.0.0', 1], ['0.0.1', 0]] as const)
  test(`a session start toasts only when main is newer (main at ${latest})`, async ($, on) => {
    const toasts: string[] = []
    const clock = mock.clock(on)
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('fs.read', ($, e) => ({ value: e.path.endsWith('/.claude-plugin/plugin.json') ? JSON.stringify({ version: '0.4.0' }) : '' }))
    on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ version: latest }) } }))
    on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }))
    await $.session.start({ cwd: '/tmp', surface: 'terminal' } as any)
    await clock.advance(2500)
    for (let i = 0; i < 50 && toasts.length < expected; i++) await new Promise(r => setTimeout(r, 10))
    expect(toasts.length).toBe(expected)
    if (expected) expect(toasts[0]).toContain('/clawd-actor:update')
  })
