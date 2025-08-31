# Slack Notifications

Get instant Slack notifications when Claude Code finishes working.

## Quick Setup

### 1. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. **Create New App** → **From scratch**
3. Name it "Claude Code Notifier"
4. Select your workspace

### 2. Enable Webhook

1. Go to **Features** → **Incoming Webhooks**
2. Toggle **Activate Incoming Webhooks** to ON
3. **Add New Webhook to Workspace**
4. Select your channel (e.g., #dev-notifications)
5. **Copy the Webhook URL**

### 3. Install Hook

```bash
# Basic notifications
npx claude-code-templates@latest --hook automation/slack-notifications

# Rich block notifications with session details
npx claude-code-templates@latest --hook automation/slack-detailed-notifications

# Long operation monitoring
npx claude-code-templates@latest --hook automation/slack-error-notifications
```

### 4. Set Environment Variable

```bash
# Temporary (current session)
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR_WEBHOOK_URL"

# Permanent (add to ~/.zshrc or ~/.bashrc)
echo 'export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR_WEBHOOK_URL"' >> ~/.zshrc
source ~/.zshrc
```

### 5. Test

```bash
curl -X POST $SLACK_WEBHOOK_URL \
     -H 'Content-type: application/json' \
     -d '{"text":"🧪 Test notification"}'
```

## What You Get

- **Session completion** → "🤖 Claude Code finished working"
- **Rich blocks** → Structured messages with project info, duration, memory usage
- **Long operation alerts** → Warnings for commands taking >30 seconds
- **Team collaboration** → Perfect for development teams

## Environment Variable

The hook requires `SLACK_WEBHOOK_URL` to be set in your environment.

Your webhook URL format: `https://hooks.slack.com/services/T.../B.../...`

That's it! The hook works automatically once installed and configured.