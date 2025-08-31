# Discord Notifications

Get instant Discord notifications when Claude Code finishes working.

## Quick Setup

### 1. Create Discord Webhook

1. Right-click your Discord channel → **Edit Channel**
2. Go to **Integrations** → **Create Webhook**
3. Name it "Claude Code Bot"
4. **Copy the Webhook URL**

### 2. Install Hook

```bash
# Basic notifications
npx claude-code-templates@latest --hook automation/discord-notifications

# Rich embed notifications with session details
npx claude-code-templates@latest --hook automation/discord-detailed-notifications

# Long operation monitoring
npx claude-code-templates@latest --hook automation/discord-error-notifications
```

### 3. Set Environment Variable

```bash
# Temporary (current session)
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"

# Permanent (add to ~/.zshrc or ~/.bashrc)
echo 'export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"' >> ~/.zshrc
source ~/.zshrc
```

### 4. Test

```bash
curl -X POST $DISCORD_WEBHOOK_URL \
     -H 'Content-Type: application/json' \
     -d '{"content":"🧪 Test notification"}'
```

## What You Get

- **Session completion** → "🤖 Claude Code finished working"
- **Rich embeds** → Colorful cards with project info, duration, memory usage
- **Long operation alerts** → Warnings for commands taking >30 seconds
- **Gaming community focused** → Perfect for Discord servers

## Environment Variable

The hook requires `DISCORD_WEBHOOK_URL` to be set in your environment.

Your webhook URL format: `https://discord.com/api/webhooks/[ID]/[TOKEN]`

That's it! The hook works automatically once installed and configured.