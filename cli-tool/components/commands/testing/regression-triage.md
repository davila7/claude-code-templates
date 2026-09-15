---
allowed-tools: Read, Glob, Grep, Bash(git:*), Bash(npm test:*), Bash(npm run:*), Bash(pnpm test:*), Bash(yarn test:*)
argument-hint: <failing-test-or-issue>
description: Triage a regression by comparing the failing path against the last known good commit
---

# Regression Triage

Investigate a regression for: **$ARGUMENTS**

## Purpose

Find the smallest code change that introduced a failing test, broken workflow, or user-reported regression.

## Pre-flight

1. Confirm the working tree is clean. If this prints anything, stop and ask the user to commit or stash the changes before continuing:
   ```bash
   test -z "$(git status --porcelain)" || { echo "Working tree is dirty; commit or stash changes first."; exit 1; }
   ```
2. Record the current branch and commit:
   ```bash
   git branch --show-current
   git rev-parse --short HEAD
   ```
3. Identify the failing command or reproduction steps from `$ARGUMENTS`.

## Triage Workflow

### 1. Reproduce the failure

Run the narrowest available command first. Treat `$ARGUMENTS` as a description or test selector, not as a shell command: identify the reproduction/test command from the issue and repository documentation, then append only a validated selector (quoted as needed).

For example, after identifying `packages/foo/test/foo.test.ts` as the selector:

```bash
npm test -- packages/foo/test/foo.test.ts
```

If no narrow command exists, run the documented test command from the repository README or CONTRIBUTING guide.

### 2. Compare against recent history

Inspect recent commits that touched the failing area:

```bash
git log --oneline --decorate --max-count=20 -- <path-to-failing-area>
```

For each suspicious commit, inspect the focused diff:

```bash
git show --stat <commit>
git show <commit> -- <path-to-failing-area>
```

### 3. Isolate the change

If the regression window is unclear, use `git bisect` only with a wrapper that distinguishes a real test failure from an indeterminate environment failure. The wrapper must exit 0 for pass, 1 for a reproducible failure, and 125 when the test cannot run:

```bash
cat > /tmp/triage-bisect.sh <<'EOF'
#!/usr/bin/env bash
set -o pipefail
<validated-test-command>
status=$?
# Replace this classification with the repository-specific environment errors.
case "$status" in 0) exit 0;; 1) exit 1;; *) exit 125;; esac
EOF
chmod +x /tmp/triage-bisect.sh
git bisect start
git bisect bad
git bisect good <known-good-commit>
git bisect run /tmp/triage-bisect.sh
git bisect reset
```

Stop and report the environment failure if it cannot be classified reliably. Only run bisect when the test command is deterministic and reasonably fast.

### 4. Report findings

Return a concise report with:

- Failing command and observed error
- Suspected commit or code path
- Minimal fix recommendation
- Tests that should pass after the fix

## Safety Notes

- Do not discard user changes.
- Do not run destructive git commands.
- Prefer narrow tests before full suites.
- If tests require unavailable services, document the missing dependency and continue with static analysis.
