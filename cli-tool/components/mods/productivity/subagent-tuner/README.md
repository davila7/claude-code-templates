# subagent-tuner

Vendored from https://github.com/Kruhlikau/subagent-tuner at tag v0.1.7 (MIT). I'm the author.

A mod that settles the model and reasoning effort of every subagent Claude Code starts, so a review can run on Opus and a file search on Haiku.

![A pick pane in Manual, and Auto replacing the model the agent asked for](https://raw.githubusercontent.com/Kruhlikau/subagent-tuner/v0.1.7/docs/media/demo.gif)

## What it does

- **A band above the prompt:** `Tuner [Manual][Auto] · default [model]/[effort] [Reset]`. Click to switch the mode or cycle the saved default.
- **Manual** (the default) asks before a subagent starts: a pane beside the transcript on terminals 144 columns or wider, a short chain of dialogs on narrower ones. A dismissed question starts the subagent with what was shown.
- **Auto** never asks. The saved default wins, even over a model or effort the agent set itself (for example a `CLAUDE.md` rule that makes it pass `model: "opus"`). A toast says what was applied.
- **Recommendation by task kind:** review, audit or security → `opus`/`high`; implement, build or fix → `sonnet`/`medium`; explore, search or research → `haiku`/`low`. A long prompt gets one step more effort.

## Where it stays out of the way

- `claude -p` and SDK hosts: nothing is changed.
- Forks: never touched.
- VS Code extension: no band is possible there, so it never asks and behaves as Auto.
- No network calls. It changes only the `model` and `effort` fields of Agent calls, keeps the mode and default in Claude Code's plugin store, and runs `sh` (macOS, Linux) or `powershell.exe` (Windows) only to wait for an answer in the pane.

## Install

```bash
npx claude-code-templates --mod productivity/subagent-tuner
```

Needs Claude Code 2.1.287 or later (it sets `effort` on the Agent call, so the version must apply a per-call effort; tested on 2.1.295 and 2.1.296 on macOS and Windows 11). Or install straight from the upstream marketplace:

```
/plugin install subagent-tuner --marketplace Kruhlikau/subagent-tuner
```

## Typechecking

`types/claude-code.d.ts` in this folder is the 2.1.283 declaration file, which has no `effort` on the Agent input and no `AskUserQuestion` input type. Each module therefore starts with `// @ts-nocheck`. Upstream typechecks cleanly against the 2.1.296 declarations; regenerate the shared file and the pragmas can go.

Tests: `claude plugin test .` runs the engine test; the unit tests under `hooks/*.test.ts` run against a fake `$` in `hooks/harness.ts`.

## License

MIT, see `LICENSE`.
