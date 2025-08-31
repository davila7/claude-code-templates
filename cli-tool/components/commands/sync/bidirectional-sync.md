---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [sync-mode] | --full | --incremental | --dry-run | --conflict-strategy
description: Enable comprehensive bidirectional GitHub-Linear synchronization with conflict resolution
model: sonnet
---

# Bidirectional Sync

Enable comprehensive bidirectional GitHub-Linear synchronization: **$ARGUMENTS**

## Current Sync Environment

- GitHub status: !`gh api user 2>/dev/null && echo "✓ Authenticated" || echo "⚠ Not authenticated"`
- Linear MCP: Check if Linear MCP server is available and configured
- Sync state: @.sync-state.json or @sync/ (if exists)
- Webhooks: !`gh api repos/{owner}/{repo}/hooks 2>/dev/null | grep -c linear || echo "0"`

## Task

Implement robust bidirectional synchronization between GitHub Issues and Linear tasks:

**Sync Mode**: Use $ARGUMENTS to specify full sync, incremental sync, dry-run preview, or conflict resolution strategy

**Synchronization Framework**:
1. **Sync State Management** - Initialize sync database, track entity relationships, maintain sync history
2. **Conflict Detection** - Identify simultaneous changes, field-level conflicts, timing issues
3. **Resolution Strategies** - NEWER_WINS, GITHUB_WINS, LINEAR_WINS, or intelligent field-level merge
4. **Transaction Management** - Atomic operations, rollback capability, distributed locking
5. **Webhook Integration** - Real-time event handling, sync loop prevention, automated triggers
6. **Data Integrity** - Bidirectional validation, cross-reference maintenance, audit trails

**Advanced Features**: Field-level merge rules, sync loop prevention, webhook automation, performance optimization, comprehensive monitoring.

**Production Ready**: Transaction safety, conflict resolution, error recovery, performance monitoring, comprehensive logging.

**Output**: Complete bidirectional sync system with conflict resolution, webhook integration, performance metrics, and comprehensive sync reporting.