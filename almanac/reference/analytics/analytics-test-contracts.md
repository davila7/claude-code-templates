---
title: "Analytics Test Contracts"
summary: "The analytics tests define expected conversation states, cache behavior, WebSocket messaging, integration flow, and performance limits."
topics: [reference, analytics, testing]
sources:
  - id: coverage-entry
    type: file
    path: almanac/coverage-map.md
  - id: state-tests
    type: file
    path: cli-tool/tests/unit/StateCalculator.test.js
  - id: cache-tests
    type: file
    path: cli-tool/tests/unit/DataCache.test.js
  - id: websocket-tests
    type: file
    path: cli-tool/tests/unit/WebSocketServer.test.js
  - id: integration-tests
    type: file
    path: cli-tool/tests/integration/analytics-system.test.js
  - id: cli-package
    type: file
    path: cli-tool/package.json
---

# Analytics Test Contracts

The analytics test contract is the set of behavior that must stay true when changing conversation analysis, caching, realtime notifications, or analytics server wiring. The coverage map assigns this reference to cache hits, state calculation, WebSocket behavior, performance, and concurrent reads; the test files exercise those areas directly through unit and integration suites [@coverage-entry] [@state-tests] [@cache-tests] [@websocket-tests] [@integration-tests].

## Test Commands

`cli-tool/package.json` exposes `npm run test:analytics` and `npm run analytics:test` as aliases for the analytics Jest slice [@cli-package]. The broader `npm test`, `npm run test:unit`, and `npm run test:integration` scripts also cover analytics tests depending on the selected Jest path [@cli-package].

## Conversation State

`StateCalculator` tests define four valid status strings: `active`, `waiting`, `idle`, and `completed` [@state-tests]. Recent user-plus-assistant activity is expected to be `active`, a recent user-only turn is expected to be `waiting`, old conversations become `idle`, and a conversation ending with an assistant response after several minutes becomes `completed` [@state-tests].

Detailed state calculation must report whether a matching process is running, the last activity date, message count, last user and assistant message dates, elapsed time since activity, and whether the conversation is recent [@state-tests]. Fast state calculation must mark a conversation `active` when a running process has a matching working directory, and must preserve the original status when no process matches [@state-tests].

The state tests also define error tolerance. Empty, null, invalid timestamp, and malformed message inputs must not throw; they fall back to `idle`, `false`, or `0` depending on the helper being exercised [@state-tests].

## Cache Behavior

`DataCache` starts with separate `Map` instances for file content, parsed data, and computation results, plus hit and miss metrics initialized to zero [@cache-tests]. Custom constructor options such as `fileContentTTL` and `maxFileSize` must override defaults [@cache-tests].

File-content caching is mtime and size aware. The first read calls `fs.stat` and `fs.readFile`, increments misses, and caches content; a second read of an unchanged file returns cached content without another read; a changed mtime forces another read and miss [@cache-tests].

The cache must reject files above the default 10MB limit, propagate file read errors, skip malformed JSONL lines while parsing valid lines, cache parsed conversations, cache computed token usage, and remove all per-file entries when `invalidateFile()` is called [@cache-tests].

Cache statistics must include per-cache size and hit rate plus global hit, miss, and hit-rate metrics. The tests expect two hits and one miss to produce a hit rate close to 66.67 percent [@cache-tests].

## WebSocket Behavior

`WebSocketServer` defaults to port `3334`, path `/ws`, `isRunning: false`, and a `Map` of clients, while custom options can override port, path, and heartbeat interval [@websocket-tests]. Initialization must create a `WebSocket.Server` with the HTTP server, `/ws` path, and client tracking enabled, then register connection, error, and close handlers [@websocket-tests].

On connection, the server must register a client, attach message, close, error, and pong handlers, and send a connection welcome message containing a client id [@websocket-tests]. Client messages must support `subscribe`, `unsubscribe`, and `ping`, and malformed JSON must be handled without throwing [@websocket-tests].

Broadcast behavior is channel aware. A broadcast without a channel goes to all open clients, while a broadcast with `conversation_updates` goes only to subscribed clients; send failures must not throw and must remove the failing client [@websocket-tests].

## Integration Flow

The integration suite builds fixture conversation JSONL files and verifies that `ClaudeAnalytics.loadInitialData()` loads conversations and a summary without starting the actual web server or file watchers [@integration-tests]. It also verifies that `ConversationAnalyzer` produces conversations whose statuses are one of the four valid state strings and whose token and message counts are positive [@integration-tests].

The WebSocket integration test starts a real HTTP server on a random port, connects to `/ws`, subscribes to `conversation_updates`, and expects a `subscription_confirmed` message [@integration-tests]. The notification integration test wires `NotificationManager` to the WebSocket server and expects a `conversation_state_change` message for subscribed clients after a state-change notification [@integration-tests].

The end-to-end analytics flow reloads data after writing a new conversation file and expects the conversation count to increase by one [@integration-tests]. Performance tests run analysis five times and require total time under 10 seconds, then require cache hits to be greater than zero [@integration-tests].

## Concurrent Reads

Concurrent cache reads are part of the contract. The integration suite launches ten simultaneous `getFileContent()` calls for the same JSONL file and requires every returned value to match the first result [@integration-tests].

For the analytics architecture behind these tests, read [Analytics Dashboard Backend Pipeline](../../architecture/analytics/analytics-dashboard-backend-pipeline). For realtime behavior, read [Realtime Update Stack](../../architecture/analytics/realtime-update-stack). For debugging stale cache or refresh problems, read [Debug Analytics Cache and Refresh](../../guides/analytics/debug-analytics-cache-and-refresh).
