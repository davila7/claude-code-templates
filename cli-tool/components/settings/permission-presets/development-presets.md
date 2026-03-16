# Permissions Template: Development Environment

Developer-friendly permission presets that balance productivity with safety.

Copy the relevant configuration into `.claude/settings.json` for project-wide settings,
or `~/.claude/settings.json` for personal settings.

---

## Balanced Development (Recommended)

Allow common development tools, protect sensitive files, ask for destructive operations.

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Grep",
      "Glob",
      "Bash(npm run *)",
      "Bash(npm test *)",
      "Bash(npm install *)",
      "Bash(npx *)",
      "Bash(node *)",
      "Bash(git status *)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git branch *)",
      "Bash(git stash *)",
      "Bash(ls *)",
      "Bash(cat *)",
      "Bash(wc *)",
      "Bash(head *)",
      "Bash(tail *)",
      "Bash(mkdir *)",
      "Bash(cp *)",
      "Edit",
      "Write"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force *)",
      "Bash(git reset --hard *)",
      "Bash(git clean -f *)",
      "Bash(chmod 777 *)",
      "Bash(curl * | bash)",
      "Bash(wget * | bash)",
      "Read(.env)",
      "Read(.env.*)",
      "Read(**/secrets/**)",
      "Read(**/*.pem)",
      "Read(**/*.key)",
      "Edit(.env)",
      "Edit(.env.*)",
      "Write(.env)",
      "Write(.env.*)"
    ]
  }
}
```

---

## Python Development

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Grep",
      "Glob",
      "Edit",
      "Write",
      "Bash(uv *)",
      "Bash(python *)",
      "Bash(pytest *)",
      "Bash(ruff *)",
      "Bash(mypy *)",
      "Bash(pip *)",
      "Bash(git status *)",
      "Bash(git diff *)",
      "Bash(git log *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Read(.env)",
      "Read(.env.*)",
      "Edit(.env)",
      "Write(.env)"
    ]
  }
}
```

---

## Ruby/Rails Development

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Grep",
      "Glob",
      "Edit",
      "Write",
      "Bash(bundle *)",
      "Bash(rails *)",
      "Bash(rake *)",
      "Bash(rspec *)",
      "Bash(rubocop *)",
      "Bash(bin/*)",
      "Bash(git status *)",
      "Bash(git diff *)",
      "Bash(git log *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(rails db:drop *)",
      "Bash(rails db:reset *)",
      "Read(.env)",
      "Read(config/master.key)",
      "Read(config/credentials.yml.enc)"
    ]
  }
}
```

---

## Go Development

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Grep",
      "Glob",
      "Edit",
      "Write",
      "Bash(go *)",
      "Bash(make *)",
      "Bash(git status *)",
      "Bash(git diff *)",
      "Bash(git log *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Read(.env)",
      "Read(.env.*)"
    ]
  }
}
```

---

## Restrictive (New to Claude Code)

Start restrictive and relax as you get comfortable.

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Grep",
      "Glob",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)"
    ],
    "deny": [
      "Bash(rm *)",
      "Bash(git push *)",
      "Bash(git reset *)",
      "Bash(curl *)",
      "Bash(wget *)",
      "Read(.env*)",
      "Read(**/*.key)",
      "Read(**/*.pem)"
    ]
  }
}
```

With this setup, Claude will ask permission for edits, writes, and most bash commands.

---

## Open (Experienced User)

Maximum productivity, minimal interruptions. Use when you trust the codebase and review diffs before committing.

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Grep",
      "Glob",
      "Edit",
      "Write",
      "Bash"
    ],
    "deny": [
      "Bash(rm -rf /)",
      "Bash(git push --force *)",
      "Bash(git reset --hard *)",
      "Read(.env)",
      "Read(.env.*)"
    ]
  }
}
```

---

## File Protection Patterns

Common patterns for the `deny` list:

```json
{
  "permissions": {
    "deny": [
      "Read(.env)",
      "Read(.env.*)",
      "Read(**/secrets/**)",
      "Read(**/*.pem)",
      "Read(**/*.key)",
      "Read(**/*.p12)",
      "Read(**/credentials*)",
      "Edit(package-lock.json)",
      "Edit(yarn.lock)",
      "Edit(pnpm-lock.yaml)",
      "Edit(Gemfile.lock)",
      "Edit(.github/workflows/**)",
      "Write(.github/workflows/**)"
    ]
  }
}
```

---

## Tips

- Start restrictive and relax over time using `/permissions`
- Use project-level settings (`.claude/settings.json`) for team-shared rules
- Use user-level settings (`~/.claude/settings.json`) for personal preferences
- Deny rules take priority over allow rules
- Wildcard `*` matches any arguments in Bash commands
- Gitignore-style patterns work for file paths
- Use `--permission-mode plan` for a safe exploration mode that allows no edits
