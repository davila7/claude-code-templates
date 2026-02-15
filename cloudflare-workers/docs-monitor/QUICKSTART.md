# 🚀 Quick Start - 5 Minutes (100% CLI)

Super quick guide to deploy the monitor in 5 minutes using only the command line.

## Step 1: Create Telegram Bot (2 min)

1. Open Telegram and search for **@BotFather**
2. Send: `/newbot`
3. Follow instructions (name and username)
4. **Save the token** it gives you (looks like: `1234567890:ABCdef...`)

## Step 2: Get Your Chat ID (1 min)

1. Search for **@userinfobot** in Telegram
2. Send: `/start`
3. **Save your ID** (looks like: `123456789`)

## Step 3: Setup Worker via CLI (2 min)

```bash
# 1. Go to directory
cd cloudflare-workers/docs-monitor

# 2. Install dependencies
npm install

# 3. Login to Cloudflare (opens browser once)
npx wrangler login

# 4. Create KV namespace (via CLI)
npx wrangler kv:namespace create DOCS_MONITOR_KV

# Copy the ID it gives you and edit wrangler.toml:
# [[kv_namespaces]]
# binding = "DOCS_MONITOR_KV"
# id = "PASTE_ID_HERE"  # ← Change this

# 5. Configure secrets (via CLI)
npx wrangler secret put TELEGRAM_BOT_TOKEN
# → Paste bot token

npx wrangler secret put TELEGRAM_CHAT_ID
# → Paste your chat ID

# 6. Deploy (via CLI)
npm run deploy
```

## Done! 🎉

Your worker is now running. You'll receive a Telegram notification whenever Claude Code documentation changes.

### Verify it works (CLI commands)

```bash
# Check status
curl https://claude-docs-monitor.YOUR-USERNAME.workers.dev/status

# Force a check (optional)
# First configure the secret:
npx wrangler secret put TRIGGER_SECRET
# → Type any password: my-secret-123

# Then use it:
curl -X POST https://claude-docs-monitor.YOUR-USERNAME.workers.dev/trigger \
  -H "Authorization: Bearer my-secret-123"

# View real-time logs
npx wrangler tail

# List all secrets
npx wrangler secret list

# View deployments
npx wrangler deployments list
```

### Problems?

See the [full documentation](./README.md) or check the [Troubleshooting](./README.md#-troubleshooting) section.

---

**Next step**: Customize check frequency by editing `wrangler.toml` → `[triggers]`
