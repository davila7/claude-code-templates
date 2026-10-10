// Run with: claude plugin test security/block-destructive-commands
import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

function fakeEngine(on: On, w: { ran: string[] }, fail = false) {
  on('ui.log', () => ({ value: undefined }))
  on('tool.call', async ($, e) => {
    w.ran.push((e as unknown as { command: string }).command)
    if (fail) throw new Error('boom')
    return { result: { stdout: 'ok' } } as never
  })
}

const bash = async ($: { tool: { call: (e: never) => Promise<unknown> } }, command: string) =>
  (await $.tool.call({ tool: 'Bash', command } as never)) as { deny?: string; result?: { stdout: string } }

describe('block-destructive-commands', () => {
  test('a destructive command is denied and never runs', async ($, on) => {
    const w = { ran: [] as string[] }
    fakeEngine(on, w)
    const r = await bash($, 'rm -rf ~/')
    expect(r.deny).toContain('recursive delete')
    expect(w.ran).toEqual([])
  })

  test('a safe command runs', async ($, on) => {
    const w = { ran: [] as string[] }
    fakeEngine(on, w)
    const r = await bash($, 'ls -la')
    expect(r.result?.stdout).toBe('ok')
    expect(w.ran).toEqual(['ls -la'])
  })

  test('a call that failed after the check passed runs once and is not reported as unchecked', async ($, on) => {
    const w = { ran: [] as string[] }
    fakeEngine(on, w, true)
    const r = await bash($, 'ls -la')
    expect(w.ran).toEqual(['ls -la'])
    expect(r.deny ?? '').not.toContain('could not check')
  })
})
