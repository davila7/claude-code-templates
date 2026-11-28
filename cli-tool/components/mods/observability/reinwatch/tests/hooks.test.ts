import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { register } from '../hooks/register'

// The registrations reinwatch makes, as a stand-in `on` records them: each event with its matcher (none when the hook
// came right after the event's name).
function registrations(): { event: string; matcher: unknown }[] {
  const seen: { event: string; matcher: unknown }[] = []
  const on = ((event: string, ...rest: unknown[]) => {
    seen.push({ event, matcher: rest.length > 1 ? rest[0] : undefined })
    const registration = { catch: () => registration }
    return registration
  }) as unknown as On
  void register(on, {})
  return seen
}

// A hook that may match a tool call keeps that call from moving to the background (and from streaming its output
// past the hook), so reinwatch's tool hooks must never match a call of the main conversation, which has no agentId.
test("the tool hooks match subagents' calls only", () => {
  const toolHooks = registrations().filter(r => r.event.startsWith('tool.'))
  expect(toolHooks.map(r => r.event).sort()).toEqual(['tool.call', 'tool.call', 'tool.run'])
  for (const { matcher } of toolHooks) {
    const agentId = (matcher as { agentId?: unknown } | undefined)?.agentId
    expect(agentId instanceof RegExp && agentId.test('a1')).toBe(true)
  }
})
