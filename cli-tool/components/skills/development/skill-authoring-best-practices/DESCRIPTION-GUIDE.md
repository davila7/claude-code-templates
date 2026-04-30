# Description Guide

The description field is the **only** thing the skill loader reads when deciding which skill to surface. Everything else — the body, the reference files, the scripts — is invisible until invocation. So the description has one job: help the agent discriminate this skill from every other installed skill.

## The discrimination test

Read your description out loud. Could it equally describe a different skill in the catalog? If yes, it fails the discrimination test.

> "Helps with code review."
>
> Could be: code-review-excellence, code-simplifier, ts-code-review, react-code-review, security-audit. Useless.

> "Run a TypeScript-aware code review focused on type safety, narrowing, and unsafe `as` assertions. Use when reviewing a TypeScript PR or when the user mentions type assertions, `as`, generics, or unsoundness."
>
> Only matches one skill in the catalog. Useful.

## Format

```
[Capability sentence]. Use when [specific triggers, keywords, file types, contexts].
```

**Constraints:**

- Max 1024 characters
- Third person, active voice ("Extract...", not "I extract..." or "This skill extracts...")
- First sentence: a capability the agent can recognise
- Second sentence: triggers the user is likely to say literally

**Triggers should be:**

- **Verbatim phrases** users say ("debug this", "diagnose the bug", "something is broken")
- **File types** that signal context (`.pdf`, `.xlsx`, `package.json`)
- **Domain keywords** (`SHAP values`, `survival analysis`, `hreflang`)
- **Tool/library names** (`Husky`, `lint-staged`, `Playwright`)

## Ten before/after rewrites

### 1. Empty / placeholder

❌ `description: |`
✅ `description: Build Garry's Mod Lua addons with proper hooks, networking, and entity registration. Use when creating Garry's Mod content, .lua files, or when the user mentions GMod, Lua hooks, or addon scaffolding.`

### 2. Single sentence, no triggers

❌ `Helps with PDFs.`
✅ `Extract text and tables from PDF files, fill forms, merge documents, run OCR. Use when working with .pdf files or when the user mentions PDFs, forms, document extraction, or scanned documents.`

### 3. First-person voice

❌ `I help you write better React components.`
✅ `Generate accessible, performant React components with proper hooks, memoization, and TypeScript typing. Use when scaffolding React components, refactoring class components, or when the user mentions hooks, memoization, or React best practices.`

### 4. Wishy-washy capability

❌ `A skill for code quality.`
✅ `Apply Lighthouse-style web best practices: HTTPS, CSP headers, valid HTML, deprecated API removal, memory leak fixes. Use when the user asks for "best practices", "security audit", "modernize code", or "check for vulnerabilities".`

### 5. No discrimination from sibling skills

❌ `React performance optimization.`
✅ `React performance optimization focused on render profiling, memoization decisions, and bundle splitting. Use when the user reports slow renders, profile output from React DevTools, or asks about useMemo/useCallback/React.memo trade-offs.`

### 6. Implementation-detail leak

❌ `A pdfkit wrapper.`
✅ `Generate styled PDF reports with tables, charts, and page numbering. Use when generating PDF output from data, building invoices/reports, or when the user provides .csv/.json and asks for a PDF.`

### 7. Time-sensitive

❌ `Latest React 19 features as of October 2024.`
✅ `Apply current React server component patterns including async components, server actions, and use() hook. Use when the user mentions RSC, server actions, or "use client" / "use server" boundaries.`

### 8. Vague trigger list

❌ `Use when working with data.`
✅ `Use when the user mentions pandas DataFrames, .csv/.parquet files, time-series resampling, or pandas merge/join operations.`

### 9. Too long, no signal density

❌ A 900-character paragraph rambling about possibilities.
✅ Tight: capability + 5–10 specific triggers. Aim for 150–400 characters.

### 10. Missing the "Use when" phrase

❌ `Generate test cases for Python functions using pytest fixtures.`
✅ `Generate test cases for Python functions using pytest fixtures. Use when the user has a Python function and asks for tests, mentions pytest/fixtures, or wants test scaffolding for an existing module.`

## Trigger inventory worksheet

Before writing the description, list these for your skill:

| Category | Examples for this skill |
|---|---|
| Verbatim phrases | "review my PR", "check security", "audit this" |
| File types | `.tsx`, `tsconfig.json`, `Dockerfile` |
| Domain keywords | "memoization", "hreflang", "OAuth flow" |
| Tools/libraries | "Playwright", "Vitest", "Tailwind v4" |
| User intents | "I want to...", "How do I...", "Help me..." |

Pick the 4–6 strongest signals. Drop the rest.

## When to use `disable-model-invocation: true`

Add this to the frontmatter when the skill is **only** meant to be triggered explicitly via slash command, never by the loader's pattern matching. Useful for one-shot prompts the user invokes deliberately (e.g. `/zoom-out`, `/grill-me`).

```yaml
---
name: zoom-out
description: ...
disable-model-invocation: true
---
```

## Final check

Before committing the description, ask:

1. Does the first sentence describe a **capability**, not a vague theme?
2. Does the second sentence start with `Use when` and list **specific triggers**?
3. Could a different skill in the catalog match this description equally well? If yes, sharpen.
4. Is it under 1024 characters?
5. Did you remove all time-sensitive phrases ("currently", "as of", "latest")?
