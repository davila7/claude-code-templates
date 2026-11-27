---
title: "Conversation State Model"
summary: "How the analytics dashboard turns Claude JSONL messages, file activity, process activity, and tool use into readable conversation state labels."
topics: [concepts, analytics]
sources:
  - id: state-calculator
    type: file
    path: cli-tool/src/analytics/core/StateCalculator.js
  - id: state-doc
    type: file
    path: cli-tool/docs_to_claude/ANALYTICS_STATE_DETECTION.md
  - id: typing-debug
    type: file
    path: cli-tool/docs_to_claude/DEBUG_TYPING_DETECTION.md
---

# Conversation State Model

The conversation state model is the analytics dashboard's translation layer between raw Claude activity and human-readable session labels. It looks at parsed messages from the [Claude JSONL data model](claude-jsonl-data-model), the conversation file's modification time, matched running processes, and recent tool activity, then emits strings such as `Claude Code working...`, `Awaiting user input...`, `User typing...`, `Recently active`, `Idle`, and `Inactive` [@state-calculator]. This matters because the dashboard is not reading an explicit "Claude is working" flag; it infers state from side effects that Claude Code leaves in local files and process state [@state-doc].

## Why State Is Inferred

Claude conversations are stored as local JSONL records, while the analytics dashboard needs a live sidebar-style status. `StateCalculator.determineConversationState()` therefore treats state as a derived value, not stored data. It first asks whether recent Claude activity can be detected from file and message patterns, then falls back to file recency, active process information, last message role, and elapsed time [@state-calculator].

The most important distinction is between "activity" and "conversation flow." Very recent file writes, recent user messages with file activity, fresh assistant messages, recent tool blocks, and rapid back-and-forth message timing all count as real Claude activity [@state-calculator]. If those signals are absent, the calculator interprets the last role: a recent user message means Claude may be working or awaiting response, while a recent assistant message means the system is likely awaiting user input [@state-calculator].

## Process-Aware States

When the analytics backend knows a conversation has an active process, it gives that process signal extra weight. `quickStateCalculation()` checks whether any running process appears to match the conversation project, command, or already-attached running process field; if no process matches, it returns `null` so inactive conversations can be skipped by the fast path [@state-calculator]. For matching processes, it uses the conversation file's last modification time to choose between `Claude Code working...`, `Awaiting user input...`, and `User typing...` [@state-calculator].

The companion documentation describes the `/api/conversation-state` endpoint as a batch endpoint that returns `activeStates` keyed by conversation id, with frontend refresh behavior ranging from seconds to tens of seconds depending on the real-time path [@state-doc]. That endpoint-level model explains why state strings are stable dashboard API data rather than only component-local UI labels [@state-doc].

## Timing Rules

The state model uses deliberately broad timing windows. A file modified within one minute is treated as active Claude work; any conversation file modified within five minutes can still return `Claude Code working...` even without a matched process [@state-calculator]. A user message under three minutes old returns `Claude Code working...`; under ten minutes it becomes `Awaiting response...`; under thirty minutes it becomes `User typing...`; after that it becomes `Recently active` [@state-calculator].

Assistant messages follow the other side of the exchange. A fresh assistant response can return `Awaiting user input...`, then `User typing...`, then `Recently active` as time passes [@state-calculator]. `determineConversationStatus()` separately collapses the dashboard's coarse status to `active`, `recent`, or `inactive` based mainly on recent message role and file modification time [@state-calculator].

## Tool Activity And Typing

Tool use is a strong activity signal because Claude often writes tool calls and tool results while a task is still in progress. The calculator inspects the last few parsed messages for `tool_use` blocks or attached `toolResults`, and can label the conversation as an `Active session` if those tool signals and file activity are recent enough [@state-calculator].

The repository also records a debugging note for `User typing...` detection. It names three possible sources for that state: frontend timeout logic, backend file watcher activity, and backend state calculation [@typing-debug]. That note is useful because it exposes a practical ambiguity in this model: the same state label can be produced by different mechanisms, so debugging wrong labels requires checking both browser-side state and backend file/process signals [@typing-debug].

## Relationship To Analytics Data

The state model depends on parsed message fields, especially role, timestamp, content blocks, and attached tool results. Those fields come from the [Claude JSONL data model](claude-jsonl-data-model), and repeated parsing is avoided by [Analytics Cache Layers](analytics-cache-layers). The concept to remember is simple: conversation state is a best-effort live interpretation of recent evidence, while JSONL is the durable source and caches are the performance layer around it.
