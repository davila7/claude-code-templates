/**
 * chess — Claude Mod (EARLY ACCESS)
 *
 * Chess against Claude in a side pane while you work. `/chess` opens it; in
 * the fullscreen layout (`/tui fullscreen`) the engine docks it beside the
 * transcript, floor to ceiling, otherwise it sits above the prompt. Click a
 * piece and then a square, or type a move (`e4`, `Nf3`, `O-O`, `e2e4`).
 *
 * Claude's move comes from `$.model.fork`: one tool-less completion over the
 * session's own transcript, on the session's model, sharing its prompt cache.
 * It is the one model call that reports what it cost, so every move of
 * Claude's shows the API's own usage (input, output, cache read, cache write)
 * and the pane sums them. Before the session's first turn there is no
 * transcript to fork; that move falls back to `$.model.complete` on
 * `fallbackModel`, a short completion whose usage is counted the same way.
 *
 * With a Jev key in the options (`typesafeApiKey` or `gatewayApiKey`, the
 * same ones jev-model-router takes), Jev plays instead: one request to
 * TypeSafe's decision API per move, a `choice` over the legal moves, and the
 * pane says Jev wherever it said Claude. Tokens show when the response
 * reports them, "not reported" otherwise.
 *
 * Privacy: with a Jev key set, the position and the moves so far are sent to
 * whichever backend the key belongs to.
 *
 * Nothing here touches files, git or the transcript.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259).
 *
 * Options (pluginConfigs["chess@skills-dir"].options):
 *   columns: number        width asked for the docked pane (default 40)
 *   pieces: string         "unicode" (default) or "letters"
 *   fallbackModel: string  model for a move made before the first turn (default "haiku")
 *   typesafeApiKey / gatewayApiKey: string  a Jev key makes Jev the opponent
 *   provider: string       "auto" (default), "typesafe", "gateway" or "claude"
 *   typesafeBaseUrl, typesafeModel, gatewayBaseUrl, gatewayModel, timeoutMs (Jev, default 15000)
 */
import type { Register } from 'claude-code'
import { findMove, legalMoves, squareIndex, squareName } from './chess.ts'
import type { Color, Move, Piece } from './chess.ts'
import {
  addUsage,
  asReply,
  claudeColor,
  colorName,
  fmt,
  gameUsage,
  isClaudeTurn,
  isYourTurn,
  movePrompt,
  newGame,
  play,
  readReply,
  resultText,
  totalTokens,
  usageLine,
} from './game.ts'
import type { Game, Played, Reply } from './game.ts'
import { DEFAULT_BASE_URL, DEFAULT_MODEL, endpoint, jevMove, requestBody, requestHeaders, selectProvider } from './jev.ts'
import type { JevResponse } from './jev.ts'

const PANE = 'chess'
const COMMAND = 'chess'
const DEFAULT_COLUMNS = 40
// Claude's moves listed under the board, newest last
const HISTORY_ROWS = 8

// Unicode's "white" pieces are outlines and its "black" ones solid. On a dark
// theme the terminal draws both in a light foreground, so the solid set reads
// as the light side: there White gets the solid glyphs and Black the outlines.
const OUTLINE: Record<string, string> = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }
const SOLID: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
const LIGHT = '#8b7355'
const DARK = '#5c4a36'
const PICKED = '#a08a2c'
const LAST = '#4f6b3a'
// where the picked piece can go, and where it captures
const TARGET = '#3d6a8a'
const CAPTURE = '#8a3d3d'

// both resolve ModelCompleteResult-like values; read through asReply
type Call = (prompt: string) => Promise<unknown>
// Jev's HTTP answer for a game, or undefined when it did not come in time
type JevCall = (g: Game) => Promise<JevResponse>

let game: Game = newGame('w')
let picked = -1
let thinking = false
let note: string | undefined
let isOpen = false
// the Claude Code theme is dark (or auto, taken as dark) unless it names light
let darkTheme = true
// raised by every new game, so a reply that lands after one is dropped
let generation = 0
// who plays the other side: Jev when a Jev key is configured, Claude otherwise
let opponent = 'Claude'

const isDarkTheme = (value: unknown) => typeof value !== 'string' || !value.startsWith('light')
// `auto` follows the terminal, which a mod cannot read, so `board` can say which it is
const pickDark = (board: unknown, theme: unknown) => (board === 'dark' ? true : board === 'light' ? false : isDarkTheme(theme))

const paneColumns = (v: unknown) => (typeof v === 'number' && v >= 30 && v <= 100 ? Math.round(v) : DEFAULT_COLUMNS)

function statusText(): string | undefined {
  if (!isOpen) return undefined
  const { usage, moves } = gameUsage(game)
  const where = resultText(game, opponent) ?? (thinking ? `${opponent} is thinking` : isYourTurn(game) ? 'your move' : `${opponent} to move`)
  return `chess: ${where} · ${opponent} ${moves} move${moves === 1 ? '' : 's'}, ${fmt(totalTokens(usage))} tokens`
}

/**
 * Claude's move: fork the session, or before its first turn (nothing to fork)
 * complete on `fallbackModel`; read the reply, retry once naming the miss,
 * then a random legal move so the game never stalls. Every call's usage is
 * summed onto the move. Never throws: a failure still ends Claude's turn.
 */
async function claudeMoves(fork: Call, complete: Call, fallbackModel: string): Promise<void> {
  const gen = generation
  let usage: Played['usage'] = null
  let reply = ''
  let move: Move | undefined
  let how: string | undefined
  const count = (r: Reply) => {
    if (r.usage) usage = usage ? addUsage(usage, r.usage) : { ...r.usage }
  }
  try {
    for (let attempt = 0; attempt < 2 && !move; attempt++) {
      const prompt = movePrompt(game, attempt ? reply : undefined)
      let r = asReply(await fork(prompt))
      if (gen !== generation) return
      if (r.reason === 'nothing-to-fork') {
        r = asReply(await complete(prompt))
        if (gen !== generation) return
        how = `${fallbackModel}: no transcript to fork yet`
      }
      count(r)
      if (r.reason) {
        how = `no reply (${r.reason})`
        continue
      }
      reply = r.text ?? ''
      move = readReply(game.pos, reply)
      if (!move && attempt === 0) how = `retried: "${reply.trim().slice(0, 16)}" was not legal`
    }
  } catch (err) {
    if (gen !== generation) return
    how = `model call failed: ${String(err).slice(0, 60)}`
  }
  if (!move) {
    const legal = legalMoves(game.pos)
    move = legal[Math.floor(Math.random() * legal.length)]
    how = `random: ${how ?? `${opponent} named no legal move`}`
  }
  game = play(game, move, { by: 'claude', usage, ...(how ? { note: how } : {}) })
  note = undefined
}

/**
 * Jev's move: one request to the decision model, whose answer is a choice
 * among the legal moves. A failed request, a timeout or an answer naming no
 * legal move plays a random legal move and says why. Never throws.
 */
async function jevMoves(ask: JevCall, provider: string): Promise<void> {
  const gen = generation
  let got: ReturnType<typeof jevMove>
  try {
    got = jevMove(game.pos, await ask(game), provider)
  } catch (err) {
    got = { usage: null, why: `request failed: ${String(err).slice(0, 60)}` }
  }
  if (gen !== generation) return
  let move = got.move
  if (!move) {
    const legal = legalMoves(game.pos)
    move = legal[Math.floor(Math.random() * legal.length)]
  }
  game = play(game, move, { by: 'claude', usage: got.usage, ...(got.why ? { note: `random: ${got.why}` } : {}) })
  note = undefined
}

function tryYourMove(text: string): boolean {
  if (!isYourTurn(game) || thinking) return false
  const m = findMove(game.pos, text)
  if (!m) {
    note = `"${text.trim().slice(0, 20)}" is not a legal move here`
    return false
  }
  game = play(game, m, { by: 'you' })
  picked = -1
  note = undefined
  return true
}

/** A click on a square: pick your piece, re-pick, or move the picked one there. */
function clickSquare(sq: number): boolean {
  if (!isYourTurn(game) || thinking) return false
  const p = game.pos.board[sq]
  const mine = p !== '' && (p === p.toUpperCase() ? 'w' : 'b') === game.you
  if (picked < 0 || mine) {
    picked = mine && picked !== sq ? sq : -1
    note = undefined
    return false
  }
  const options = legalMoves(game.pos).filter(m => m.from === picked && m.to === sq)
  if (!options.length) {
    picked = -1
    return false
  }
  // a promotion by click is a queen; type e7e8n for another piece
  const m = options.find(o => !o.promotion || o.promotion === 'q') ?? options[0]
  game = play(game, m, { by: 'you' })
  picked = -1
  note = undefined
  return true
}

export const register: Register = (on, options) => {
  const columns = paneColumns(options.columns)
  const letters = options.pieces === 'letters'
  const text = (key: string, fallback: string) =>
    typeof options[key] === 'string' && options[key] ? (options[key] as string) : fallback
  const fallbackModel = text('fallbackModel', 'haiku')
  // A Jev key (the same ones jev-model-router takes) makes Jev the opponent.
  const typesafeKey = text('typesafeApiKey', '')
  const gatewayKey = text('gatewayApiKey', '')
  const forced = text('provider', 'auto')
  const jev = selectProvider(forced, typesafeKey, gatewayKey)
  // a backend named without its key plays Claude; say so rather than silently
  const unusable = (forced === 'typesafe' || forced === 'gateway') && !jev
  const jevKey = jev === 'typesafe' ? typesafeKey : gatewayKey
  const jevModel = jev ? text(`${jev}Model`, DEFAULT_MODEL[jev]) : ''
  const jevUrl = jev ? endpoint(jev, text(`${jev}BaseUrl`, DEFAULT_BASE_URL[jev])) : ''
  const jevTimeout = typeof options.timeoutMs === 'number' && options.timeoutMs > 0 ? options.timeoutMs : 15_000
  opponent = jev ? 'Jev' : 'Claude'

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: COMMAND,
        description: `Play chess against ${opponent} in a side pane; shows the tokens each of its moves costs`,
        argumentHint: '[white|black|stop]',
        immediate: true,
      })
      .catch(err => $.ui.log(`chess: /${COMMAND} not registered: ${err}`))
    $.ui.log(`chess loaded: /${COMMAND} opens the board`, { to: 'debug' })
    if (unusable) $.ui.log(`chess: provider "${forced}" has no key set; Claude plays`)
    const theme = await $.config.list().then(rows => rows.find(row => row.key === 'theme')?.value).catch(() => undefined)
    darkTheme = pickDark(options.board, theme)
    return r
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop' || arg === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      isOpen = false
      $.ui.status(undefined)
      return { text: 'chess closed; the game stays where it is' }
    }
    const side: Color | undefined = arg === 'white' || arg === 'w' ? 'w' : arg === 'black' || arg === 'b' ? 'b' : undefined
    if (side || game.over || game.resigned) {
      generation++
      game = newGame(side ?? game.you)
      picked = -1
      thinking = false
      note = undefined
    }
    const theme = await $.config.list().then(rows => rows.find(row => row.key === 'theme')?.value).catch(() => undefined)
    darkTheme = pickDark(options.board, theme)
    isOpen = true
    await $.ui.open({ id: PANE, title: 'chess', focus: true, columns })
    $.ui.status(statusText())
    $.ui.invalidate('ui.render')
    if (isClaudeTurn(game) && !thinking) {
      const gen = generation
      thinking = true
      $.ui.status(statusText())
      $.ui.invalidate('ui.render')
      if (jev) {
        await jevMoves(
          async g =>
            (await Promise.race([
              $.http.fetch(jevUrl, { method: 'POST', headers: requestHeaders(jev, jevKey, jevModel), body: requestBody(jev, g, jevModel) }),
              $.clock.sleep(jevTimeout),
            ])) ?? undefined,
          jev,
        )
      } else {
        await claudeMoves(
          prompt => $.model.fork({ prompt }),
          prompt => $.model.complete({ model: fallbackModel, prompt, maxTokens: 64, timeoutMs: 60_000 }),
          fallbackModel,
        )
      }
      // a new game or a resignation meanwhile owns `thinking` now
      if (gen === generation) thinking = false
      $.ui.status(statusText())
      $.ui.invalidate('ui.render')
    }
    const hint = e.presentation.isFullscreen ? 'click a piece, then a square' : 'drawn above the prompt; /tui fullscreen docks it beside the transcript'
    return { text: `you play ${colorName(game.you)} · ${hint} · /${COMMAND} stop closes` }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id !== PANE) return next(e)
    const r = await next(e)
    isOpen = false
    $.ui.status(undefined)
    return r
  })

  on('ui.input', async ($, e, next) => {
    if (e.plugin !== $.plugin.name || e.requestId !== PANE || e.element !== 'move') return next(e)
    const r = await next(e)
    if (e.kind !== 'submit') return r
    const moved = tryYourMove(e.value)
    $.ui.status(statusText())
    $.ui.invalidate('ui.render')
    if (moved && isClaudeTurn(game)) {
      const gen = generation
      thinking = true
      $.ui.status(statusText())
      $.ui.invalidate('ui.render')
      if (jev) {
        await jevMoves(
          async g =>
            (await Promise.race([
              $.http.fetch(jevUrl, { method: 'POST', headers: requestHeaders(jev, jevKey, jevModel), body: requestBody(jev, g, jevModel) }),
              $.clock.sleep(jevTimeout),
            ])) ?? undefined,
          jev,
        )
      } else {
        await claudeMoves(
          prompt => $.model.fork({ prompt }),
          prompt => $.model.complete({ model: fallbackModel, prompt, maxTokens: 64, timeoutMs: 60_000 }),
          fallbackModel,
        )
      }
      // a new game or a resignation meanwhile owns `thinking` now
      if (gen === generation) thinking = false
      $.ui.status(statusText())
      $.ui.invalidate('ui.render')
    }
    return r
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== $.plugin.name || e.requestId !== PANE) return next(e)
    const r = await next(e)
    const key = e.element
    let moved = false

    if (key === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      return r
    }
    if (key === 'new-w' || key === 'new-b') {
      generation++
      game = newGame(key === 'new-w' ? 'w' : 'b')
      picked = -1
      thinking = false
      note = undefined
    } else if (key === 'resign') {
      if (!game.over && !game.resigned) {
        generation++
        game = { ...game, resigned: game.you }
        thinking = false
      }
    } else if (key.startsWith('sq:')) {
      moved = clickSquare(squareIndex(key.slice(3)))
    }
    $.ui.status(statusText())
    $.ui.invalidate('ui.render')
    if ((moved || key.startsWith('new-')) && isClaudeTurn(game) && !thinking) {
      const gen = generation
      thinking = true
      $.ui.status(statusText())
      $.ui.invalidate('ui.render')
      if (jev) {
        await jevMoves(
          async g =>
            (await Promise.race([
              $.http.fetch(jevUrl, { method: 'POST', headers: requestHeaders(jev, jevKey, jevModel), body: requestBody(jev, g, jevModel) }),
              $.clock.sleep(jevTimeout),
            ])) ?? undefined,
          jev,
        )
      } else {
        await claudeMoves(
          prompt => $.model.fork({ prompt }),
          prompt => $.model.complete({ model: fallbackModel, prompt, maxTokens: 64, timeoutMs: 60_000 }),
          fallbackModel,
        )
      }
      // a new game or a resignation meanwhile owns `thinking` now
      if (gen === generation) thinking = false
      $.ui.status(statusText())
      $.ui.invalidate('ui.render')
    }
    return r
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    // mobile draws no Input: there a move is clicked
    const Input = 'Input' in els ? els.Input : undefined
    const noop = () => {}
    const g = game
    const last = g.played[g.played.length - 1]
    const lastSquares = last ? [squareIndex(last.uci.slice(0, 2)), squareIndex(last.uci.slice(2, 4))] : []
    // destination -> whether moving there captures (en passant lands on an empty square)
    const targets = new Map(picked >= 0 ? legalMoves(g.pos).filter(m => m.from === picked).map(m => [m.to, !!m.captured] as const) : [])
    const ranks = g.you === 'w' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]
    const files = g.you === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]
    const isWhite = (p: Piece) => p !== '' && p === p.toUpperCase()
    // HTML collapses runs of spaces and trims a text's ends; a no-break space keeps them
    const pad = (text: string) => (e.surface === 'terminal' ? text : text.replace(/ /g, '\u00a0'))
    const glyph = (p: Piece) => {
      if (p === '' || letters) return p || ' '
      const solid = isWhite(p) === darkTheme
      return (solid ? SOLID : OUTLINE)[p.toLowerCase()]
    }

    const board = ranks.map(rank => (
      <Box key={`rank:${rank}`} flexDirection="row">
        <Box key="rank-label" width={2} flexShrink={0}>
          <Text dimColor>{pad(`${rank + 1} `)}</Text>
        </Box>
        {files.map(file => {
          const sq = rank * 8 + file
          const p = g.pos.board[sq]
          const target = targets.has(sq)
          const capture = targets.get(sq) === true
          const bg =
            sq === picked ? PICKED
            : target ? (capture ? CAPTURE : TARGET)
            : lastSquares.includes(sq) ? LAST
            : (file + rank) % 2 ? LIGHT : DARK
          // the marker keeps a capture readable without the red
          const label = capture ? `×${p === '' ? ' ' : glyph(p)} ` : target ? ' • ' : ` ${glyph(p)} `
          return (
            // Every square is a fixed 3 x 1 cell. Without it a desktop (HTML) sizes a
            // square to its text: whitespace collapses, so an empty square came out
            // narrower than one holding a piece and rows 3-6 drifted out of the grid.
            // The terminal already drew exactly 3 x 1, so nothing changes there.
            <Box key={`cell:${sq}`} backgroundColor={bg} width={3} height={1} flexShrink={0} justifyContent="center">
              <Button
                key={`sq:${squareName(sq)}`}
                plain
                dimColor={darkTheme && p !== '' && !isWhite(p)}
                label={pad(label)}
                onPress={noop}
              />
            </Box>
          )
        })}
      </Box>
    ))

    const { usage, moves, unreported } = gameUsage(g)
    const claudeLast = [...g.played].reverse().find(m => m.by === 'claude')
    const history = g.played
      .map((m, i) => ({ m, n: Math.floor(i / 2) + 1, i }))
      .filter(x => x.m.by === 'claude')
      .slice(-HISTORY_ROWS)
    const result = resultText(g, opponent)
    const turnLine = result ??
      (thinking
        ? `${opponent} is thinking…`
        : isYourTurn(g)
          ? `Your move (${colorName(g.you)}): ${picked >= 0 ? 'click a highlighted square' : 'click a piece'}`
          : `${opponent} to move`)

    return (
      <Box flexDirection="column">
        <Text bold>{`You ${colorName(g.you)} vs ${opponent} ${colorName(claudeColor(g))}`}</Text>
        <Box key="board" flexDirection="column" marginTop={1}>
          {board}
          <Box key="files" flexDirection="row">
            <Box key="files-gap" width={2} flexShrink={0} />
            {files.map(f => (
              <Box key={`file:${f}`} width={3} flexShrink={0} justifyContent="center">
                <Text dimColor>{'abcdefgh'[f]}</Text>
              </Box>
            ))}
          </Box>
        </Box>

        <Box key="turn" marginTop={1} flexDirection="column">
          <Text bold color={result ? 'magenta' : thinking ? 'yellow' : 'green'}>{turnLine}</Text>
          {note ? <Text color="red" wrap="truncate-end">{note}</Text> : null}
          {Input && isYourTurn(g) && !thinking ? (
            <Input key="move" label="move " placeholder="e4, Nf3, O-O, e7e8q" submitLabel="play" onSubmit={noop} />
          ) : null}
        </Box>

        <Box key="tokens" marginTop={1} flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
          <Text bold color="cyan">{`${opponent}'s tokens (API usage)`}</Text>
          {claudeLast ? (
            <Text wrap="truncate-end">
              <Text bold>{`last ${claudeLast.san}: `}</Text>
              {claudeLast.usage ? `${fmt(totalTokens(claudeLast.usage))}` : 'not reported'}
            </Text>
          ) : (
            <Text dimColor>no move yet</Text>
          )}
          {claudeLast?.usage ? <Text dimColor wrap="truncate-end">{usageLine(claudeLast.usage)}</Text> : null}
          {claudeLast?.note ? <Text color="yellow" wrap="truncate-end">{claudeLast.note}</Text> : null}
          <Text wrap="truncate-end">
            <Text bold>{`game: ${fmt(totalTokens(usage))}`}</Text>
            {` over ${moves} move${moves === 1 ? '' : 's'}${unreported ? `, ${unreported} unreported` : ''}`}
          </Text>
          {moves ? <Text dimColor wrap="truncate-end">{usageLine(usage)}</Text> : null}
        </Box>

        {history.length ? (
          <Box key="history" flexDirection="column" marginTop={1}>
            {history.map(({ m, n, i }) => (
              <Text key={`h:${i}`} wrap="truncate-end">
                <Text dimColor>{`${n}${i % 2 ? '...' : '.'} `.padEnd(6)}</Text>
                {m.san.padEnd(8)}
                <Text color="cyan">{m.usage ? fmt(totalTokens(m.usage)).padStart(7) : '      -'}</Text>
                {m.usage ? <Text dimColor>{`  out ${fmt(m.usage.output_tokens)}`}</Text> : null}
              </Text>
            ))}
          </Box>
        ) : null}

        <Box key="foot" marginTop={1} flexDirection="row" columnGap={1} flexWrap="wrap">
          <Button key="new-w" label="new as white" onPress={noop} />
          <Button key="new-b" label="new as black" onPress={noop} />
          <Button key="resign" label="resign" onPress={noop} />
          <Button key="close" label="close" onPress={noop} />
        </Box>
        <Text dimColor>{'click a piece: • move  × capture'}</Text>
      </Box>
    )
  })
}
