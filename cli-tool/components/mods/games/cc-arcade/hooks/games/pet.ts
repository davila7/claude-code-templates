// The pet: pure logic. It grows with the work Claude does in any session: tests passing, commits
// and edits give it xp and lift its mood; failing tests hurt its mood; idle time slowly bores it.
// The hooks module feeds it from tool calls and keeps it in $.store; ../boards/pet.tsx draws it.

export type PetEvent = 'test-pass' | 'test-fail' | 'commit' | 'edit'
export type Pet = {
  xp: number
  mood: number
  // when it was last fed, and when it hatched (ms since the epoch)
  at: number
  born: number
  tests: number; fails: number; commits: number; edits: number
  last?: PetEvent
}

const XP: Record<PetEvent, number> = { 'test-pass': 10, 'test-fail': 2, commit: 15, edit: 1 }
const MOOD: Record<PetEvent, number> = { 'test-pass': 8, 'test-fail': -12, commit: 10, edit: 1 }
const BORED = 30

export const newPet = (now: number): Pet => ({ xp: 0, mood: 70, at: now, born: now, tests: 0, fails: 0, commits: 0, edits: 0 })

// test runners across common stacks; a failing run is a tool call that ended in error
const TEST_COMMAND = /\b(bun|npm|pnpm|yarn)\s+(run\s+)?test\b|\bnpx\s+(jest|vitest|mocha)\b|\b(pytest|jest|vitest|rspec|phpunit|mocha)\b|\bgo\s+test\b|\bcargo\s+test\b|\bmake\s+test\b|\b(mvn|gradle|gradlew|sbt)\b.*\btest\b/

// what a finished tool call means for the pet; `ok` is undefined when the call was denied
export function petEvent(tool: string, command: string | undefined, ok: boolean | undefined): PetEvent | undefined {
  if (ok === undefined) return undefined
  if (tool === 'Bash' && command) {
    if (TEST_COMMAND.test(command)) return ok ? 'test-pass' : 'test-fail'
    if (ok && /\bgit\s+commit\b/.test(command) && !/--dry-run\b/.test(command)) return 'commit'
    return undefined
  }
  if (ok && (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit')) return 'edit'
  return undefined
}

// idle, mood sinks a point every ten minutes, down to bored; below that only failures take it
export function moodAt(p: Pet, now: number): number {
  if (p.mood <= BORED) return p.mood
  return Math.max(BORED, p.mood - Math.floor(Math.max(0, now - p.at) / 600_000))
}

export function feed(p: Pet, event: PetEvent, now: number): Pet {
  return {
    ...p,
    xp: p.xp + XP[event],
    mood: Math.max(0, Math.min(100, moodAt(p, now) + MOOD[event])),
    at: now,
    last: event,
    tests: p.tests + (event === 'test-pass' ? 1 : 0),
    fails: p.fails + (event === 'test-fail' ? 1 : 0),
    commits: p.commits + (event === 'commit' ? 1 : 0),
    edits: p.edits + (event === 'edit' ? 1 : 0),
  }
}

// level n needs 10·n² xp: level 1 at 10, 2 at 40, 3 at 90, 6 at 360, 10 at 1000
export const level = (xp: number) => Math.floor(Math.sqrt(xp / 10))
export type Stage = 'egg' | 'baby' | 'kid' | 'adult' | 'legend'
export const stage = (xp: number): Stage => {
  const l = level(xp)
  return l >= 10 ? 'legend' : l >= 6 ? 'adult' : l >= 3 ? 'kid' : l >= 1 ? 'baby' : 'egg'
}
export const feeling = (mood: number) => (mood >= 70 ? 'happy' : mood >= 35 ? 'okay' : 'sad')
