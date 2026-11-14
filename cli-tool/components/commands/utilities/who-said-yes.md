---
allowed-tools: Bash(npx --yes github:skprasad-korture/who-said-yes#v0.1.0:*)
argument-hint: "[--detail]"
description: "Count which of your coding agent's actions you approved yourself at the prompt, from the Claude Code and Codex session logs on this computer. Read only, sends nothing."
---

# /who-said-yes

Count which of your coding agent's actions you approved yourself at the prompt, from the Claude Code and Codex session logs on this computer. Read only, sends nothing.

## Purpose

Your coding agent asks before it runs things. Most of the time something else answers for you: a rule you saved earlier, the permission mode, auto mode or a hook. This command shows how many of your agent's recent actions you approved yourself, at the prompt, in that moment, and how many were approved without you.

It runs [who-said-yes](https://github.com/skprasad-korture/who-said-yes) (MIT), one JavaScript file with no network calls. It reads the Claude Code and Codex session logs on this computer and never changes them. It writes one small file in your home folder with your last totals, so the next run can show what changed. Needs Node 18 or newer.

## Usage

/who-said-yes
/who-said-yes --detail

## Implementation

1. First ask the person exactly this, and wait for their answer:
   "Out of your agent's last 1,000 actions, how many do you think you said yes to yourself?"
   Do not guess for them and do not hint at the answer.
2. If they give a whole number from 0 to 1000, run:
   `npx --yes github:skprasad-korture/who-said-yes#v0.1.0 --guess <their number>`
   If they skip, run:
   `npx --yes github:skprasad-korture/who-said-yes#v0.1.0 --no-guess`
   Add `--detail` if they asked for the count by project or by week: $ARGUMENTS
3. Show the output exactly as printed, inside a code block. Do not add advice about permission settings, modes or rules, and do not summarise the numbers in your own words. If they ask what a line means, explain only that line.

## What it counts

- You said yes: you approved the action at the prompt yourself.
- Not you: actions approved by rules you saved, the permission mode, auto mode, settings or hooks.
- You said no, how fast you said yes, the longest run of actions with no message from you, and file edits that ran with no prompt shown to you.

The log fields it reads are not documented by Anthropic or OpenAI and may change. If they do, the tool says it cannot read the format rather than guessing.
