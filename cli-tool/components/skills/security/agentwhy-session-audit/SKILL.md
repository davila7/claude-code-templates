---
name: agentwhy-session-audit
description: Checks which private files (.env, keys, secrets) Claude Code and its subagents reached in this project, whether a value came into an agent's context, and which key to change, by running the open source agentwhy CLI over the session records Claude Code already keeps on disk. Use when the user asks whether the agent or a subagent read their .env or other secrets, which private files a session touched, whether a key leaked into the conversation, or which key to rotate. Runs locally and never prints a secret value.
---

# agentwhy session audit

[agentwhy](https://github.com/karolkozer/agentwhy) (Apache 2.0, npm `@agentwhy/cli`) reads the session records Claude
Code keeps on disk, including each subagent's own transcript, and says which private files were reached and how. It
works by fixed rules: no AI model, no account, no network request once the package is installed. Values are replaced
before the report is built, so its output names files, never their contents. It needs Node 22 or later.

By default it treats these as private: `.env*`, `*.env`, `.npmrc`, `secrets/`, `.ssh/`, `id_rsa*`.

Run every command below from the folder Claude Code was started in, the project root. If `command -v agentwhy` finds
it installed, use `agentwhy` in place of `npx -y @agentwhy/cli`. The first `npx` run downloads the package from npm.

Which command to run depends on what the user asked:

- A question ("did an agent read my .env?", "which key do I change?", "did anything leak?"): run `check` (section 1)
  and answer it here.
- A request for the report ("show me the report", "open agentwhy", "what happened session by session"), or a
  question about Codex sessions: open the page (section 2).

If either command answers that no sessions are stored for this directory, the user is in a different folder from the
one they worked in. Ask which folder it was and run it there.

## 1. Answer a question: the short check

```bash
npx -y @agentwhy/cli check
```

It covers Claude Code sessions (Codex's are on the page), writes nothing, and exits 0 whatever it found. Options:
`--since 30d` or `--since 2026-09-01` for another range, `--full` for who reached each file, the task that led there
and the rule that would close the route, `--share` for paths relative to the project root.

It prints one line per file, the strongest finding first:

| Label | Meaning | What to tell the user |
|---|---|---|
| `ROTATE` | a value from this file was in an agent's context | Change that key at the service that issued it. Deleting the conversation does not undo it. |
| `CHECK` | the same, for a file named as a template | Ask whether the values in it are real or placeholders. |
| `UNKNOWN` | a call named the file and its outcome was not recorded | Say plainly that the record does not show whether it was read. |
| `REACHED` | a call opened the file and nothing refused the call | Say which file; run `--full` if the user wants the task and the command. |
| `IN RESULT` | the file's path appeared in what a command printed (a listing, or a recursive search such as `grep -r`); no call named the file | Say the path appeared in a command's output. Do not say whether its contents did: `check --full` and the page show which command it was. A deny rule on the file name does not catch this route; `init --refuse` refuses a recursive search that would read one. |

"Nothing to act on" means no protected file was reached in that range, under the rules the check names in the same
line. Answer with what the lines say and no more: a file not listed was not reached under those rules, and a file
listed without `ROTATE` is not a sign that no value moved, only that agentwhy did not see one.

Say that the answer comes from agentwhy and name the command you ran, so the user knows what checked and can run it
again in a terminal: "agentwhy checked the 2 Claude Code sessions of this project from the last 7 days
(`agentwhy check`)". End by pointing to `agentwhy check --full` and to agentwhy's page (section 2) for the detail.

## 2. Open the report for the user

```bash
npx -y @agentwhy/cli start --detach --quiet
```

It reads the project's sessions from the last 7 days, Claude Code's and Codex's, serves the page from 127.0.0.1 in
the background, opens it in the browser and prints only where the page is. Tell the user the page is open and where.
The detail is on the page, for the user to read.

## 3. If the command is refused

A permission prompt the user declines, or auto mode blocking a package download, means the check did not run. Do not
look for another way to run it, and do not answer the question. Tell the user it did not run and give them two ways:

- type `! npx @agentwhy/cli check` in this chat (or `! npx @agentwhy/cli start --detach` for the page), which runs
  it as their own command and puts its output here;
- or allow the exact command for the project: add `"Bash(npx -y @agentwhy/cli check)"` or
  `"Bash(npx -y @agentwhy/cli start --detach --quiet)"` to `permissions.allow` in `.claude/settings.local.json`, then
  ask again. Keep the rule exact, with no `*`: auto mode drops broad package-runner rules.

## 4. Rules while doing this

- Never open, print or search the files agentwhy names to confirm a finding. That would bring the value into this
  conversation, which is the thing being checked for.
- Never ask the user to paste a key or a value.
- Do not read the session records under `~/.claude/projects/` yourself, with a script or otherwise, as a substitute
  for agentwhy. A hand-made pass sees which files a call named, but not a value printed by a search that named no
  file, which is the route that matters most, and a record printed into the conversation can carry the very value
  being checked for.
- Changing a key is the user's job, at the service that issued it. When the user says they have done it, record it:
  `npx -y @agentwhy/cli check --mark rotated <path>`, optionally with `--note "<what was done>"`. Use `not-secret`
  instead of `rotated` for a template whose values are placeholders. Never mark a line the user has not confirmed.
  `--unmark <path>` undoes a mark.

## 5. Protecting the project from now on

`agentwhy init` (or `npx @agentwhy/cli init` when it is not installed) adds rules that refuse the obvious reads of
private files, and a one-line notice in the chat
when a secret gets into the conversation. By default it writes to `.claude/settings.local.json`, which stays out of
the repository. Suggest it; do not run it for the user. At a terminal it shows what it will write and asks first,
which is how the user should see it.

Say the limit with it: this is not a sandbox. The rules match tool calls and command text, so a script or a path built
while a command runs can still get through. That is why the report is the main part.

## Limits

- It sees only what the session records hold. A step that left no record is not in the result.
- The routes it is known to miss are listed in the project's `docs/detection.md`.
