// How /arcade random and /arcade auto choose a game. Pure; the hooks module supplies the context.

export type AutoContext = {
  // a model turn is running, and for how long
  working: boolean
  turnMs: number
  // the pet's last event (test-pass, test-fail, commit, edit) and how long ago it was
  lastEvent?: string
  lastEventAgoMs?: number
  lastGame?: string
}

// a random game from the pool, not the one just played when there is another
export function pickRandom(pool: string[], last: string | undefined, rand = Math.random): string {
  const fresh = pool.filter(g => g !== last)
  const from = fresh.length ? fresh : pool
  return from[Math.floor(rand() * from.length)]
}

// a game for the moment: tests that just failed send you to the pet; a long turn gets a game you
// can sink into; a short one a quick round; an idle Claude something you can put down any time
export function pickAuto(ctx: AutoContext, rand = Math.random): { game: string; reason: string } {
  if (ctx.lastEvent === 'test-fail' && (ctx.lastEventAgoMs ?? Infinity) < 5 * 60_000) {
    return { game: 'pet', reason: 'tests just failed, your pet could use a visit' }
  }
  if (ctx.working && ctx.turnMs >= 60_000) {
    const min = Math.floor(ctx.turnMs / 60_000)
    return { game: pickRandom(['tetris', 'invaders', 'doom', 'snake'], ctx.lastGame, rand), reason: `Claude has been working ${min} min, time for a longer game` }
  }
  if (ctx.working) {
    return { game: pickRandom(['flappy', 'pong', 'typing'], ctx.lastGame, rand), reason: 'Claude is working, a quick round' }
  }
  return { game: pickRandom(['2048', 'minesweeper'], ctx.lastGame, rand), reason: 'Claude is idle, a game you can put down any time' }
}
