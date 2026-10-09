// Run with: claude plugin test productivity/webfetch-cache
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

type World = { fetched: number[] }

function fakeEngine(on: On, w: World) {
  on('ui.log', () => ({ value: undefined }))
  on('tool.call', async ($, e) => {
    const offset = (e as unknown as { offset?: number }).offset ?? 0
    w.fetched.push(offset)
    return { result: { text: `page at ${offset}` } } as never
  })
}

const fetch = async ($: Engine, offset?: number) =>
  (await $.tool.call({ tool: 'WebFetch', url: 'https://example.com/long', prompt: 'summarize', ...(offset === undefined ? {} : { offset }) } as never)) as {
    result?: { text: string }
  }

describe('webfetch-cache', () => {
  test('a repeated fetch is served from the cache', async ($, on) => {
    const w: World = { fetched: [] }
    fakeEngine(on, w)
    await fetch($)
    const again = await fetch($)
    expect(w.fetched).toEqual([0])
    expect(again.result?.text).toBe('page at 0')
  })

  test('a read further down the page is not answered with the first page', async ($, on) => {
    const w: World = { fetched: [] }
    fakeEngine(on, w)
    await fetch($)
    const next = await fetch($, 100_000)
    expect(w.fetched).toEqual([0, 100_000])
    expect(next.result?.text).toBe('page at 100000')
    // and that piece is cached on its own
    await fetch($, 100_000)
    expect(w.fetched).toEqual([0, 100_000])
  })
})
