---
title: "Database Tables and Migration Gaps"
summary: "Committed migration tables, runtime-referenced tables, and missing migration coverage for Neon and Supabase-backed APIs."
topics: [reference, api, persistence]
sources:
  - id: migrations-dir
    type: file
    path: database/migrations/
  - id: command-usage-api
    type: file
    path: api/track-command-usage.js
  - id: release-api
    type: file
    path: api/claude-code-check.js
  - id: collections-api-dir
    type: file
    path: dashboard/src/pages/api/collections/
  - id: telemetry-api-dir
    type: file
    path: dashboard/src/pages/api/
  - id: live-task-api-dir
    type: file
    path: dashboard/src/pages/api/live-task/
  - id: download-api
    type: file
    path: api/track-download-supabase.js
  - id: neon-helper
    type: file
    path: dashboard/src/lib/api/neon.ts
---

# Database Tables and Migration Gaps

The database migration map is uneven. The committed `database/migrations/` directory defines release-monitoring tables and command-usage tables, but several Neon-backed API routes reference collection, website-event, installation-outcome, health-log, and live-task tables that do not have committed migrations in that directory [@migrations-dir] [@collections-api-dir] [@telemetry-api-dir] [@live-task-api-dir]. Supabase download tracking is separate: it writes `component_downloads` and `download_stats` through the Supabase endpoint rather than the Neon helper [@download-api]. For the broader persistence model, see [Dual Persistence Model](../../concepts/persistence/dual-persistence-model).

## Committed Migration Coverage

| Migration area | Tables and views |
| --- | --- |
| Release monitoring | `claude_code_versions`, `claude_code_changes`, `discord_notifications_log`, and `monitoring_metadata` are defined in the first migration [@migrations-dir]. The release API reads and writes those same tables when checking new Claude Code versions and sending Discord notifications [@release-api]. |
| Command usage | `command_usage_logs` and `command_usage_stats` are defined in the second migration, along with `daily_command_usage`, `platform_distribution`, and `popular_commands_30d` views [@migrations-dir]. The command usage API inserts raw command executions into `command_usage_logs` [@command-usage-api]. |

Both committed migrations target Neon-style PostgreSQL use. The runtime helper throws when `NEON_DATABASE_URL` is missing, which makes that variable the common gate for dashboard API routes that use the helper [@neon-helper].

## Runtime Tables Without Committed Migrations

| Referenced table | Referenced by | Gap |
| --- | --- | --- |
| `user_collections` | Collection list, create, update, delete, and sharing APIs [@collections-api-dir] | No `CREATE TABLE` appears in `database/migrations/` [@migrations-dir]. |
| `collection_items` | Collection item add, move, delete, public share, and list APIs [@collections-api-dir] | No committed migration defines the table or its ownership/index constraints [@migrations-dir]. |
| `website_events` | Dashboard website event tracking endpoint [@telemetry-api-dir] | No committed migration defines event columns such as event type, event data, page path, visitor/session ids, country, or screen width [@migrations-dir] [@telemetry-api-dir]. |
| `installation_outcomes` | Installation outcome tracking endpoint [@telemetry-api-dir] | No committed migration defines component type/name, outcome, error, duration, version, platform, or batch fields [@migrations-dir] [@telemetry-api-dir]. |
| `api_health_logs` | Dashboard health-check endpoint [@telemetry-api-dir] | No committed migration defines endpoint, method, status, response-time, and error logging [@migrations-dir] [@telemetry-api-dir]. |
| `cycle_control` | Live-task control and cycle APIs [@live-task-api-dir] | No committed migration defines the singleton pause-control row [@migrations-dir]. |
| `review_cycles` | Live-task cycle API [@live-task-api-dir] | No committed migration defines cycle status, phase, PR metadata, branch, issue, summary, or completion fields [@migrations-dir] [@live-task-api-dir]. |
| `tool_executions` | Live-task tool logging API [@live-task-api-dir] | No committed migration defines tool execution rows or their relationship to review cycles [@migrations-dir] [@live-task-api-dir]. |

## Supabase Tables

`api/track-download-supabase.js` constructs a Supabase client from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, inserts raw install events into `component_downloads`, and updates aggregate rows in `download_stats` [@download-api]. Those tables are not defined in `database/migrations/`, which is consistent with the repo's split between Supabase download tracking and Neon-backed API surfaces [@download-api] [@migrations-dir].

## Practical Rule

Before changing an API route, check whether its table is migration-backed. Release monitoring and command usage have committed SQL migrations [@migrations-dir]. Collections, website telemetry, installation outcomes, health logs, and live-task tables are runtime dependencies without matching committed migrations, so schema changes there need a migration added before the code can be treated as reproducible from the repository alone [@collections-api-dir] [@telemetry-api-dir] [@live-task-api-dir].
