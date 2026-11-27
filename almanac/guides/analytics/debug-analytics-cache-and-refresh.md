---
title: "Debug Analytics Cache and Refresh"
summary: "How to diagnose stale analytics data across cache entries, file watcher invalidation, refresh endpoints, and real-time notifications."
topics: [guides, analytics]
sources:
  - id: coverage-entry
    type: file
    path: almanac/coverage-map.md
  - id: analytics-server
    type: file
    path: cli-tool/src/analytics.js
  - id: data-cache
    type: file
    path: cli-tool/src/analytics/data/DataCache.js
  - id: file-watcher
    type: file
    path: cli-tool/src/analytics/core/FileWatcher.js
  - id: notification-manager
    type: file
    path: cli-tool/src/analytics/notifications/NotificationManager.js
  - id: state-detection
    type: file
    path: cli-tool/docs_to_claude/ANALYTICS_STATE_DETECTION.md
  - id: data-cache-tests
    type: file
    path: cli-tool/tests/unit/DataCache.test.js
---

# Debug Analytics Cache and Refresh

This guide is the debugging path for analytics data that looks stale, delayed, or inconsistent in the local Claude analytics dashboard. The page exists because the coverage map assigns this guide to the cache invalidation, state refresh, WebSocket update, and `/api/clear-cache` path, with `analytics.js`, `DataCache`, the cache tests, and the state detection notes as the core evidence [@coverage-entry].

## Successful outcome

A successful fix proves where freshness broke. The dashboard should either refresh from changed `.jsonl` files through the watcher path, recalculate from cleared cache entries, or expose a specific failed endpoint or WebSocket update. The backend builds analytics around `ConversationAnalyzer`, `StateCalculator`, `ProcessDetector`, `SessionAnalyzer`, `DataCache`, `FileWatcher`, `WebSocketServer`, and `NotificationManager`, so stale data usually belongs to one of those handoff points [@analytics-server].

## Preconditions

Start the analytics server from the CLI package, then reproduce the stale view before clearing anything. The server initializes the Claude home directory, creates `ConversationAnalyzer` with the shared `DataCache`, loads initial data, installs watchers, and then sets up the web server [@analytics-server]. If the dashboard never starts, this is not a cache problem yet; first confirm the `~/.claude` directory exists, because initialization throws when it cannot find that directory [@analytics-server].

Use the state endpoint as a quick freshness probe. The state documentation identifies `/api/conversation-state` as a GET endpoint returning `activeStates` and a timestamp, and gives direct curl checks for state and conversation count [@state-detection].

## Ordered work

1. Check whether the stale value is a file cache, parsed conversation, computed result, process value, or summary. `DataCache` keeps separate stores for file contents, parsed conversations, token usage, model info, status squares, tool usage, sessions, summary, process data, file stats, and project stats [@data-cache].

2. Compare the changed conversation file's modification time with the cache path. `getFileContent()` reuses cached content only when the cached timestamp is at least as new as the file mtime; otherwise it rereads the file and updates file stats [@data-cache]. `getParsedConversation()` repeats the same mtime check for parsed JSONL messages [@data-cache].

3. Check watcher activity. `FileWatcher` watches `**/*.jsonl`, extracts a conversation id, tracks file activity, invalidates the changed file in `DataCache`, calls the conversation change callback when present, and triggers a data refresh [@file-watcher].

4. If file changes are missed, wait for the fallback interval before changing code. The watcher also runs a periodic data refresh every two minutes and a process refresh every thirty seconds [@file-watcher].

5. Inspect whether notifications were throttled. `NotificationManager` sends `data_refresh` and conversation state notifications through WebSocket and local subscribers, but throttles rapid data refresh events with a default throttle time of one second [@notification-manager].

6. Use `/api/clear-cache` only after you have captured the stale behavior. The analytics server exposes a POST `/api/clear-cache` endpoint and also has routes that clear parsed conversations, file contents, file stats, and computed values when a forced refresh is needed [@analytics-server].

## Verification

Verify cache behavior at the level that failed. The unit tests exercise the expected basics: reading on a miss, returning cached file content when a file is unchanged, rereading when mtime changes, skipping malformed JSONL lines, caching parsed conversations, caching token usage, invalidating a file, clearing expired entries, and reporting stats [@data-cache-tests]. Treat these as behavior checks, not as a complete map of current internal property names, because the implementation now uses cache names such as `parsedConversations`, `tokenUsage`, and `fileStats` [@data-cache].

Verify state freshness with the documented curl checks. The state guide recommends testing `/api/conversation-state`, checking `/api/conversations?page=0&limit=1`, and watching server logs for conversation-state processing [@state-detection].

## Recovery notes

If a single conversation is stale, prefer invalidating that file path before clearing all caches. `invalidateFile()` removes file content, parsed conversation, token usage, model info, status squares, tool usage, and file stats for the changed file, then resets dependent session and summary computations when needed [@data-cache].

If every conversation looks stale, clear computed values and parsed/file caches together. The server has refresh paths that call `invalidateComputations()` and clear `parsedConversations`, `fileContent`, and `fileStats`, which is the broad reset for stale aggregate analytics [@analytics-server].
