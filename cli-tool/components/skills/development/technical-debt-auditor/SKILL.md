---
name: technical-debt-auditor
description: >
  Scans a codebase and produces a quantified technical debt report with a prioritized remediation
  plan. Analyzes dead code, TODO/FIXME/HACK markers, dependency staleness, complexity hotspots,
  code duplication signals, test coverage gaps, unused exports, and outdated patterns. Use this
  skill when the user asks to audit their codebase for tech debt, wants a health check of their
  code quality, says things like "where should I focus refactoring", "find code smells", "audit
  my codebase", "what technical debt do we have", "prioritize cleanup work", or asks about code
  quality metrics. Also trigger when the user mentions "code rot", "legacy cleanup", "refactoring
  priorities", or wants to understand the overall health of a project before a major effort.
  Trigger even if the user doesn't say "technical debt" explicitly — any request to systematically
  assess code quality and identify improvement priorities belongs here.
---

# Technical Debt Auditor

You are performing a systematic technical debt audit of this codebase. Your goal: produce a
quantified, actionable report that tells the team exactly where their debt is, how severe it is,
and what to fix first. This is not a vague "code review" — it's a structured scan with concrete
metrics and a prioritized remediation plan.

Technical debt is like financial debt — it accumulates interest. A quick hack today costs 10x more
to fix in six months when three features depend on it. Your job is to find the debt before the
interest compounds, quantify it so it can be prioritized against feature work, and give the team
a realistic plan to pay it down.

## What you're scanning for

| Debt category | What to look for | Why it matters |
|---|---|---|
| **Marker debt** | TODO, FIXME, HACK, XXX, TEMP, WORKAROUND comments | Developers flagged these as known shortcuts — they're self-reported debt |
| **Dead code** | Unused exports, unreachable branches, commented-out code blocks, unused files | Dead code misleads readers, adds cognitive load, and sometimes hides bugs |
| **Dependency debt** | Outdated packages, deprecated APIs, pinned-to-old-major versions, unused deps in package manifest | Stale deps accumulate security vulns and block upgrades |
| **Complexity hotspots** | Large files (>300 lines), large functions (>50 lines), deeply nested logic (>3 levels), high cyclomatic complexity | Complex code is where bugs hide and where changes are slowest |
| **Duplication signals** | Near-identical code blocks, copy-pasted patterns with slight variations | Duplication means bug fixes need to happen in N places instead of 1 |
| **Test gaps** | Missing test files for modules, low assertion density, test files that only test happy paths | Untested code is where regressions slip through |
| **Outdated patterns** | Patterns that contradict the project's own conventions, deprecated language features, legacy API usage | Inconsistency slows onboarding and creates confusion |
| **Config debt** | Stale configs, conflicting settings, environment files with unused variables | Config debt causes "works on my machine" bugs and deploy failures |

## PHASE 1 — RECONNAISSANCE

Before scanning anything, understand the project:

1. **Identify the tech stack** — read package.json, Cargo.toml, pyproject.toml, go.mod, or whatever the project uses. Note the language(s), framework(s), package manager, and build system.
2. **Find the entry points** — where does the application start? What are the main modules?
3. **Check for existing quality tooling** — linters, formatters, type checkers, test runners, CI config. Understanding what's already enforced tells you what NOT to flag (e.g., don't report style issues if prettier is configured).
4. **Read any CLAUDE.md or project docs** — these may contain conventions that inform what counts as "outdated" vs "intentional."
5. **Note the project scale** — file count, approximate lines of code. This calibrates your effort estimates later.

Do not start scanning until you have this context. A "large function" in a 200-line CLI script means something different than in a 50,000-line enterprise app.

## PHASE 2 — SYSTEMATIC SCAN

Work through each debt category methodically. For each category, use the appropriate tools:

### Marker debt scan
Search for these patterns across all source files (not node_modules, vendor, build output):
- `TODO`, `FIXME`, `HACK`, `XXX`, `TEMP`, `WORKAROUND`, `KLUDGE`, `DEPRECATED`
- Note the file, line number, and surrounding context for each
- Classify each by severity: `HACK`/`FIXME` are higher severity than `TODO`
- Check dates if present — older markers indicate forgotten debt

### Dead code scan
- Look for exported functions/classes that are never imported elsewhere
- Find commented-out code blocks (more than 2 consecutive commented lines of code, not documentation comments)
- Check for files that nothing imports or references
- Look for unreachable code after return/throw/break statements
- Check for unused variables and imports that linters haven't caught

### Dependency debt scan
- Read the package manifest and lockfile
- For Node.js: check `package.json` dependencies against actual imports; flag packages in dependencies that aren't imported anywhere
- Look for deprecated package warnings in lockfiles
- Check major version gaps (e.g., package is on v2 but v5 is current)
- Note any dependency with known security advisories if identifiable from lockfile metadata

### Complexity hotspot scan
- Find the largest files by line count — list the top 10
- Within those files, find the largest functions/methods
- Look for deeply nested conditionals (if/else chains >3 levels deep)
- Flag god classes/modules that do too many things (heuristic: >10 public methods or >5 unrelated responsibilities)
- Check for overly long parameter lists (>5 parameters)

### Duplication signal scan
- Look for structurally similar code blocks across files
- Check for copy-pasted error handling patterns
- Find repeated business logic that should be extracted into shared utilities
- Note: you're looking for significant duplication (>10 lines of near-identical logic), not trivial similarities

### Test gap scan
- Map source files to test files — which source files have no corresponding test?
- Look at existing tests: are they just smoke tests or do they test edge cases?
- Check for test files that are skipped (.skip, @Ignore, etc.)
- Note any mocking that's testing implementation details rather than behavior

### Outdated pattern scan
- Compare patterns used across the codebase — is most of the code using pattern A while a few files use deprecated pattern B?
- Look for deprecated language features (e.g., `var` in modern JS, `string.format` over f-strings in Python 3.6+)
- Check for inconsistent error handling strategies across modules
- Flag any usage of APIs marked as deprecated in the codebase itself

### Config debt scan
- Compare `.env.example` (if present) against actual usage — are all vars still needed?
- Look for conflicting configs (e.g., tsconfig extending differently in subpackages)
- Check for hardcoded values that should be configurable

## PHASE 3 — QUANTIFY AND SCORE

For each finding, assign a severity and effort estimate:

### Severity levels

| Level | Criteria | Examples |
|---|---|---|
| **Critical** | Actively causing bugs, security risks, or blocking upgrades | Security-vulnerable dependency, dead code hiding a bug, broken test suite |
| **High** | Will cause significant pain if not addressed soon — compounds quickly | God class everyone's afraid to touch, major version dependency gap, zero test coverage on critical path |
| **Medium** | Genuine debt that slows development but isn't urgent | TODO markers older than 6 months, moderate duplication, missing tests for non-critical paths |
| **Low** | Cleanup work that improves quality but has low blast radius | Commented-out code, minor inconsistencies, unused config variables |

### Effort estimates

| Level | Meaning |
|---|---|
| **Trivial** | < 30 minutes — delete dead code, remove stale TODOs, drop unused deps |
| **Small** | 1-4 hours — extract duplicated logic, add missing tests for a module, update a dependency |
| **Medium** | 1-3 days — refactor a complex module, migrate a deprecated pattern across the codebase |
| **Large** | 1-2 weeks — rewrite a god class, major dependency upgrade with breaking changes |

## PHASE 4 — REPORT

Present findings in this exact structure:

```
# Technical Debt Audit Report

## Executive Summary
- **Project**: <name> (<language/framework>)
- **Files scanned**: <count>
- **Total findings**: <count>
- **Critical**: <count> | **High**: <count> | **Medium**: <count> | **Low**: <count>
- **Estimated total remediation effort**: <range>
- **Top 3 priorities**: <one-line each>

## Debt Heatmap

<Table showing files with the most findings, sorted by severity-weighted score>

| File | Critical | High | Medium | Low | Debt Score |
|------|----------|------|--------|-----|------------|
| ... | ... | ... | ... | ... | ... |

## Findings by Category

### 1. [Category Name] — [count] findings

#### [Severity] [Brief description]
- **File**: `path/to/file.ts:42`
- **What**: <specific description of the debt>
- **Why it matters**: <concrete consequence if not addressed>
- **Suggested fix**: <actionable remediation step>
- **Effort**: <Trivial|Small|Medium|Large>

(repeat for each finding)

## Remediation Plan

### Immediate (this sprint)
<Critical and high-severity items with trivial/small effort — highest ROI>

### Short-term (next 2-4 weeks)
<High-severity items with medium effort, critical items with large effort>

### Medium-term (next quarter)
<Medium-severity items, larger refactoring efforts>

### Backlog
<Low-severity items to tackle opportunistically>

## Metrics Summary

| Metric | Value |
|--------|-------|
| Marker density (TODOs per 1K lines) | ... |
| Dead code ratio (unused exports / total exports) | ... |
| Test coverage (files with tests / total source files) | ... |
| Dependency freshness (up-to-date / total deps) | ... |
| Average file size (lines) | ... |
| Largest file (lines) | ... |
| Files with >3 nesting levels | ... |
```

## Important behavioral notes

- **Be specific, not vague.** Every finding must reference exact files and line numbers. "There's some duplication" is worthless. "`src/handlers/user.ts:45-78` and `src/handlers/admin.ts:32-65` contain nearly identical validation logic" is actionable.

- **Don't flag what tooling handles.** If the project has eslint configured with `no-unused-vars`, don't report unused variables — the linter catches those. Focus on debt that falls through the cracks of existing tooling.

- **Calibrate to the project.** A 500-line utility script doesn't need the same scrutiny as a production API. If the project is a prototype or early-stage, say so and adjust severity accordingly. Don't recommend enterprise patterns for a weekend project.

- **Respect intentional tradeoffs.** Some "debt" is deliberate. If a comment says "// Intentionally using X because Y", don't flag it. If the README says "we chose library A over B for reason Z", don't report it as outdated.

- **The remediation plan is the most important part.** Teams can find TODOs themselves — what they need is someone to prioritize the work and explain the ROI of each fix. Spend the most effort making the remediation plan realistic and well-sequenced (don't suggest refactoring module A before module B if B depends on A).

- **Count things.** Actually count the lines, the files, the findings. The executive summary numbers must be accurate. If you say "42 findings" the report should contain exactly 42 findings.

- **Debt score formula.** For the heatmap, weight findings: Critical = 8, High = 4, Medium = 2, Low = 1. Sum per file. This gives a single sortable number.
