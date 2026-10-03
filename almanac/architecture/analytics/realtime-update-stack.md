---
title: "Realtime Update Stack"
summary: "File watchers, cache invalidation, throttled notifications, WebSocket channels, message queues, and polling endpoints keep the local analytics dashboard fresh."
topics: [architecture, analytics]
sources:
  - id: file-watcher
    type: file
    path: cli-tool/src/analytics/core/FileWatcher.js
  - id: websocket-server
    type: file
    path: cli-tool/src/analytics/notifications/WebSocketServer.js
  - id: notification-manager
    type: file
    path: cli-tool/src/analytics/notifications/NotificationManager.js
  - id: analytics-server
    type: file
    path: cli-tool/src/analytics.js
---

# Realtime Update Stack

The realtime update stack keeps the local analytics dashboard synchronized with Claude Code activity by combining filesystem watching, cache invalidation, throttled notification fanout, WebSocket subscriptions, and polling endpoints. It is not a single push channel; it is a layered freshness system where file events trigger reloads, WebSocket clients receive targeted updates, and HTTP routes remain available as fallbacks [@file-watcher] [@websocket-server] [@notification-manager] [@analytics-server].

## Responsibility

`FileWatcher` watches Claude conversation files and project directories. It watches `**/*.jsonl` for conversation changes, watches the Claude directory to depth 2 for project-level changes, invalidates the changed file in `DataCache`, invokes a conversation-change callback for new-message detection, and triggers a data refresh callback [@file-watcher].

`NotificationManager` turns server events into notifications. It records notification history, throttles noisy event types, forwards messages to the WebSocket server, and exposes local subscriptions for events such as `refresh_requested` [@notification-manager].

`WebSocketServer` owns client connections. It attaches to the HTTP server on `/ws`, tracks clients and channel subscriptions, sends a connection message, supports subscribe, unsubscribe, ping, and refresh_request messages, and broadcasts updates only to clients subscribed to the relevant channel when a channel is provided [@websocket-server].

## Boundaries

File watching is concerned with detecting change, not calculating analytics. The watcher receives callbacks from `ClaudeAnalytics`; those callbacks run `loadInitialData()` or process enrichment in the main server object [@file-watcher] [@analytics-server].

Notifications are concerned with delivery, not source-of-truth state. The notification manager can send `conversation_state_change`, `data_refresh`, `new_message`, `system_status`, `file_change`, and `process_change` events, but it does not compute the analytics payload itself [@notification-manager].

WebSocket connections are optional. The HTTP API still provides `/api/realtime`, `/api/fast-update`, `/api/conversation-state`, and `/api/refresh`, so dashboard clients can poll or force refresh even if push updates are unavailable [@analytics-server].

## Flow

When a JSONL file changes, `FileWatcher` extracts a conversation id, records file size and mtime activity, invalidates that file in the cache, calls the conversation-change callback, and triggers a full data refresh [@file-watcher]. The server's conversation-change callback reads the latest parsed messages and sends a `new_message` notification when a notification manager is available [@analytics-server].

When the analytics server initializes WebSockets, it creates the WebSocket server with path `/ws` and a 30-second heartbeat, initializes the notification manager, gives the watcher access to that manager for typing-related state updates, and subscribes to refresh requests so a WebSocket client can request `loadInitialData()` [@analytics-server].

When a notification is broadcast, `WebSocketServer` serializes it with a timestamp and server label. If a channel is supplied, only clients subscribed to that channel receive it; if no clients are connected, the message is stored in a bounded queue of at most 100 messages and replayed to newly connected clients as queued messages [@websocket-server].

## Freshness Layers

The fastest layer is specific conversation notification. New messages are not throttled and are sent to the `conversation_updates` channel immediately after the changed file is parsed [@notification-manager] [@analytics-server].

The next layer is throttled data refresh. `notifyDataRefresh()` uses the default one-second throttle, while file-change notifications have a two-second per-file throttle and process-change notifications have a five-second throttle [@notification-manager].

The fallback layer is polling. The watcher also runs a full data refresh every two minutes and process refresh every 30 seconds, which catches missed filesystem events and keeps active-process status moving even without WebSockets [@file-watcher].

## Invariants And Failure Modes

The stack assumes the cache must be invalidated before clients are told about changed conversation data. The watcher calls `dataCache.invalidateFile(filePath)` before invoking the conversation-change callback and triggering reload [@file-watcher].

The stack tolerates disconnected clients. Broadcasts queue messages only when there are zero connected clients, and each later connection receives the queued messages with a `queued_` prefix [@websocket-server].

The main risk is event amplification. A single file change can produce cache invalidation, new-message notification, and full reload; throttling in `NotificationManager` and reduced periodic refresh intervals limit the impact, but high-frequency JSONL writes still drive repeated parsing work [@file-watcher] [@notification-manager]. This is why the realtime layer should be understood together with the [Analytics Dashboard Backend Pipeline](./analytics-dashboard-backend-pipeline.md).
