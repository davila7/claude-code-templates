# Telegram PR Notifications - Setup Summary

## ✅ What's Already Done

1. **Code Implementation** ✅
   - Telegram notifier module created
   - GitHub webhook endpoint created
   - Database migration file ready
   - Tests added
   - Documentation complete

2. **Setup Scripts Created** ✅
   - `scripts/setup-telegram-notifications-simple.sh` - Automated setup
   - Generated webhook secret saved to `.webhook-secret`
   - `.webhook-secret` added to `.gitignore`

3. **All Code Committed & Pushed** ✅
   - Branch: `claude/telegram-pr-notifications-ldhZq`
   - Ready to merge to main for automatic deployment

## ⚠️ What You Need to Provide

### 1. Telegram Bot Credentials

**TELEGRAM_BOT_TOKEN** - Get this now:
1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Follow prompts to create bot
4. Copy the token (looks like: `110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw`)

**TELEGRAM_CHAT_ID** - Get this after creating bot:
1. Start chat with your new bot
2. Send any message to it (e.g., `/start`)
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find `"chat":{"id":123456789}` in the response
5. Copy the chat ID number

### 2. Database Connection (Optional but Recommended)

**NEON_DATABASE_URL** - If you already have Neon configured:
- It should be in your Vercel environment variables already
- Format: `postgresql://user:password@host/database?sslmode=require`

If you don't have it:
- Check Vercel Dashboard → Settings → Environment Variables
- Look for `NEON_DATABASE_URL`
- Copy the value

### 3. GitHub Webhook Secret (Already Generated!)

**GITHUB_WEBHOOK_SECRET**: `e8580a0d3bb3976cbf8b796405fc5cd58bf9b9a1ef0ae24fd7bf97d16ef59ad3`

⚠️ **Keep this secret safe!** It's saved in `.webhook-secret` file (not committed to git)

## 🚀 Deployment Steps

### Step 1: Add Environment Variables to Vercel

Go to: [Vercel Dashboard](https://vercel.com/dashboard) → Your Project → Settings → Environment Variables

Add these 4 variables:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `TELEGRAM_BOT_TOKEN` | _[Your bot token from @BotFather]_ | Production, Preview, Development |
| `TELEGRAM_PR_NOTIFICATION_CHAT_ID` | _[Your chat ID]_ | Production, Preview, Development |
| `GITHUB_WEBHOOK_SECRET` | `e8580a0d3bb3976cbf8b796405fc5cd58bf9b9a1ef0ae24fd7bf97d16ef59ad3` | Production, Preview, Development |
| `TELEGRAM_SKIP_DRAFT_PRS` | `true` | Production, Preview, Development |

### Step 2: Deploy to Production

**Option A: Automatic (Recommended)**
1. Merge the PR to `main` branch
2. Vercel will deploy automatically
3. Wait ~2 minutes for deployment

**Option B: Manual**
```bash
vercel --prod
```

### Step 3: Run Database Migration

If you have `NEON_DATABASE_URL` configured:

```bash
# If psql is installed locally:
psql $NEON_DATABASE_URL -f database/migrations/003_create_telegram_notifications_log.sql

# Or use Neon's web SQL editor:
# 1. Go to Neon Console
# 2. Select your database
# 3. Go to SQL Editor
# 4. Copy/paste the migration file content
# 5. Run
```

### Step 4: Configure GitHub Webhook

1. Go to: GitHub Repo → Settings → Webhooks → **Add webhook**

2. Configure:
   - **Payload URL**: `https://aitmpl.com/api/github-pr-webhook`
   - **Content type**: `application/json`
   - **Secret**: `e8580a0d3bb3976cbf8b796405fc5cd58bf9b9a1ef0ae24fd7bf97d16ef59ad3`
   - **Which events?**: Select "Let me select individual events"
     - ✅ **Pull requests** (check this)
     - ⬜ Uncheck everything else
   - **Active**: ✅ Checked

3. Click **Add webhook**

### Step 5: Test It!

1. Create a test PR in your repo
2. Check your Telegram chat - you should receive a notification
3. Go to GitHub → Settings → Webhooks → Your webhook → Recent Deliveries
   - Should show green checkmark ✅
   - If red ❌, click to see error details

## 🔧 Quick Test Commands

### Test Telegram Bot Connection

```bash
# Set your credentials
export TELEGRAM_BOT_TOKEN="your_token_here"
export TELEGRAM_CHAT_ID="your_chat_id_here"

# Run setup script to test
bash scripts/setup-telegram-notifications-simple.sh
```

### Test Webhook Endpoint (After Deploy)

```bash
curl -X POST https://aitmpl.com/api/github-pr-webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -d '{
    "action": "opened",
    "pull_request": {
      "number": 999,
      "title": "Test PR",
      "html_url": "https://github.com/owner/repo/pull/999",
      "user": {"login": "testuser"},
      "head": {"ref": "test-branch", "repo": {"html_url": "https://github.com/owner/repo"}},
      "base": {"ref": "main"}
    },
    "repository": {"full_name": "owner/repo"}
  }'
```

## 📊 Monitoring

### Check Vercel Logs
```bash
vercel logs aitmpl.com --follow
```

### Check Telegram Bot Info
```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe
```

### Check GitHub Webhook Deliveries
GitHub → Settings → Webhooks → Click your webhook → Recent Deliveries

## 🆘 Troubleshooting

### No notifications received?

1. **Check Vercel logs**: `vercel logs aitmpl.com --follow`
2. **Check GitHub webhook deliveries**: Look for error responses
3. **Verify environment variables**: Vercel Dashboard → Settings → Environment Variables
4. **Test bot token**: `curl https://api.telegram.org/bot<TOKEN>/getMe`
5. **Check chat ID**: Make sure bot can send to that chat

### "Invalid bot token" error?

- Double-check `TELEGRAM_BOT_TOKEN` in Vercel
- Make sure there are no extra spaces or quotes
- Test with curl command above

### "Chat not found" error?

- Verify `TELEGRAM_CHAT_ID` is correct
- Make sure you started a chat with the bot first
- For groups: Bot must be added to the group

### Database migration fails?

- Check `NEON_DATABASE_URL` format
- Verify database connection: `psql $NEON_DATABASE_URL -c "SELECT 1;"`
- Migration may already be applied (safe to ignore)

## 📁 Files Reference

```
api/
├── github-pr-webhook.js          # Main webhook endpoint
├── telegram/
│   ├── telegram-notifier.js      # Notification logic
│   └── README.md                 # API documentation
└── __tests__/
    └── endpoints.test.js         # Tests for webhook

database/migrations/
└── 003_create_telegram_notifications_log.sql  # Database schema

docs/
└── telegram-pr-notifications-setup.md  # Complete setup guide

scripts/
├── setup-telegram-notifications-simple.sh  # Automated setup
└── setup-telegram-pr-notifications.js      # Advanced setup

.webhook-secret                   # Generated webhook secret (DO NOT COMMIT)
```

## 🎯 Next Actions for You

1. [ ] Create Telegram bot with @BotFather
2. [ ] Get bot token and chat ID
3. [ ] Add environment variables to Vercel
4. [ ] Merge PR to main (or deploy manually)
5. [ ] Run database migration
6. [ ] Configure GitHub webhook
7. [ ] Create test PR to verify

## ✨ Expected Result

When you create a PR, you should receive a Telegram message like:

```
🚀 Pull Request Opened

📝 Add new feature

🔢 PR #42
👤 Author: username
📦 Repo: owner/repository

🔗 Preview URL
🔗 View PR
```

---

**Need help?** Check `docs/telegram-pr-notifications-setup.md` for detailed instructions.
