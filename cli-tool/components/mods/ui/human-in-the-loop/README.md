![Human in the loop: Claude hands you the tasks only you can do; they wait in the My tasks pane until you answer, and your answers go back to Claude](https://raw.githubusercontent.com/tzafrir/human-in-the-loop/main/media/hero.gif)

# Human in the loop

> Vendored from [tzafrir/human-in-the-loop](https://github.com/tzafrir/human-in-the-loop) (MIT, by Tzafrir Rehan). Install with `npx claude-code-templates@latest --mod ui/human-in-the-loop`, or from the author's marketplace as described below. Report issues upstream.

**Claude hands you the tasks only you can do. They wait until you act, and your answer goes back to Claude.**

## Why

Claude often needs something only you can do: a key in `.env`, an approval on staging, a command on your own machine, a decision. Today it says so in the middle of a reply. You're busy steering the next fix, and the ask scrolls away. At best Claude keeps repeating "I still need you to…"; at worst the ask is lost.

With this mod, Claude assigns the ask as a task instead. It waits in the **My tasks** pane, counted under the prompt, until you do it, answer it or reject it.

## An example

> Get our Stripe webhooks library ready to open-source.

Claude works through it, and three times hits something only you can do: the integration tests need your Stripe key, making the repo public is your call, and the package needs a name. Each becomes a task, and Claude keeps working:

```
╭─ My tasks ──────────────────────────────────────────────────────────╮
│ ☐ 3 tasks for you                                                   │
│                                                                     │
│ ☐ #1 Add STRIPE_SECRET_KEY to .env  2m                              │
│   The integration tests run against Stripe's test mode and need it. │
│   Done when: It's in .env. Don't paste it here.                     │
│   d: Done   r: Answer…   x: Reject…                                 │
│ ☐ #2 Decide whether to make the repo public  1m                     │
│ ☐ #3 Choose the package's name on npm  now                          │
│                                                                     │
│ Esc: back to the prompt   Hide                                      │
╰─────────────────────────────────────────────────────────────────────╯
☐ 3 tasks for you · /my-tasks
```

- **#1** you do in your editor, then press `d`. The key never passes through Claude.
- **#2** is your decision: `1` makes the repo public, `2` keeps it private.
- **#3** needs your words: press `r`, type `@acme/stripe-hooks`, Enter.

Answer whenever it suits you. Answers you give while Claude works wait for it, and your next answer after it stops takes them along. Here #1 and #2 were answered while Claude worked and #3 after, so Claude gets them as one message, in your words:

```
My responses to tasks you gave me (Human in the loop):

#1 Add STRIPE_SECRET_KEY to .env: Done.

#2 Decide whether to make the repo public: I chose "Make it public".

#3 Choose the package's name on npm:
@acme/stripe-hooks
```

Claude picks up where it left off: the integration tests pass, the repo goes public, and the package gets its name. Publishing is left to you.

## How it works

- **Claude assigns** with `assign_task`: an imperative title, why it's needed, what counts as done, and a kind (`do`, `answer` or `choose`).
- **The status line** under the prompt counts what's waiting: `☐ 3 tasks for you · /my-tasks`.
- **The My tasks pane** opens by itself when a task arrives. In fullscreen it's a sidebar beside the transcript; on the main screen it sits above the prompt. `/my-tasks` opens it any time, with the keyboard.
- **You respond:** Done, an option (`1`–`4`), an answer (`r`), or a rejection with a reason (`x`). Click, or focus the pane with `/my-tasks` or `ctrl+x tab` and use the keys.
- **Your answer reaches Claude:**
  - while Claude is idle, right away;
  - while it works, it waits, so Claude isn't interrupted, and goes when Claude finishes its turn. If a task is still open then, your answers wait for that one too and arrive together (or with your next prompt). **Send now** sends right away.
- **Long answers** (a log, a stack trace) go through your own prompt box: **Long answer…** starts it with `↳ Answer to #3:`, and you paste and press Enter.
- **Claude keeps working.** Unlike a question dialog, a task doesn't stop Claude: it carries on with everything else while the task waits for you, and takes the task back if it finds another way.
- **Nothing is lost** across a compaction or a new session: open tasks stay with the project and Claude is told about them again. With several sessions open in one project, each keeps its own tasks, so your answer always reaches the Claude that asked.

It never draws in the band above the prompt, so it works beside band mods such as [What's Agent Doing](https://github.com/tzafrir/whats-agent-doing).

## Guardrails

- At most 5 open tasks at a time.
- The same ask twice is one task.
- Only the main agent assigns tasks; a subagent reports what it needs in its result.
- An answer that looks like a secret (an API key, a token, a private key) is held with a warning before it is sent.

## Install

In Claude Code:

```
/plugin marketplace add tzafrir/human-in-the-loop
/plugin install human-in-the-loop@human-in-the-loop
```

Or from your shell:

```
claude plugin marketplace add tzafrir/human-in-the-loop
claude plugin install human-in-the-loop@human-in-the-loop
```

Then start a new session (or run `/reload-plugins`).

**Requirements:** Claude Code in a terminal, or in the desktop app's Code tab. The plugin is a [mod](https://github.com/anthropics/claude-code/blob/main/mods/README.md), written with Claude Code's function hooks, which are early access: they load only where function hooks are enabled, and their API may change between releases.

## Data and privacy

- **Stays on your machine.** Tasks live in the session's own state and in the plugin's own store (a JSON file under your Claude Code configuration directory), keyed by project folder, so open tasks come back in the next session there. No network, no files of yours, no processes.
- **Your responses become part of the conversation.** Claude reads what you answer, and the session's transcript on disk keeps it, like anything you type. That's why tasks ask you to put a secret where it belongs and press Done, never to paste it, and why an answer that looks like a secret is held first.
- **What it adds to the conversation:** the three tools, a few lines in the system prompt telling Claude about tasks, your responses, and, at a conversation's start or after a compaction, a short list of the tasks still open.

### What it sends to Claude, and which tool calls it answers

- **The prompts it submits.** When you respond to a task while Claude is idle, when Claude finishes a turn with your saved responses waiting and no task left open, or when you press **Send now**, the mod submits your response as a prompt in your own words. For each task it carries only the task's number and title and what you did: "Done", the option you chose, your answer, or your reason for rejecting it. It carries nothing else from the conversation or from your machine. One fixed line is the only other prompt it submits: "I answered a task while you were finishing your reply; my answer is above." It goes when your answer arrived during Claude's final reply.
- **While Claude works:** **Send now** adds the same response as a row Claude reads at its next step, with a notice in the transcript for you ("Sent your response to #3 to Claude") that Claude doesn't read.
- **Your prompts:** the mod reads them only to recognize a long answer (`↳ Answer to #3: …`), which it turns into that same response, and to attach responses not yet sent as notes Claude reads.
- **The tool calls it answers:** only calls to its own three tools, `assign_task`, `list_tasks` and `withdraw_task`, which the mod itself serves. Every other tool call passes through untouched.

## Support

Report a problem or ask for a feature in [GitHub Issues](https://github.com/tzafrir/human-in-the-loop/issues). Read the [privacy policy](https://tzafrir.github.io/human-in-the-loop/privacy).

## Develop

Load the plugin from a clone; the session reloads it as you edit:

```
git clone https://github.com/tzafrir/human-in-the-loop
claude --plugin-dir human-in-the-loop
```

```
claude plugin validate --strict human-in-the-loop/.claude-plugin/plugin.json
claude plugin test human-in-the-loop
```

| File | What it does |
|------|--------------|
| `hooks/register.tsx` | The tools Claude calls, delivering your responses, the My tasks pane and status line, `/my-tasks`, long answers through the prompt box |
| `hooks/project.ts` | Each session's tasks in the project's store, and taking on those of sessions that ended |
| `hooks/tasks.ts` | Reading a task from Claude's call, what Claude is told, the status line, secret shapes |
| `hooks/text.ts` | Printable labels, ages, sizes |
| `types/index.d.ts` | The `$.state` contract: the tasks, the selection, the open field |
| `tests/register.test.tsx` | Assigning, the pane and `/my-tasks`, every response and when it reaches Claude, long answers, tasks carried across sessions |
| `docs/DESIGN.md` | The design and the decisions behind it |

## License

MIT
