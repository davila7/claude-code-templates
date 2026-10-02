// Run with: CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test productivity/session-time-machine
import { describe, expect, test } from 'claude-code/testing'
import {
  buildTimeline,
  closePrefix,
  forkTranscript,
  mainChain,
  newSessionId,
  parseArgs,
  parseRows,
  projectSlug,
  promptText,
  resumeCommand,
  shellQuote,
  transcriptPath,
} from '../hooks/transcript.ts'

let seq = 0
const row = (type: string, content: unknown, extra: Record<string, unknown> = {}, parent?: string) => {
  seq += 1
  return { type, uuid: `u${seq}`, parentUuid: parent ?? (seq > 1 ? `u${seq - 1}` : null), sessionId: 'old', message: { content }, ...extra }
}
const use = (id: string, name = 'Bash', input: unknown = { command: 'ls' }) => ({ type: 'tool_use', id, name, input })
const result = (id: string) => ({ type: 'tool_result', tool_use_id: id, content: 'ok' })

const session = () => {
  seq = 0
  return [
    row('user', 'first task'),
    row('assistant', [use('a', 'Bash', { command: 'npm test' })]),
    row('assistant', [use('b', 'Read', { file_path: 'src/x.ts' })]),
    row('user', [result('a')]),
    row('user', [result('b')]),
    row('assistant', [{ type: 'text', text: 'Tests pass.' }]),
    row('user', 'now refactor it'),
    row('assistant', [{ type: 'text', text: 'Done.' }]),
  ]
}

describe('the chain', () => {
  test('rows are parsed, a half-written last line is ignored', () => {
    expect(parseRows('{"a":1}\n\n{"b":2}\n{"c":').length).toBe(2)
  })

  test('the live conversation is the parent chain from the last row; a rewound branch and a sidechain drop out', () => {
    const rows = session()
    const dead = { ...row('user', 'abandoned', {}, 'u1'), uuid: 'dead' }
    const side = { ...row('assistant', 'agent', { isSidechain: true }, 'u3'), uuid: 'side' }
    rows.splice(2, 0, dead, side)
    const chain = mainChain([...rows, { type: 'last-prompt', sessionId: 'old' }])
    expect(chain.map(r => r.uuid)).not.toContain('dead')
    expect(chain.map(r => r.uuid)).not.toContain('side')
    expect(chain.length).toBe(session().length)
  })

  test('only typed prompts count: tool results, meta rows and injected reminders do not', () => {
    expect(promptText(row('user', 'hi'))).toBe('hi')
    expect(promptText(row('user', [result('a')]))).toBeUndefined()
    expect(promptText(row('user', 'x', { isMeta: true }))).toBeUndefined()
    expect(promptText(row('user', '<system-reminder>be good</system-reminder>'))).toBeUndefined()
    expect(promptText(row('user', [{ type: 'text', text: 'typed' }]))).toBe('typed')
  })
})

describe('the timeline', () => {
  test('prompts cut before themselves, tool calls after their result, turns after their last row', () => {
    const chain = mainChain(session())
    const t = buildTimeline(chain)
    expect(t.map(p => `${p.kind}:${p.keep}`)).toEqual(['prompt:0', 'tool:4', 'tool:5', 'turn:6', 'prompt:6', 'turn:8'])
    expect(t[1]!.label).toBe('Bash npm test')
    expect(t[2]!.label).toBe('Read src/x.ts')
    expect(t[3]!.label).toBe('turn 1 ended: Tests pass.')
    expect(t.map(p => p.n)).toEqual([1, 2, 3, 4, 5, 6])
  })
})

describe('forking', () => {
  test('a cut between two parallel calls is grown to hold the second result', () => {
    const chain = mainChain(session())
    expect(closePrefix(chain, 4)).toBe(5)
    expect(closePrefix(chain, 3)).toBe(5)
    expect(closePrefix(chain, 1)).toBe(1)
  })

  test('a call the original never answered does not drag the cut to the end', () => {
    seq = 0
    const chain = mainChain([row('user', 'go'), row('assistant', [use('x')]), row('user', 'next')])
    expect(closePrefix(chain, 2)).toBe(2)
  })

  test('the fork is JSONL under the new id with uuids and parents intact, and the original is untouched', () => {
    const chain = mainChain(session())
    const out = forkTranscript(chain, 6, 'new-id').trimEnd().split('\n').map(l => JSON.parse(l))
    expect(out.length).toBe(6)
    expect(out.every(r => r.sessionId === 'new-id')).toBe(true)
    expect(out.map(r => r.uuid)).toEqual(chain.slice(0, 6).map(r => r.uuid))
    expect(chain[0]!.sessionId).toBe('old')
    expect(forkTranscript(chain, 0, 'new-id')).toBe('')
  })

  test('the command quotes the instruction and the directory', () => {
    expect(shellQuote("it's")).toBe(`'it'\\''s'`)
    expect(resumeCommand('/my repo', 'abc', "try the other approach; don't touch $HOME")).toBe(
      `cd '/my repo' && claude --resume abc 'try the other approach; don'\\''t touch $HOME'`,
    )
  })

  test('paths and ids', () => {
    expect(projectSlug('/home/me/my.repo')).toBe('-home-me-my-repo')
    expect(transcriptPath('/h/.claude/', '/home/me', 's1')).toBe('/h/.claude/projects/-home-me/s1.jsonl')
    expect(newSessionId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  test('command arguments', () => {
    expect(parseArgs('')).toEqual({ kind: 'open' })
    expect(parseArgs(' list ')).toEqual({ kind: 'list' })
    expect(parseArgs('fork 3 use the other approach\nplease')).toEqual({ kind: 'fork', n: 3, instruction: 'use the other approach\nplease' })
    expect(parseArgs('fork 3').kind).toBe('error')
    expect(parseArgs('fork x y').kind).toBe('error')
  })
})
