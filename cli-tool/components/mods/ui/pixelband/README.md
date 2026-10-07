# pixelband

Animated pixel art above the Claude Code prompt that reacts while Claude works. Pick one of seven
scenes (Michelangelo's hands with a spark between the fingers, a rainy city at night, matrix rain,
an aquarium, space, aurora, fire) or drop in your own image or animated GIF. Zero tokens.

![pixelband: animated pixel-art scenes above the prompt](https://raw.githubusercontent.com/furqan-khan07/pixelband/main/docs/demo.gif)

While Claude works, the band shrinks to a slim strip and the scene picks up (heavier rain, warp
speed, the spark crackling); when a turn finishes it plays a flourish, like lightning. Images are
pixelated on purpose, with styles (original, Game Boy, PICO-8, mono, sepia), a crop you can aim,
and a mode for 256-colour terminals.

`/pixelband` opens a menu to pick a scene or image, style, size and crop, with every change live.
Or use commands: `/pixelband scene city`, `/pixelband set ~/Pictures/cat.gif`, `/pixelband style gameboy`,
`/pixelband help` for the rest.

Hooks: `session.start`, `turn.start`, `turn.complete`, `ui.render` (AbovePrompt and its own Pane),
`command.run`. It reads images you point it at, lists your newest images in Downloads, Desktop and
Pictures for the menu, and runs macOS's `sips` (or ImageMagick) only to convert photo formats.

## Install

```sh
npx claude-code-templates@latest --mod ui/pixelband
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/pixelband/`, which Claude Code auto-loads as `pixelband@skills-dir`. `claude plugin validate .claude/skills/pixelband` prints every event it hooks and every `$` call it makes.

By [Furqan Khan](https://github.com/furqan-khan07). Tests: `claude plugin test` in this folder (decoders checked against Pillow). Source and updates: https://github.com/furqan-khan07/pixelband (MIT). A star there helps.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
