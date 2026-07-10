---
title: "Analytics Cache Layers"
summary: "The in-memory cache hierarchy that keeps the Claude analytics dashboard from repeatedly reading, parsing, and recomputing the same conversation data."
topics: [concepts]
sources:
  - id: data-cache
    type: file
    path: cli-tool/src/analytics/data/DataCache.js
  - id: conversation-analyzer
    type: file
    path: cli-tool/src/analytics/core/ConversationAnalyzer.js
  - id: analytics-server
    type: file
    path: cli-tool/src/analytics.js
---

# Analytics Cache Layers

Analytics cache layers are the dashboard's in-memory performance model for local Claude data. `DataCache` keeps separate caches for raw file contents, file stats, parsed conversations, computed token usage, model info, status squares, tool usage, summary data, Claude sessions, process data, and project stats [@data-cache]. This matters because every analytics refresh begins from the [Claude JSONL Data Model](claude-jsonl-data-model), but the dashboard would be expensive and noisy if it reread and reparsed every conversation file for every metric [@conversation-analyzer].

## Layered Cache Shape

The cache is intentionally split by kind of work. File content is cached as text with stats, parsed conversations are cached as normalized messages, computed per-file metrics are cached in separate maps, and cross-file computations such as `summary` and `sessions` are cached as objects with dependency sets [@data-cache]. Metadata has its own file stat and project stat maps, while process data has a very short TTL because running process state changes faster than historical conversation files [@data-cache].

The default TTLs reflect that split. File content uses a one-minute TTL, parsed data uses thirty seconds, expensive computations use twenty seconds, metadata uses ten seconds, and process data uses one second [@data-cache]. Size enforcement caps each map-style cache at fifty entries and removes the oldest entries when a cache grows beyond that limit [@data-cache].

## File Modification As The Validity Check

Most per-file cache entries are valid only if their timestamp is at least as new as the file's modification time. `getFileContent()` checks `fs.stat()` before returning cached content, and `getParsedConversation()` checks cached parsed messages against `fileStats.mtime` before reusing them [@data-cache]. Token usage, model info, status squares, and tool usage follow the same file-mtime pattern [@data-cache].

That design fits the analytics domain because Claude conversations are append-like local files. When a JSONL file changes, the cache can invalidate the affected file path and force all derived views for that file to be recomputed from the new durable source [@data-cache].

## Dependency-Aware Computations

Not all analytics values belong to one file. `getCachedComputation()` supports dependency arrays and stores dependency modification times, so cross-file computations can detect when any source file has changed [@data-cache]. `ConversationAnalyzer.calculateSummary()` uses that mechanism with all conversation file paths as dependencies, and `calculateClaudeSessions()` does the same for session statistics [@conversation-analyzer].

`invalidateFile()` removes direct caches for content, parsed messages, token usage, model info, status squares, tool usage, and file stats for one path. It also clears `sessions` and `summary` if their dependency sets include that file [@data-cache]. This is the key distinction between cache layers and a simple memoization map: file-level invalidation can also invalidate aggregate analytics that were built from the file [@data-cache].

## Server Integration

The main analytics server constructs one `DataCache` instance and passes it into `ConversationAnalyzer`, making the cache shared across initial loading, refreshes, and API handlers [@analytics-server]. `ConversationAnalyzer` delegates file content, file stats, parsed conversations, token usage, model info, tool usage, status squares, summary, and session calculations to the cache when it is present [@conversation-analyzer].

The server exposes cache-related behavior through API routes. `/api/cache/clear` can clear all caches or conversation-related caches, while `/api/clear-cache` attempts to clear server-side cache state before reloading data [@analytics-server]. The code path is uneven: `DataCache` exposes `clearAll()`, while the `/api/clear-cache` route checks for a `clear()` method, so the more explicit `/api/cache/clear` route better matches the current cache API [@data-cache] [@analytics-server].

## Relationship To State

The [Conversation State Model](conversation-state-model) depends on fresh-enough parsed messages and file modification times. Cache layers therefore sit between durable JSONL files and state labels: they reduce repeated I/O, but they must invalidate quickly enough for labels such as `Claude Code working...` and `Awaiting user input...` to feel live.
