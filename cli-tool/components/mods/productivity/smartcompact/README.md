# smartcompact

A Claude Code mod that compacts the conversation at the right moment with a summary focused on the current task, and then picks the work back up. The [repo README](https://github.com/ambervdberg/smartcompact/blob/main/README.md) covers install and requirements.

Requires Claude Code 2.1.289 or newer.

## What it does

After each turn of the main conversation:

1. When the answer ends with the compact tag, the session asked for a compaction itself and the judge is not asked. See [When the session asks](#when-the-session-asks).
2. Below the [token floor](#token-floor) it does nothing.
3. While [subagents run](#running-subagents) it waits.
4. It asks a small judge model whether this is a good moment to compact. A good moment is a finished piece of work, for example when Claude offers to push or to start the next task. The turn never waits for the judge.
5. On a yes it checks that no new turn and no new subagent started meanwhile. Then it waits until the prompt box is empty and no dialog is open, and compacts with the instructions `Keep the current goal, the next step and open decisions.` A new main-loop turn, a `/clear` or a manual `/compact` drops pending judge and tag work, including a continue prompt still being prepared. Subagent turns do not drop it. A new turn before the compaction runs drops it, and the next finished turn is judged again. So does a dialog that stays open for two minutes.
6. After its own compaction it sends the [continue prompt](#continue-prompt), so Claude goes on with the work. It never sends one after a compaction it did not start, such as `/compact` typed by hand or Claude Code's own auto-compact.

During a turn above the floor, the plugin also adds a hidden [nudge](#the-nudge) after a tool result, so a busy session picks a moment itself.

### Token floor

The floor (`minTokens`, 60k by default) counts only the tokens added since a starting point, not the whole context:

- The starting point is the first turn of the session, the first turn after a `/clear`, or the first turn after a compaction. That first turn itself is never judged.
- The count starts from the context size when that first turn began: the input of its first model request, so the context plus the prompt. A first turn with only one request counts from its size at the end.
- So a new session does not count its startup context, and a compaction cannot follow right after another one.
- Claude Code has no token count before the first answer after a new session or a compaction. A turn that ends without a count is not judged, sends no nudge, follows no tag and is not taken as the first turn. The log gets a `usage-missing` line.
- A resumed or respawned session keeps its saved count. A resumed session without a saved count starts over as a new session.

### Running subagents

Only agents with a `pending`, `running` or `waiting` status count as running. An agent whose meta file says `finished: true`, or whose transcript last changed at least 60 minutes ago, no longer counts. If those files are missing, cannot be read or hold broken JSON, the engine status decides. The files are found under `CLAUDE_CONFIG_DIR`, or `.claude` in the home folder by default.

While agents run, the judge waits. A tag goes on only when it names each running agent id (see [When the session asks](#when-the-session-asks)). A due nudge is still sent and lists the running ids.

### Status line

A line under the prompt box shows what the plugin is doing, for example `smartcompact: judge in 48k`. It sits next to Claude Code's own notices. A custom `statusLine` script does not show it.

![The status line during one compaction: judge in 15k, nudged, compacting, continued](https://raw.githubusercontent.com/ambervdberg/smartcompact/main/docs/images/status-steps.png)

| Status | Meaning |
| --- | --- |
| `judge in 48k` | Below the floor. The judge is asked once the conversation has grown 48k more tokens. A new session, a `/clear` and the first turn after them or after a completed compaction show the full floor. A skipped compaction keeps the floor. |
| `judge after next turn` | The floor is reached. The judge is asked when the next turn ends. |
| `waiting for subagents` | Subagents still run, so the judge was not asked. |
| `nudged 14:02` | The session was asked to compact at the next good moment. |
| `judging...` | The judge model is asked. |
| `keep going 14:02` | The judge said this is no good moment to compact. |
| `will compact 14:02` | The judge said yes or the session asked. The compaction follows when the session is free. |
| `yes cancelled 14:02` | The judge said yes, but a new turn or subagent started meanwhile. |
| `request ignored 14:02` | The session asked, but the tag missed a running agent id, the loop guard held or the turn had no token count yet. The log says why. |
| `waiting for empty prompt` | A compaction waits until you empty the prompt box. |
| `waiting for idle` | A compaction waits for a dialog to close or for the session to be free. |
| `compacting...`, `compacted 14:03` | The compaction runs or has finished. |
| `compact skipped 14:03` | Claude Code skipped the compaction, for example because a hook blocked it. |
| `continued 14:03` | The continue prompt was sent. |
| `dropped 14:03` | A new turn started, the session stayed busy, you cancelled the compaction or this mode cannot compact (`claude -p`). |
| `error 14:02` | The judge or a session's request failed. The log says why. A judge reply that is no verdict counts as no and keeps the countdown. The log then has a `judge-unreadable` line with the reply length and whether it starts with `{`. |

## When the session asks

The plugin adds a block named `smartcompact` to the context of each conversation. Claude Code renders it with the first message and again after each compaction or `/clear`. It tells Claude to end its answer with `<smartcompact>the prompt for the next piece</smartcompact>` and stop, when a piece of work is done and the next piece of the same task can start right away without the details so far. Claude leaves the tag out when it waits for other sessions or agents, or when all work is done. It also leaves it out when it waits for the user, unless smartcompact asked it to compact. It never writes an empty tag. Subagents get the block too, so it ends with `Only the main session does this, never a subagent.`

Only a tag at the very end of a main answer counts. Whitespace may follow it. A tag earlier in the text, a tag from a subagent and an empty or blank tag do nothing, and the turn goes to the judge. Else the first match below runs:

1. The tag misses a running agent id: the request is ignored and logged with the running and missing ids. A hidden note `compaction skipped, N subagent(s) still running (<ids>)` asks Claude to tag again with each id and what to do with its report, or once they finish. Each id must match literally, with no letter, digit, `_` or `-` touching either side. So `agent-1.` and `(agent-1)` name `agent-1`, but `agent-10` does not.
2. Loop guard: the request is ignored and logged as `loop guard` when this turn came right after a continue prompt the plugin sent without a compaction. Without it a session that tags again at once loops. It holds when the previous continue prompt followed a compaction Claude Code skipped, at any token count. It also holds when the previous continue prompt was sent below the floor and this turn is below the floor too.
3. Below the floor: nothing is compacted and the continue prompt is sent at once. The first turn of a new session and the first turn after a compaction count as 0 added tokens. With `minTokens: 0`, a tagged first turn can compact.
4. Else the compaction waits as after a judge yes, with the instructions `Keep the current goal, open decisions and what this next step needs: <text>`. With running agents it adds `Keep the ids of the subagents still running (<ids>) and what to do with each report when it arrives.` When Claude Code skips the compaction, the continue prompt is still sent.

The text in the tag fills `{next}` in the continue prompt.

### The nudge

Above the floor, a tool result of the main conversation can be followed by a hidden note:

> smartcompact: this conversation grew 64k tokens since smartcompact started counting. Plan a compaction at the next good moment. Start no new subagents. Then end your answer with <smartcompact>the prompt to start the next piece with</smartcompact>. Do this also when you would wait for the user, and put your question in the tag. Leave the tag out when the user must confirm an action that is hard to undo, such as a push, a delete or a publish.

With running agents, it adds this after "Start no new subagents.":

> 2 subagent(s) still run (agent-1, agent-2). You may tag now if the tag names each of them and says what to do with its report, else let them finish first.

The number is the tokens added since the floor started counting, in thousands. The first note comes with the first tool result above the floor, the next each time the conversation grows another half floor, at least 10k. The count starts over after a compaction, a `/clear` or a new session. There is no note for subagents and none while the floor waits for its first turn. A sent note logs `nudge-sent`, with the running ids when any. A refused note logs `nudge-error`.

When a mode such as `claude -p` lacks a call the nudge needs, the nudge skips without an error status and logs one `nudge-skipped` with reason `not available in this mode`. It does not retry until a new session starts. Compaction and `/clear` do not turn it on again.

After a nudge, a question for you goes into the tag, and the shipped continue prompt asks Claude to ask it again. To let Claude decide and go on without you, put a line like this in your own [continue prompt](#continue-prompt):

```
- If you were waiting on a choice from me, make the best decision and go on.
```

It can also ask Claude to write that choice to the [choices file](#choices-file). A yes or no on an action that is hard to undo stays a normal stop for you to answer.

## Options

Set them with `/plugin configure smartcompact@smartcompact` in a session, or in `settings.json`:

```json
{ "pluginConfigs": { "smartcompact@smartcompact": { "options": { "minTokens": 80000 } } } }
```

A plugin loaded with `--plugin-dir` uses the key `smartcompact` instead of `smartcompact@smartcompact`.

| Option | Default | What it does |
| --- | --- | --- |
| `minTokens` | `60000` | The [token floor](#token-floor): tokens added before the judge is asked or a session's request compacts. |
| `claudeModel` | `haiku` | Model alias or id for the judge. It runs through Claude Code's own model call and needs no setup. |

## Continue prompt

The plugin sends a continue prompt after its own compaction and after a tag below the floor. It reads the text from a file each time, so an edit works at once:

- `~/.claude/smartcompact/continue-prompt.md` when it exists. This is your own copy. An empty file turns the continue prompt off. A prompt that becomes empty when its compacted line is removed is also left unsent.
- Else `continue-prompt.md` in the plugin folder, the shipped default.

Run `/smartcompact-prompt` to copy the default to your own file. It prints the path and says when it just made the file. A file that exists stays as it is.

When nothing was compacted, a first line `Context was compacted automatically.` is left out. Any other first line stays. The plugin fills these placeholders each time they occur:

| Placeholder | Replaced with |
| --- | --- |
| `{next}` | The text in the session's tag. After a judge yes: `Continue where you left off. If the next step is clear, do it.` Keep it in your own file, else the session's prompt for the next piece is lost. |
| `{choicesFile}` | The absolute path of the choices file, in the platform's own spelling. |
| `{choicesHeading}` | One line `## <ISO time> \| <cwd> \| <session id>`, with the time of sending. |

### Choices file

Your own continue prompt can ask Claude to write the choices it made for you to `~/.claude/smartcompact/choices.md`. The plugin folder is the default location for the choices file. With `SMARTCOMPACT_LOG` set, it sits next to that log file. A bare log filename uses the current folder, and `{choicesFile}` is always an absolute path. For example:

```
Append your choices to {choicesFile}. Create the file if it is missing and never overwrite earlier text. Start with this line:
{choicesHeading}
Then write one bullet per choice you made for me, with what you chose and why.
```

A filled heading looks like `## 2026-10-04T10:00:00.000Z | C:/work | session-1`. Each continue adds one block that starts with this line. A dashboard can split the file on lines that start with `## `.

## What it reads, sends and writes

The mod sends nothing to the author or to any server of its own. The only call that leaves the session is the judge, through the engine's own model call (`claudeModel`). The mod reads no credentials. The engine's call does the sign-in. After a turn above the floor, the judge gets:

- up to 2000 characters of the person's last prompt, keeping the head and tail with a short marker between when it is longer
- the last 4000 characters of the last answer
- a one-line summary of the last 40 tool calls since that prompt, 150 characters each

**In the session** it adds the `smartcompact` block to `prompt.context` and changes no other block. Its `session.append` hook runs after a main tool result and may append the hidden nudge row. It changes no stored row. When a tag misses a running subagent id, it appends a hidden note that lists the ids. A subagent gets neither note. It handles only its own command, `/smartcompact-prompt`. It runs `/compact` with the instructions above, and submits only the continue prompt.

The continue prompt is the text of your `continue-prompt.md` or the shipped default. `{next}` is filled with the tag text the session wrote, or the fixed judge-yes line. `{choicesFile}` is filled with the choices path. `{choicesHeading}` is filled with a line holding the time, the working folder and the session id. Nothing else goes in.

**It writes these files** under `~/.claude/smartcompact/` by default:

- `logs/<session id>.jsonl`, capped at 300 KB and trimmed to the newest 150 KB, or the file `SMARTCOMPACT_LOG` names. See [Log](#log) below.
- `continue-prompt.md`, a prompt the mod sends to Claude. It is written only when you run `/smartcompact-prompt` and the file does not exist.

Apart from `continue-prompt.md`, it edits no settings, instructions, hooks, build or start-up file. It reads its own files, the session's messages and token count, the prompt box and the list of running subagents. It lists `projects/` under the Claude config folder, reads `agent-*.meta.json` and reads the modification time of `agent-*.jsonl`. It reads no subagent transcript content.

## Log

Each decision is one JSON line in `~/.claude/smartcompact/logs/<session id>.jsonl`. Each session writes its own file, with only letters, digits, dash and underscore kept in the file name. It stays on your machine. Each file is capped at 300 KB and trimmed to the newest 150 KB of whole lines when it exceeds the cap. Old session files stay because the engine cannot delete files. `SMARTCOMPACT_LOG` overrides the path and makes all sessions share that file. It keeps no text from the conversation and no text the judge wrote. A line holds the event, the time and details such as token counts, the length of the judge's reason (`reasonChars`) or an error message. The rows of a compaction carry `source`: `judge` or `request` (the session's tag). A `compact-started` row shows that the compact call began.

## Development

Checks, in this folder: `claude plugin validate .`, `claude plugin test .` and `npx -p typescript tsc -p .`.

Claude Code writes the API types to `.claude-plugin/types/` when it loads the plugin from a folder. `tsc` needs them. The folder is gitignored, so a fresh worktree has none. In this folder run `tmux new-session -d -s types "claude --plugin-dir $PWD"`, wait 20 seconds, check that `.claude-plugin/types` exists, then `tmux kill-session -t types`.

The tests use `/home/test` as the fake home (`FAKE_HOME` in `tests/fake-engine.ts`). Keep fake paths absolute POSIX paths. A `C:/home` style path fails on Linux, because the engine resolves it under the cwd. The tests cannot read the disk, so `tests/fake-engine.ts` holds a copy of `continue-prompt.md`. Keep the two the same.
