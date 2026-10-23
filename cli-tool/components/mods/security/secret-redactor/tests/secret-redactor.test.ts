// Run with: claude plugin test security/secret-redactor
import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const KEY = 'AKIAABCDEFGHIJKLMNOP'

function fakeEngine(on: On, answer: () => unknown) {
  on('ui.log', () => ({ value: undefined }))
  on('tool.call', async () => answer() as never)
}

describe('secret-redactor', () => {
  test('redacts a secret in a tool result', async ($, on) => {
    fakeEngine(on, () => ({ result: { stdout: `key=${KEY}` } }))
    const r = (await $.tool.call({ tool: 'Bash', command: 'cat .env' } as never)) as { result?: { stdout: string } }
    expect(r.result?.stdout).toBe('key=[REDACTED:aws-access-key]')
  })

  test('a failure while handling the result withholds it instead of passing it on unredacted', async ($, on) => {
    fakeEngine(on, () => {
      throw new Error('boom')
    })
    const r = (await $.tool.call({ tool: 'Bash', command: 'cat .env' } as never)) as { deny?: string; result?: unknown }
    expect(r.result).toBeUndefined()
    expect(r.deny).toBe('The Bash call failed, and secret-redactor withheld its error unscanned.')
  })

  test('a redacted placeholder never travels back into a command', async ($, on) => {
    fakeEngine(on, () => ({ result: { stdout: 'ran' } }))
    const r = (await $.tool.call({ tool: 'Bash', command: 'echo [REDACTED:aws-access-key]' } as never)) as { deny?: string }
    expect(r.deny).toContain('redacted secret placeholder')
  })
})
