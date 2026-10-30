# agent-standup-band

A line above your Claude Code prompt when another Claude Code session on this computer needs you:

    ✋ web-shop (VS Code) needs an approval
    Agent Standup · /agent-standup:open shows them all   Hide

and a short toast when one starts waiting for you, or finishes its turn ("✓ api has finished: your turn there"). You stay in the session you are working in and still know when another one is stuck on a question or an approval. "Hide" puts the current waits away until a new one comes.

Vendored from [Atoll92/agent-standup](https://github.com/Atoll92/agent-standup/tree/901f3923b5fba49df23a14ff3f54283352d50103/plugin-band) (MIT, see `LICENSE`).

## Install

```bash
npx claude-code-templates@latest --mod observability/agent-standup-band
```

Claude Code 2.1.294 or later. Seen drawing in real sessions on 2.1.294 and 2.1.302, tests pass on 2.1.306, and the manifest is accepted by 2.1.59, which loads it and does nothing (versions that old do not run mods). The status files it reads are written by Claude Code 2.1.221 and later in the terminal, 2.1.269 and later in the VS Code panel, the desktop app's Code tab and the Agent SDK.

## What it reads and runs

- Every 4 seconds, the status file Claude Code keeps for each open session, `~/.claude/sessions/<pid>.json` (or under `CLAUDE_CONFIG_DIR`): which session, its folder, and whether it is busy, idle or waiting for you. Not the conversations.
- `ps`, to check that a session said to be waiting still runs: a session that crashed leaves its file behind.

Left out on purpose: the session the band is drawn in, a dialog you opened yourself somewhere else (`/model`, `/config`… are written as `waiting` with `waitingFor: "dialog open"`), and sessions a program started with `claude -p`, whose questions go to that program. Agent SDK hosts (Zed, a home-made app) are kept, since they may show their menus to a person.

It writes nothing and makes no network calls.

## Tests

```bash
claude plugin test cli-tool/components/mods/observability/agent-standup-band
```

## The whole call

The `/agent-standup:open` hint in the band refers to [Agent Standup](https://agent-standup.com), the app this mod comes from: every Claude Code, Codex and Mistral Vibe session on the computer as a live video call. It is a separate install (`/plugin install agent-standup --marketplace Atoll92/agent-standup`); the band works without it.

Unofficial: not affiliated with or endorsed by Anthropic.
