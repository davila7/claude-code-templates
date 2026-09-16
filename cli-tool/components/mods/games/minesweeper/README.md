# minesweeper

Minesweeper above the Claude Code prompt, for the minutes Claude spends working: open every cell that is not a mine. The game pauses and its status line says so when Claude finishes the turn, so you never miss a reply. Playing costs no tokens: the mod answers every key and click itself.

> A single game split out of [sezaakgun/cc-arcade](https://github.com/sezaakgun/cc-arcade) (MIT, by Seza Akgün). Want all nine games, a picker and the pet in one plugin? Install `games/cc-arcade` instead.

## Play

1. `/minesweeper` opens the board above the prompt (`/minesweeper stop` or the `close` button closes it).
2. **Click the board** to give it the keyboard; **Esc** gives the keyboard back to the prompt.
3. click a cell to open it, right-click to flag it. Without a mouse: arrows move the blue cursor, Space or Enter opens, `f` flags. `r` deals a new board. The first click never hits a mine.

Your best score is kept in the plugin's store across sessions.

## Install

```sh
npx claude-code-templates@latest --mod games/minesweeper
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/minesweeper/`, which Claude Code auto-loads as `minesweeper@skills-dir`. For one session with hot reload: `claude --plugin-dir .claude/skills/minesweeper`.

## Requirements

- Claude Code 2.1.269 or later (the first build whose function hooks draw above the prompt) with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`. The `$` API is early access and may change between releases.
- An interactive terminal that reports the mouse. Nothing draws in `claude -p`, the desktop app or mobile.
- A terminal font with box-drawing and block characters.

Clones of the genre, not affiliated with or endorsed by the original publishers.
