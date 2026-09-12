---
name: pr-summary
description: Slash command /pr-summary to generate comprehensive markdown changelogs and commit diff reviews
---

# /pr-summary

Generate comprehensive, production-ready pull request descriptions, categorized changelogs, and semantic commit diff reviews from the active Git workspace or branch comparison.

**Arguments**: `$ARGUMENTS` (e.g., `main`, `upstream/main`, `HEAD~3`, `--detailed`, `--breaking-only`)

---

## Workspace & Git Context

Inspect the local repository state before composing the summary:
- **Repository**: !`gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || git remote get-url origin 2>/dev/null || echo "Local Repository"`
- **Current Branch**: !`git branch --show-current 2>/dev/null || echo "Detached HEAD"`
- **Upstream / Target Base**: Determined from `$ARGUMENTS` (default: `main` or `origin/main`)
- **Changed Files Count**: !`git diff --name-only ${ARGUMENTS:-origin/main...HEAD} 2>/dev/null | wc -l || echo "Run within Git repository"`

---

## Execution Workflow

When invoked, execute the following systematic process:

### Step 1: Analyze Changes & Diff
1. Detect base reference: If `$ARGUMENTS` specifies a branch or commit range (e.g. `main...HEAD`, `v1.2.0..HEAD`), use it; otherwise compare against `origin/main` or `main`.
2. Inspect diff statistics:
   ```bash
   git diff --stat ${ARGUMENTS:-origin/main...HEAD}
   ```
3. Inspect commit history on branch:
   ```bash
   git log --oneline --no-merges ${ARGUMENTS:-origin/main...HEAD}
   ```
4. Analyze full patch contents for functional and architectural modifications:
   ```bash
   git diff ${ARGUMENTS:-origin/main...HEAD}
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
