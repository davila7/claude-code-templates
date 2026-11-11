# spooky-season

A Halloween band above the prompt: a row of dripping blood, a pumpkin and a
`/halloween off` hint. It also swaps the line that closes each turn
(`Baked for 4s`) for a haunted word (`Haunted for 4s`, `Brewed for 4s`,
`Cursed for 4s`).

The band composes with other mods: it draws its own two rows and then
whatever the next band returns (`next(e)`) under them, so a cache line or an
open game board still shows.

## The full Halloween look

A mod can redraw a few spots of Claude Code, but not its colors. The
complete look is three components, each usable alone:

| Component | What it changes | Where |
| --- | --- | --- |
| `--setting appearance/halloween-theme` | Colors: orange logo and accents, blood-red prompt border, bone text, purple plan mode | Terminal |
| `--setting appearance/halloween-spinner` | Spinner words: Conjuring, Brewing, Haunting… | Terminal (Desktop untested) |
| `--mod ui/spooky-season` (this) | Dripping band above the prompt, haunted end-of-turn words, `/halloween` | Terminal; the band also draws in Desktop |

```sh
npx claude-code-templates@latest --setting appearance/halloween-theme,appearance/halloween-spinner --mod ui/spooky-season
```

Claude Code reads custom themes only from `~/.claude/themes/`, so the theme
file always lands there; the `theme` key goes to whichever settings file you
choose. If the colors don't change, pick "Halloween" in `/theme`.

## Command

```
/halloween        toggle the band and the turn words
/halloween on     show them
/halloween off    hide them (the theme stays until you pick another in /theme)
```

The choice is kept across sessions (`$.store`). A mod cannot switch the theme
itself: Claude Code accepts only its built-in themes from a plugin, so
custom themes are picked in `/theme`.

## Install

```sh
npx claude-code-templates@latest --mod ui/spooky-season
claude
```

It is written to `.claude/skills/spooky-season/`, which Claude Code
auto-loads as `spooky-season@skills-dir` in a trusted project. For one
session with hot reload: `claude --plugin-dir .claude/skills/spooky-season`.

**Requirements.** Claude Code 2.1.287+ (mods on by default). Tested on
2.1.316 in the terminal. Typed against Anthropic's declarations:
https://github.com/anthropics/claude-code/tree/main/mods
