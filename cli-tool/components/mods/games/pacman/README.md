# pacman

Pac-Man above the Claude Code prompt: a 19×15 maze, four ghosts that chase, scatter and flee, power pellets, three lives and faster levels. Plays while Claude works, pauses when the turn ends, keeps your best score; zero tokens. Needs function hooks (early access) and an interactive terminal. Zero tokens: the mod answers every key and click itself and never asks the model anything.

## Play

1. `/pacman` opens the maze above the prompt (`/pacman stop` or the `close` button closes it).
2. **Click the maze** to give it the keyboard; **Esc** gives the keyboard back to the prompt.
3. Arrows or WASD steer: the turn is taken at the next opening. Space or `p` pauses, `r` restarts.
4. Pellets are 10 points, a power pellet 50 and makes the ghosts edible for a few seconds: 200, 400, 800, 1600 in a row. The row in the middle is a tunnel. Clear the maze and the next level is faster.

The four ghosts behave like the originals: red chases you, pink aims four cells ahead of you, cyan mirrors red through you, green chases while far and runs to its corner while near. They switch to a scatter pattern now and then.

Your best score is kept in the plugin's store across sessions.

## Install

```sh
npx claude-code-templates@latest --mod games/pacman
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/pacman/`, which Claude Code auto-loads as `pacman@skills-dir`. For one session with hot reload: `claude --plugin-dir .claude/skills/pacman`. `claude plugin validate .claude/skills/pacman` prints every event it hooks and every `$` call it makes.

## How it is built

`hooks/register.tsx` is the hooks module: it registers `/pacman`, mounts the board on the `AbovePrompt` band and keeps the score in `$.store`. `hooks/games/*.ts` is the game's logic, pure functions with no drawing, and `hooks/boards/*.tsx` is the surface module that draws it in two-character cells on the drawing thread and takes the keys and the mouse. Written for aitmpl.com against Anthropic's published function-hooks declarations.

## Requirements

- Claude Code 2.1.269 or later (the first build whose function hooks draw above the prompt) with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`. The `$` API is early access and may change between releases.
- An interactive terminal that reports the mouse. Nothing draws in `claude -p`, the desktop app or mobile.
- A terminal font with box-drawing and block characters.

A clone of the genre, not affiliated with or endorsed by the original publisher.
