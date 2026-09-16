# flappy

Flappy above the Claude Code prompt, for the minutes Claude spends working: flap through the gaps in the pipes. The game pauses and its status line says so when Claude finishes the turn, so you never miss a reply. Playing costs no tokens: the mod answers every key and click itself.

> A single game split out of [sezaakgun/cc-arcade](https://github.com/sezaakgun/cc-arcade) (MIT, by Seza Akgün). Want all nine games, a picker and the pet in one plugin? Install `games/cc-arcade` instead.

## Play

1. `/flappy` opens the board above the prompt (`/flappy stop` or the `close` button closes it).
2. **Click the board** to give it the keyboard; **Esc** gives the keyboard back to the prompt.
3. Space, ↑, `w`, Enter or a click flaps. `p` pauses, `r` restarts. Touching the ceiling only stops you; the floor and the pipes end the round.

Your best score is kept in the plugin's store across sessions.

## Install

```sh
npx claude-code-templates@latest --mod games/flappy
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/flappy/`, which Claude Code auto-loads as `flappy@skills-dir`. For one session with hot reload: `claude --plugin-dir .claude/skills/flappy`.

## Requirements

- Claude Code 2.1.269 or later (the first build whose function hooks draw above the prompt) with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`. The `$` API is early access and may change between releases.
- An interactive terminal that reports the mouse. Nothing draws in `claude -p`, the desktop app or mobile.
- A terminal font with box-drawing and block characters.

Clones of the genre, not affiliated with or endorsed by the original publishers.
