# Telegram PR Notifications Setup Guide

This guide explains how to set up Telegram notifications for Pull Requests in your GitHub repository.

## Overview

When a Pull Request is created or updated in your repository, you'll automatically receive a Telegram message with:
- PR title and number
- Author information
- Repository name
- Preview URL (if available)
- Link to the PR

## Prerequisites

- A Telegram account
- Access to your GitHub repository settings
- Vercel deployment with environment variables configured
- (Optional) Neon Database for logging notifications

## Step 1: Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Start a chat with BotFather
3. Send the command `/newbot`
4. Follow the prompts to:
   - Choose a name for your bot (e.g., "My Project PR Notifier")
   - Choose a username for your bot (must end in 'bot', e.g., "my_project_pr_bot")
5. BotFather will provide you with a **bot token**. Save this token securely.

```
Example token: 110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
```

## Step 2: Get Your Telegram Chat ID

You need to get the chat ID where you want to receive notifications.

### Option A: Personal Chat (Recommended for individual use)

1. Start a chat with your bot by clicking the link BotFather provided
2. Send any message to your bot (e.g., `/start`)
3. Open your browser and visit:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
   Replace `<YOUR_BOT_TOKEN>` with your actual bot token
4. Look for the `"chat":{"id":...}` field in the response
5. Save this chat ID (it will be a number like `123456789`)

### Option B: Group or Channel

1. Add your bot to the group/channel
2. For channels: Make the bot an administrator
3. Send a message in the group/channel
4. Visit the getUpdates URL as above
5. Find the chat ID in the response (for groups it will be negative, e.g., `-1001234567890`)

## Step 3: Configure Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add the following variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `TELEGRAM_BOT_TOKEN` | Your bot token from BotFather | Required for sending messages |
| `TELEGRAM_PR_NOTIFICATION_CHAT_ID` | Your chat ID | Where notifications will be sent |
| `TELEGRAM_SKIP_DRAFT_PRS` | `true` or `false` | Skip notifications for draft PRs (optional) |
| `GITHUB_WEBHOOK_SECRET` | Random secret string | For securing webhook requests |
| `NEON_DATABASE_URL` | Your Neon DB connection string | For logging (optional) |

### Generating a Webhook Secret

Generate a secure random string for `GITHUB_WEBHOOK_SECRET`:

```bash
openssl rand -hex 32
```

Or use an online generator: https://randomkeygen.com/

## Step 4: Deploy Database Migration (Optional)

If you're using Neon Database for logging, run the migration:

```bash
# Connect to your Neon database
psql $NEON_DATABASE_URL

# Run the migration
\i database/migrations/003_create_telegram_notifications_log.sql
```

This creates a table to track all notifications sent.

## Step 5: Deploy to Vercel

1. Commit your changes
2. Deploy to Vercel:
   ```bash
   vercel --prod
   ```
3. Wait for deployment to complete
4. Note your deployment URL (e.g., `https://aitmpl.com`)

## Step 6: Configure GitHub Webhook

1. Go to your GitHub repository
2. Navigate to Settings → Webhooks
3. Click "Add webhook"
4. Configure the webhook:

| Field | Value |
|-------|-------|
| **Payload URL** | `https://your-domain.com/api/github-pr-webhook` |
| **Content type** | `application/json` |
| **Secret** | Your `GITHUB_WEBHOOK_SECRET` value |
| **Which events?** | Select "Let me select individual events" |
| **Events** | ✅ Pull requests only |
| **Active** | ✅ Checked |

5. Click "Add webhook"

## Step 7: Test the Setup

### Test 1: Create a Test PR

1. Create a new branch in your repository
2. Make a small change
3. Open a Pull Request
4. Check your Telegram chat - you should receive a notification within seconds

### Test 2: Manual Testing

You can test the endpoint manually using curl:

```bash
curl -X POST https://your-domain.com/api/github-pr-webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -d '{
    "action": "opened",
    "pull_request": {
      "number": 123,
      "title": "Test PR",
      "html_url": "https://github.com/owner/repo/pull/123",
      "user": {
        "login": "testuser"
      },
      "head": {
        "ref": "test-branch",
        "repo": {
          "html_url": "https://github.com/owner/repo"
        }
      },
      "base": {
        "ref": "main"
      }
    },
    "repository": {
      "full_name": "owner/repo"
    }
  }'
```

## Troubleshooting

### No notifications received

1. **Check webhook delivery:**
   - Go to GitHub → Settings → Webhooks
   - Click on your webhook
   - Check "Recent Deliveries" tab
   - Look for errors in the response

2. **Check Vercel logs:**
   ```bash
   vercel logs aitmpl.com --follow
   ```

3. **Verify environment variables:**
   - Go to Vercel dashboard → Settings → Environment Variables
   - Ensure all variables are set correctly
   - Redeploy if you changed any variables

4. **Test bot token:**
   ```bash
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe
   ```
   Should return bot information

5. **Check chat permissions:**
   - Ensure the bot can send messages to your chat
   - For groups/channels, bot must be admin

### Notifications received but missing preview URL

The preview URL feature requires integration with your deployment platform (Vercel, Netlify, etc.). By default, it falls back to the repository URL.

To add preview URLs:
1. Configure your deployment platform to post deployment status to PRs
2. The webhook will automatically detect preview URLs from PR status checks

### Database logging not working

If you see "Skipping database logging" in logs:
- Verify `NEON_DATABASE_URL` is set in Vercel
- Check database connection string format
- Ensure migration was run successfully

## Message Format

Telegram notifications will look like this:

```
🚀 Pull Request Opened

📝 Add Telegram PR notifications feature

🔢 PR #42
👤 Author: username
📦 Repo: owner/repository

🔗 Preview URL
🔗 View PR
```

## Customization

### Changing the Message Format

Edit `/api/telegram/telegram-notifier.js` and modify the `formatPRMessage()` function:

```javascript
function formatPRMessage(prData) {
  // Customize your message format here
  let message = `🚀 New PR: ${prData.title}\n`;
  message += `👤 ${prData.user}\n`;
  message += `🔗 ${prData.url}`;
  return message;
}
```

### Filtering PRs

You can add custom filtering logic in `/api/github-pr-webhook.js`:

```javascript
// Example: Only notify for PRs with specific labels
if (!prData.labels?.includes('ready-for-review')) {
  return res.status(200).json({ message: 'PR not ready for review' });
}
```

### Adding Preview URLs

If you're using Vercel deployments, you can enhance the `extractPRData()` function to fetch deployment URLs:

```javascript
// In telegram-notifier.js
export async function extractPRData(webhookPayload) {
  // ... existing code ...

  // Fetch deployment from Vercel API
  const deploymentUrl = await getVercelDeployment(pull_request.head.sha);

  return {
    // ... existing fields ...
    previewUrl: deploymentUrl
  };
}
```

## Security Best Practices

1. **Keep secrets secure:**
   - Never commit `.env` files
   - Use environment variables only
   - Rotate webhook secret periodically

2. **Verify webhook signatures:**
   - The endpoint automatically validates GitHub signatures
   - Never disable signature verification in production

3. **Limit bot permissions:**
   - Only give the bot permission to send messages
   - Don't make it admin unless necessary

4. **Monitor logs:**
   - Check Vercel logs regularly
   - Set up alerts for failed notifications

## Advanced Features

### Multiple Repositories

To receive notifications from multiple repositories:

1. **Option A: Same chat for all repos**
   - Add the webhook to each repository
   - All will use the same `TELEGRAM_PR_NOTIFICATION_CHAT_ID`

2. **Option B: Different chats per repo**
   - Deploy multiple instances with different environment variables
   - Use different webhook URLs for each repository

### Rate Limiting

Telegram has rate limits:
- 30 messages per second per bot
- 20 messages per minute to the same group

The current implementation doesn't include rate limiting. For high-volume repositories, consider adding a queue system.

### Rich Notifications with Images

You can enhance notifications with screenshots or PR previews using Telegram's photo message API. Modify the `sendTelegramNotification()` function to use `sendPhoto` instead of `sendMessage`.

## Monitoring and Analytics

### View Notification Logs

If you configured Neon Database:

```sql
-- Recent notifications
SELECT pr_number, pr_title, success, sent_at
FROM telegram_notifications_log
ORDER BY sent_at DESC
LIMIT 10;

-- Success rate
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM telegram_notifications_log;

-- Notifications by repository
SELECT repository, COUNT(*) as count
FROM telegram_notifications_log
GROUP BY repository
ORDER BY count DESC;
```

### Vercel Analytics

Monitor endpoint performance in Vercel:
1. Go to Analytics tab
2. Filter by `/api/github-pr-webhook`
3. Check response times and error rates

## Support

If you encounter issues:

1. Check the [troubleshooting section](#troubleshooting)
2. Review Vercel logs: `vercel logs --follow`
3. Test the endpoint with curl
4. Open an issue on GitHub

## Related Documentation

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [GitHub Webhooks](https://docs.github.com/en/webhooks)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Neon Database](https://neon.tech/docs)

---

**Last Updated:** 2026-01-16
