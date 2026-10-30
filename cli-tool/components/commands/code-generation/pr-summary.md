---
name: pr-summary
description: Generate comprehensive pull request descriptions, changelogs, and commit diff reviews
allowed-tools: Bash, Read, Glob, Grep
argument-hint: "[branch-or-range] [--detailed|--changelog|--json|--breaking-only]"
---

# /pr-summary

Generate comprehensive, production-ready pull request descriptions, categorized changelogs, and semantic commit diff reviews from the active Git workspace or branch comparison.

**Arguments**: `$ARGUMENTS` — an optional Git revision followed by any of `--detailed`, `--changelog`, `--json`, or `--breaking-only` (for example, `main --json`).
---

## Workspace & Git Context

Inspect the local repository state before composing the summary:
- **Repository**: !`gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || git remote get-url origin 2>/dev/null || echo "Local Repository"`
- **Current Branch**: !`git branch --show-current 2>/dev/null || echo "Detached HEAD"`
- **Upstream / Target Base**: Determined from `$ARGUMENTS` (default: `main` or `origin/main`)
- **Changed Files Count**: Check modified files count between the target ref and HEAD.

---

## Execution Workflow

When invoked, execute the following systematic process:

### Step 1: Analyze Changes & Diff
1. Detect base reference & parse flags:
   - Extract any options specified in `$ARGUMENTS`: `--detailed`, `--changelog`, `--json`, `--breaking-only`.
   - Treat the first non-flag argument as the Git target revision; reject unknown flags instead of passing them to Git.
   - Remove all mode flags before constructing `TARGET_REF`; append `...HEAD` when the target is a branch or revision that is not already a range.
   - If no revision is given, default the comparison target `TARGET_REF` to `origin/main...HEAD` (or `main...HEAD`). Never pass mode flags as arguments to Git commands.
   - Keep `--breaking-only` in sync with the Arguments and Advanced Flags lists; it emits only the Breaking Changes & Migrations section and checklist.
2. Inspect diff statistics:
   ```bash
   git diff --stat "${TARGET_REF:-origin/main...HEAD}"
   ```
3. Inspect commit history on branch:
   ```bash
   git log --oneline --no-merges "${TARGET_REF:-origin/main...HEAD}"
   ```
4. Analyze full patch contents for functional and architectural modifications:
   ```bash
   git diff "${TARGET_REF:-origin/main...HEAD}"
   ```

### Step 2: Classify Modifications
Group all detected changes according to Conventional Commits standards:
- 🚀 **Features (`feat`)**: User-facing capabilities, new endpoints, novel components.
- 🐛 **Bug Fixes (`fix`)**: Defect corrections, edge case handling, error resilience.
- ⚡ **Performance (`perf`)**: Latency reductions, memory leak fixes, query optimizations, bundle trimming.
- 🔄 **Refactoring (`refactor`)**: Code reorganization without changing external behavior.
- 🛡️ **Security & Hardening (`security`)**: Vulnerability mitigation, input validation, secret hygiene.
- 📝 **Documentation (`docs`)**: README updates, API reference changes, architecture diagrams.
- 🧪 **Tests (`test`)**: New test suites, unit/integration mocks, benchmark fixtures.
- 🔧 **Build & Tooling (`chore` / `ci`)**: Dependency bumps, CI workflows, build scripts.

### Step 3: Assess Impact & Breaking Changes
- Flag any public API signature changes, modified database schemas, altered environment variables, or breaking behavior modifications.
- Detail required migration steps for downstream consumers or operators.

### Step 4: Synthesize Output
Produce a high-grade Pull Request description ready to copy into GitHub, GitLab, or pass directly to `gh pr create --body`.

---

## Standard PR Summary Output Template

```markdown
## 📌 Summary of Changes
A concise 2-3 sentence executive summary of what was accomplished, why it was needed, and the high-level design direction.

## 🎯 Motivation & Context
- Why are these changes being made?
- Links to relevant issues, tickets, or user stories (e.g., `Resolves #123`).

## 🔍 Detailed Walkthrough

### 🚀 Features & Enhancements
- **`<component-or-module>`**: Brief description of new functionality and implementation details.

### 🐛 Bug Fixes & Resilience
- **`<component-or-module>`**: Problem identified and how it was resolved.

### ⚡ Performance & Optimization
- **`<component-or-module>`**: Quantitative or qualitative improvements made.

## 📂 File-by-File Change Matrix

| File Path | Change Type | Summary of Modifications |
| :--- | :--- | :--- |
| `path/to/file.ts` | Modified | Added validation check and exported helper function |
| `path/to/new_file.ts` | Added | Implemented new handler service |

## ⚠️ Breaking Changes & Migrations
<!-- If none, explicitly state "None" -->
- None / List of breaking changes with migration guidance.

## 🧪 Testing & Verification
- [ ] Unit tests added/updated (`npm test` / `pytest`)
- [ ] Manual verification executed:
  - *Scenario 1*: [Description of test step and observed behavior]
  - *Scenario 2*: [Edge case validation]
- [ ] Linting & static analysis passed (`npm run lint`)

## 📋 Reviewer Focus & Notes
- Highlight specific areas where architectural feedback or security scrutiny is requested.
```

---

## Advanced Flags & Options

- **`--detailed`**: Includes comprehensive per-function diff commentary and sequence walkthroughs.
- **`--changelog`**: Formats output strictly as a release-ready Keep a Changelog block (`## [Unreleased]`).
- **`--json`**: Emits the structured breakdown as a JSON object for CI/CD automation pipelines.
- **`--breaking-only`**: Emits only the Breaking Changes & Migrations section and checklist.
