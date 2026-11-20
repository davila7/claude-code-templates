---
title: "Critical API Surfaces"
summary: "The repository has production API surfaces for install telemetry, command usage, Discord interactions, release monitoring, health checks, website events, and dashboard collections."
topics: [architecture, api]
sources:
  - id: api-readme
    type: file
    path: api/README.md
  - id: root-download-api
    type: file
    path: api/track-download-supabase.js
  - id: root-command-api
    type: file
    path: api/track-command-usage.js
  - id: root-discord-api
    type: file
    path: api/discord/interactions.js
  - id: root-release-api
    type: file
    path: api/claude-code-check.js
  - id: dashboard-download-api
    type: file
    path: dashboard/src/pages/api/track-download-supabase.ts
  - id: dashboard-command-api
    type: file
    path: dashboard/src/pages/api/track-command-usage.ts
  - id: dashboard-outcome-api
    type: file
    path: dashboard/src/pages/api/track-installation-outcome.ts
  - id: dashboard-events-api
    type: file
    path: dashboard/src/pages/api/track-website-events.ts
  - id: dashboard-health-api
    type: file
    path: dashboard/src/pages/api/health-check.ts
  - id: dashboard-release-api
    type: file
    path: dashboard/src/pages/api/claude-code-check.ts
  - id: dashboard-discord-api
    type: file
    path: dashboard/src/pages/api/discord/interactions.ts
---

# Critical API Surfaces

The critical API surfaces are the endpoints that keep the component ecosystem observable and connected: download tracking, command usage tracking, Discord component search, Claude Code release monitoring, API health checks, website event tracking, installation outcome tracking, and authenticated dashboard features. The repository contains an older root `api/` Vercel-style surface and a dashboard `src/pages/api/` Astro surface with overlapping production responsibilities [@api-readme] [@dashboard-download-api] [@dashboard-command-api].

## Responsibility

The API README identifies three root critical endpoints: `/api/track-download-supabase` for component installation metrics, `/api/discord/interactions` for Discord bot component discovery, and `/api/claude-code-check` for Claude Code release monitoring and Discord notifications [@api-readme]. It also states the database split: download metrics use Supabase, while release monitoring uses Neon [@api-readme].

The dashboard API surface extends that contract. It includes Astro handlers for download tracking, command tracking, installation outcomes, website events, health checks, Discord interactions, release checks, collections, GitHub token exchange, and live-task tools [@dashboard-download-api] [@dashboard-command-api] [@dashboard-outcome-api] [@dashboard-events-api] [@dashboard-health-api] [@dashboard-discord-api].

## Telemetry Endpoints

Download tracking accepts only POST and OPTIONS, validates component type and name, accepts the component path, category, CLI version, user agent, IP address, and Vercel country header, inserts a `component_downloads` row, and attempts to upsert aggregate `download_stats` [@root-download-api] [@dashboard-download-api]. Supabase insert failure fails the request, while aggregate-stat upsert failure is logged but does not fail the response [@root-download-api] [@dashboard-download-api].

Command usage tracking accepts a fixed allowlist of CLI commands, records CLI version, Node version, platform, architecture, session id, and metadata into `command_usage_logs`, and rejects unknown command names [@root-command-api] [@dashboard-command-api].

Installation outcome tracking records component type, component name, outcome, optional error detail, duration, runtime metadata, and batch id into `installation_outcomes`. It only allows `success`, `failure`, or `partial` outcomes [@dashboard-outcome-api].

Website event tracking accepts batches of up to 50 events and only allows `search`, `cart_add`, `cart_remove`, `cart_checkout`, `component_view`, and `copy_command` event types. Each event is inserted into `website_events` with page path, event data, referrer, session id, visitor id, country, and screen width [@dashboard-events-api].

## Discord And Release Monitoring

The Discord interaction endpoint verifies Discord's Ed25519 signature before handling interactions. It supports PING, then application commands for search, info, install, popular, and random component discovery, using a five-minute in-memory cache of `components.json` [@root-discord-api] [@dashboard-discord-api].

The release check endpoint reads the latest `@anthropic-ai/claude-code` version from npm, checks Neon for prior notification, fetches the upstream changelog, parses the current version section, stores version and change rows, sends a Discord webhook, logs the notification, and updates monitoring metadata [@root-release-api] [@dashboard-release-api].

## Health And Operations

The dashboard health check probes the public download, command, and website-event endpoints with OPTIONS requests, writes the results into `api_health_logs`, and sends Discord plus error-tracking alerts for failures or timeouts [@dashboard-health-api].

The root API README treats tests and predeploy checks as part of the critical surface: it instructs maintainers to run API tests before deployment and points troubleshooting at production endpoint probes, Vercel logs, and database queries [@api-readme].

## Boundaries And Related Pages

The API layer has two persistence backends. Download tracking uses Supabase service credentials, while command usage, installation outcomes, website events, release monitoring, and health logs use Neon through SQL inserts [@api-readme] [@dashboard-download-api] [@dashboard-command-api] [@dashboard-outcome-api] [@dashboard-events-api] [@dashboard-release-api] [@dashboard-health-api].

Authenticated collection APIs are another critical dashboard surface because they gate user-owned saved components and public collection sharing. Their architecture is covered in [Collections System](../dashboard/collections-system.md).

## Invariants And Failure Modes

Every telemetry endpoint validates enum-like fields before inserting. Component types, command names, outcomes, and website event types are all allowlisted at the API edge [@dashboard-download-api] [@dashboard-command-api] [@dashboard-outcome-api] [@dashboard-events-api].

CORS preflight handling is part of the public contract. The tracking endpoints expose OPTIONS handlers so browser and CLI-facing clients can check or send telemetry without custom server negotiation [@root-download-api] [@root-command-api] [@dashboard-download-api] [@dashboard-command-api] [@dashboard-events-api].

The biggest operational risk is drift between the root Vercel-style API files and the dashboard Astro API files. They implement similar behavior for download tracking, command tracking, Discord interactions, and release checks, but they are separate code paths with different helpers and error tracking [@root-download-api] [@dashboard-download-api] [@root-command-api] [@dashboard-command-api] [@root-discord-api] [@dashboard-discord-api] [@root-release-api] [@dashboard-release-api].
