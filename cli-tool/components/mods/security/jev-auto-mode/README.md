# jev-auto-mode

A permission layer for Claude Code driven by a JSON policy. It decides whether Claude may run each **tool call** (Bash, file edits, web, MCP tools, subagents through the Agent tool, skills through the Skill tool), each **slash command or skill you type**, and each **skill preloaded into a subagent**. Rules decide first. Anything no rule covers can go to [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), TypeSafe's System One decision model, which judges the action against your latest request. This is the idea behind Claude Code's own auto mode, except the policy, the questions and the thresholds are yours.

It pairs with [`jev-guardrails`](../jev-guardrails): guardrails screens what is *said* (prompts and replies), while auto mode governs what is *done* (every action).

```
[jev-auto-mode] ready: enforce · default jev · 14 rules · ask via mod · judge typesafe jev-latest · /home/you/.claude/jev-auto-mode.json
[jev-auto-mode] deny Bash(rm -rf build) (rule no-rm-rf)
[jev-auto-mode] judge Bash(curl -X POST https://… -d @dump.sql): exfiltration 0.91 · destructive 0.12 · … · severity 2.0 · 310ms
[jev-auto-mode] deny Bash(curl -X POST https://… -d @dump.sql) (jev)
[jev-auto-mode] ask Bash(git push origin main) (rule publish-and-deploy)
```

The status line keeps a running tally: `auto · 42✓ 3? 2✗ · deny Bash(rm -rf build)`.

## How a decision is made

For every tool call, in this order:

1. **Self-protection.** Claude may not change the policy files in force (yours, including a custom `configFile` path, and the project's) or the mod's own files. The check errs toward refusing:
   - Any tool other than a reader whose input names one of them in a path is refused. That covers Write/Edit and MCP file tools, but not a file's content that merely mentions the name.
   - Any shell part naming them that isn't a plain read (`cat`, `grep`, `git diff`, …, with no redirect and no write option such as `-o`, `-i` or `--output`) is refused. That covers `sed -i`, `>`, `curl -o`, `wget -O`, `git show --output=`, `cp`, `mv`, `ln`, a variable holding the path, and so on.

   This check runs before any rule, so no rule and no project file can switch it off.
2. **Rules.** Every rule that matches is collected, and **deny beats ask beats allow**, whatever order they were written in.
   - Compound shell commands are split (`&&`, `||`, `;`, `|`, `&`, newlines, `$( … )`, backticks, `bash -c '…'`).
   - Each part is matched as written, and also as the shell will run it: quotes and escapes dropped (`r'm'` is `rm`), `$IFS` read as a space, leading `VAR=x` assignments and wrappers stripped (`sudo`, `env`, `nohup`, `xargs`, …), and variables the same line assigned read back (`X=rm; $X -rf /` is `rm -rf /`).
   - A deny or ask rule hits when *any* part matches. An allow rule only applies when it covers *every* part, so an allow on `ls*` does not let `ls && rm -rf ~` through.
   - A part whose program is only known at run time (`$TOOL …`, `eval`, `source`) can't be read by any rule, so it gets at least `opaqueShell` (ask by default).
3. **Default.** When nothing matched, `default` decides: `allow`, `ask`, `deny`, `passthrough` (the engine's normal permission flow), or `jev` (the judge, below).
4. **The verdict.**
   - `deny`: the call is refused, and the model reads the rule's `reason`.
   - `allow`: the call runs *without* the engine's prompt. A deny from your settings (`permissions.deny`) or from plan mode still stands.
   - `ask`: with `askWith: "mod"`, the mod shows you an Allow / Deny dialog, and dismissing it denies. With `askWith: "engine"`, the question goes to your permission mode. In `claude -p` no one can answer, so `headless` decides (default `deny`).

Slash commands and skills you type are checked against the rules only: you typed them, so there is nothing to judge. A skill's prompt is also checked when it expands (typed, through the Skill tool, or preloaded into a subagent). A deny rule replaces the prompt with a notice, so a blocked skill cannot reach a subagent through its definition either. An ask rule asks there too, unless the Skill call or the typed `/skill` was just approved, so you're never asked twice.

**If the mod itself fails, it denies.** The engine skips a hook that throws, which would let the call through unchecked. So an internal error denies the tool call, refuses the typed command, or withholds the skill, and says why. A policy file that can't be re-read leaves the last good policy in force rather than an empty one.

**Inputs over 20,000 characters are asked about.** Matching is synchronous, so the rules don't match past that length, and the judge never sees a half-shown command. For the same reason, a regex whose repeated group itself repeats (`(a+)+`) is refused when the file loads.

## The judge (`default: "jev"`)

For a call to a tool listed in `jev.tools` that no rule decided, one request goes to Jev. It carries your latest prompt (the intent), the action, and a battery of yes/no questions, one per hazard:

| Hazard | Question (short) | Default decision |
|---|---|---|
| `destructive` | deletes, overwrites or irreversibly changes data, history or infrastructure? | ask |
| `exfiltration` | sends secrets, credentials, private code or personal data off the machine? | deny |
| `security_weakening` | disables checks, widens permissions, touches credentials/CI secrets, runs untrusted code? | ask |
| `out_of_scope` | goes clearly beyond what you asked for? | ask |

It also asks for a `severity` score (0–3). A hazard at or above `threshold` triggers its decision, and one at or above `askThreshold` asks. A severity at or above `severityDeny` turns an ask into a deny. The strictest result wins. Judgements are cached per identical action within the same request.

Backends, chosen by whichever key is set, the same as in jev-guardrails:

| Backend | Endpoint | Probability |
|---|---|---|
| `typesafe` | `POST api.typesafe.ai/v1/systemone`, `jev-latest` | `noul`, calibrated |
| `gateway` | `POST ai-gateway.vercel.sh/v4/ai/evaluation-model`, `typesafe-ai/jev` | `probability` |
| built-in | the engine's `$.model.classify` (no key needed) | none: the label is the decision |

If the judge errors or runs past `timeoutMs`, `jev.onError` decides (`ask` by default, or `passthrough`, `allow`, `deny`). The default asks rather than fails open: an outage should not quietly remove the protection.

## The policy file

Two files are merged:

| File | Who writes it | What it may do |
|---|---|---|
| `~/.claude/jev-auto-mode.json` (or the `configFile` option) | you | everything |
| `<project>/.claude/jev-auto-mode.json` | the repository | **tighten only**: deny and ask rules, a stricter `default`, `mode`, `headless`, `askWith` or `opaqueShell`, lower thresholds, more judged tools. Its allow rules are ignored unless your file sets `"trustProjectAllow": true` |

A repository you clone cannot use its own file to open things up. Both files are re-read at the start of each turn if they changed. A broken rule is reported (log + toast) and dropped, while the rest of the file still applies.

`/jev-auto-mode init` writes the [example policy](examples/jev-auto-mode.json) to your user file, and `/jev-auto-mode init project` writes it to the project's. Neither overwrites an existing file.

```jsonc
{
  "mode": "enforce",            // "audit": log what it would do, block nothing
  "default": "jev",             // allow | ask | deny | passthrough | jev
  "askWith": "mod",             // "mod": the mod's dialog · "engine": your permission mode
  "headless": "deny",           // what an ask becomes in claude -p
  "trustProjectAllow": false,   // user file only
  "opaqueShell": "ask",         // floor for `$X …`, eval, source: ask | deny | allow
  "rules": [
    { "id": "read-only", "decision": "allow", "tool": ["Read", "Glob", "Grep"] },
    { "id": "no-rm-rf", "decision": "deny", "bashRegex": "\\brm\\s+-[a-z]*r[a-z]*f", "reason": "Delete specific files instead." },
    { "id": "publish", "decision": "ask", "bash": ["npm publish*", "git push*"] },
    { "id": "secrets", "decision": "deny", "tool": ["Read", "Edit"], "path": ["**/.env", "~/.ssh/**"] },
    { "id": "github-deletes", "decision": "ask", "mcpServer": "github", "inputRegex": "\"delete" },
    { "id": "no-paste", "decision": "deny", "tool": "WebFetch", "domain": "*.pastebin.com" },
    { "id": "no-deploy-skill", "decision": "deny", "skill": "deploy-*" },
    { "id": "no-typed-deploy", "decision": "deny", "command": "deploy" },
    { "id": "no-nested-agents", "decision": "deny", "tool": "Agent", "scope": "subagents" }
  ],
  "jev": {
    "tools": ["Bash", "Write", "Edit", "MultiEdit", "NotebookEdit", "WebFetch", "mcp__*"],
    "hazards": { "destructive": "ask", "exfiltration": "deny", "security_weakening": "ask", "out_of_scope": "ask" },
    "threshold": 0.7, "askThreshold": 0.4, "severityDeny": 3,
    "onError": "ask", "timeoutMs": 2500
  }
}
```

### Rule matchers

A rule has a `decision`, an optional `id`, `reason` and `scope` (`all`, `main` or `subagents`), and at least one matcher. The matchers it names must **all** hit, and a list within one matcher hits if **any** entry does.

| Matcher | Matches | Notes |
|---|---|---|
| `tool` | tool name | `Bash`, `Write`, `mcp__github__*`, `Agent`, `Skill`, `*` |
| `mcpServer` | the server of an `mcp__server__tool` | `github` |
| `bash` | each part of a Bash command, as a glob | `*` matches anything, spaces included: `git push*` |
| `bashRegex` | each part of a Bash command, as a regex | |
| `path` | `file_path` / `path` / `notebook_path`, and a Bash command's arguments | `*` stays in one segment, `**` crosses them, `~` is your home. Relative and absolute forms both match. On Bash, a deny or ask hits when any argument matches (`cat ~/.aws/credentials`), and an allow only when every argument does |
| `domain` | the host of a `url` | `*.example.com` also matches `example.com` |
| `skill` | the Skill tool's skill, a typed `/skill`, a preloaded skill | |
| `command` | a slash command you type, without the slash | |
| `agent` | the Agent tool's `subagent_type` | |
| `inputRegex` | the action's whole input as JSON | the catch-all |

A rule with no matcher is rejected, since it would match everything. If that's what you want, write `"tool": "*"`.

## Commands

- `/jev-auto-mode`: the active policy, where it was loaded from, the decision tally, and any problems in the files
- `/jev-auto-mode log`: the last 15 decisions and what decided each one
- `/jev-auto-mode reload`: re-read the files on your next prompt
- `/jev-auto-mode init` / `init project`: write the example policy

## Options

```
  configFile:      file    your policy file; empty uses ~/.claude/jev-auto-mode.json
  typesafeApiKey:  string  TypeSafe key for the judge (preferred: calibrated probabilities)
  gatewayApiKey:   string  Vercel AI Gateway key
  provider:        string  "auto" | "typesafe" | "gateway" | "builtin"
  typesafeBaseUrl, typesafeModel, gatewayBaseUrl, gatewayModel: overrides, empty for the defaults
  logLevel:        string  "blocked" (asks and denies, default) | "all" | "off"
```

Keys live only in the options, never in the policy JSON. Set them in user settings (`~/.claude/settings.json`, never project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "jev-auto-mode@skills-dir": { "options": { "typesafeApiKey": "" } } } }
```

With `--plugin-dir` the key is plain `"jev-auto-mode"`.

## Install

```sh
npx claude-code-templates@latest --mod security/jev-auto-mode
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

Then run `/jev-auto-mode init` and edit `~/.claude/jev-auto-mode.json`. The mod is written to `.claude/skills/jev-auto-mode/` and auto-loads as `jev-auto-mode@skills-dir` **in a trusted project**. For one session: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/jev-auto-mode`.

Start with `"mode": "audit"` to see what it would block in your own work before you let it block anything.

## Limits

- It governs Claude, not you: a command you run yourself in a terminal is not seen.
- Shell matching is static. It reads what can be read from the command line (quoting, `$IFS`, wrappers, same-line variables, `bash -c`) and sends what can't to `opaqueShell`. But a script that builds the dangerous command inside a file it then runs (`python x.py`, `./deploy.sh`) is only as safe as the rules and the judge are about running that script. Treat the rules as a strong guard, not a sandbox.
- Self-protection covers the policy files and the mod's directory. Someone who can edit your `~/.claude/settings.json` can still turn the mod off; keep a `permissions.deny` on that file too if Claude should never touch it.
- The judge sees your latest prompt, not the whole conversation.
- Built-in classifier judgements carry no probability, so the thresholds do not apply to them.

## Privacy

With a key set and `default: "jev"`, your latest prompt and the judged action's input (a command, a file's path and new content, a URL) are sent to the backend the key belongs to. With no key, nothing leaves the machine.

## Tests

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .claude/skills/jev-auto-mode
```

The tests cover glob and shell parsing, rule precedence, the project-file trust model, self-protection and the judge's thresholds. Through the engine they also check that tool calls are denied, allowed past the engine prompt or handed to the engine's ask, the headless and audit paths, typed commands and skill prompts.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Written and tested on 2.1.282 against the 2.1.278 declarations. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
