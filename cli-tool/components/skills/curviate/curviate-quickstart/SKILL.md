---
name: curviate-quickstart
description: "The first run: install the Curviate CLI, authenticate this machine with `curviate setup`, confirm with `curviate doctor`, connect a LinkedIn account, and prove the whole path works by reading the same profile live and then from the store. Use when Curviate is being set up for the first time, when `curviate` is not installed or not authenticated, when a command fails with a credential or account error, or when someone asks how to get started. Reads only: it issues no write of any kind."
version: 0.1.0
author: Curviate
license: MIT
tags: [LinkedIn, CLI, Agents, Sales, Recruiting, Outreach]
repository: https://github.com/Curviate/curviate-plugin
---

# Curviate: the first run

Four steps, in this order: install, authenticate, connect an account, prove it. Every command here
is a read. Nothing in this skill posts, messages, invites, follows or endorses anyone.

Established against CLI `0.33.0`.

## 1. Install the CLI

```bash
npm install -g @curviate/cli
curviate --version    # needs Node 18 or newer
```

## 2. Authenticate this machine: `curviate setup`

`setup` opens the dashboard, takes the short code it shows you, and saves an API key into a local
profile. **The key is never printed and never passed on a command line.**

The command has two shapes, and which one you get is decided by whether **stdout** is a terminal.

### Agent shape: two legs, because a browser has to happen in between

When stdout is not a terminal, or when `--json` is passed, `setup` prints a JSON object and exits
`0`. It does not prompt and it does not open a browser:

```bash
curviate setup --json
# {"authorize_url":"…","next_step":"curviate setup --code -","instructions":"…"}
```

Open `authorize_url` in a browser signed in to the workspace, press Authorize, and read back the
code it displays. Then hand that code to the second leg **on stdin**:

```bash
printf '%s' "$CODE" | curviate setup --code -
# {"ok":true,"tenant":"…","profile":"default","account_id":"…"}
```

- **`--code -` reads from stdin deliberately.** Passing the code as a flag value works but warns:
  a value on the command line is visible to other processes through `ps` and is saved in shell
  history.
- **The two legs must run on the same machine, under the same configuration directory.** Leg one
  writes a short-lived resume file beside the config file, readable only by you, holding the session
  id and the private key that opens the delivered credential. Leg two reads it and deletes it. Split
  the legs across machines, users, containers or config-directory overrides and the exchange cannot
  complete.
- **`--code -` with no setup in progress exits `2`** and says so. Run leg one first.
- The code is short, case-insensitive, and drops anything that is not one of its own characters, so
  a pasted code with stray spaces or punctuation is still accepted.

### Human shape

With stdout on a terminal and no `--json`, `setup` prints the link, opens a browser, and prompts for
the code (up to three attempts). `--no-browser` prints the link rather than opening it, which is what
you want over SSH or anywhere a browser would open on the wrong machine.

One asymmetry to know before scripting it: **stdout on a terminal with stdin piped is refused at exit
`2`**, because there is nowhere to paste a code into. It names `CURVIATE_API_KEY` and
`curviate login --api-key -` as the alternatives. A *fully* piped invocation is not that case: it is
the agent shape above, and it exits `0`.

### What each failure means

| Exit | Cause | What to do |
|---|---|---|
| `0` | Authenticated. The key is saved to the named profile. | Continue to `doctor`. |
| `2` | Usage: no setup in progress, or a terminal was needed and there was none. | Fix the invocation. Never retry unchanged. |
| `3` | The code was wrong, expired, or the attempts ran out; or the workspace has no API key to deliver; or the key saved but a verifying call did not succeed. **Read the message: these are deliberately four different sentences, and only the first is fixed by starting over.** | Wrong or expired code: run `setup` again for a fresh one. No API key: create one in the dashboard first. Saved but unverified: run `doctor`. |
| `6` | Too many attempts against this endpoint. | Wait, then try again. |
| `7` | The API could not be reached. | Check the network, and the base URL if you overrode it. |
| `1` | The exchange failed in a way the CLI did not expect, or the delivered credential could not be opened by this process. | Worth one retry. If it repeats it is a bug to report, not a state to work around. |

A code is short-lived and allows only a handful of attempts. If in doubt, start a fresh `setup`
rather than reusing anything.

## 3. Confirm: `curviate doctor`

```bash
curviate doctor --json
```

It reports the CLI version, the config path, the active profile, the base URL, where the credential
resolved from, **which workspace it authenticated as**, whether the API is reachable, whether the
credential is accepted, and every connected account with its status.

Three things that surprise people:

- **Run `setup` first, then `doctor`, not the other way round.** Reachability is only tested through
  a real call, so with no credential resolved `doctor` reports the API as unreachable. That is not a
  network problem; there was nothing to call with.
- **The workspace line is populated only for a credential `setup` wrote.** A key supplied through the
  environment or `login` authenticates perfectly well, but `doctor` has no name to show for it and
  says so. And where a name is shown it identifies the workspace; it is not promised to be a
  friendly, human-chosen label.
- **Zero connected accounts is a pass, not a failure.** `doctor` reports `0 connected` and exits `0`.
  That is the expected state of a workspace nobody has connected an account to yet.

`doctor` reports rather than throws, so it prints a report and not an error envelope. Branch on the
exit code and read `checks[]` for which stage failed:

- **`0`**: every check passed.
- **`2`**: the request was refused before it was sent, so nothing reached the network. An empty
  credential, or a malformed base URL (the report's detail reads `Invalid base URL: expected an
  absolute http:// or https:// URL`). Fix the invocation or the value; a retry cannot help.
- **`3`**: no credential resolved, or one resolved and was rejected. Run `setup`.
- **`7`**: the API could not be reached, or was reached and answered with a platform fault. Both are
  worth a retry.

**This list is not exhaustive, and the codes beyond it are not `doctor`'s own.** The credential check
is a real API call, and whatever refusal comes back is passed straight through, so any code the API
can produce can surface here. The one a first run meets most often is **exit `5` on a workspace with
no active seat**: the credential is fine and the network is fine, and no amount of re-running `setup`
will change it. Look an unfamiliar code up in the area skill for the surface you are about to use:
each ends with a table of the codes its commands produce and the action each implies.

The `checks[]` entries separate the three stages, and the wording is exact: `api reachable` reading
`not checked` means the request never left this machine, while `could not reach` means it left and
found nothing. `credential valid` reading `not checked` means nothing asked the credential anything;
it is not a verdict on the credential, so do not go looking for a bad key on the strength of it.

## 4. Connect a LinkedIn account

Curviate acts on LinkedIn through an account you connect. Until one is connected, authentication is
complete and correct while **every account-scoped command is unusable**: that is the whole state,
and it is not an error to be debugged.

```bash
curviate account list --json    # empty on a fresh workspace
```

If `setup` reported an `account_id`, an account is already connected **and already set as this
profile's default**; skip the rest of this step, including the block below, and go to step 5.

Otherwise, find a free seat first:

```bash
curviate account seats --json    # seat_id of any entry with "occupied": false
```

Then connect one with `curviate account link --seat-id <id> ...`. It attaches a LinkedIn account to
that seat and usually needs a verification code, which means a human. Non-interactive shells get exit
`12` and finish through the checkpoint flow. **The command surface, its flags and the checkpoint
commands are in `curviate-profile`**: read that before running it, because a half-finished connect
leaves a session to poll rather than a clean failure.

Then tell the CLI which account to act as:

```bash
curviate account list --json              # the acc_id of the account you just connected
curviate config set-account <acc_id>      # make it this profile's default
```

**Do not skip this.** `setup` stores a default account only when the workspace already had one to
hand back, which is exactly what the expected first run does not have. Without a default, every
account-scoped command, including the demonstration below, stops at exit `2` asking for `--account`.
Set it once here, or pass `--account <acc_id>` on each call. **`config set-account` writes to the
stored profile, so it needs one**: if your credential came from `CURVIATE_API_KEY` rather than
`setup`, it exits `2` saying there is no config file, and `--account <acc_id>` per call (or
`CURVIATE_ACCOUNT` in the environment) is the path for you. Account ids change when an account is
reconnected, so read one live rather than hard-coding it.

## 5. Prove the whole path: the same read, twice

This is the demonstration, and it is worth running because it exercises authentication, the
connected account, projection and the store in one pass. Both calls are reads of your own profile.

```bash
curviate profile me --mode live --json          # "source":"live"
curviate profile me --mode cache_only --json    # "source":"store", with "observed_at"
```

The first forces a live call to LinkedIn. The second refuses to go to LinkedIn at all and answers
from the copy the first one stored, so it comes back with `source: store` and an `observed_at`
timestamp saying when that copy was taken.

**Read `source` rather than assuming it.** That field, not the freshness you asked for, is what
actually happened. The full set of modes, and what a `cache_only` read does when nothing is stored,
are in `curviate-profile`.

## Full command surface

<!-- generated: command surface, CLI 0.33.0 -->

Read from the CLI's own `--help` at version 0.33.0. Descriptions, traps and confidence
tags elsewhere in this skill are hand-written and carry the version they were established against.

Every command below that takes flags at all also accepts `--base-url`, `--json`, `--profile`.

| Command | Arguments | Flags |
|---|---|---|
| `curviate setup` | *(none)* | `--no-browser`, `--code` |
| `curviate doctor` | *(none)* | `--api-key`, `--timeout` |
| `curviate login` | *(none)* | `--api-key`, `--account` |

<!-- /generated -->

## Where to go next

Back to `curviate` for the dispatch table. The common first tasks: look someone up
(`curviate-profile`), find a set of people (`curviate-search`), read your inbox (`curviate-inbox`).
Each area skill ends with the exit codes its commands can produce and what each one implies; branch
on those, never on the message text.
