---
sidebar_position: 4
---

# Chats Interface

Mobile-first interface for browsing Claude Code conversations with resume functionality.

## Launch Command

```bash
npx claude-code-templates@latest --chats
```

## Features

- **Resume conversations** - One-click resume button with modal dialog showing `claude --resume {session_id}` command
- **Copy functionality** - Click to copy resume command to clipboard with visual feedback
- **Mobile-optimized** - Touch-friendly design with responsive layout
- **Real-time monitoring** - Live conversation state detection and updates
- **Conversation browsing** - View and navigate through all your Claude Code conversations

## 🌐 Remote Access

Combine with Cloudflare Tunnel for access from anywhere:

```bash
npx claude-code-templates@latest --chats --tunnel
```

---

**Next:** Learn about [Cloudflare Tunnel](./tunnel) for secure remote access to your tools.