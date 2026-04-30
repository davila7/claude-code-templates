# Frontmatter Reference

Complete reference for the YAML frontmatter fields supported by Claude Code skills, distilled from the official documentation at [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills#frontmatter-reference).

All fields are **optional**. Only `description` is **recommended** so Claude knows when to invoke the skill.

## Quick reference table

| Field | Required | Type | Purpose |
|---|---|---|---|
| `name` | No | string | Display name (defaults to directory name) |
| `description` | Recommended | string | What the skill does + when to use it |
| `when_to_use` | No | string | Extra trigger context, appended to description |
| `argument-hint` | No | string | Autocomplete hint for arguments |
| `arguments` | No | string \| list | Named positional arguments for `$name` substitution |
| `disable-model-invocation` | No | boolean | If `true`, only the user can invoke (no auto-trigger) |
| `user-invocable` | No | boolean | If `false`, hidden from `/` menu (Claude-only) |
| `allowed-tools` | No | string \| list | Tools pre-approved while skill is active |
| `model` | No | string | Override session model for this skill |
| `effort` | No | string | Override effort level: `low`, `medium`, `high`, `xhigh`, `max` |
| `context` | No | string | Set to `fork` to run in a forked subagent |
| `agent` | No | string | Subagent type when `context: fork` is set |
| `hooks` | No | object | Skill-scoped lifecycle hooks |
| `paths` | No | string \| list | Glob patterns that gate auto-activation |
| `shell` | No | string | `bash` (default) or `powershell` for inline `!` commands |

## Field-by-field

### `name` (optional)

Display name shown in the `/` menu and used as the slash command. Defaults to the directory name if omitted.

**Format:** lowercase letters, numbers, hyphens. Max 64 characters.

```yaml
name: my-skill
```

For skills in this repository, **always set `name` explicitly** and make it match the directory name. This avoids surprises when the directory is renamed.

### `description` (recommended)

What the skill does and when to use it. Claude reads this to decide whether to load the skill automatically.

**Critical constraints:**
- The combined `description` + `when_to_use` is **truncated at 1,536 characters** in the skill listing. Front-load the key use case.
- If omitted, Claude uses the first paragraph of the markdown body — usually a poor trigger signal. Always set it explicitly.

See [DESCRIPTION-GUIDE.md](DESCRIPTION-GUIDE.md) for format rules and ten before/after rewrites.

### `when_to_use` (optional)

Extra trigger phrases or example user requests, appended to `description` in the skill listing. Counts toward the same 1,536-character cap.

```yaml
description: Run accessibility audits on React components.
when_to_use: When the user mentions a11y, ARIA, screen readers, or asks "is this accessible?"
```

Use this when your `description` covers the capability cleanly but you want to load up on triggers without bloating the first sentence. If your description is already trigger-rich, omit `when_to_use`.

### `argument-hint` (optional)

Hint shown in autocomplete to indicate expected arguments.

```yaml
argument-hint: "[issue-number]"
argument-hint: "[filename] [format]"
```

Pure UX — does not validate input.

### `arguments` (optional)

Named positional arguments for `$name` substitution in the skill body. Accepts a space-separated string or a YAML list.

```yaml
arguments: issue branch
# or
arguments:
  - issue
  - branch
```

Then reference in the body as `$issue`, `$branch`. See [string substitutions](#available-string-substitutions) below.

### `disable-model-invocation` (optional, default `false`)

Set to `true` to prevent Claude from auto-invoking the skill. The user can still trigger it explicitly with `/skill-name`.

```yaml
disable-model-invocation: true
```

**Use for:** workflows with side effects (`/deploy`, `/commit`, `/send-slack-message`), one-shot prompt skills (`/zoom-out`, `/grill-me`).

**Side effect:** removes the skill description from Claude's context entirely, freeing tokens.

### `user-invocable` (optional, default `true`)

Set to `false` to hide from the `/` menu while still letting Claude invoke it.

```yaml
user-invocable: false
```

**Use for:** background knowledge that isn't an actionable command (e.g. `legacy-system-context`).

### `allowed-tools` (optional)

Tools pre-approved without per-use prompts while the skill is active. Accepts a space-separated string or a YAML list.

```yaml
allowed-tools: Read Grep Bash(git status:*)
```

This **grants** permission for listed tools — it does not restrict the rest. Other tools remain callable subject to your permission settings. To block tools, use deny rules in `/permissions`.

### `model` (optional)

Override the session model while this skill is active. Resumes the session model on the next prompt.

```yaml
model: opus
# or
model: inherit
```

Same values accepted as `/model`. Use `inherit` to keep the active model.

### `effort` (optional)

Override the effort level while this skill is active. Inherits from session by default.

**Valid values:** `low`, `medium`, `high`, `xhigh`, `max` (availability depends on the active model).

```yaml
effort: high
```

### `context` (optional)

Set to `fork` to run the skill in an isolated subagent context. The skill body becomes the subagent's prompt.

```yaml
context: fork
agent: Explore
```

**Important:** `context: fork` only makes sense for skills with explicit task instructions. Reference-style skills ("apply these conventions") will return without meaningful output because the subagent has no actionable prompt.

### `agent` (optional)

When `context: fork` is set, picks the subagent configuration. Defaults to `general-purpose`.

**Built-in options:** `Explore`, `Plan`, `general-purpose`. Or any custom subagent in `.claude/agents/`.

### `hooks` (optional)

Skill-scoped lifecycle hooks. See the official hooks docs for the configuration format.

### `paths` (optional)

Glob patterns that gate auto-activation. When set, Claude only auto-loads the skill while working with files matching one of the patterns. Accepts a comma-separated string or a YAML list.

```yaml
paths: "**/*.tsx,**/*.jsx"
# or
paths:
  - "**/*.tsx"
  - "**/*.jsx"
```

Manual invocation (`/skill-name`) always works regardless of `paths`.

### `shell` (optional, default `bash`)

Shell to use for inline `` !`command` `` and ` ```! ` blocks. Set to `powershell` for Windows. Requires `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`.

```yaml
shell: powershell
```

## Available string substitutions

Substitutions resolve before the skill content is sent to Claude.

| Variable | Resolves to |
|---|---|
| `$ARGUMENTS` | Full argument string. If absent from the body, gets appended as `ARGUMENTS: <value>`. |
| `$ARGUMENTS[N]` | Argument at 0-based index N. Multi-word values must be quoted at invocation. |
| `$N` | Shorthand for `$ARGUMENTS[N]` (e.g. `$0`, `$1`). |
| `$name` | Named argument from the `arguments` list. |
| `${CLAUDE_SESSION_ID}` | Current session ID. |
| `${CLAUDE_EFFORT}` | Current effort level. |
| `${CLAUDE_SKILL_DIR}` | Directory of this `SKILL.md`. Use in inline shell commands to reference bundled scripts. |

**Indexed argument quoting:** `/my-skill "hello world" second` → `$0` = `hello world`, `$1` = `second`.

## Recommended frontmatter for this repository

For skills shipped in `cli-tool/components/skills/`, the **minimum** is:

```yaml
---
name: skill-name
description: Capability sentence. Use when [specific triggers].
---
```

Add fields **only when needed**:

| Add this | When |
|---|---|
| `disable-model-invocation: true` | One-shot prompts, side-effecting workflows you only want triggered manually |
| `user-invocable: false` | Background knowledge that isn't a useful slash command |
| `allowed-tools` | The skill needs to run specific tools without prompting on every invocation |
| `argument-hint` + `arguments` | The skill takes structured arguments (`/fix-issue 123`) |
| `paths` | The skill is only relevant in specific file types (`*.tsx`, `tsconfig.json`) |
| `context: fork` + `agent` | The skill is a one-shot research/audit task that should run in isolation |
| `model` / `effort` | The skill genuinely needs a different model or effort tier than the session default |
| `when_to_use` | The capability description is clean but you want extra trigger phrases without bloating it |

**Avoid** adding fields speculatively. Every extra field is a maintenance surface and a thing to get wrong.

## Anti-patterns

❌ **Non-standard fields** like `license`, `version`, `metadata.author` — these are not part of the official schema. The catalog generator may ignore them silently. If you need attribution, use a `LICENSE.txt` file at the skill directory root or a comment block in the body.

❌ **Setting `name` to anything other than the directory name** — breaks the convention that directory = slash command.

❌ **`disable-model-invocation: true` without explaining why** — most skills should be model-invocable. Reserve this for workflows where Claude's autonomous decision could cause harm or surprise.

❌ **`allowed-tools: *`** — defeats the purpose. List the specific tools the skill actually needs.

❌ **`paths` patterns that are too narrow** — `paths: "src/components/**/*.tsx"` will miss the skill in monorepos or alternate layouts. Prefer `**/*.tsx` unless you genuinely need the path constraint.

❌ **`context: fork` on a reference skill** — the subagent receives the guidelines as a prompt with no task and returns nothing useful.

## Validation

Run the audit script to catch the most common frontmatter issues:

```bash
bash scripts/audit-skill.sh path/to/SKILL.md
```

The script checks: `name` is kebab-case and matches the directory, `description` is present and includes a `Use when` trigger, character count is under 1024, no first-person voice, no time-sensitive content. It does not yet validate every field in this reference — those checks rely on manual review against [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
