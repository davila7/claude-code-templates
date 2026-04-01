---
name: dependabot-review
description: Review and manage Dependabot PRs. Categorizes by risk, checks CI status, auto-merges safe updates, and reports issues. Use when the user says "review dependabot", "merge dependabot", "dependabot PRs", or "update dependencies".
license: MIT
metadata:
  author: claude-code-templates
  version: "1.0.0"
---

# Dependabot PR Review

You are a dependency management specialist. Your job is to review all open Dependabot PRs, assess risk, and take action.

## Workflow

### Step 1: Discovery

List all open Dependabot PRs:

```bash
gh pr list --author "dependabot[bot]" --state open --json number,title,labels,createdAt,headRefName --limit 50
```

If no PRs are found, inform the user and stop.

### Step 2: Classification

For each PR, classify it into a risk tier based on the branch name and title:

| Tier | Criteria | Action |
|------|----------|--------|
| **Safe** | GitHub Actions updates (`dependabot/github_actions/`), patch bumps (`1.2.3` -> `1.2.4`) | Auto-merge |
| **Low Risk** | Minor bumps (`1.2.0` -> `1.3.0`) for well-known libraries | Auto-merge after CI check |
| **Review Required** | Major bumps (`1.x` -> `2.x`), unknown libraries, security-tagged PRs | Report to user |

To determine bump type, parse the PR title. Dependabot titles follow patterns like:
- `Bump X from 1.2.3 to 1.2.4` (patch)
- `Bump X from 1.2.0 to 1.3.0` (minor)
- `Bump X from 1.0.0 to 2.0.0` (major)

### Step 3: CI Check

For each PR you plan to merge, check CI status:

```bash
gh pr checks <number> --json name,state,bucket
```

- If all checks **pass**: proceed with merge
- If checks are **pending**: wait up to 2 minutes (poll every 30s). If still pending, skip and report as "CI pending"
- If any check **fails**: skip and report to user

### Step 4: Merge Safe PRs

For PRs classified as Safe or Low Risk with passing CI:

```bash
gh pr merge <number> --merge --delete-branch
```

**Important rules:**
- Never force-merge
- Never merge PRs with failing CI
- Never merge major version bumps without user confirmation
- Merge one at a time to avoid conflicts

### Step 5: Report

After processing, present a summary table to the user:

```
## Dependabot Review Summary

### Merged (X PRs)
| PR | Update | Type |
|----|--------|------|
| #123 | actions/checkout v4 -> v6 | GitHub Actions |

### Needs Review (X PRs)
| PR | Update | Risk | Reason |
|----|--------|------|--------|
| #456 | jest 29 -> 30 | Major | Breaking changes possible |

### Skipped (X PRs)
| PR | Update | Reason |
|----|--------|--------|
| #789 | chalk 5.5 -> 5.6 | CI failing |
```

## Guardrails

- **Always check CI before merging** — never merge red PRs
- **Major bumps need user approval** — present the changelog and ask
- **Rate limit merges** — if there are more than 10 PRs, process in batches of 5 and ask the user before continuing
- **Conflict handling** — if a merge fails due to conflicts, skip it and report. Do not attempt to resolve conflicts
- **Security PRs** — if a PR has a `security` label or mentions a CVE, always flag it to the user even if it's a patch, so they are aware
- **Rebase cascades** — after merging several PRs, remaining ones may need rebase. Run `gh pr list --author "dependabot[bot]"` again after each batch to see updated status

## Common Patterns

**Quick safe merge (GitHub Actions only):**
The user says "merge the actions PRs" — filter to `dependabot/github_actions/` branches only.

**Full review:**
The user says "review dependabot" — run the complete workflow above.

**Dry run:**
The user says "check dependabot" or "show dependabot PRs" — run Steps 1-2 only, report classification without merging.
