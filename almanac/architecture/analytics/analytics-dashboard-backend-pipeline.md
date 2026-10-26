---
title: "Analytics Dashboard Backend Pipeline"
summary: "The local analytics backend turns Claude conversation files, process state, cached computations, and session analysis into Express APIs for the dashboard."
topics: [architecture, analytics]
sources:
  - id: analytics-server
    type: file
    path: cli-tool/src/analytics.js
  - id: conversation-analyzer
    type: file
    path: cli-tool/src/analytics/core/ConversationAnalyzer.js
  - id: process-detector
    type: file
    path: cli-tool/src/analytics/core/ProcessDetector.js
  - id: session-analyzer
    type: file
    path: cli-tool/src/analytics/core/SessionAnalyzer.js
  - id: file-watcher
    type: file
    path: cli-tool/src/analytics/core/FileWatcher.js
---

# Analytics Dashboard Backend Pipeline

The analytics dashboard backend is a local Express service that reads Claude Code data from `~/.claude`, parses JSONL conversation files, enriches conversations with process state, computes summaries and session data, and serves the result through dashboard APIs. Its boundary is local observability: it does not own the production catalog or dashboard APIs, but it does maintain an in-memory analytics model that can be refreshed by file watchers, HTTP endpoints, and WebSocket requests [@analytics-server] [@conversation-analyzer].

## Responsibility

`ClaudeAnalytics` is the orchestrator. During initialization it locates the Claude directories, creates a `ConversationAnalyzer` with a shared data cache, loads initial data, installs file watchers, and registers the web server routes [@analytics-server]. The core pipeline is `loadInitialData()`: it asks the conversation analyzer for analyzed conversations and projects, reads Claude session information, computes session usage, and emits refresh notifications when realtime infrastructure is active [@analytics-server].

The conversation analyzer owns recursive JSONL discovery and per-conversation derivation. For each `.jsonl` file under the Claude directory, it reads stats, parses messages, calculates token usage, model info, tool usage, project identity, status, conversation state, and status squares [@conversation-analyzer]. It deliberately omits parsed messages from the stored conversation object to reduce memory pressure, relying on cache-backed access when full messages are needed [@conversation-analyzer].

## Boundaries

The backend treats conversation files as source data and process state as enrichment. `ProcessDetector` shells out to `ps aux`, filters likely Claude CLI processes, caches detection for 500 milliseconds, and matches running processes to conversations by working directory, command text, or most-recent-conversation fallback [@process-detector]. If process detection fails, it returns the original conversations with no orphan processes instead of failing the whole analytics load [@process-detector].

Session analysis is separate from conversation parsing. `SessionAnalyzer` groups usage into reset windows, calculates weighted message usage from token metadata when available, detects the user plan from conversation data, and can use real Claude session data from statsig files when the server provides it [@session-analyzer] [@analytics-server].

## Entrypoints

The main dashboard payload is `GET /api/data`. It returns summary data, detailed token usage, timestamps, and a newest-first slice of up to 150 conversations without mutating the in-memory conversation list [@analytics-server].

Conversation access is split by use case. `GET /api/conversations` paginates conversation summaries, `GET /api/conversations/:id/messages` reads parsed messages from the conversation file with optional pagination, and `GET /api/session/:id` expands a conversation into display-friendly message history with tool-use metadata [@analytics-server].

Operational endpoints include `GET /api/realtime`, `GET /api/refresh`, `GET /api/conversation-state`, `GET /api/fast-update`, `GET /api/system/health`, `GET /api/system/metrics`, `POST /api/cache/clear`, and `POST /api/clear-cache` [@analytics-server]. These routes expose either cached state, forced reloads, lightweight state recalculation, or cache management.

## Flow

The normal load path starts with recursive file discovery, then per-file parsing, cached computation, project extraction, and state calculation [@conversation-analyzer]. After the conversation analyzer returns, process detection marks active conversations and recalculates conversation state where possible [@process-detector]. The server then derives session data and exposes the combined model through Express [@analytics-server] [@session-analyzer].

The refresh path has multiple triggers. File changes call back into `loadInitialData()`, `/api/refresh` invokes it directly, and the realtime stack can subscribe to refresh requests from WebSocket clients [@analytics-server] [@file-watcher]. The [Realtime Update Stack](./realtime-update-stack.md) handles the watcher and notification mechanics.

## Invariants And Failure Modes

The in-memory model is the serving boundary. Routes generally read `this.data`, and the expensive parsing path is centralized in `loadInitialData()` so clients do not each re-scan the filesystem [@analytics-server]. Routes that need full messages use `ConversationAnalyzer.getParsedConversation()` against the conversation file, preserving the lighter summary model [@analytics-server] [@conversation-analyzer].

The backend is resilient by design, but not silent everywhere. Invalid JSONL lines are skipped during parsing, individual unparseable files warn and continue, process detection failures return empty process enrichment, and session endpoints return 500 when their own analysis fails [@conversation-analyzer] [@process-detector] [@analytics-server].

The most important implementation gotcha is naming drift: some process-enrichment code refers to `conversation.fileName`, while conversation objects are created with `filename` and `filePath`. Because those reads are guarded by try/catch, the pipeline keeps running, but active-state recalculation can silently fall back to existing state when the constructed path is wrong [@conversation-analyzer] [@process-detector] [@analytics-server].
