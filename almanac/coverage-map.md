---
title: Coverage Map
summary: Frozen page inventory for this first wiki build.
topics: [build, wiki, reference]
sources: []
---

# Coverage Map

## Page Inventory

### Root

- path: `almanac/getting-started.md`
  - slug: `getting-started`
  - purpose: Routes future contributors through the finished wiki by work area: CLI, components, catalog, dashboard, analytics, validation, API, deployment, and release.
  - planned links: `concepts/components/component-system`, `architecture/cli/node-cli-dispatch-flow`, `architecture/catalog/catalog-generation-pipeline`, `architecture/dashboard/astro-dashboard-data-loading`, `guides/components/add-or-change-component`, `reference/cli/public-cli-options`
  - key evidence files: `README.md`, `CLAUDE.md`, `package.json`

### concepts/components

- path: `almanac/concepts/components/component-system.md`
  - slug: `concepts/components/component-system`
  - purpose: Defines the repository's component ecosystem: agents, commands, MCPs, settings, hooks, skills, loops, templates, and sandbox assets.
  - planned links: `concepts/components/template-vs-component-installation`, `concepts/components/component-quality-gates`, `architecture/cli/component-install-flow`, `reference/components/component-inventory`
  - key evidence files: `README.md`, `CLAUDE.md`, `cli-tool/components/`, `cli-tool/src/index.js`

- path: `almanac/concepts/components/template-vs-component-installation.md`
  - slug: `concepts/components/template-vs-component-installation`
  - purpose: Explains the difference between project setup templates and direct component installation.
  - planned links: `concepts/components/component-system`, `architecture/cli/node-cli-dispatch-flow`, `architecture/cli/component-install-flow`, `reference/components/component-schema-reference`
  - key evidence files: `cli-tool/src/templates.js`, `cli-tool/src/file-operations.js`, `cli-tool/src/index.js`

- path: `almanac/concepts/components/component-quality-gates.md`
  - slug: `concepts/components/component-quality-gates`
  - purpose: Records the required review, naming, security, and SkillSpector checks for component changes.
  - planned links: `concepts/components/component-system`, `guides/components/add-or-change-component`, `architecture/validation/five-tier-validation-system`, `decisions/security/no-hardcoded-secrets-or-ids`
  - key evidence files: `CLAUDE.md`, `.claude/agents/component-reviewer.md`, `scripts/skillspector_scan.py`, `.claude-plugin/skills/owasp-security/SKILL.md`

- path: `almanac/concepts/components/download-tracking-privacy.md`
  - slug: `concepts/components/download-tracking-privacy`
  - purpose: Describes the fire-and-forget, opt-out telemetry contract for component installs and CLI command tracking.
  - planned links: `architecture/api/critical-api-surfaces`, `concepts/persistence/dual-persistence-model`, `decisions/security/no-hardcoded-secrets-or-ids`, `reference/api/environment-variables`
  - key evidence files: `cli-tool/docs_to_claude/DOWNLOAD_TRACKING.md`, `cli-tool/src/tracking-service.js`, `api/track-download-supabase.js`, `api/track-command-usage.js`, `CLAUDE.md`

### concepts/catalog

- path: `almanac/concepts/catalog/component-catalog-schema.md`
  - slug: `concepts/catalog/component-catalog-schema`
  - purpose: Defines the catalog records and the singular/plural component type rules used by CLI, docs, and dashboard surfaces.
  - planned links: `architecture/catalog/catalog-generation-pipeline`, `reference/catalog/generated-artifact-inventory`, `reference/components/component-schema-reference`, `guides/catalog/debug-missing-component-detail-page`
  - key evidence files: `scripts/generate_components_json.py`, `dashboard/src/lib/types.ts`, `dashboard/src/lib/data.ts`, `docs/components.json`

### concepts/analytics

- path: `almanac/concepts/analytics/conversation-state-model.md`
  - slug: `concepts/analytics/conversation-state-model`
  - purpose: Explains how Claude conversation state strings are derived from message timing, file activity, process state, and tool activity.
  - planned links: `architecture/analytics/analytics-dashboard-backend-pipeline`, `architecture/analytics/realtime-update-stack`, `concepts/analytics/claude-jsonl-data-model`, `guides/analytics/debug-analytics-cache-and-refresh`
  - key evidence files: `cli-tool/src/analytics/core/StateCalculator.js`, `cli-tool/docs_to_claude/ANALYTICS_STATE_DETECTION.md`, `cli-tool/docs_to_claude/DEBUG_TYPING_DETECTION.md`, `cli-tool/tests/unit/StateCalculator.test.js`

- path: `almanac/concepts/analytics/claude-jsonl-data-model.md`
  - slug: `concepts/analytics/claude-jsonl-data-model`
  - purpose: Documents the JSONL event model the analytics parser reads from Claude project conversations.
  - planned links: `concepts/analytics/conversation-state-model`, `concepts/analytics/analytics-cache-layers`, `architecture/analytics/analytics-dashboard-backend-pipeline`, `reference/analytics/analytics-test-contracts`
  - key evidence files: `cli-tool/docs_to_claude/CLAUDE_DATA_STRUCTURE.md`, `cli-tool/src/analytics/core/ConversationAnalyzer.js`, `cli-tool/src/analytics/data/DataCache.js`

- path: `almanac/concepts/analytics/analytics-cache-layers.md`
  - slug: `concepts/analytics/analytics-cache-layers`
  - purpose: Explains the analytics cache layers for file contents, parsed conversations, computed fields, summaries, and sessions.
  - planned links: `architecture/analytics/analytics-dashboard-backend-pipeline`, `guides/analytics/debug-analytics-cache-and-refresh`, `reference/analytics/analytics-test-contracts`
  - key evidence files: `cli-tool/src/analytics/data/DataCache.js`, `cli-tool/tests/unit/DataCache.test.js`, `cli-tool/src/analytics.js`

### concepts/validation

- path: `almanac/concepts/validation/validation-error-model.md`
  - slug: `concepts/validation/validation-error-model`
  - purpose: Defines validation errors, warnings, info entries, score penalties, timestamps, and location metadata.
  - planned links: `architecture/validation/five-tier-validation-system`, `reference/validation/validation-error-codes`, `decisions/validation/validation-scoring-code-vs-docs`
  - key evidence files: `cli-tool/src/validation/BaseValidator.js`, `cli-tool/src/validation/ValidationOrchestrator.js`, `cli-tool/src/validation/README.md`

### concepts/persistence

- path: `almanac/concepts/persistence/dual-persistence-model.md`
  - slug: `concepts/persistence/dual-persistence-model`
  - purpose: Explains why the repo uses Supabase for some analytics and Neon for release monitoring, command stats, collections, and dashboard APIs.
  - planned links: `architecture/api/critical-api-surfaces`, `architecture/dashboard/collections-system`, `reference/api/database-tables-and-migration-gaps`, `reference/api/environment-variables`
  - key evidence files: `api/track-download-supabase.js`, `api/track-command-usage.js`, `api/_lib/neon.js`, `dashboard/src/lib/api/neon.ts`, `database/migrations/`

### architecture/cli

- path: `almanac/architecture/cli/node-cli-dispatch-flow.md`
  - slug: `architecture/cli/node-cli-dispatch-flow`
  - purpose: Maps the Node CLI wrapper, Commander options, `createClaudeConfig()` dispatch order, and early-return handlers.
  - planned links: `reference/cli/public-cli-options`, `architecture/cli/component-install-flow`, `concepts/components/template-vs-component-installation`, `guides/release/run-api-and-cli-tests`
  - key evidence files: `cli-tool/bin/create-claude-config.js`, `cli-tool/src/index.js`, `cli-tool/package.json`, `package.json`

- path: `almanac/architecture/cli/component-install-flow.md`
  - slug: `architecture/cli/component-install-flow`
  - purpose: Explains how direct installs fetch components, flatten category names, merge settings/MCPs/hooks, track outcomes, and optionally run prompts.
  - planned links: `concepts/components/component-system`, `decisions/cli/github-as-runtime-source`, `architecture/cli/rust-cli-native-core`, `reference/components/component-schema-reference`
  - key evidence files: `cli-tool/src/index.js`, `cli-tool/src/file-operations.js`, `cli-tool/src/hook-scanner.js`, `cli-tool/src/tracking-service.js`

- path: `almanac/architecture/cli/rust-cli-native-core.md`
  - slug: `architecture/cli/rust-cli-native-core`
  - purpose: Describes the Rust `cct` port, its native install boundary, Node delegation path, and packaging shape.
  - planned links: `decisions/cli/rust-port-delegation-boundary`, `architecture/cli/component-install-flow`, `reference/cli/public-cli-options`, `reference/components/component-schema-reference`
  - key evidence files: `cli-rust/src/main.rs`, `cli-rust/src/cli.rs`, `cli-rust/src/commands/install.rs`, `cli-rust/src/commands/delegate.rs`, `cli-rust/Cargo.toml`, `cli-rust/npm/`

### architecture/catalog

- path: `almanac/architecture/catalog/catalog-generation-pipeline.md`
  - slug: `architecture/catalog/catalog-generation-pipeline`
  - purpose: Explains how local component and template sources become docs and dashboard catalog artifacts.
  - planned links: `concepts/catalog/component-catalog-schema`, `decisions/catalog/split-heavy-content-from-index`, `guides/catalog/regenerate-catalog-safely`, `reference/catalog/generated-artifact-inventory`
  - key evidence files: `scripts/generate_components_json.py`, `scripts/generate_trending_data.py`, `scripts/generate_agents_api.py`, `.claude/agents/catalog-generator.md`

### architecture/dashboard

- path: `almanac/architecture/dashboard/astro-dashboard-data-loading.md`
  - slug: `architecture/dashboard/astro-dashboard-data-loading`
  - purpose: Describes Astro dashboard data loading, split component slices, search index, component-content fetches, and caching.
  - planned links: `architecture/catalog/catalog-generation-pipeline`, `concepts/catalog/component-catalog-schema`, `guides/catalog/debug-missing-component-detail-page`, `reference/catalog/generated-artifact-inventory`
  - key evidence files: `dashboard/src/lib/data.ts`, `dashboard/src/lib/constants.ts`, `dashboard/src/pages/component/[type]/[...slug].astro`, `dashboard/src/pages/[...type].astro`

- path: `almanac/architecture/dashboard/collections-system.md`
  - slug: `architecture/dashboard/collections-system`
  - purpose: Explains authenticated component collections, Clerk auth, Neon ownership checks, item operations, and public sharing.
  - planned links: `concepts/persistence/dual-persistence-model`, `architecture/api/critical-api-surfaces`, `reference/api/database-tables-and-migration-gaps`, `reference/api/environment-variables`
  - key evidence files: `dashboard/src/pages/api/collections/index.ts`, `dashboard/src/pages/api/collections/[id].ts`, `dashboard/src/pages/api/collections/items.ts`, `dashboard/src/pages/api/collections/share.ts`, `dashboard/src/lib/api/auth.ts`

### architecture/analytics

- path: `almanac/architecture/analytics/analytics-dashboard-backend-pipeline.md`
  - slug: `architecture/analytics/analytics-dashboard-backend-pipeline`
  - purpose: Explains the local analytics server pipeline from Claude directories through analyzers, process detection, session analysis, and Express APIs.
  - planned links: `concepts/analytics/conversation-state-model`, `concepts/analytics/claude-jsonl-data-model`, `concepts/analytics/analytics-cache-layers`, `architecture/analytics/realtime-update-stack`
  - key evidence files: `cli-tool/src/analytics.js`, `cli-tool/src/analytics/core/ConversationAnalyzer.js`, `cli-tool/src/analytics/core/ProcessDetector.js`, `cli-tool/src/analytics/core/SessionAnalyzer.js`

- path: `almanac/architecture/analytics/realtime-update-stack.md`
  - slug: `architecture/analytics/realtime-update-stack`
  - purpose: Describes file watcher invalidation, notification throttling, WebSocket channels, message queues, and polling fallbacks.
  - planned links: `architecture/analytics/analytics-dashboard-backend-pipeline`, `concepts/analytics/conversation-state-model`, `guides/analytics/debug-analytics-cache-and-refresh`, `reference/analytics/analytics-test-contracts`
  - key evidence files: `cli-tool/src/analytics/core/FileWatcher.js`, `cli-tool/src/analytics/notifications/WebSocketServer.js`, `cli-tool/src/analytics/notifications/NotificationManager.js`, `cli-tool/docs_to_claude/ANALYTICS_STATE_DETECTION.md`

### architecture/validation

- path: `almanac/architecture/validation/five-tier-validation-system.md`
  - slug: `architecture/validation/five-tier-validation-system`
  - purpose: Describes the validator orchestration for structural, integrity, semantic, reference, and provenance checks.
  - planned links: `concepts/validation/validation-error-model`, `guides/validation/add-new-validator`, `reference/validation/validation-error-codes`, `reference/validation/security-audit-cli-contract`
  - key evidence files: `cli-tool/src/validation/ARCHITECTURE.md`, `cli-tool/src/validation/ValidationOrchestrator.js`, `cli-tool/src/validation/validators/`, `cli-tool/tests/validation/`

### architecture/api

- path: `almanac/architecture/api/critical-api-surfaces.md`
  - slug: `architecture/api/critical-api-surfaces`
  - purpose: Maps the production API endpoints for download tracking, command usage, Discord interactions, release checks, health checks, and dashboard events.
  - planned links: `concepts/persistence/dual-persistence-model`, `concepts/components/download-tracking-privacy`, `architecture/workers/worker-scheduling-and-reporting`, `reference/api/environment-variables`
  - key evidence files: `api/README.md`, `api/track-download-supabase.js`, `api/track-command-usage.js`, `api/discord/interactions.js`, `api/claude-code-check.js`, `dashboard/src/pages/api/`

### architecture/workers

- path: `almanac/architecture/workers/worker-scheduling-and-reporting.md`
  - slug: `architecture/workers/worker-scheduling-and-reporting`
  - purpose: Explains Cloudflare Worker cron scheduling, docs monitoring, pulse reporting, Sentry check-ins, and Telegram reports.
  - planned links: `architecture/api/critical-api-surfaces`, `architecture/deployment/cloudflare-dashboard-runtime`, `guides/deployment/deploy-dashboard-and-workers`, `reference/api/environment-variables`
  - key evidence files: `cloudflare-workers/README.md`, `cloudflare-workers/crons/index.js`, `cloudflare-workers/crons/wrangler.toml`, `cloudflare-workers/pulse/index.js`, `cloudflare-workers/daily-health-report/index.js`, `cloudflare-workers/docs-monitor/index.js`

### architecture/deployment

- path: `almanac/architecture/deployment/cloudflare-dashboard-runtime.md`
  - slug: `architecture/deployment/cloudflare-dashboard-runtime`
  - purpose: Explains the current dashboard/API runtime on Cloudflare Pages and the stale Vercel-oriented artifacts contributors must not blindly follow.
  - planned links: `decisions/deployment/cloudflare-over-vercel-runtime`, `guides/deployment/deploy-dashboard-and-workers`, `reference/deployment/deploy-drift-gotchas`, `architecture/dashboard/astro-dashboard-data-loading`
  - key evidence files: `CLAUDE.md`, `.claude/rules/dashboard.md`, `dashboard/astro.config.mjs`, `dashboard/package.json`, `scripts/deploy.sh`, `vercel.json`, `docs/guides/deployment.md`

### guides/components

- path: `almanac/guides/components/add-or-change-component.md`
  - slug: `guides/components/add-or-change-component`
  - purpose: Gives the safe contributor workflow for adding or modifying agents, commands, MCPs, settings, hooks, skills, loops, and templates.
  - planned links: `concepts/components/component-system`, `concepts/components/component-quality-gates`, `guides/catalog/regenerate-catalog-safely`, `reference/components/component-schema-reference`
  - key evidence files: `CONTRIBUTING.md`, `CLAUDE.md`, `.claude/agents/component-reviewer.md`, `cli-tool/components/`, `scripts/generate_components_json.py`

### guides/catalog

- path: `almanac/guides/catalog/regenerate-catalog-safely.md`
  - slug: `guides/catalog/regenerate-catalog-safely`
  - purpose: Gives the safe workflow for regenerating the component catalog and checking the docs/dashboard artifact split.
  - planned links: `architecture/catalog/catalog-generation-pipeline`, `concepts/catalog/component-catalog-schema`, `reference/catalog/generated-artifact-inventory`, `guides/release/run-api-and-cli-tests`
  - key evidence files: `scripts/generate_components_json.py`, `CLAUDE.md`, `.claude/agents/catalog-generator.md`, `docs/components.json`, `dashboard/public/`

- path: `almanac/guides/catalog/debug-missing-component-detail-page.md`
  - slug: `guides/catalog/debug-missing-component-detail-page`
  - purpose: Shows how to debug missing or broken component detail pages across path cleanup, slug generation, plural routes, and content artifacts.
  - planned links: `architecture/dashboard/astro-dashboard-data-loading`, `concepts/catalog/component-catalog-schema`, `reference/catalog/generated-artifact-inventory`
  - key evidence files: `dashboard/src/lib/data.ts`, `dashboard/src/pages/component/[type]/[...slug].astro`, `scripts/generate_components_json.py`, `dashboard/src/lib/icons.ts`

### guides/analytics

- path: `almanac/guides/analytics/debug-analytics-cache-and-refresh.md`
  - slug: `guides/analytics/debug-analytics-cache-and-refresh`
  - purpose: Gives the debugging path for stale analytics data, cache invalidation, state refresh, WebSocket updates, and `/api/clear-cache`.
  - planned links: `concepts/analytics/analytics-cache-layers`, `architecture/analytics/analytics-dashboard-backend-pipeline`, `architecture/analytics/realtime-update-stack`, `reference/analytics/analytics-test-contracts`
  - key evidence files: `cli-tool/src/analytics.js`, `cli-tool/src/analytics/data/DataCache.js`, `cli-tool/tests/unit/DataCache.test.js`, `cli-tool/docs_to_claude/ANALYTICS_STATE_DETECTION.md`

### guides/validation

- path: `almanac/guides/validation/add-new-validator.md`
  - slug: `guides/validation/add-new-validator`
  - purpose: Gives the steps to add a validator to the five-tier validation system and its tests.
  - planned links: `architecture/validation/five-tier-validation-system`, `concepts/validation/validation-error-model`, `reference/validation/validation-error-codes`, `reference/validation/security-audit-cli-contract`
  - key evidence files: `cli-tool/src/validation/README.md`, `cli-tool/src/validation/BaseValidator.js`, `cli-tool/src/validation/ValidationOrchestrator.js`, `cli-tool/tests/validation/`

### guides/release

- path: `almanac/guides/release/publish-npm-package.md`
  - slug: `guides/release/publish-npm-package`
  - purpose: Gives the release checklist for package version alignment, npm granular tokens, publishing, token cleanup, tagging, and deployment follow-up.
  - planned links: `guides/release/run-api-and-cli-tests`, `architecture/cli/node-cli-dispatch-flow`, `reference/cli/public-cli-options`, `reference/deployment/deploy-drift-gotchas`
  - key evidence files: `CLAUDE.md`, `cli-tool/TESTING.md`, `package.json`, `cli-tool/package.json`

- path: `almanac/guides/release/run-api-and-cli-tests.md`
  - slug: `guides/release/run-api-and-cli-tests`
  - purpose: Describes which API, CLI, validation, and predeploy test commands matter before release or deployment.
  - planned links: `architecture/api/critical-api-surfaces`, `architecture/validation/five-tier-validation-system`, `reference/analytics/analytics-test-contracts`, `reference/validation/security-audit-cli-contract`
  - key evidence files: `api/package.json`, `api/__tests__/endpoints.test.js`, `cli-tool/package.json`, `cli-tool/TESTING.md`, `scripts/predeploy-check.sh`

### guides/content

- path: `almanac/guides/content/publish-blog-article.md`
  - slug: `guides/content/publish-blog-article`
  - purpose: Gives the durable steps and constraints for producing blog articles, cover images, HTML output, and blog index updates.
  - planned links: `architecture/catalog/catalog-generation-pipeline`, `reference/catalog/generated-artifact-inventory`, `guides/catalog/regenerate-catalog-safely`
  - key evidence files: `.claude/commands/create-blog-article.md`, `cli-tool/docs_to_claude/BLOG_WRITING_GUIDE.md`, `docs/blog/README.md`, `scripts/generate_blog_images.py`, `scripts/generate_blog_images_v2.py`

### guides/deployment

- path: `almanac/guides/deployment/deploy-dashboard-and-workers.md`
  - slug: `guides/deployment/deploy-dashboard-and-workers`
  - purpose: Gives the current deployment and verification path for the Cloudflare Pages dashboard/API runtime and Cloudflare Workers, while warning about stale Vercel artifacts.
  - planned links: `architecture/deployment/cloudflare-dashboard-runtime`, `architecture/workers/worker-scheduling-and-reporting`, `reference/deployment/deploy-drift-gotchas`, `reference/api/environment-variables`
  - key evidence files: `CLAUDE.md`, `.claude/rules/dashboard.md`, `.claude/rules/cloudflare.md`, `dashboard/package.json`, `cloudflare-workers/README.md`, `scripts/deploy.sh`, `docs/guides/deployment.md`

### decisions/cli

- path: `almanac/decisions/cli/rust-port-delegation-boundary.md`
  - slug: `decisions/cli/rust-port-delegation-boundary`
  - purpose: Records the choice that Rust handles component installs natively and delegates dashboards, sandbox, global agents, stats, health, and setup to Node.
  - planned links: `architecture/cli/rust-cli-native-core`, `architecture/cli/component-install-flow`, `reference/cli/public-cli-options`
  - key evidence files: `cli-rust/src/main.rs`, `cli-rust/src/cli.rs`, `cli-rust/src/commands/delegate.rs`, `cli-rust/README.md`

- path: `almanac/decisions/cli/github-as-runtime-source.md`
  - slug: `decisions/cli/github-as-runtime-source`
  - purpose: Records that component and template installs fetch from GitHub raw paths at runtime instead of relying only on packaged npm files.
  - planned links: `architecture/cli/component-install-flow`, `architecture/catalog/catalog-generation-pipeline`, `reference/components/component-schema-reference`
  - key evidence files: `cli-tool/src/file-operations.js`, `cli-tool/src/index.js`, `cli-rust/src/constants.rs`, `package.json`, `cli-tool/package.json`

### decisions/catalog

- path: `almanac/decisions/catalog/split-heavy-content-from-index.md`
  - slug: `decisions/catalog/split-heavy-content-from-index`
  - purpose: Records the decision to keep full content and security data in docs artifacts while splitting lighter dashboard indexes and per-component content files.
  - planned links: `architecture/catalog/catalog-generation-pipeline`, `architecture/dashboard/astro-dashboard-data-loading`, `reference/catalog/generated-artifact-inventory`
  - key evidence files: `scripts/generate_components_json.py`, `dashboard/src/lib/data.ts`

### decisions/deployment

- path: `almanac/decisions/deployment/cloudflare-over-vercel-runtime.md`
  - slug: `decisions/deployment/cloudflare-over-vercel-runtime`
  - purpose: Records the current Cloudflare Pages/Workers runtime as authoritative over stale Vercel and GitHub Pages documentation.
  - planned links: `architecture/deployment/cloudflare-dashboard-runtime`, `guides/deployment/deploy-dashboard-and-workers`, `reference/deployment/deploy-drift-gotchas`
  - key evidence files: `CLAUDE.md`, `.claude/rules/dashboard.md`, `.claude/rules/cloudflare.md`, `dashboard/astro.config.mjs`, `scripts/deploy.sh`, `vercel.json`, `docs/guides/deployment.md`

### decisions/security

- path: `almanac/decisions/security/no-hardcoded-secrets-or-ids.md`
  - slug: `decisions/security/no-hardcoded-secrets-or-ids`
  - purpose: Records the broad invariant that secrets and infrastructure identifiers must come from environment variables or Cloudflare secrets, with the documented Sentry DSN exception.
  - planned links: `concepts/components/download-tracking-privacy`, `concepts/components/component-quality-gates`, `reference/api/environment-variables`, `decisions/security/neon-instagres-plan-boundaries`
  - key evidence files: `CLAUDE.md`, `SECURITY.md`, `cli-tool/src/error-reporting.js`

- path: `almanac/decisions/security/neon-instagres-plan-boundaries.md`
  - slug: `decisions/security/neon-instagres-plan-boundaries`
  - purpose: Records the Neon Instagres plan, its existing component ecosystem, and the unresolved conflicts around hardcoded referral IDs and stale Vercel deployment language.
  - planned links: `concepts/persistence/dual-persistence-model`, `decisions/security/no-hardcoded-secrets-or-ids`, `architecture/catalog/catalog-generation-pipeline`
  - key evidence files: `NEON_INTEGRATION_PLAN.md`, `CLAUDE.md`, `docs/featured/neon-instagres/index.html`

### decisions/analytics

- path: `almanac/decisions/analytics/analytics-memory-protection.md`
  - slug: `decisions/analytics/analytics-memory-protection`
  - purpose: Records why conversation objects avoid storing parsed messages and use cache-backed parsed data to reduce memory pressure.
  - planned links: `concepts/analytics/analytics-cache-layers`, `architecture/analytics/analytics-dashboard-backend-pipeline`, `guides/analytics/debug-analytics-cache-and-refresh`
  - key evidence files: `cli-tool/src/analytics/core/ConversationAnalyzer.js`, `cli-tool/src/analytics/data/DataCache.js`, `cli-tool/src/analytics/utils/PerformanceMonitor.js`

### decisions/validation

- path: `almanac/decisions/validation/validation-scoring-code-vs-docs.md`
  - slug: `decisions/validation/validation-scoring-code-vs-docs`
  - purpose: Records the drift between docs describing weighted validation scoring and code averaging validator scores.
  - planned links: `architecture/validation/five-tier-validation-system`, `concepts/validation/validation-error-model`, `reference/validation/validation-error-codes`
  - key evidence files: `cli-tool/src/validation/ValidationOrchestrator.js`, `cli-tool/src/validation/README.md`, `cli-tool/src/validation/ARCHITECTURE.md`

### reference/cli

- path: `almanac/reference/cli/public-cli-options.md`
  - slug: `reference/cli/public-cli-options`
  - purpose: Provides a lookup table for the public CLI names, aliases, flags, and delegated/native handling.
  - planned links: `architecture/cli/node-cli-dispatch-flow`, `architecture/cli/rust-cli-native-core`, `guides/release/publish-npm-package`
  - key evidence files: `package.json`, `cli-tool/package.json`, `cli-tool/bin/create-claude-config.js`, `cli-rust/src/cli.rs`

### reference/components

- path: `almanac/reference/components/component-schema-reference.md`
  - slug: `reference/components/component-schema-reference`
  - purpose: Provides exact lookup material for command, agent, hook, statusline, MCP, setting, skill, and loop schemas and placement rules.
  - planned links: `concepts/components/component-system`, `guides/components/add-or-change-component`, `architecture/cli/component-install-flow`, `reference/components/component-inventory`
  - key evidence files: `cli-tool/docs_to_claude/COMMANDS_GUIDE.md`, `cli-tool/docs_to_claude/SUBAGENTS_GUIDE.md`, `cli-tool/docs_to_claude/HOOKS_GUIDE.md`, `cli-tool/docs_to_claude/STATUSLINE_GUIDE.md`, `cli-tool/components/`

- path: `almanac/reference/components/component-inventory.md`
  - slug: `reference/components/component-inventory`
  - purpose: Provides a concise inventory of component neighborhoods, counts, known duplicate paths, and generated catalog exposure.
  - planned links: `concepts/components/component-system`, `architecture/catalog/catalog-generation-pipeline`, `reference/catalog/generated-artifact-inventory`
  - key evidence files: `cli-tool/components/`, `scripts/generate_components_json.py`, `docs/components.json`

### reference/catalog

- path: `almanac/reference/catalog/generated-artifact-inventory.md`
  - slug: `reference/catalog/generated-artifact-inventory`
  - purpose: Lists generated catalog, search, API, component-content, trending, jobs, and plugin artifacts by source and consumer.
  - planned links: `architecture/catalog/catalog-generation-pipeline`, `architecture/dashboard/astro-dashboard-data-loading`, `guides/catalog/regenerate-catalog-safely`
  - key evidence files: `scripts/generate_components_json.py`, `scripts/generate_trending_data.py`, `scripts/generate_agents_api.py`, `scripts/generate_claude_jobs.py`, `scripts/generate_plugins_json.py`, `docs/`, `dashboard/public/`

### reference/api

- path: `almanac/reference/api/environment-variables.md`
  - slug: `reference/api/environment-variables`
  - purpose: Provides a lookup table for environment variables used by API routes, Cloudflare Workers, dashboard auth, telemetry, and deploy scripts.
  - planned links: `architecture/api/critical-api-surfaces`, `architecture/workers/worker-scheduling-and-reporting`, `decisions/security/no-hardcoded-secrets-or-ids`, `reference/deployment/deploy-drift-gotchas`
  - key evidence files: `api/README.md`, `CLAUDE.md`, `cloudflare-workers/*/wrangler.toml`, `scripts/deploy.sh`, `dashboard/src/lib/api/`

- path: `almanac/reference/api/database-tables-and-migration-gaps.md`
  - slug: `reference/api/database-tables-and-migration-gaps`
  - purpose: Lists documented migration tables, runtime-referenced tables, and gaps where code references tables absent from committed migrations.
  - planned links: `concepts/persistence/dual-persistence-model`, `architecture/api/critical-api-surfaces`, `architecture/dashboard/collections-system`
  - key evidence files: `database/migrations/`, `api/*.js`, `dashboard/src/pages/api/`, `dashboard/src/lib/api/neon.ts`

### reference/validation

- path: `almanac/reference/validation/security-audit-cli-contract.md`
  - slug: `reference/validation/security-audit-cli-contract`
  - purpose: Provides exact commands, modes, JSON output behavior, and CI failure expectations for the component security audit.
  - planned links: `architecture/validation/five-tier-validation-system`, `guides/validation/add-new-validator`, `concepts/components/component-quality-gates`
  - key evidence files: `cli-tool/src/security-audit.js`, `cli-tool/src/validation/README.md`, `cli-tool/package.json`

- path: `almanac/reference/validation/validation-error-codes.md`
  - slug: `reference/validation/validation-error-codes`
  - purpose: Provides lookup material for `STRUCT_*`, `SEM_*`, `REF_*`, `INT_*`, and `PROV_*` codes and validator families.
  - planned links: `concepts/validation/validation-error-model`, `architecture/validation/five-tier-validation-system`, `reference/validation/security-audit-cli-contract`
  - key evidence files: `cli-tool/src/validation/ARCHITECTURE.md`, `cli-tool/src/validation/validators/`, `cli-tool/tests/validation/`

### reference/analytics

- path: `almanac/reference/analytics/analytics-test-contracts.md`
  - slug: `reference/analytics/analytics-test-contracts`
  - purpose: Lists analytics unit and integration test expectations for cache hits, state calculation, WebSocket behavior, performance, and concurrent reads.
  - planned links: `architecture/analytics/analytics-dashboard-backend-pipeline`, `architecture/analytics/realtime-update-stack`, `guides/analytics/debug-analytics-cache-and-refresh`
  - key evidence files: `cli-tool/tests/unit/StateCalculator.test.js`, `cli-tool/tests/unit/DataCache.test.js`, `cli-tool/tests/unit/WebSocketServer.test.js`, `cli-tool/tests/integration/analytics-system.test.js`, `cli-tool/package.json`

### reference/deployment

- path: `almanac/reference/deployment/deploy-drift-gotchas.md`
  - slug: `reference/deployment/deploy-drift-gotchas`
  - purpose: Lists deployment and documentation drift that future agents must resolve before trusting Vercel, GitHub Pages, Cloudflare Pages, or wrangler instructions.
  - planned links: `architecture/deployment/cloudflare-dashboard-runtime`, `decisions/deployment/cloudflare-over-vercel-runtime`, `guides/deployment/deploy-dashboard-and-workers`
  - key evidence files: `CLAUDE.md`, `CLAUDE_BACKUP.md`, `.claude/rules/dashboard.md`, `.claude/agents/deployer.md`, `scripts/deploy.sh`, `scripts/predeploy-check.sh`, `vercel.json`, `docs/guides/deployment.md`, `docs/api/README.md`
