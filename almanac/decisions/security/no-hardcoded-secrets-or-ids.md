---
title: "No Hardcoded Secrets or IDs"
summary: "Secrets and infrastructure identifiers must live in environment variables or Cloudflare secrets, with the public opt-in CLI Sentry DSN as the documented exception."
topics: [decisions, security]
sources:
  - id: repo-security-guidance
    type: file
    path: CLAUDE.md
  - id: security-policy
    type: file
    path: SECURITY.md
  - id: cli-error-reporting
    type: file
    path: cli-tool/src/error-reporting.js
---

# No Hardcoded Secrets or IDs

The repository decision is that API keys, tokens, passwords, project IDs, org IDs, database URLs, Discord IDs, Supabase URLs, Cloudflare identifiers, and similar infrastructure values must not be committed to code; they belong in `.env` files or Cloudflare secrets [@repo-security-guidance]. The one documented exception is the CLI Sentry DSN, which is treated as public send-only configuration, can be overridden with `CCT_SENTRY_DSN`, and only sends reports when the end user explicitly opts in with `CCT_ERROR_REPORTING=true` [@repo-security-guidance] [@cli-error-reporting].

## Status

Accepted. This rule is part of the repository's security guidance, component quality expectations, and deployment practice [@repo-security-guidance]. It also matches the public security policy's contributor guidance to validate inputs, choose secure defaults, and use security-focused review [@security-policy].

## Context

The repo publishes installable Claude Code components and runs dashboard/API surfaces on Cloudflare Pages and Workers [@repo-security-guidance]. A committed secret or infrastructure identifier can therefore leak into generated files, docs, deployment scripts, or user-facing components instead of staying inside an operator-controlled environment [@repo-security-guidance].

The Cloudflare runtime split reinforces the boundary. `PUBLIC_*` values are build-time variables, while Clerk secrets, GitHub client secrets, Supabase service credentials, Neon database URLs, Discord tokens, and webhook URLs are Cloudflare secrets [@repo-security-guidance].

## Decision

Contributors must route sensitive values through environment variables, `.env`, or Cloudflare secret storage instead of literals in code [@repo-security-guidance]. Scripts that need API keys should read from `process.env` or `os.environ`, load `.env` when appropriate, add placeholders to `.env.example`, and keep `.env` ignored by git [@repo-security-guidance].

The CLI Sentry DSN is allowed because the repository documents it as public, send-only configuration for the `aitmpl-cli` Sentry project [@repo-security-guidance]. The implementation still gates reporting behind `CCT_ERROR_REPORTING=true`, honors `CCT_NO_TRACKING`, `CCT_NO_ANALYTICS`, and `CI`, and avoids throwing if reporting fails [@cli-error-reporting].

## Consequences

This decision applies when changing [Download Tracking Privacy](../../concepts/components/download-tracking-privacy), [Component Quality Gates](../../concepts/components/component-quality-gates), and [Neon Instagres Plan Boundaries](neon-instagres-plan-boundaries). New partner IDs, referral IDs, account IDs, database URLs, webhook URLs, or service tokens need an explicit environment-variable or secret-storage plan before they are added to code [@repo-security-guidance].

If a secret is committed, the repository guidance treats it as compromised: revoke it immediately, generate a replacement, update `.env`, and assume git history cannot make the old value safe again [@repo-security-guidance].
