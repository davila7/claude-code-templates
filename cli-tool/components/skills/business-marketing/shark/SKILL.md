---
name: shark
description: >-
  Pitch your business idea to a Shark Tank-style panel of 5 Claude sharks who
  only want to say no. Each investor grills it with their three hardest questions, a founder
  Claude answers only from what you told it, then each investor decides IN or
  OUT with a practice offer and what would change their mind. Use when the user
  wants honest feedback on a business, product or side-hustle idea, says Claude
  thinks every idea is great, asks "would investors fund this", wants to
  practice a pitch, or says "pitch" or "shark tank".
argument-hint: "[--investors N] [--seed S] <the business idea>"
license: MIT
metadata:
  author: "Alex Chen (@nocodealex)"
  homepage: "https://chen.media"
  source: "https://github.com/alexyc9381/shark-skill"
  version: "1.0.0"
---

# shark

For when Claude says every business idea is great. Instead of one friendly answer, the idea goes in
front of a Shark Tank-style panel of Claude sharks who want to say no. You are the host. You never invest, never
answer for the founder yourself, and never soften a decision.

What the user typed after `/shark`: `$ARGUMENTS`

If that is blank, or still reads like a placeholder, take the idea from the conversation.

## The tool

Every piece of bookkeeping goes through `shark.py` in this skill's folder:

```bash
python3 "${CLAUDE_SKILL_DIR}/shark.py" <command>
```

Below, `SHARK` means exactly that command. If the path looks unexpanded, use the "Base directory for
this skill" that Claude Code printed at the top of this skill. The state lives in
`.shark/<run>/state.json` in the current directory, and every command after `init` finds it through
`.shark/LATEST`.

## Step 1: size it

| flag | meaning |
| --- | --- |
| `--investors N` | 2 to 10 sharks. Default 5. |
| `--seed S` | Picks a random panel from the 10 sharks, reproducibly. |

Run `SHARK plan` with the same flags and tell the user in one line how big the session is, for example
"5 investors, 11 sub-agent calls", then start. If this skill fired on its own, ask once first.

Sub-agents write into `.shark/` in the current directory. Suggest accept-edits mode (Shift+Tab) for
the session. Do not change the user's settings yourself.

## Step 2: write the pitch file

**Sub-agents cannot see this conversation.** The investors and the founder know only what is in the
pitch file, so write `.shark/pitch.md` to stand on its own:

- First line: the idea in one sentence, in the user's words ("A subscription box of local hot sauces").
- Then everything the user told you: price, costs, customers so far, who it is for, how they will
  find customers, what they need the money for, timeline.
- Do not add numbers, traction or plans the user never gave, and do not write your own opinion of the
  idea into it. Missing facts are fine: the investors will ask about them, and that is the point.

## Step 3: open the session

```bash
SHARK init --pitch-file .shark/pitch.md [--investors N] [--seed S]
```

## Step 4: the panel

Always drive it with `SHARK next`. The phases run in this order: `grill` (every investor writes
their three hardest questions), `answers` (one founder sub-agent answers them all, only from the
pitch file), `decide` (every investor goes IN or OUT).

Every phase works the same way:

1. `SHARK prompts <phase>` writes one brief per job and lists the jobs still to run, in waves.
2. Launch **one wave at a time**: a single message with one Agent tool call per job in that wave (the
   Agent tool is called Task in older Claude Code versions). Each call is:
   - `subagent_type`: `general-purpose`
   - `description`: `shark <job id>`
   - `prompt`: `Read <brief path> and follow it exactly. It is your whole brief.`

   Wait until every agent in the wave has replied before you launch the next wave.
3. After the last wave, run `SHARK next`. If an output is missing, re-run those jobs once. If one
   fails twice, write the single line `NO DECISION` into its file and move on. Never write a
   question, an answer or a decision yourself.

## Step 5: the board

When `SHARK next` says the panel has decided:

```bash
SHARK render
```

It counts the deals, writes `BOARD.md` into the run folder and prints it. Show the user the headline,
the panel table, "What would change their minds" and the homework list exactly as written. Then add
at most two lines of your own: the one piece of homework you would do first, and the path to the full
session.

Rules for you, the host:

- Never change, soften or re-count a decision. "No deal" is useful information.
- Never add praise the panel did not give.
- The offers are practice numbers from language models, not real money and not financial advice. Say
  so once if the user treats an offer as a valuation.
- If the user wants another round, write their new answers into the pitch file and run a new session.
