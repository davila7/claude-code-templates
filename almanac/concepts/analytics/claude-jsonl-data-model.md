---
title: "Claude JSONL Data Model"
summary: "The local JSON Lines message format that the analytics dashboard parses into conversations, tokens, tools, models, projects, and session metrics."
topics: [concepts, analytics]
sources:
  - id: data-structure-doc
    type: file
    path: cli-tool/docs_to_claude/CLAUDE_DATA_STRUCTURE.md
  - id: conversation-analyzer
    type: file
    path: cli-tool/src/analytics/core/ConversationAnalyzer.js
  - id: session-analyzer
    type: file
    path: cli-tool/src/analytics/core/SessionAnalyzer.js
  - id: data-cache
    type: file
    path: cli-tool/src/analytics/data/DataCache.js
---

# Claude JSONL Data Model

The Claude JSONL data model is the analytics dashboard's source format for local Claude Code conversations. Each `.jsonl` file contains one JSON object per line, with root fields such as `uuid`, `parentUuid`, `timestamp`, `type`, `sessionId`, `cwd`, and a nested `message` object that carries the user or assistant role, content, model, and token usage [@data-structure-doc]. The dashboard parses those lines into normalized message objects, attaches tool results to tool calls, and uses the result for conversation totals, project names, model summaries, token metrics, tool timelines, and the [Conversation State Model](conversation-state-model) [@conversation-analyzer].

## Record Shape

The repository documentation describes Claude conversation files under `~/.claude/projects/` as JSON Lines files where each line is a message or event [@data-structure-doc]. User records usually have `type: "user"` and a nested `message.role: "user"` with string content, while assistant records include a nested assistant message with a model, content blocks, stop fields, and a `usage` object [@data-structure-doc].

Assistant content is usually an array of blocks. Text blocks carry prose, and `tool_use` blocks carry a tool id, name, and input object [@data-structure-doc]. Tool results are represented as user-side content blocks with `type: "tool_result"` and a `tool_use_id`, which means the raw file alternates between conversation text and tool plumbing [@data-structure-doc].

## Parser Normalization

`ConversationAnalyzer.loadConversations()` recursively searches the Claude directory for `.jsonl` files, gets file stats, parses each conversation, computes token and tool data, extracts project names, and builds a conversation object with fields such as `id`, `filePath`, `messageCount`, `fileSize`, `lastModified`, `created`, `tokens`, `tokenUsage`, `modelInfo`, `toolUsage`, `project`, `status`, `conversationState`, and `statusSquares` [@conversation-analyzer].

The parser does not keep raw JSONL records as-is. `parseAndCorrelateToolMessages()` first parses valid user and assistant entries, maps assistant `tool_use` blocks by id, then attaches matching `tool_result` blocks to the original tool-use message and skips those standalone result entries in the normalized output [@conversation-analyzer]. The final normalized message keeps `id`, `role`, `timestamp`, `content`, `model`, `usage`, `toolResults`, `isCompactSummary`, `uuid`, and `type` [@conversation-analyzer].

## Extracted Metrics

The analytics layer treats token and model data as first-class fields. `calculateRealTokenUsage()` sums `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens` from parsed message usage objects, and records how many messages included usage data [@conversation-analyzer]. `extractModelInfo()` collects all models and service tiers, remembers the latest model and tier, and flags conversations that use multiple models [@conversation-analyzer].

Tool analytics come from assistant content blocks. `extractToolUsage()` counts `tool_use` blocks by name, builds a time-sorted tool timeline, records total tool calls, and records the number of unique tools [@conversation-analyzer]. Status squares are another derived view: the analyzer takes the last ten messages and marks them as user input, tool execution, error, successful assistant response, or unknown based on role and content [@conversation-analyzer].

## Project And Session Context

Project identity can come from project `settings.json`, but the analyzer also falls back to early `cwd` fields in the conversation file and finally to `Unknown` [@conversation-analyzer]. This makes the JSONL `cwd` field important even though it is not part of the nested message body.

Session metrics are also derived from JSONL records. `SessionAnalyzer` calculates Claude usage sessions by collecting user-message timestamps across conversations, so sessions are counted from user activity rather than every line in the file [@session-analyzer]. The same parsed files therefore support both local conversation display and higher-level usage summaries.

## Cache Boundary

The [Analytics Cache Layers](analytics-cache-layers) mirror this data model. `DataCache.getParsedConversation()` reads file content, splits it into lines, parses and correlates tool messages, and stores the normalized messages keyed by file path and file modification time [@data-cache]. That means the durable model is still JSONL, but most analytics code works against cached normalized messages rather than reparsing raw lines on every request [@data-cache].
