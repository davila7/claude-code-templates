---
name: curviate
description: "Entry point for driving LinkedIn work through the Curviate CLI: which skill answers which task, how to resolve the `curviate` binary, the retrieval-mode concept and the flags only four commands accept, and the rule that an agent branches on the exit code rather than on the message text. Use whenever a task involves LinkedIn profiles, companies, search, messages, posts, comments, reactions, connections, follows, job postings, Sales Navigator or Recruiter, or whenever a `curviate` command is about to run and it is not obvious which area covers it."
version: 0.1.0
author: Curviate
license: MIT
tags: [LinkedIn, CLI, Agents, Sales, Recruiting, Outreach]
repository: https://github.com/Curviate/curviate-plugin
---

# Curviate: start here

Curviate is a LinkedIn API for agents. The `curviate` CLI is its command surface, and this skill is
the dispatcher: it says which skill to read, and carries the few rules that apply everywhere. It
carries no command syntax: every command, flag and worked example lives in the area skill that owns
it.

Established against CLI `0.33.0`.

## Which skill answers this

| Task | Skill |
|---|---|
| First run on a new machine: install, authenticate, connect an account, prove it works. | `curviate-quickstart` |
| A member profile or a company page. Resolving a human search term into the filter id a search needs. Sessions, stored profiles and connected accounts. | `curviate-profile` |
| Finding people, companies, posts, jobs, services or groups. Running a pasted LinkedIn search URL. | `curviate-search` |
| Reading conversations, sending and managing messages, InMail, company-page inboxes. | `curviate-inbox` |
| Publishing posts, commenting, reacting, the home feed, notifications. | `curviate-engage` |
| Connection invitations, follows, relations, followers. | `curviate-network` |
| Job postings: creating, publishing, budgets, applicants. | `curviate-jobs` |
| Sales Navigator and Recruiter. | `curviate-premium` |

When a task spans two areas (find someone, then message them), read both. They are self-sufficient
and repeat what they need to; nothing is hidden behind a third skill.

## Resolve the binary before anything else

```bash
curviate --version    # needs Node 18 or newer
```

If that fails, install it: `npm install -g @curviate/cli`. **Do not substitute a raw HTTP call for a
command you could not find.** The command surface is the contract, and hand-rolled requests miss the
projections, the retry contract and the exit-code mapping that every one of these skills is written
against.

Credentials resolve **flag > environment > stored profile**. For a scripted run prefer
`CURVIATE_API_KEY` in the environment or a stored profile: a key passed as a flag is visible to other
processes through `ps` and is saved in shell history.

## Branch on the exit code, never on the message text

Every command exits with a code that says what to do next, and under `--json` an error prints
`{"error": {"code", "message", …}}`. **The code is the contract. The wording is not**: it is written
for a human reading a terminal and it changes between releases.

Two consequences worth internalising before the first failure:

- **A single exit code can carry several distinct causes**, so read `error.code` before deciding on a
  remedy. Exit `5` alone means three unrelated things whose fixes have nothing in common.
- **Retrying is right for some codes and actively wrong for others.** A rate limit tells you how long
  to wait; a refusal by one of your own ceilings will not clear on a retry at all. Each area skill
  ends with the exit codes reachable from its commands and the action each implies. Read that table
  rather than guessing from the message.

## Retrieval mode, and the flag of the same name that is not it

Some reads can be answered from a stored copy instead of a live call to LinkedIn, and `--mode` /
`--max-age` choose between them. Two rules matter everywhere:

- **Exactly four commands accept those flags**: `profile me`, `profile <id>`, `inbox get` and
  `inbox messages`. The mechanics (what each mode does, what a store miss returns, and why
  `cache_only` and `--max-age` cannot be combined) are in `curviate-profile` and `curviate-inbox`.
- **Every other command refuses them outright rather than ignoring them**: ``unknown flag `--mode` ``
  at exit `2`, before any network call. That is the good failure. A retrieval-mode habit carried onto
  a search fails loudly instead of quietly serving you a freshness you did not ask for. The two
  exceptions below are not retrieval commands either: they refuse retrieval *values*.

**Two commands take a `--mode` that is a different flag wearing the same name, and both spend real
money**: `job publish` and `recruiter job publish`, each `--mode FREE|PROMOTED|PROMOTED_PLUS`. They
select how a posting is published. No retrieval value is valid there, and on both the flag is
required rather than optional, so a retrieval habit is refused at exit `2` rather than silently
promoting a posting. See `curviate-jobs` and `curviate-premium`.

## Reading a response

- **Pass `--json` on anything you parse.** It is already the default when stdout is not a terminal;
  ask for it explicitly when a human might also be watching.
- **An empty field in a default response is not proof the data does not exist.** Responses are
  projected, and several fields are withheld until `--verbose` asks for them, including a few that
  read exactly like "this member published nothing". Each area skill names its own.
- **`--preview` before a write** renders the resolved request without sending it. On a read command
  it is refused at exit `2`.
