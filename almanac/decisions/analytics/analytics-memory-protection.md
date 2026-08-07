---
title: "Analytics Memory Protection"
summary: "Conversation summaries keep parsed messages out of long-lived objects and rely on cache-backed parsing with eviction to reduce analytics memory pressure."
topics: [decisions, analytics]
sources:
  - id: conversation-analyzer
    type: file
    path: cli-tool/src/analytics/core/ConversationAnalyzer.js
  - id: data-cache
    type: file
    path: cli-tool/src/analytics/data/DataCache.js
  - id: performance-monitor
    type: file
    path: cli-tool/src/analytics/utils/PerformanceMonitor.js
---

# Analytics Memory Protection

The analytics backend intentionally keeps parsed JSONL messages out of the long-lived conversation list. `ConversationAnalyzer` parses each file to calculate counts, token usage, model info, tool usage, status, state, and status squares, but the conversation object stores only derived fields and leaves `parsedMessages` in cache-backed access paths [@conversation-analyzer]. This keeps the dashboard pipeline useful without retaining every parsed message from every conversation in memory.

## Status

Accepted in the current analytics implementation. The code comment beside the conversation object says parsed messages were removed to prevent a memory leak and remain available through the cache when needed [@conversation-analyzer].

## Context

Claude analytics reads many JSONL files, parses message content, correlates tool-use/tool-result pairs, and then derives dashboard data from those parsed messages [@conversation-analyzer]. Holding all parsed arrays directly on conversation records would make `this.data.conversations` grow with full message bodies, not just with conversation metadata [@conversation-analyzer].

The cache layer is designed as the pressure valve. It has separate maps for file content, parsed conversations, token usage, model info, status squares, tool usage, file stats, and project stats, with TTLs and a maximum cache size of 50 entries [@data-cache].

## Decision

Conversation records store durable metadata and computed summaries, not full parsed messages [@conversation-analyzer]. Callers that need parsed data go through `getParsedConversation()`, which uses `DataCache.getParsedConversation()` when a cache exists and falls back to direct file parsing when it does not [@conversation-analyzer] [@data-cache].

The cache enforces memory protection in two ways. Old file content, parsed conversations, and file stats are evicted by TTL, and oversized caches remove oldest entries until they are under the configured limit [@data-cache]. The performance monitor separately records heap, RSS, cache metrics, request timings, and memory-threshold errors, giving the analytics runtime a way to observe pressure instead of guessing [@performance-monitor].

## Consequences

Features under [Analytics Cache Layers](../../concepts/analytics/analytics-cache-layers), [Analytics Dashboard Backend Pipeline](../../architecture/analytics/analytics-dashboard-backend-pipeline), and [Debug Analytics Cache And Refresh](../../guides/analytics/debug-analytics-cache-and-refresh) should preserve this boundary. It is fine to compute more derived fields from parsed messages, but storing the parsed message arrays on conversation objects reintroduces the memory problem this decision avoids [@conversation-analyzer].

Session-level work that needs message timestamps rereads cached file content and extracts only the user-message timestamps it needs, rather than depending on retained parsed arrays [@conversation-analyzer]. That makes cache invalidation and file freshness important, but it keeps the primary conversation list compact.
