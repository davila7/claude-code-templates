# Telegram Notifications

Get instant Telegram notifications when Claude Code finishes working.

## Quick Setup

### 1. Create Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Choose a name: "Claude Code Notifier"
4. Choose username: "your_bot_name_bot"
5. **Copy the Bot Token** (looks like `123456789:ABCdef...`)

### 2. Get Chat ID

1. Send any message to your new bot
2. Open this URL in browser (replace YOUR_BOT_TOKEN):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
3. Find `"chat":{"id":123456789}` in the response
4. **Copy the Chat ID** (the number)

### 3. Install Hook

```bash
# Basic notifications
npx claude-code-templates@latest --hook automation/telegram-notifications

# Detailed notifications with session info
npx claude-code-templates@latest --hook automation/telegram-detailed-notifications

# Long operation monitoring
npx claude-code-templates@latest --hook automation/telegram-error-notifications
```

### 4. Set Environment Variables

```bash
# Temporary (current session)
export TELEGRAM_BOT_TOKEN="123456789:ABCdef..."
export TELEGRAM_CHAT_ID="987654321"

# Permanent (add to ~/.zshrc or ~/.bashrc)
echo 'export TELEGRAM_BOT_TOKEN="123456789:ABCdef..."' >> ~/.zshrc
echo 'export TELEGRAM_CHAT_ID="987654321"' >> ~/.zshrc
source ~/.zshrc
```

### 5. Test

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
     -d "chat_id=$TELEGRAM_CHAT_ID" \
     -d "text=🧪 Test notification"
```

## What You Get

- **Session completion** → "🤖 Claude Code finished working"
- **Detailed session info** → Project name, duration, memory usage
- **Long operation alerts** → Warnings for commands taking >30 seconds
- **Mobile first** → Perfect for staying updated on your phone

## Environment Variables

The hook requires two environment variables:

- `TELEGRAM_BOT_TOKEN` - Your bot token from BotFather
- `TELEGRAM_CHAT_ID` - Your chat ID number

That's it! The hook works automatically once installed and configured.