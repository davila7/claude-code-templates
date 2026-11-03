# human-gate

Splits tool permissions into two lanes:

- **Held for a person.** Calls that cannot be undone are answered `ask` by the mod: deploys, package publishes, pushes to a protected branch, money moves, messages sent outside the session, destructive SQL. Since Claude Code 2.1.304 a mod's ask belongs to a person: the auto-mode classifier and allow rules in settings can't approve it. Where nobody can be asked (`claude -p`, a headless host), the call is refused and the model gets the reason.
- **Let through.** A call that the tool marks read-only (`e.isReadOnly`), and that the engine would only have asked about, runs without a prompt. A deny rule or ask rule you wrote, a classic hook's ask, a setting's own check (such as reads outside the working directories), or an organization ceiling of `ask` always wins.

```bash
npx claude-code-templates@latest --mod security/human-gate
```

Type `/human-gate` to see which categories are active and how many calls the mod has held or let through in this session. The status line under the prompt shows the same counts.

## What is held

| Category | Examples |
| --- | --- |
| `deploy` | `wrangler pages deploy`, `vercel --prod`, `fly deploy`, `kubectl apply`, `helm upgrade`, `terraform apply`, `gh workflow run`, MCP `deploy_*` and `delete_project` |
| `publish` | `npm publish` (also pnpm/yarn/bun), `npm unpublish`, `cargo publish`, `twine upload`, `docker push`, `gh release create` |
| `push-main` | `git push origin main`, `git push origin HEAD:main`, `git push --all`/`--mirror`, `git -C dir push …`, or `git push` / `git push origin HEAD` while you are on a protected branch. If git can't name the current branch, the push is held |
| `money` | Any tool of an MCP server whose name contains `stripe`, except list/get/retrieve/search/read/fetch/describe/find tools, and any MCP tool about refunds, payouts, charges, transfers, payment intents or invoices (same read exception) |
| `outbound` | MCP tools whose name has a `send`, `forward`, `reply`, `post`, `publish` or `share` word (`send_message`, `slack_send_message`), or adds a comment (`add_issue_comment`) |
| `data` | `DROP`/`TRUNCATE`/`ALTER` of a table, database, schema, role or user, `DELETE`/`UPDATE` without `WHERE` (also inside the quotes of `psql`, `mysql`, `sqlite3` and other SQL clients, and in any string of an MCP tool's input), `prisma migrate deploy`, `alembic upgrade`, `rails db:migrate` |

Compound Bash commands are split on `&&`, `||`, `;` and `|`, so `cd app && npm publish` is caught. Global flags before the verb don't hide it (`terraform -chdir=infra apply`, `kubectl -n prod apply`, `pnpm -r publish`). Text inside quotes is ignored, so `git commit -m "explain npm publish"` is not held. A segment with `--dry-run` (`npm publish --dry-run`, `kubectl apply --dry-run=client`) is not held, but `--dry-run=none` and `=false` are.

## Options

Set them in `~/.claude/settings.json` under `pluginConfigs["human-gate@skills-dir"].options`.

| Option | Default | What it does |
| --- | --- | --- |
| `categories` | all | Comma-separated subset of `deploy, publish, push-main, money, outbound, data`. Unknown names are logged and ignored, and if none of the names is known, every category stays held, so a typo can't switch the gate off |
| `protectedBranches` | `main, master, production, prod, release` | Comma-separated branch names |
| `extraCommands` | — | Comma-separated regexes on Bash command segments, e.g. `\bansible-playbook\b` |
| `extraTools` | — | Comma-separated regexes on tool names, e.g. `^mcp__linear__save_issue$` |
| `readOnlyFastLane` | `true` | Let read-only calls run without a prompt |
| `trustMcpReadOnly` | `false` | Include MCP tools in the fast lane. Off because an MCP tool's read-only flag is only its server's claim |

`WebFetch`, `WebSearch`, `Agent`, `Task`, `SendMessage` and `Skill` never take the fast lane, even though they report themselves as read-only: they reach the network or hand the work to someone else.

## Limits

- The patterns are heuristics. A command built at run time (`sh -c "$CMD"`, a script that publishes) is not seen, and only the `Bash` tool's commands are parsed (not PowerShell or an MCP shell tool). Use the mod as a second line of defense alongside deny rules, not as a sandbox.
- If the check itself throws, the mod fails closed and asks a person.
- Overlaps with `security/jev-auto-mode`, which is a full allow/ask/deny policy. Use human-gate when all you want is "irreversible things wait for me".

Needs Claude Code 2.1.304 or later.
