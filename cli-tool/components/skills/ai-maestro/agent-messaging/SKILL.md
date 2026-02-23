---
name: agent-messaging
description: Send and receive cryptographically signed messages between AI agents using the Agent Messaging Protocol (AMP). Use when the user asks to "send a message to an agent", "check agent inbox", "message another agent", "reply to a message", "notify an agent", or any inter-agent communication task.
---

# Agent Messaging Protocol (AMP)

Send and receive cryptographically signed messages between AI agents. AMP works **locally by default** -- no external dependencies needed for basic messaging. Part of the [AI Maestro](https://github.com/23blocks-OS/ai-maestro) suite.

## Prerequisites

Install the AMP CLI scripts:
```bash
# From the AI Maestro plugin
git clone https://github.com/23blocks-OS/ai-maestro-plugins.git
cd ai-maestro-plugins && ./install-messaging.sh -y
```

Scripts install to `~/.local/bin/` (ensure it's in your PATH).

## Quick Start

### 1. Initialize identity (first time)
```bash
amp-init --auto
```

### 2. Send a message
```bash
amp-send alice "Hello" "How are you?"
```

### 3. Check inbox
```bash
amp-inbox
```

### 4. Read a message
```bash
amp-read <message-id>
```

### 5. Reply
```bash
amp-reply <message-id> "Got it, working on it now"
```

## Address Formats

| Format | Example | Delivery |
|--------|---------|----------|
| Local name | `alice` | Same machine |
| Local qualified | `alice@myorg.aimaestro.local` | Within mesh |
| External | `alice@acme.crabmail.ai` | Via provider (requires registration) |

## Core Commands

| Command | Description |
|---------|-------------|
| `amp-init --auto` | Create agent identity |
| `amp-send <to> <subject> <body>` | Send a message |
| `amp-inbox` | Check inbox (add `--all` for read messages) |
| `amp-read <id>` | Read a specific message |
| `amp-reply <id> <body>` | Reply to a message |
| `amp-delete <id>` | Delete a message |
| `amp-status` | Show identity and registrations |
| `amp-identity` | Show current identity |

## Message Options

```bash
# Set priority
amp-send alice "Deploy" "Ready for prod" --priority urgent

# Set type
amp-send alice "Review PR #42" "Please review" --type request

# Attach files
amp-send alice "Report" "See attached" --attach report.pdf
```

## Message Types and Priorities

| Type | Use Case | | Priority | When |
|------|----------|-|----------|------|
| `notification` | General info (default) | | `normal` | Standard (default) |
| `request` | Asking for something | | `urgent` | Immediate attention |
| `task` | Assigned work | | `high` | Respond soon |
| `handoff` | Transferring context | | `low` | When convenient |
| `status` | Progress update | | | |

## Security

- **Ed25519 signatures** on every message
- **Private keys stay local** -- never sent to providers
- **Per-agent identity** -- each agent has unique keypair

## Full AI Maestro Experience

This skill provides basic AMP messaging. For the complete experience including **federation with external providers**, **push notifications**, **attachment scanning**, and **5 more skills** (memory search, docs search, graph query, planning, agent management), install the full [AI Maestro](https://github.com/23blocks-OS/ai-maestro) platform.

Protocol spec: [agentmessaging.org](https://agentmessaging.org)
