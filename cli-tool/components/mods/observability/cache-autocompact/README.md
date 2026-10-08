# cache-autocompact

Runs `/compact` on its own when a big chat's prompt cache is about to run out. You step away, the cache lapses, and the next message pays full price to reread the whole chat. This mod compacts while the cache is still warm, so the compact itself reads the chat at the cache price and the message you send when you come back starts from a short summary.

It is the action half of [prompt-cache-control](../prompt-cache-control). That mod shows the countdown and tells you to `/compact`. This one does it for you. The two can run side by side.

## What it does

- Watches each main-loop request and counts the cache down with the same code as prompt-cache-control (`hooks/cache.ts` is a copy of that mod's file with a three-line header comment added), so the two always agree.
- Fires when the chat is at or over **100k tokens** and the cache has under **5:00** left. Both are options. On a 5-minute cache (an API key, a cloud provider, usage credits) the window is capped at 2:00, so it fires 3 minutes after the last request started. It waits while a reply or a turn is still running, or while another compaction runs. A request that started 3 to 5 minutes before its turn ended is compacted as soon as the turn ends; one that started 5 minutes or more before has outlived its cache, and the status line says it was missed.
- Says so every time. In the terminal that is a toast, plus a transcript line with the size before and after and what the compact itself cost. In the desktop app (below) it is a toast that it is running `/compact`; the compaction is Claude Code's own, so there is no size or cost line from the mod.
- Says so again when it fails. A refused compact pops up once per cache while it keeps retrying. A `/compact` it ran is shown as still queued or running until Claude Code takes it. It fails, with a pop-up giving the reason and how long the cache has left, when the command throws, when another plugin vetoes it, when the cache runs out first, or when no compaction has turned up 90 seconds (or half the time left, whichever is shorter) after the command returned. If it lands after all, a second pop-up says so. A compact another plugin vetoes pops up once and is not asked again. Either way the status line says it failed, never that it compacted. A `/compact` it ran that no compaction has settled holds off any further one until a compaction turns up, so running `/compact` yourself starts it again.
- Shows what it will do in the status line: `Auto-compact armed: fires in 56m`, `Auto-compact due now`, `Auto-compact waits for 100k (chat is 40k)`, `Auto-compact due, waiting for the reply to finish`, `Auto-compact off in this folder`, `Auto-compact off: can't find skip folder ...`, `Auto-compact ran /compact: still queued or running`, `Auto-compact ran /compact, waiting for it to finish`, `Auto-compact failed (...). Run /compact yourself`, `Auto-compact missed: the cache ran out`.
- Leaves chosen folders alone (`skipPaths`). A session started in one of them, or below it, or moved into one, never auto-compacts. Links and junctions are followed to where they really land. Folders compare without case everywhere: Windows and macOS ignore case, and on Linux that skips one folder too many, never one too few. A backslash separates folders only in a Windows spelling. `/` skips every folder, on any drive. A skip folder that cannot be found (a typo, a share not mounted, a folder made later) turns auto-compact off, named on the status line and in the transcript, and is looked for again at every check, so it comes back on once the folder turns up.

## In the desktop app

The Claude desktop app runs Claude Code headless, and there the engine refuses a plugin's own compact ("not available in a headless (-p / SDK) session yet"). When a refusal says "not available in a headless" the mod runs `/compact` as if you typed it. That path was proven in a live desktop session: the mod queued `/compact` on its own, with nobody typing. Any other refusal is never turned into `/compact`.

## What it cannot do

- **Compact while Claude is waiting on you.** The engine refuses a compact while a turn runs. Walk away from a permission prompt or a question and the cache can lapse with nothing fired. The status line says so.
- **Pick up after a hot reload while idle.** A reload starts with no recorded request, so nothing fires until the next message. That fails safe: no compact, never a wrong one.
- **See the cache lifetime directly.** The mod API passes on only the four token counts, so the lifetime is worked out the way prompt-cache-control does it: Claude Code's own TTL rules, corrected by request timing. Settings that cannot be read count as the 5-minute cache, so it compacts early rather than after a lapse.

It fails closed. An unknown folder, a folder whose real location cannot be found, or a skip folder that cannot be resolved all mean "do not compact."

## What it hooks

- `turn.step`: records each main-loop request's usage (subagents keep their own caches and are left out), and holds the mod while one runs
- `turn.start` / `turn.complete`: holds the mod while a turn goes on between its requests
- `session.compact`: holds the mod while anything else compacts the chat, then forgets the recorded request, so it is never compacted twice
- `session.start`: sets up when a session starts
- `session.end`: starts over on `/clear` and resume (a `/clear` fires no `session.start`)
- `classic.CwdChanged`: rechecks the folder when the session moves
- `$.clock.every(5000)`: decides whether now is the moment, then checks the folder right before it calls `$.session.compact()`

## Options

```
  minTokens: number       smallest prompt worth compacting (default 100000)
  windowSeconds: number   seconds left on the cache at which it fires (default 300, capped at 120 on a 5-minute cache)
  skipPaths: string       comma-separated folders it never fires in (default none)
```

## Install

```sh
npx claude-code-templates@latest --mod observability/cache-autocompact
claude
```

It is written to `.claude/skills/cache-autocompact/`, which Claude Code auto-loads as `cache-autocompact@skills-dir` once the workspace trust prompt is accepted. `claude plugin validate .claude/skills/cache-autocompact` lists what it hooks and calls. `claude plugin test .claude/skills/cache-autocompact` runs its tests.

Options are read from user settings (`~/.claude/settings.json`, never project settings), `--settings <file>` or managed settings:

```json
{ "pluginConfigs": { "cache-autocompact@skills-dir": { "options": { "skipPaths": "/home/me/finance, /home/me/experiments" } } } }
```

**Requirements.** Mods are on by default in Claude Code 2.1.287+. Builds from 2.1.259 to 2.1.286 need `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`.

## Tests

124 tests under `claude plugin test`, passing on Linux and Windows. `decide.test.ts` covers the decision logic, the window edges, path spellings and the status line. `lifecycle.test.ts` drives the whole mod through the engine on a mocked clock, including runs that pause the mod mid-check and change the world underneath it: a `/clear`, a manual `/compact`, a folder change, a cache that lapses during the check. One branch cannot be staged there: the test kit swaps the words of any refusal for its own, so the desktop handoff to `/compact` is covered by the live run above, and the state it shares with a veto is tested through the engine.
