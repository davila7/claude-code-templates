# pane-backdrop

Vendored from https://github.com/Sallvainian/claude-code-mods at commit 5f29d5c (version 0.1.0, MIT). I'm the author.

Gives every mod's pane a transparent background, so your terminal's own background shows through the pane body instead of a solid fill.

A mod that picks a background color for its pane keeps it. pane-backdrop only fills in `transparent` where the mod left the color unset.

## Access

It hooks `ui.open` and nothing else. When a pane opens without a `backgroundColor`, it passes the call on with `backgroundColor: 'transparent'`. It has no settings or commands, reads nothing, writes nothing, makes no network calls and runs no processes.

## Install

```bash
npx claude-code-templates --mod ui/pane-backdrop
```

Needs Claude Code 2.1.287 or later; built on 2.1.317 on macOS. Or install it from the upstream marketplace, in the terminal:

```bash
claude plugin marketplace add Sallvainian/claude-code-mods
claude plugin install pane-backdrop@claude-code-mods
```

Or inside a Claude Code session:

```text
/plugin marketplace add Sallvainian/claude-code-mods
/plugin install pane-backdrop@claude-code-mods
```

## License

MIT
