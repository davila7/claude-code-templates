# remote-qr

Vendored from https://github.com/heberholanda/Claude-RemoteQR at tag v0.1.1 (MIT). I'm the author.

Shows a **QR Code** for the `/remote-control` link, so you can pick up the session on your phone by pointing the camera at the terminal, with no copying and pasting.

![The QR Code shown above the prompt after /remote-control connects](https://raw.githubusercontent.com/heberholanda/Claude-RemoteQR/v0.1.1/docs/qr.png)

## What it does

- When `/remote-control` connects, Claude Code prints the link as usual and the mod opens a band **above the prompt** with the link's QR Code and a **Close** button.
- The code is compact (about 10 rows × 19 columns): it is drawn with Unicode 16 octant characters, 2 × 4 modules per cell, which keeps the modules square in a 1:2 terminal cell.
- It is drawn white on black, so it scans on light and dark terminals alike.
- The band goes away on **Close** or with your next message.
- If the session is already connected, `/remote-control` opens Claude Code's own menu and the mod stays out of the way.
- No dependencies: the QR Code encoder (byte mode, level M, versions 1 to 10) is built in, after Project Nayuki's reference implementation (MIT).

## How it works

Three hooks: `command.run` on `remote-control`, `prompt.submit` (hides the band) and `ui.render` on `AbovePrompt` (draws it).

`/remote-control` returns no text, so the mod reads the link from Claude Code's local session file (`<config dir>/sessions/<pid>.json`, the `bridgeSessionId` beside this session's id). The bridge connects just after the command returns, so the mod polls for up to about 15 seconds off the hook's clock, then stores the link in `$.state` and the band redraws.

That session file is a Claude Code internal, not a public API: if a future version changes it, the QR Code stops showing up and `/remote-control` keeps working as before.

No network calls. It reads only the session files and three environment variables (`USERPROFILE`, `HOME`, `CLAUDE_CONFIG_DIR`).

## Install

```sh
npx claude-code-templates@latest --mod ui/remote-qr
claude
```

It is written to `.claude/skills/remote-qr/`, which Claude Code auto-loads as `remote-qr@skills-dir`. Or install straight from the upstream marketplace:

```
/plugin install remote-qr --marketplace heberholanda/Claude-RemoteQR
```

**Requirements.** Mods are on by default in Claude Code 2.1.287+. The terminal must draw the octant characters (U+1CD00–U+1CDE5): Windows Terminal 1.22+ draws them itself; elsewhere the font needs them. Tested on Claude Code 2.1.312 with Windows Terminal 1.24 on Windows 11.

## Tips

- **Phone won't read it?** Turn the brightness up, hold the phone a little farther away, or zoom the terminal in (`Ctrl` + `+`).
- **Empty boxes or `?` instead of a code?** The terminal or font lacks the octant characters.
- **No code at all?** It only shows when `/remote-control` *connects*; from the menu, disconnect and run it again.
