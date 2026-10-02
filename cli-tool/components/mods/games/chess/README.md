# chess

Chess against Claude (or [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), when a Jev key is configured) in a side pane while you work. Every move Claude makes shows the tokens it cost, as the API reported them, and the pane keeps the running total for the game.

```
You White vs Claude Black

8 ♖ ♘ ♗ ♕ ♔ ♗ ♘ ♖
7 ♙ ♙ ♙ ♙   ♙ ♙ ♙
6
5         ♙
4         ♟
3           ♞
2 ♟ ♟ ♟ ♟   ♟ ♟ ♟
1 ♜ ♞ ♝ ♛ ♚ ♝   ♜
   a  b  c  d  e  f  g  h

Your move (White): click a piece
move  e4, Nf3, O-O, e7e8q
╭────────────────────────────────╮
│ Claude's tokens (API usage)    │
│ last Nc6: 48k                  │
│ in 240 · out 4 · cache r 48k w 0│
│ game: 96k over 2 moves         │
╰────────────────────────────────╯
1...  e5        48k  out 4
2...  Nc6       48k  out 4
[ new as white ] [ new as black ] [ resign ] [ close ]
```

Run `/chess` to open the board (`/chess black` to play Black, `/chess white` for a new game as White) and `/chess stop` to close it. Closing keeps the game; `/chess` reopens it where it was.

## Playing

- **Click** one of your pieces, then a square. The picked square turns yellow, the squares it can move to turn blue with a `•`, and the pieces it can capture turn red with a `×` (en passant included). Click another of your pieces to switch, or the same one to drop it. A pawn clicked onto the last rank becomes a queen.
- **Type** a move in the field under the board: SAN (`e4`, `Nf3`, `exd5`, `O-O`, `e8=N`) or UCI (`e2e4`, `e7e8n`).
- `new as white` / `new as black` start over; `resign` ends the game.
- Your side is always at the bottom.

Unicode draws White's pieces as outlines and Black's as solid shapes, which only reads right as dark ink on a light background. On a dark Claude Code theme (and on `auto`) the pane swaps them, so White is solid and Black is a dimmed outline; on a `light*` theme it keeps the Unicode convention. The theme is read when the session starts and each time you run `/chess`. A mod cannot see what `auto` resolved to, so if your terminal is light under `auto`, set the `board` option to `light`.

The board is drawn as 64 fixed 3 x 1 cells on every surface. On Claude Code Desktop (HTML) a square used to size itself to its text, so empty squares came out narrower than ones with a piece and the rows drifted; the cells now have a fixed size, and the desktop gets no-break spaces so the label's padding is not collapsed. The terminal draws exactly what it did before.

Mouse clicks land in the fullscreen layout. Everywhere else, focus the pane (ctrl+x tab), then move with Tab and press with Enter. The Claude Code mobile app has no text field, so there you click.

The full rules are enforced: castling, en passant, promotion, check, checkmate, stalemate, the fifty-move rule, threefold repetition and insufficient material.

## Where it draws

In the **fullscreen layout** the engine docks the pane beside the transcript, floor to ceiling. That layout needs a terminal at least 110 columns wide; turn it on with `/tui fullscreen` (the session restarts and resumes) or `CLAUDE_CODE_NO_FLICKER=1`. On the classic layout the same pane sits above the prompt. While the pane is open the status line reads `chess: your move · Claude N moves, 96k tokens`.

## How Claude moves, and what the tokens mean

Claude's move comes from `$.model.fork`: one completion over **your session's own transcript**, on the session's model, with tools denied. The prompt gives the position (FEN), the moves so far and Claude's legal moves in SAN, and asks for one of them. The fork shares the main thread's prompt cache, and it is the one model call a mod has that returns the API's usage, which is why the numbers are real and not estimated.

What that means for the numbers:

- **Most of each move is cache read.** The fork re-reads the session's system prompt, tools and conversation from the cache, so a move in a fresh session costs about 48k tokens, nearly all `cache r`, and it grows as your session grows. `in` is the uncached input (the chess prompt, a few hundred tokens), `out` is Claude's reply (a handful), `w` is what was newly written to the cache.
- **The headline is the sum of all four counts.** The breakdown line under it says where they went; cache reads are billed at a fraction of normal input.
- **A move that needed a retry** (Claude named a move that is not legal) makes two calls, and both are counted on that move.
- **Nothing is written to your transcript.** The fork's prompt and reply stay out of the conversation's JSONL.

Before the session's first turn there is no transcript to fork. A move Claude makes then (for example when you start as Black in a new session) goes through `$.model.complete` on `fallbackModel` instead, a short completion with only the chess prompt, so that move costs a few hundred tokens and the pane notes where it came from. If a call fails (an API error, an empty reply) or Claude still names no legal move after one retry, the pane plays a random legal move for it and says why, so the game never stays on "Claude is thinking".

## Playing Jev instead of Claude

Put a Jev key in the chess plugin's options and Jev, TypeSafe's System One decision model, plays the other side. The pane then says Jev wherever it said Claude: the header (`You White vs Jev Black`), the turn line, the token box and the status line.

```json
{ "pluginConfigs": { "chess@skills-dir": { "options": { "typesafeApiKey": "<your key>" } } } }
```

These are the same options jev-model-router, jev-skill-suggestion and jev-auto-mode take, but each plugin reads only its own `pluginConfigs` entry, so the key goes under `chess@skills-dir` too (plain `chess` with `--plugin-dir`). `/config` stores a key there for you and keeps it in secure storage.

- `typesafeApiKey` calls TypeSafe's own API (`POST api.typesafe.ai/v1/systemone`, model `jev-latest`); `gatewayApiKey` calls the Vercel AI Gateway (`POST ai-gateway.vercel.sh/v4/ai/evaluation-model`, model `typesafe-ai/jev`). With both, TypeSafe wins. `provider` forces one, or `claude` to keep Claude with a key set.
- Jev answers typed questions, not text, so each move is one `choice` whose options are exactly the legal moves (SAN, each with a short description), with the position (FEN) and the moves so far as its state. It cannot name an illegal move.
- Jev's move is one HTTP request, not a fork of your session: it reads none of your transcript and spends none of your Claude tokens. The pane shows the tokens the response reports; when it reports none, the move reads `not reported` rather than a guessed number.
- A failed request (a wrong key, a non-2xx status), no answer within `timeoutMs` (15 s), or an unreadable answer plays a random legal move for Jev and says why, as with Claude.

The position and move list are sent to TypeSafe (or the Gateway) on every move of Jev's.

## Options

```
  columns: number        width asked for the docked pane, 30-100 (default 40)
  pieces: string         "unicode" glyphs (default) or FEN "letters" (uppercase White)
  fallbackModel: string  model for a move before the session's first turn (default "haiku")
  board: string          "theme" (default), "dark" or "light": forces the glyph mapping above
  typesafeApiKey: string Jev key for TypeSafe's API (sensitive); set, Jev plays
  gatewayApiKey: string  Jev key for the Vercel AI Gateway (sensitive); set, Jev plays
  provider: string       "auto" (default), "typesafe", "gateway" or "claude"
  typesafeBaseUrl, typesafeModel, gatewayBaseUrl, gatewayModel: string  empty uses the defaults above
  timeoutMs: number      how long to wait for Jev's move (default 15000)
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, never project settings), with `--settings <file>` or in managed settings, under the plugin's full id:

```json
{ "pluginConfigs": { "chess@skills-dir": { "options": { "pieces": "letters" } } } }
```

With `--plugin-dir` the id is plain `chess`. If the unicode pieces look too alike in your terminal's font, `letters` draws `K Q R B N P` for White and `k q r b n p` for Black.

## Install

```sh
npx claude-code-templates@latest --mod games/chess
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/chess/`, which Claude Code auto-loads as `chess@skills-dir` in a **trusted** project (accept the trust prompt once; `claude -p` never shows it). For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/chess`. `claude plugin validate .claude/skills/chess` prints every event it hooks and every `$` call it makes.

If `/chess` is missing from the typeahead, the mod did not load: run `claude --debug` and look for `hooks module chess@… loaded` in `~/.claude/debug/latest`.

## Tests

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .claude/skills/chess
```

The rules are checked against published perft move counts. The Jev tests check the request (a choice over exactly the legal moves) and how each response is read. The pane tests answer `$.model.fork` and `$.model.complete` from a script, mount the pane on the terminal surface, click and type moves, and read the token lines.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Written and tested on 2.1.283 against its declarations; on 2.1.283 `$.model.fork` and `$.model.complete` resolve `{ isAnswered, text, usage }`, and the mod also reads the older string/null results. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
