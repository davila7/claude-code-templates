# sudus-status

[Sudus](https://github.com/eas4ai/sudus) is the referee for agent-led software development: it reads the repository and names the next action. This mod puts that verdict in front of you while Claude works: a status line under the prompt, a pane beside the transcript, or both, with a [blobatar](https://github.com/Alain00/blobatar) face whose expression follows the verdict. Zero tokens: the mod runs `sudus wake` itself and never asks the model anything.

<img src="https://blobatar.dev/avatar/sudus?background=squircle&size=96" width="96" alt="the sudus face" align="left" /> `(o_o) Sudus | Resolvable | run WTE-001 | no current receipt carries a result for WTE-001`<br clear="all" />

| verdict | face |
| --- | --- |
| a turn is running | thinking |
| Resolvable: work to do | idle |
| Waiting: you owe an answer | sad |
| Waiting with no developer to answer (exit 4) | mad |
| a repair, a recover, or outside a project (exit 3) | sick |
| Done | happy |

## Install

```sh
npx claude-code-templates@latest --mod productivity/sudus-status
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/sudus-status/`, which Claude Code auto-loads as `sudus-status@skills-dir` in a trusted project. The `sudus` command must be on PATH; the Sudus plugin's `install-sudus` skill sets it up.

## Settings

Everything is set in `~/.claude/settings.json`; there is no command.

```json
{ "pluginConfigs": { "sudus-status": { "options": { "view": "both", "face": "sudus" } } } }
```

| option | values | default |
| --- | --- | --- |
| `view` | `status-line`, `pane`, `both`, `off` | `status-line` |
| `face` | any text; blobatar draws the same face from the same text every time. `sudus` is built in, any other text is fetched from blobatar.dev once per session | `sudus` |
| `asciiFace` | `true` puts a small ASCII face in the same expression before the status line | `true` |
| `command` | the command that runs Sudus | `sudus` |

## What it hooks

| event | what the hook does |
| --- | --- |
| `session.start` | fetches another `face` if one is set, opens the pane under `pane` or `both`, runs `sudus wake` |
| `turn.start` | the face thinks while the main loop's turn runs |
| `turn.complete` | runs `sudus wake` again (a subagent's turn is ignored) |
| `tool.call` on `Bash` | runs `sudus wake` after a `sudus`, `cairn` or history-changing `git` command |
| `ui.render` on `Pane` | draws the face (Image on the terminal, Svg elsewhere), the verdict, action, reason and predicate |
| `ui.close` on the pane | a pane you closed stays closed for the session |

## How it is built

`hooks/register.tsx` is the hooks module; no hook waits on `sudus wake`: it asks for a refresh and returns, and `hooks/latest.ts` runs one wake at a time with the newest request always landing. `hooks/verdict.ts` reads what `sudus wake` printed and says what the line and the face show; `hooks/raster.ts` draws a blobatar SVG (paths of M, C and Z, circles, groups with a fill and a translate) into RGBA pixels for the terminal's Image element; `hooks/faces.ts` holds the six expressions for `sudus`, and `node scripts/faces.mjs` rewrites it from blobatar.dev. `bun test` runs the pure parts; `claude plugin validate` lists every event it hooks and every `$` call it makes.

## Requirements

- Claude Code 2.1.259 or later with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`. The `$` API is early access and may change between releases.
- The `sudus` command, 3.1.2 or later.
- The pane draws the picture on a terminal with image support (kitty graphics); elsewhere its alt text stands in.
