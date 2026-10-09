# cache-autocompact

Runs `/compact` on its own when a big chat's prompt cache is about to run out. You step away, the cache lapses, and the next message pays full price to reread the whole chat. This mod compacts while the cache is still warm, so the compact itself reads the chat at the cache price and the message you send when you come back starts from a short summary.

It is the action half of [prompt-cache-control](../prompt-cache-control). That mod shows the countdown and tells you to `/compact`. This one does it for you. The two can run side by side.

## What it does

- Watches each main-loop request and counts the cache down with the same code as prompt-cache-control (`hooks/cache.ts` is a copy of that mod's file with a three-line header comment added), so the two always agree.
- Fires when the chat is at or over **100k tokens** and the cache has under **5:00** left. Both are options. On a 5-minute cache (an API key, a cloud provider, usage credits) the window is capped at 2:00, so it fires 3 minutes after the last request started. It waits while a turn is under way (a reply, a tool, or a question waiting on your answer) and while another compaction runs. A request that started 3 to 5 minutes before its turn ended is compacted as soon as the turn ends; one that started 5 minutes or more before has outlived its cache, and the status line says it was missed.
- Says so every time. In the terminal that is a toast, plus a transcript line with the size before and after and what the compact itself cost. In the desktop app (below) it is a toast that it is running `/compact`, and nothing more: the mod does not learn how that `/compact` ended.
- Says so again when it fails. A refused compact pops up once per cache while it keeps retrying. With compaction switched off (`DISABLE_COMPACT` set to 1, true, yes or on, read when the session starts and again when a compact is due), which refuses `/compact` too, it stops asking and the status line says `Auto-compact off: compaction is switched off`. A compact another plugin vetoes pops up once and is not asked again for that cache. In the desktop app, a `/compact` that cannot be run pops up once, and the next reply's cache tries again. A failure is never shown as a compaction, and once the cache has run out the status line says it was missed, with no advice to run `/compact`.
- Shows what it will do in the status line: `Auto-compact armed: fires in 56m`, `Auto-compact due now`, `Auto-compact waits for 100k (chat is 40k)`, `Auto-compact due, waiting for the turn to end (a reply, a tool, or your answer)`, `Auto-compact off in this folder`, `Auto-compact off: can't find skip folder ...`, `Auto-compact started /compact for this cache`, `Auto-compact failed (...). Run /compact yourself`, `Auto-compact missed: the cache ran out`.
- Leaves chosen folders alone (`skipPaths`). A session started in one of them, or below it, or moved into one, never auto-compacts. Links and junctions are followed to where they really land. Folders compare without case everywhere: Windows and macOS ignore case, and on Linux that skips one folder too many, never one too few. A backslash separates folders only in a Windows spelling. `/` skips every folder, on any drive. Skip folders are looked up when a session starts, when it moves, and each time a compact is due, unless the session is already known to be in a skip folder. List absolute folders: `~` is not expanded, and a relative entry is resolved by the engine, not against a folder you chose, so its meaning can change with the session's folder. An entry that names no folder (`.`, `x/..`) or a folder that cannot be found (a typo, a share not mounted, a folder made later) turns auto-compact off, named on the status line and in the transcript, until a later lookup finds it.

## In the desktop app

The Claude desktop app runs Claude Code headless, and there the engine refuses a plugin's own compact ("not available in a headless (-p / SDK) session yet"). On that refusal, and only that one, the mod runs `/compact` once for that cache, as if you typed it, and says so in a toast. Every other refusal stays a refusal: a turn still running, compaction switched off, no session bound. It does not track whether that `/compact` finished: Claude Code queues it until the session is idle and restarts the session when it compacts. A live desktop session backs this: the mod queued `/compact` on its own, with nobody typing.

One assumption no test can stage: the handed-off `/compact` either compacts (which the mod sees) or restarts the session. If it did neither, the compaction's own model request could be recorded as a new big request and the mod would arm again for it.

## What it cannot do

- **Compact while Claude is waiting on you.** The engine refuses a compact while a turn runs. Walk away from a permission prompt or a question and the cache can lapse with nothing fired. The status line says so.
- **Pick up after a hot reload while idle.** A reload starts with no recorded request, so nothing fires until the next message. That fails safe: no compact, never a wrong one.
- **Let another plugin veto the desktop `/compact`.** In the desktop app the engine refuses the mod's own compact before any `session.compact` hook runs, so a plugin that vetoes plugin compacts is never asked, and the `/compact` the mod runs reaches it as a manual one (trigger `manual`). Such a plugin can still stop it on `command.run`, where the call carries `origin: { kind: 'plugin' }`.
- **Recover from a lost turn end.** It waits while a turn is open, from `turn.start` to `turn.complete`. If another plugin's `turn.complete` hook answers without passing the event on, the mod never sees the end and stays held until the next turn starts. A time limit would be wrong here: a permission prompt can rightly hold a turn longer than the cache lasts.
- **See the cache lifetime directly.** The mod API passes on only the four token counts, so the lifetime is worked out the way prompt-cache-control does it: Claude Code's own TTL rules, corrected by request timing. Settings that cannot be read count as the 5-minute cache, so it compacts early rather than after a lapse.

It fails closed. An unknown folder, a folder whose real location cannot be found, or a skip folder that cannot be resolved all mean "do not compact."

## What it hooks

- `turn.step`: records each main-loop request's usage (subagents keep their own caches and are left out), and holds the mod while one runs
- `turn.start` / `turn.complete`: holds the mod while a turn goes on between its requests
- `session.compact`: holds the mod while anything else compacts the chat, then forgets the recorded request, so it is never compacted twice and never credited for a compaction it did not make
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

162 tests under `claude plugin test`, run on Windows with Claude Code 2.1.285 and on Linux (WSL Ubuntu) with Claude Code 2.1.295. `decide.test.ts` covers the decision logic, the window edges, path spellings, which refusals hand off, and the status line. `lifecycle.test.ts` drives the whole mod through the engine on a mocked clock, including runs that pause the mod mid-check, mid-refusal, mid-command or mid-lookup and change the world underneath it: a `/clear`, a resume, a new request, a manual `/compact`, a folder change, a cache that lapses. The test kit cannot stage the engine's own refusals. It drops a test hook that throws and passes the mod's call on with no messages, so the call fails on the engine's general check of what a hook passes to `next()`, under the test's plugin name: "test: next() passed an argument with messages that are not a list". For the desktop tests, a session that is not interactive (`isInteractive` false: a `-p` run or the SDK) takes that exact text as the headless refusal (`KIT_STAND_IN_REFUSAL` in `hooks/decide.ts`). Another plugin passing bad messages raises the same words under its own name, which never matches. So the condition real sessions take, the headless refusal, is covered only by unit tests on the words copied from a live desktop run. Compaction switched off is covered through the engine when `DISABLE_COMPACT` is set; the engine's "switched off" refusal is recognized by a unit-tested predicate, but the code acting on that refusal is not reached by any test.
