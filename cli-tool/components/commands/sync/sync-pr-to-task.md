---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [pr-number] | --task | --auto-detect | --enable-auto | --update-state
description: Link GitHub pull requests to Linear tasks with automated state synchronization and workflow integration
model: sonnet
---

# Sync PR to Task

Link GitHub pull requests to Linear tasks with comprehensive workflow integration: **$ARGUMENTS**

## Current PR Context

- Repository: !`gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "No repo context"`
- PR details: Based on $ARGUMENTS PR number or auto-detection criteria
- Linear references: Detection of task IDs in PR content and branch names
- Webhook status: Current automation configuration for PR-task synchronization

## Task

Implement comprehensive pull request to Linear task linking with automated workflow integration:

**PR Target**: Use $ARGUMENTS to specify PR number, task assignment, auto-detection mode, or automation configuration

**Integration Framework**:
1. **Reference Detection** - Extract Linear task IDs from PR title, body, branch names, commit messages
2. **PR Analysis** - Fetch complete PR data, analyze state, review status, change metrics, timeline
3. **State Synchronization** - Map PR states to Linear equivalents, handle review cycles, merge events
4. **Task Updates** - Update Linear task status, add PR references, create comments, sync metadata
5. **GitHub Enhancement** - Add Linear context to PR, create labels, post task summaries, maintain links
6. **Workflow Automation** - Configure webhooks, enable real-time sync, implement event handlers, maintain consistency

**Advanced Features**: Smart branch detection, automated state mapping, review integration, commit analysis, comprehensive validation.

**Workflow Integration**: Real-time updates, bidirectional sync, event-driven automation, comprehensive monitoring.

**Output**: Complete PR-task integration with automated synchronization, workflow enhancement, state management, and comprehensive relationship tracking.