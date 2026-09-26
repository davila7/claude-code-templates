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
 * `fallbackModel`, which reports no usage, and the pane says so.
 *
 * Nothing here touches files, git or the transcript.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259).
 *
 * Options (pluginConfigs["chess@skills-dir"].options):
 *   columns: number        width asked for the docked pane (default 40)
 *   pieces: string         "unicode" (default) or "letters"
 *   fallbackModel: string  model for a move made before the first turn (default "haiku")
 */
import type { ModelForkResult, Register } from 'claude-code'
import { findMove, legalMoves, squareIndex, squareName } from './chess.ts'
import type { Color, Piece } from './chess.ts'
import {
  addUsage,
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
import type { Game, Played } from './game.ts'

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

type Fork = (prompt: string) => Promise<ModelForkResult | null>
type Complete = (prompt: string) => Promise<string>

let game: Game = newGame('w')
let picked = -1
let thinking = false
let note: string | undefined
let isOpen = false
// the Claude Code theme is dark (or auto, taken as dark) unless it names light
let darkTheme = true
// raised by every new game, so a reply that lands after one is dropped
let generation = 0

const isDarkTheme = (value: unknown) => typeof value !== 'string' || !value.startsWith('light')
// `auto` follows the terminal, which a mod cannot read, so `board` can say which it is
const pickDark = (board: unknown, theme: unknown) => (board === 'dark' ? true : board === 'light' ? false : isDarkTheme(theme))

const paneColumns = (v: unknown) => (typeof v === 'number' && v >= 30 && v <= 100 ? Math.round(v) : DEFAULT_COLUMNS)

function statusText(): string | undefined {
  if (!isOpen) return undefined
  const { usage, moves } = gameUsage(game)
  const where = resultText(game) ?? (thinking ? 'Claude is thinking' : isYourTurn(game) ? 'your move' : 'Claude to move')
  return `chess: ${where} · Claude ${moves} move${moves === 1 ? '' : 's'}, ${fmt(totalTokens(usage))} tokens`
}

/**
 * Claude's move: fork, read the reply, one retry naming the miss, then a
 * random legal move so the game never stalls. Usage of every call is summed.
 */
async function claudeMoves(fork: Fork, complete: Complete, fallbackModel: string): Promise<void> {
  const gen = generation
  let usage: Played['usage'] = null
  let reply = ''
  let move
  let how: string | undefined
  for (let attempt = 0; attempt < 2 && !move; attempt++) {
    const prompt = movePrompt(game, attempt ? reply : undefined)
    const forked = await fork(prompt).catch(() => null)
    if (gen !== generation) return
    if (forked) {
      reply = forked.text
      usage = usage ? addUsage(usage, forked.usage) : { ...forked.usage }
    } else {
      reply = await complete(prompt).catch(err => {
        how = `${fallbackModel} failed: ${String(err).slice(0, 60)}`
        return ''
      })
      if (gen !== generation) return
      how ??= `${fallbackModel}, no transcript to fork yet: usage not reported`
    }
    move = readReply(game.pos, reply)
    if (!move && attempt === 0 && reply) how = `retried: "${reply.trim().slice(0, 16)}" was not legal`
  }
  if (!move) {
    const legal = legalMoves(game.pos)
    move = legal[Math.floor(Math.random() * legal.length)]
    how = 'random: Claude named no legal move'
  }
  game = play(game, move, { by: 'claude', usage, ...(how ? { note: how } : {}) })
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
  const fallbackModel = typeof options.fallbackModel === 'string' && options.fallbackModel ? options.fallbackModel : 'haiku'

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: COMMAND,
        description: 'Play chess against Claude in a side pane; shows the tokens each of its moves costs',
        argumentHint: '[white|black|stop]',
        immediate: true,
      })
      .catch(err => $.ui.log(`chess: /${COMMAND} not registered: ${err}`))
    $.ui.log(`chess loaded: /${COMMAND} opens the board`, { to: 'debug' })
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
      await claudeMoves(
        prompt => $.model.fork({ prompt }),
        prompt => $.model.complete({ model: fallbackModel, prompt, maxTokens: 64 }),
        fallbackModel,
      )
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
      await claudeMoves(
        prompt => $.model.fork({ prompt }),
        prompt => $.model.complete({ model: fallbackModel, prompt, maxTokens: 64 }),
        fallbackModel,
      )
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
      await claudeMoves(
        prompt => $.model.fork({ prompt }),
        prompt => $.model.complete({ model: fallbackModel, prompt, maxTokens: 64 }),
        fallbackModel,
      )
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
    const glyph = (p: Piece) => {
      if (p === '' || letters) return p || ' '
      const solid = isWhite(p) === darkTheme
      return (solid ? SOLID : OUTLINE)[p.toLowerCase()]
    }

    const board = ranks.map(rank => (
      <Box key={`rank:${rank}`} flexDirection="row">
        <Text dimColor>{`${rank + 1} `}</Text>
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
            <Box key={`cell:${sq}`} backgroundColor={bg}>
              <Button
                key={`sq:${squareName(sq)}`}
                plain
                dimColor={darkTheme && p !== '' && !isWhite(p)}
                label={label}
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
    const result = resultText(g)
    const turnLine = result ??
      (thinking
        ? 'Claude is thinking…'
        : isYourTurn(g)
          ? `Your move (${colorName(g.you)}): ${picked >= 0 ? 'click a highlighted square' : 'click a piece'}`
          : 'Claude to move')

    return (
      <Box flexDirection="column">
        <Text bold>{`You ${colorName(g.you)} vs Claude ${colorName(claudeColor(g))}`}</Text>
        <Box key="board" flexDirection="column" marginTop={1}>
          {board}
          <Text dimColor>{`  ${files.map(f => ` ${'abcdefgh'[f]} `).join('')}`}</Text>
        </Box>

        <Box key="turn" marginTop={1} flexDirection="column">
          <Text bold color={result ? 'magenta' : thinking ? 'yellow' : 'green'}>{turnLine}</Text>
          {note ? <Text color="red" wrap="truncate-end">{note}</Text> : null}
          {Input && isYourTurn(g) && !thinking ? (
            <Input key="move" label="move " placeholder="e4, Nf3, O-O, e7e8q" submitLabel="play" onSubmit={noop} />
          ) : null}
        </Box>

        <Box key="tokens" marginTop={1} flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
          <Text bold color="cyan">Claude's tokens (API usage)</Text>
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
