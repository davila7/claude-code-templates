# rex-tty

Claude's Bash tool has no terminal, so `sudo`, `gh auth login`, a key passphrase or `git rebase -i` fail or hang there. Inside the [Rex](https://www.superlogical.com/rex) terminal, this mod runs those commands in a Rex pane beside the session. You type in the pane; Claude gets the exit code and what the pane showed.

```
┌ claude ───────────────────────────────────────────────┐
│ ● Bash(sudo make install)                             │
│   [rex-tty] waiting for you in pane tty-1             │
├ tty-1 ────────────────────────────────────────────────┤
│ rex-tty ▸ sudo make install                           │
│                                                       │
│ Password: ▌                                           │
└───────────────────────────────────────────────────────┘
```

What you type at a hidden prompt (a password, a passphrase) is never on screen, so it never reaches the model. Anything the pane does show, including input a command echoes back, is returned to Claude (see Limits).

## What it does

- **Bash commands that need a terminal go to a pane.** The mod reads each Bash command before it runs. When it is one of the commands below, it opens a Rex split with the command, focuses it, waits for it to end, reads the pane and closes it. Claude receives that as the Bash tool's own result, with `Exit code N` added on a failure.
- **`tty_run` tool.** Claude can ask for a pane itself, for a command the list does not know. When a normal Bash command fails with a "no terminal" error (`a terminal is required`, `not a tty`, `cannot prompt`, …), the mod adds a note to the result that points Claude at this tool.
- **Outside Rex it does nothing.** Without `REX_BLOCK` in the environment, every command runs as usual and the tool is not registered.

Commands sent to a pane by default:

| Command | Left alone when |
|---|---|
| `sudo …` (also behind `env`, `command`, `nohup`, `time`, `timeout N`) | `-n`, `-S`, `-A`, `-K`, `-V` |
| `su`, `passwd`, `ssh-copy-id` | |
| `gh auth login`, `gh auth refresh` | `--with-token` |
| `git rebase -i`, `git add -p` / `-i`, `git checkout|restore|reset|stash -p` | `GIT_EDITOR=` or `GIT_SEQUENCE_EDITOR=` is set on the command |
| `git commit` with no message | `-m`, `-F`, `-C`, `--no-edit`, `--fixup`, `--dry-run` |
| `docker login`, `podman login` | `-p`, `--password-stdin` |
| `ssh-add <key>`, `ssh-keygen` | `ssh-add -l`, `ssh-keygen -N …`, `-l`, `-y` |
| `gpg --gen-key`, `--full-generate-key`, `--edit-key` | |
| `npm`/`pnpm login`, `vercel login`, `wrangler login`, `gcloud auth login`, `gcloud init`, `aws sso login`, `az login`, `firebase login`, `heroku login`, `supabase login`, `fly auth login`, `op signin`, `netlify login`, `stripe login`, `doctl auth init`, `railway login` | a credential flag is given: `--token`, `--api-key`, `--service-principal`, `--cred-file`, `--browserless`, `--ci`, … |

Plain `ssh host` is not on the list: with a key in the agent it works without a terminal. When it fails for lack of one, the note sends Claude to `tty_run`.

## Permissions

A mod that answers a tool call runs before Claude Code's own permission dialog, so the mod asks first:

1. It queries the session's permission rules for the Bash command (`$.tool.check`).
2. **Deny**: the command is refused, as it would be without the mod.
3. **Allowed by a rule you wrote** (such as `Bash(sudo:*)`): the pane opens.
4. **Anything else**, including an allow that comes from the permission mode or from a sandbox's auto-allow: you are shown the whole command (up to 1,500 characters, control characters removed) and asked `Run in a Rex pane` / `Run without a terminal` / `Do not run`. `Run without a terminal` hands the command back to Claude Code, which then asks its usual permission question.

What this gate does not cover:

- **The pane is outside Claude Code's Bash sandbox.** A command you send to a pane runs with your full access, as it would in any terminal.
- **`PreToolUse` hooks and the auto-mode classifier are not asked** about a command that goes to a pane: only the permission rules are.
- **`tty_run` is checked as the Bash command it carries**, so `Bash(...)` rules apply to it. A rule written for `mcp__rex-tty__tty_run` itself is not what decides.

In a `-p` run with no allow rule there is no one to ask, and the command runs as it would without the mod.

## Limits

- **The pane's output goes to the model.** A hidden prompt is safe, but everything the pane shows is read by Claude like any Bash output: a secret a command prints (`gh auth token`), a one-time code, and input a command echoes as you type it (a username, an access key ID at `aws configure`). Set `returnOutput` to `false` to return only the exit code, or install `security/secret-redactor` below it.
- **The pane has its own shell with your login environment** (not your interactive config such as `~/.zshrc`). It starts in the session's working directory, but variables Claude exported in earlier Bash commands, or a virtualenv it activated, are not set there.
- **Interrupting the turn closes the pane**, with whatever was running in it.
- **A command that runs past `timeoutMinutes` is not stopped.** Claude is told it is still waiting in the pane, and the pane stays open.
- `run_in_background` commands are never sent to a pane.
- The command detection reads the command line as words. It does not see inside `bash -c '…'`, a script file, an alias or `xargs`, and it sends `sudo` even when your sudoers needs no password; `commands` adds your own patterns and `tty_run` covers the rest.

## Options

```
  commands: string         extra regex sources, comma-separated: a matching Bash command also goes to a pane
  skip: string             regex sources, comma-separated: a matching Bash command always runs as usual
  side: string             below | right | above | left (default below)
  ratio: number            percent of the split the pane takes, 10-90 (default 35)
  closeOnExit: boolean     close the pane when the command ends (default true)
  returnOutput: boolean    give Claude the pane's output; false returns only the exit code (default true)
  timeoutMinutes: number   how long to wait for the command, 1-720 (default 30)
```

## Install

```sh
npx claude-code-templates@latest --mod integrations/rex-tty
claude
```

It is written to `.claude/skills/rex-tty/`, which Claude Code auto-loads as `rex-tty@skills-dir` once the workspace trust prompt is accepted. For one session: `claude --plugin-dir .claude/skills/rex-tty`. `claude plugin validate .claude/skills/rex-tty` prints every event it hooks and every `$` call it makes; `claude plugin test .claude/skills/rex-tty` runs its tests.

Options are read from user settings (`~/.claude/settings.json`, never project settings), `--settings <file>` or managed settings, under the plugin's full id:

```json
{
  "pluginConfigs": {
    "rex-tty@skills-dir": {
      "options": { "side": "right", "ratio": 40, "commands": "^terraform (apply|destroy)\\b" }
    }
  }
}
```

With `--plugin-dir` the key is `rex-tty`.

## Requirements

- Claude Code >= 2.1.316, started inside a Rex terminal (Rex sets `REX_BLOCK` and `REX_BIN_DIR`).
- The `rex` CLI of Rex 0.0.1793981048 or later. Rex is in beta: the mod uses `rex split --json`, `rex wait --json`, `rex capture` and `rex block close|focus`, and a later Rex may change them.

Environment variables it reads: `REX_BLOCK`, `REX_BIN_DIR`, `SHELL`. The `rex` binary it runs is `$REX_BIN_DIR/rex` and the pane's shell is `$SHELL` (bash, zsh, sh, dash or ksh; otherwise `/bin/bash`), so both follow the environment Claude Code was started with. It makes no network request and stores nothing.
