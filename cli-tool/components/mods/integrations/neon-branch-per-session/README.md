# neon-branch-per-session

One [Neon](https://neon.com) database branch per Claude Code session. When the session starts the mod creates `claude/<session id>` from your default branch (or the one you name), reads its connection string and sets it as `DATABASE_URL`, which every command Claude runs afterwards inherits. Claude can migrate, seed and break the branch without touching production data, and the branch removes itself when its expiry passes.

```
neon: created branch claude/3f9a1c2e; DATABASE_URL points at it
/neon   neon: claude/3f9a1c2e (br-…) · expires in 23h · DATABASE_URL on ep-cool-1-pooler.us-east-2.aws.neon.tech · /neon keep | delete
```

## What it does

| Moment | Action |
| --- | --- |
| `session.start` | creates the branch with an `expires_at` and a read-write endpoint, reads `GET /connection_uri`, sets `DATABASE_URL` and `NEON_BRANCH`. A branch is remembered by the session's id; a session started again under the same id reuses it if it still exists. |
| `/neon` | shows the branch and where `DATABASE_URL` points (host only) |
| `/neon keep` | clears the expiry, so the branch stays |
| `/neon delete` | deletes the branch and unsets both variables |
| `session.end` | `onEnd`: `expire` does nothing and leaves it to the expiry (default), `delete` removes it, `keep` clears the expiry. `/clear` starts a new conversation in the same process and never touches the branch (no new one is created either: the branch belongs to the process). After `/neon keep`, `onEnd: delete` leaves it alone. If the connection string cannot be read after the branch is created, the branch still exists and `/neon delete` removes it. |

Neon deletes a branch at its `expires_at` (at most 30 days out), so a session that dies without a goodbye still cleans up.

## What it does not do

- **It is not a sandbox.** Commands keep your permissions. A project whose `.env` holds another database URL can still point Claude at it; loaders such as dotenv do not override a variable already in the environment, which is what lets the branch win in the common case.
- It creates a branch of the data as of now. Schema changes and writes on the branch never reach the parent; merging them back is a migration you run yourself.
- Headless runs (`claude -p`, the SDK) are skipped unless you set `interactiveOnly` to false.

## Secrets

`DATABASE_URL` carries the credentials, so any command Claude runs can print it: `env` or `echo $DATABASE_URL` puts it in the transcript and the tool output. The mod sets the variable; it cannot hide it. The Neon API key comes from the plugin options (`neonApiKey`, stored as sensitive) and is only sent to `console.neon.tech` in the `Authorization` header. It is never logged, and neither is the connection string: `/neon` and the log show the host only. Prefer a key scoped to one project.

## Options

```
  neonApiKey: string       Neon API key (required)
  projectId: string        Neon project id (required)
  parentBranchId: string   branch to fork, br-... (default: the project's default branch)
  database: string         database in the connection string (default neondb)
  role: string             role in the connection string (default neondb_owner)
  pooled: boolean          pooled connection string (default true)
  expireHours: number      self-delete after this long, 1-720 (default 24)
  onEnd: string            "expire" | "delete" | "keep" (default expire)
  namePrefix: string       branch name prefix (default claude)
  interactiveOnly: boolean skip claude -p and SDK runs (default true)
```

API calls (https://api-docs.neon.tech): `POST /projects/{id}/branches`, `GET` and `DELETE` and `PATCH /projects/{id}/branches/{branch}`, `GET /projects/{id}/connection_uri`. The default `neondb` and `neondb_owner` are what Neon creates for a new project; set `database` and `role` if yours differ.

## Install

```sh
npx claude-code-templates@latest --mod integrations/neon-branch-per-session
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/neon-branch-per-session/`, which Claude Code auto-loads as `neon-branch-per-session@skills-dir` once the workspace trust prompt is accepted. For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/neon-branch-per-session`. `claude plugin validate .claude/skills/neon-branch-per-session` prints every event it hooks and every `$` call it makes; `claude plugin test .claude/skills/neon-branch-per-session` runs its tests.

Options are read from user settings (`~/.claude/settings.json`, never project settings), `--settings <file>` or managed settings, under the plugin's full id:

```json
{ "pluginConfigs": { "neon-branch-per-session@skills-dir": { "options": { } } } }
```

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
