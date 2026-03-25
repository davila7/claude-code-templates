---
sidebar_position: 5
---

# Cloudflare Tunnel

Secure remote access to your Claude Code tools from anywhere.

## Launch Commands

### With Chats
```bash
npx claude-code-templates@latest --chats --tunnel
```

## How It Works

1. **Tool starts locally** - Analytics or chats interface launches
2. **Tunnel created** - Secure connection through Cloudflare
3. **Public URL generated** - Shareable HTTPS link provided
4. **Global access** - Use from any device with internet

## 🔧 Troubleshooting

### Common Issues

**Tunnel won't start:**
```bash
# Check internet connection
ping cloudflare.com

# Verify tool is running locally first
npx claude-code-templates@latest --chats
```

---

**Next:** Explore [E2B Sandbox](./sandbox) for secure cloud execution environments.