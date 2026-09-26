// Run with: CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test games/chess
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { ModelUsage, On } from 'claude-code'
import { START_FEN, ending, findMove, legalMoves, makeMove, parseFen, san, toFen } from '../hooks/chess.ts'
import type { Position } from '../hooks/chess.ts'
import { asReply, fmt, gameUsage, movePrompt, newGame, play, readReply, resultText } from '../hooks/game.ts'

function perft(p: Position, depth: number): number {
  if (!depth) return 1
  let n = 0
  for (const m of legalMoves(p)) n += perft(makeMove(p, m), depth - 1)
  return n
}

function playAll(fen: string, moves: string[]): Position {
  let p = parseFen(fen)
  for (const text of moves) {
    const m = findMove(p, text)
    if (!m) throw new Error(`illegal ${text} in ${toFen(p)}`)
    p = makeMove(p, m)
  }
  return p
}

describe('rules', () => {
  test('move counts match the published perft numbers', () => {
    expect(perft(parseFen(START_FEN), 3)).toBe(8902)
    // "kiwipete": castling, en passant and promotions all in play
    expect(perft(parseFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'), 2)).toBe(2039)
    expect(perft(parseFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'), 3)).toBe(2812)
  })

  test('SAN: castling, en passant, promotion, disambiguation, mate', () => {
    const ep = playAll(START_FEN, ['e4', 'a6', 'e5', 'd5'])
    expect(san(ep, findMove(ep, 'e5d6')!)).toBe('exd6')
    const castle = parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    expect(san(castle, findMove(castle, 'e1g1')!)).toBe('O-O')
    expect(findMove(castle, '0-0-0')?.flag).toBe('q')
    const promo = parseFen('8/P6k/8/8/8/8/8/K7 w - - 0 1')
    expect(san(promo, findMove(promo, 'a7a8n')!)).toBe('a8=N')
    expect(findMove(promo, 'a8=Q')?.promotion).toBe('q')
    const knights = parseFen('k7/8/8/8/8/8/8/KN3N2 w - - 0 1')
    expect(san(knights, findMove(knights, 'b1d2')!)).toBe('Nbd2')
    const mate = playAll(START_FEN, ['f3', 'e5', 'g4'])
    expect(san(mate, findMove(mate, 'Qh4')!)).toBe('Qh4#')
  })

  test('endings', () => {
    expect(ending(playAll(START_FEN, ['f3', 'e5', 'g4', 'Qh4']))).toBe('checkmate')
    expect(ending(parseFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toBe('stalemate')
    expect(ending(parseFen('7k/8/6K1/8/8/8/8/2B5 b - - 0 1'))).toBe('insufficient material')
    expect(ending(parseFen('7k/8/6K1/8/8/8/8/2R5 b - - 100 80'))).toBe('fifty-move rule')
  })
})

const U = (input: number, output: number, read: number, write: number): ModelUsage => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: read,
  cache_creation_input_tokens: write,
})

describe('the game', () => {
  test("Claude's reply is read word by word, only legal moves count", () => {
    const g = play(newGame('w'), findMove(parseFen(START_FEN), 'e4')!, { by: 'you' })
    expect(readReply(g.pos, 'e5')?.to).toBe(36)
    expect(readReply(g.pos, '1... c5 (the Sicilian)')?.to).toBe(34)
    expect(readReply(g.pos, '**Nf6**')?.to).toBe(45)
    expect(readReply(g.pos, 'I play Ke2')).toBeUndefined()
    expect(movePrompt(g)).toContain('You play Black')
    expect(movePrompt(g)).toContain('Moves so far: 1. e4')
  })

  test('usage adds up per move; unreported moves are counted, not guessed', () => {
    let g = newGame('w')
    g = play(g, findMove(g.pos, 'e4')!, { by: 'you' })
    g = play(g, findMove(g.pos, 'e5')!, { by: 'claude', usage: U(10, 4, 40_000, 200) })
    g = play(g, findMove(g.pos, 'Nf3')!, { by: 'you' })
    g = play(g, findMove(g.pos, 'Nc6')!, { by: 'claude', usage: null })
    const { usage, moves, unreported } = gameUsage(g)
    expect(moves).toBe(2)
    expect(unreported).toBe(1)
    expect(usage).toEqual(U(10, 4, 40_000, 200))
    expect(fmt(40_214)).toBe('40k')
    expect(fmt(1_234)).toBe('1.2k')
    expect(fmt(999)).toBe('999')
  })

  test('result text names the winner', () => {
    let g = newGame('w')
    for (const s of ['f3', 'e5', 'g4', 'Qh4']) g = play(g, findMove(g.pos, s)!, { by: 'you' })
    expect(resultText(g)).toBe('Checkmate: Claude wins')
  })
})

// Beneath the plugin: the model answers from a script and every prompt is kept.
// A reply is the fork's text, null for nothing to fork, or an error arm.
type Scripted = string | null | { error: string }
type Calls = { prompts: string[]; replies: Scripted[]; completes: string[] }

function fakeModel(on: On, calls: Calls) {
  on('model.fork', async ($, e) => {
    calls.prompts.push(e.prompt)
    const next = calls.replies.shift()
    if (next === null || next === undefined) return { value: { isAnswered: false as const, reason: 'nothing-to-fork' as const } }
    if (typeof next === 'object')
      return { value: { isAnswered: false as const, reason: 'api-error' as const, status: 529, error: 'overloaded' as const, usage: U(0, 0, 0, 0) } }
    return { value: { isAnswered: true as const, text: next, usage: U(12, 5, 30_000, 100) } }
  })
  on('model.complete', async ($, e) => {
    calls.completes.push(e.model)
    return { value: { isAnswered: true as const, text: 'd5', usage: U(180, 3, 0, 0) } }
  })
  on('ui.open', () => ({ value: undefined }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
}

const PANE_PROPS = {
  title: 'chess',
  isFocused: true,
  bodyColumns: 40,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

async function openBoard($: Engine, args = 'white') {
  return $.command.run({
    command: 'chess',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 200 },
  })
}

describe('the pane', () => {
  test('click e2 then e4; Claude answers and its tokens show', async ($, on) => {
    const calls: Calls = { prompts: [], replies: ['e5'], completes: [] }
    fakeModel(on, calls)
    await openBoard($)
    const ui = await $.ui.mount({ plugin: 'chess', surface: 'terminal', component: 'Pane', requestId: 'chess', props: PANE_PROPS })
    await ui.press({ key: 'sq:e2' })
    await ui.redraw()
    // the picked pawn's two squares are marked, nothing else is
    expect((await ui.find({ key: 'sq:e3' }))?.text).toContain('•')
    expect((await ui.find({ key: 'sq:e4' }))?.text).toContain('•')
    expect((await ui.find({ key: 'sq:e5' }))?.text).not.toContain('•')
    expect((await ui.find({ key: 'sq:e3' }))?.text).not.toContain('×')
    expect(await ui.find({ type: 'Text', text: /click a highlighted square/ })).toBeDefined()
    await ui.press({ key: 'sq:e4' })
    await ui.redraw()
    expect(calls.prompts.length).toBe(1)
    expect(calls.prompts[0]).toContain('Moves so far: 1. e4')
    expect(await ui.find({ type: 'Text', text: /last e5: 30k/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /in 12 · out 5 · cache r 30k w 100/ })).toBeDefined()
    await ui.unmount()
  })

  test('a typed move plays; an illegal reply is retried once', async ($, on) => {
    const calls: Calls = { prompts: [], replies: ['Qxf7', 'Nf6'], completes: [] }
    fakeModel(on, calls)
    await openBoard($)
    const ui = await $.ui.mount({ plugin: 'chess', surface: 'terminal', component: 'Pane', requestId: 'chess', props: PANE_PROPS })
    await ui.input({ key: 'move', text: 'd4' })
    await ui.redraw()
    expect(calls.prompts.length).toBe(2)
    expect(calls.prompts[1]).toContain('"Qxf7", is not one of those moves')
    // two calls, their usage summed onto the one move
    expect(await ui.find({ type: 'Text', text: /last Nf6: 60k/ })).toBeDefined()
    await ui.unmount()
  })

  test('with no transcript to fork, the fallback model moves and its usage counts', async ($, on) => {
    const calls: Calls = { prompts: [], replies: [null], completes: [] }
    fakeModel(on, calls)
    await openBoard($)
    const ui = await $.ui.mount({ plugin: 'chess', surface: 'terminal', component: 'Pane', requestId: 'chess', props: PANE_PROPS })
    await ui.press({ key: 'sq:e2' })
    await ui.press({ key: 'sq:e4' })
    await ui.redraw()
    expect(calls.completes).toEqual(['haiku'])
    expect(await ui.find({ type: 'Text', text: /last d5: 183/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /haiku: no transcript to fork yet/ })).toBeDefined()
    await ui.unmount()
  })

  test('playing Black, Claude opens', async ($, on) => {
    const calls: Calls = { prompts: [], replies: ['e4'], completes: [] }
    fakeModel(on, calls)
    await openBoard($, 'black')
    expect(calls.prompts[0]).toContain('You play White')
    const ui = await $.ui.mount({ plugin: 'chess', surface: 'terminal', component: 'Pane', requestId: 'chess', props: PANE_PROPS })
    expect(await ui.find({ type: 'Text', text: /Your move \(Black\)/ })).toBeDefined()
    await ui.unmount()
  })
})

describe('pieces follow the theme', () => {
  for (const [theme, whiteKing] of [['dark', '♚'], ['light', '♔']] as const) {
    test(`${theme} theme: White's king is ${whiteKing}`, async ($, on) => {
      const calls: Calls = { prompts: [], replies: [], completes: [] }
      fakeModel(on, calls)
      on('config.list', () => ({
        value: [{ key: 'theme', label: 'Theme', kind: 'choice', value: theme, provider: { plugin: 'engine', tier: 'core' }, isLocked: false }],
      }))
      await openBoard($)
      const ui = await $.ui.mount({ plugin: 'chess', surface: 'terminal', component: 'Pane', requestId: 'chess', props: PANE_PROPS })
      expect((await ui.find({ key: 'sq:e1' }))?.text).toContain(whiteKing)
      await ui.unmount()
    })
  }
})

describe('capture marks', () => {
  test('en passant is marked as a capture on its empty square', async ($, on) => {
    const calls: Calls = { prompts: [], replies: ['a6', 'd5'], completes: [] }
    fakeModel(on, calls)
    await openBoard($)
    const ui = await $.ui.mount({ plugin: 'chess', surface: 'terminal', component: 'Pane', requestId: 'chess', props: PANE_PROPS })
    await ui.input({ key: 'move', text: 'e4' })
    await ui.input({ key: 'move', text: 'e5' })
    await ui.press({ key: 'sq:e5' })
    await ui.redraw()
    expect((await ui.find({ key: 'sq:d6' }))?.text).toContain('×')
    expect((await ui.find({ key: 'sq:e6' }))?.text).toContain('•')
    await ui.unmount()
  })
})

describe('a failing model never leaves Claude thinking', () => {
  test('two API errors: a random legal move, and it is your turn again', async ($, on) => {
    const calls: Calls = { prompts: [], replies: [{ error: 'overloaded' }, { error: 'overloaded' }], completes: [] }
    fakeModel(on, calls)
    await openBoard($)
    const ui = await $.ui.mount({ plugin: 'chess', surface: 'terminal', component: 'Pane', requestId: 'chess', props: PANE_PROPS })
    await ui.input({ key: 'move', text: 'e4' })
    await ui.redraw()
    expect(calls.prompts.length).toBe(2)
    expect(await ui.find({ type: 'Text', text: /random: no reply \(api-error\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Your move \(White\)/ })).toBeDefined()
    await ui.unmount()
  })

  test('a result in the pre-2.1.283 shape still plays', () => {
    expect(asReply('e5')).toEqual({ text: 'e5' })
    expect(asReply(null)).toEqual({ reason: 'nothing-to-fork' })
    expect(asReply({ isAnswered: false, reason: 'nothing-to-fork' })).toEqual({ reason: 'nothing-to-fork' })
  })
})
