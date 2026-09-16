# diff-invaders

Space Invaders above the Claude Code prompt where every wave is the code Claude just wrote: each line an Edit or Write added becomes a row of the formation and every two characters one alien, so you shoot your own diff. Ship, one shot at a time, bombs, three lives, best score. Zero tokens: the mod answers every key and click itself and never asks the model anything.

## Play

1. `/invaders` opens the board above the prompt (`/invaders stop` or the `close` button closes it).
2. **Click the board** to give it the keyboard; **Esc** gives the keyboard back to the prompt.
3. ← → or `a` `d` move the ship, Space, ↑ or a click fires (one shot in the air at a time), `p` pauses, `r` shoots a demo wave.
4. An alien is 10 points, a cleared wave 50. A bomb on the ship costs a life; a formation that lands ends the game.

The waves come from Claude: every `Edit` or `Write` that goes through is read after it runs, its added lines (up to six) become the rows of the next formation, and every two characters of a line become one alien, spelled with those characters. Waves queue up while you clear the current one, so a long refactor is a long fight. `r` plays a built-in wave while Claude has not written anything yet.

Your best score is kept in the plugin's store across sessions.

## Install

```sh
npx claude-code-templates@latest --mod games/diff-invaders
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/diff-invaders/`, which Claude Code auto-loads as `diff-invaders@skills-dir`. For one session with hot reload: `claude --plugin-dir .claude/skills/diff-invaders`. `claude plugin validate .claude/skills/diff-invaders` prints every event it hooks and every `$` call it makes.

## How it is built

`hooks/register.tsx` is the hooks module: it registers `/invaders`, mounts the board on the `AbovePrompt` band and keeps the score in `$.store`. `hooks/games/*.ts` is the game's logic, pure functions with no drawing, and `hooks/boards/*.tsx` is the surface module that draws it in two-character cells on the drawing thread and takes the keys and the mouse. Written for aitmpl.com against Anthropic's published function-hooks declarations.

## Requirements

- Claude Code 2.1.269 or later (the first build whose function hooks draw above the prompt) with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`. The `$` API is early access and may change between releases.
- An interactive terminal that reports the mouse. Nothing draws in `claude -p`, the desktop app or mobile.
- A terminal font with box-drawing and block characters.

A clone of the genre, not affiliated with or endorsed by the original publisher.
