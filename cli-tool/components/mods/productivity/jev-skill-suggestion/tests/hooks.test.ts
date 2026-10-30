import { expect, test } from 'claude-code/testing'
import type { EngineInterface, Hook, Next, On, PromptSubmitInput } from 'claude-code'
import { register } from '../hooks/jev-skill-suggestion.ts'

test('context-free replies skip ranking, but short tasks and attached prompts still get both requests', async () => {
  let submit!: Hook<'prompt.submit'>
  register(((event: string, hook: unknown) => {
    if (event === 'prompt.submit') submit = hook as Hook<'prompt.submit'>
  }) as On, { typesafeApiKey: 'test-only', inject: 'suggest', logDecisions: false })

  let requests = 0
  const $ = {
    command: { list: async () => [{ name: 'test-runner', description: 'Fix failing tests', source: 'user' }] },
    http: {
      fetch: async () => {
        requests++
        return {
          ok: true,
          text: JSON.stringify({ answers: {
            which: { type: 'choice', choice: 'test-runner' },
            'fits::test-runner': { type: 'noul', noul: 0.9 },
          } }),
        }
      },
    },
    clock: { now: async () => 0, sleep: () => Promise.race([]) },
    fs: { exists: async () => false },
    env: { get: async () => undefined },
    ui: { log: () => {}, status: () => {} },
  } as unknown as EngineInterface
  const next = (async (e: PromptSubmitInput) => e) as unknown as Next<'prompt.submit'>
  const event = (text: string): PromptSubmitInput => ({ text, wait: false, origin: { kind: 'composer' } })

  for (const text of ['2', '123', '...', 'go', ' OK! ', 'okay', 'continue', 'yes', 'no', 'thanks', 'thank you', 'hi', 'hello']) {
    const e = event(text)
    expect(await submit($, e, next)).toEqual(e)
    expect(requests).toBe(0)
  }

  for (const text of ['fix tests', 'go build', 'continue migration', 'review', 'исправь тесты', '修复测试']) {
    const before = requests
    const result = await submit($, event(text), next)
    expect(requests - before).toBe(2)
    expect('context' in result && result.context?.join('\n')).toContain('test-runner')
  }

  const before = requests
  await submit($, { ...event('ok'), attachments: [{ type: 'image' }] }, next)
  expect(requests - before).toBe(2)
})
