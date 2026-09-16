# doom

Doom above the Claude Code prompt, for the minutes Claude spends working: a corridor shooter: imps, a shotgun, and the floor below. The game pauses and its status line says so when Claude finishes the turn, so you never miss a reply. Playing costs no tokens: the mod answers every key and click itself.

> A single game split out of [sezaakgun/cc-arcade](https://github.com/sezaakgun/cc-arcade) (MIT, by Seza Akgün). Want all nine games, a picker and the pet in one plugin? Install `games/cc-arcade` instead.

## Play

1. `/doom` opens the board above the prompt (`/doom stop` or the `close` button closes it).
2. **Click the board** to give it the keyboard; **Esc** gives the keyboard back to the prompt.
3. `W` `S` or ↑ ↓ walk, `A` `D` strafe, ← → or `q` `e` turn, mouse over the view aims and a click fires, Space or Enter fires, `1`/`2`/`3` select a weapon. `/doom colorblind` toggles a palette that does not lean on red against green.

Your best score is kept in the plugin's store across sessions.

## Install

```sh
npx claude-code-templates@latest --mod games/doom
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/doom/`, which Claude Code auto-loads as `doom@skills-dir`. For one session with hot reload: `claude --plugin-dir .claude/skills/doom`.

## Requirements

- Claude Code 2.1.269 or later (the first build whose function hooks draw above the prompt) with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`. The `$` API is early access and may change between releases.
- An interactive terminal that reports the mouse. Nothing draws in `claude -p`, the desktop app or mobile.
- A terminal font with box-drawing and block characters.

Clones of the genre, not affiliated with or endorsed by the original publishers.
