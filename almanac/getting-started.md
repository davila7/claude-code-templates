---
title: "Getting Started"
summary: "A routing page for the main codebase clusters: CLI, components, catalog, dashboard, analytics, validation, API, deployment, and release."
topics: [concepts, architecture, guides]
sources:
  - id: coverage-entry
    type: file
    path: almanac/coverage-map.md
  - id: root-readme
    type: file
    path: README.md
  - id: root-claude
    type: file
    path: CLAUDE.md
  - id: root-package
    type: file
    path: package.json
---

# Getting Started

This wiki is a map for working safely in `claude-code-templates`: a Node.js CLI for installing Claude Code components, an Astro dashboard for browsing them, catalog generation that connects source files to JSON artifacts, analytics tooling for local Claude sessions, validation for component security, and deployment guidance split between current Cloudflare runtime docs and older Vercel residue [@root-readme] [@root-claude] [@coverage-entry]. Start with the cluster that matches the work in front of you, then follow the next-read links below [@coverage-entry].

## CLI And Install Flow

Use the CLI pages when changing public flags, install behavior, or the Rust port. The root package exposes `claude-code-templates` and `cct` binaries through `cli-tool/bin/create-claude-config.js`, while the README shows user-facing `npx claude-code-templates@latest` installs for agents, commands, settings, hooks, MCPs, analytics, chats, health checks, and plugins [@root-package] [@root-readme].

Start with [Node CLI Dispatch Flow](architecture/cli/node-cli-dispatch-flow), then read [Component Install Flow](architecture/cli/component-install-flow) for direct component installs and [Rust CLI Native Core](architecture/cli/rust-cli-native-core) for the native/delegated split [@coverage-entry].

## Components

Use the component pages when adding or changing agents, commands, MCPs, settings, hooks, skills, loops, templates, or sandbox assets. `CLAUDE.md` says component changes must be reviewed with the component-reviewer agent, use kebab-case names, avoid hardcoded secrets and absolute paths, and regenerate the catalog afterward [@root-claude].

Start with [Component System](concepts/components/component-system), then use [Template vs Component Installation](concepts/components/template-vs-component-installation), [Component Quality Gates](concepts/components/component-quality-gates), and [Add or Change Component](guides/components/add-or-change-component) depending on whether you are reasoning about concepts, install behavior, or contributor workflow [@coverage-entry].

## Catalog And Dashboard

Use the catalog and dashboard pages when generated JSON, search, detail pages, or component browsing behavior changes. The root guidance says catalog updates run through `python scripts/generate_components_json.py`, and the current dashboard/API runtime is an Astro app deployed on Cloudflare Pages [@root-claude].

Start with [Catalog Generation Pipeline](architecture/catalog/catalog-generation-pipeline) to understand artifact production, then read [Component Catalog Schema](concepts/catalog/component-catalog-schema), [Astro Dashboard Data Loading](architecture/dashboard/astro-dashboard-data-loading), [Regenerate Catalog Safely](guides/catalog/regenerate-catalog-safely), and [Debug Missing Component Detail Page](guides/catalog/debug-missing-component-detail-page) for specific failures [@coverage-entry].

## Analytics

Use the analytics pages when changing local session dashboards, JSONL parsing, cache invalidation, state calculation, or WebSocket updates. The README exposes analytics as a CLI tool with `npx claude-code-templates@latest --analytics`, while the coverage map groups the backend pipeline, realtime stack, cache layers, JSONL data model, and test contracts as the dense analytics cluster [@root-readme] [@coverage-entry].

Start with [Analytics Dashboard Backend Pipeline](architecture/analytics/analytics-dashboard-backend-pipeline), then read [Claude JSONL Data Model](concepts/analytics/claude-jsonl-data-model), [Conversation State Model](concepts/analytics/conversation-state-model), [Analytics Cache Layers](concepts/analytics/analytics-cache-layers), [Realtime Update Stack](architecture/analytics/realtime-update-stack), and [Analytics Test Contracts](reference/analytics/analytics-test-contracts) [@coverage-entry].

## Validation And Security

Use the validation pages when changing component audit behavior, validator result shape, or security checks. `CLAUDE.md` requires component review for component changes and separately documents SkillSpector scanning for skills, while the coverage map places the five-tier validator system, error model, error codes, and security audit CLI in one validation cluster [@root-claude] [@coverage-entry].

Start with [Five-Tier Validation System](architecture/validation/five-tier-validation-system), then read [Validation Error Model](concepts/validation/validation-error-model), [Validation Error Codes](reference/validation/validation-error-codes), [Security Audit CLI Contract](reference/validation/security-audit-cli-contract), and [Add New Validator](guides/validation/add-new-validator) [@coverage-entry].

## API, Persistence, And Workers

Use the API and persistence pages when changing download tracking, command tracking, Discord interactions, release monitoring, collections, or worker schedules. Current root guidance says API routes live in `dashboard/src/pages/api/`, download tracking uses Supabase, release monitoring uses Neon, and Cloudflare Workers call dashboard API endpoints on schedules [@root-claude].

Start with [Critical API Surfaces](architecture/api/critical-api-surfaces), [Dual Persistence Model](concepts/persistence/dual-persistence-model), [Collections System](architecture/dashboard/collections-system), and [Worker Scheduling and Reporting](architecture/workers/worker-scheduling-and-reporting) [@coverage-entry].

## Deployment And Release

Use the deployment and release pages when publishing npm packages, running release tests, or touching production runtime configuration. `CLAUDE.md` says dashboard production is Cloudflare Pages with Worker support, while the coverage map calls out deployment drift as something future agents must resolve before trusting stale Vercel-oriented files [@root-claude] [@coverage-entry].

Start with [Cloudflare Dashboard Runtime](architecture/deployment/cloudflare-dashboard-runtime), then read [Deploy Drift Gotchas](reference/deployment/deploy-drift-gotchas), [Run API and CLI Tests](guides/release/run-api-and-cli-tests), and [Publish NPM Package](guides/release/publish-npm-package) [@coverage-entry].
