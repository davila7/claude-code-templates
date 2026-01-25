# Commit Work

A comprehensive skill for creating high-quality, production-ready git commits that are easy to review, safe to ship, and follow best practices.

## Purpose

This skill helps you create well-crafted git commits by:
- Ensuring only intended changes are included
- Splitting work into logically scoped commits
- Writing clear, descriptive commit messages that explain what changed and why
- Following Conventional Commits format
- Preventing common mistakes (secrets, debug code, unrelated changes)

## When to Use

Use this skill when you need to:
- Commit your work with proper staging and review
- Craft meaningful commit messages
- Split mixed changes into multiple logical commits
- Follow Conventional Commits format
- Ensure commits are review-ready and safe to merge

**Trigger phrases:**
- "commit this work"
- "create a commit"
- "split these changes into commits"
- "help me commit"
- "write a commit message"

## How It Works

The skill follows a rigorous 8-step workflow:

1. **Inspect** - Review working tree with `git status` and `git diff`
2. **Decide boundaries** - Determine if changes should be split into multiple commits
3. **Stage selectively** - Use patch staging (`git add -p`) for granular control
4. **Review staged changes** - Verify with `git diff --cached`
5. **Describe changes** - Articulate what changed and why in 1-2 sentences
6. **Write message** - Craft Conventional Commits format message
7. **Verify** - Run relevant tests/checks before committing
8. **Repeat** - Continue until working tree is clean

## Key Features

### Smart Commit Splitting

Automatically identifies when to split commits by:
- Feature vs refactor
- Backend vs frontend
- Formatting vs logic
- Tests vs production code
- Dependency bumps vs behavior changes

### Conventional Commits Format

All commits follow the standard:
```
type(scope): short summary

Detailed body explaining what changed and why.

BREAKING CHANGE: if applicable
```

### Safety Checks

Reviews staged changes for:
- Secrets or tokens
- Accidental debug logging
- Unrelated formatting changes
- Mixed or overly broad scope

### Patch Staging

Uses `git add -p` for fine-grained control when changes within a single file need to be split across commits.

## Usage Examples

### Example 1: Simple Single Commit

```bash
# User asks: "commit this bugfix"

# Skill workflow:
git status
git diff
git add src/api/auth.js
git diff --cached
git commit -m "fix(auth): resolve token expiration edge case

Previously tokens would fail validation within 1 second of expiry
due to clock skew. Now includes 5-second grace period."
```

### Example 2: Splitting Mixed Changes

```bash
# User has: formatting changes + new feature + test updates

# Skill creates 3 commits:
# Commit 1: chore: format code with prettier
# Commit 2: feat(api): add user profile endpoint
# Commit 3: test: add coverage for profile endpoint

# Uses git add -p to stage selectively
```

### Example 3: Interactive Patch Staging

```bash
# Single file has refactor + bugfix mixed

git add -p src/components/Header.js
# Stages only bugfix hunks for first commit

git commit -m "fix(ui): correct mobile menu z-index"

git add src/components/Header.js
# Stages refactor hunks for second commit

git commit -m "refactor(ui): extract menu logic to custom hook"
```

## Inputs

The skill may ask for:
- **Commit strategy**: Single commit or multiple logical commits?
- **Commit style**: Conventional Commits (required by default)
- **Project rules**: Max subject length, required scopes, etc.

If not provided, defaults to:
- Multiple small commits when changes are unrelated
- Conventional Commits format
- Standard best practices

## Deliverables

After running, the skill provides:
- Final commit message(s) used
- Short summary per commit (what/why)
- Commands used for staging and review
- Test/verification results

## Best Practices

1. **Review before staging** - Always inspect `git diff` first
2. **Stage intentionally** - Never use `git add .` or `git add -A`
3. **Use patch mode** - Leverage `git add -p` for mixed changes
4. **Verify staged changes** - Check `git diff --cached` before committing
5. **Keep commits focused** - One logical change per commit
6. **Write for reviewers** - Explain what/why, not implementation details
7. **Test before committing** - Run relevant checks after each commit

## Related Resources

- See `references/commit-message-template.md` for message templates
- Uses Conventional Commits specification: https://www.conventionalcommits.org/
- Integrates with standard git workflow and hooks

## Notes

- This skill enforces Conventional Commits format
- It encourages small, focused commits over large monolithic ones
- Patch staging (`git add -p`) is used extensively for granular control
- Each commit should pass basic verification (tests, lint, build)
- The goal is commits that are safe to review, bisect, and cherry-pick
