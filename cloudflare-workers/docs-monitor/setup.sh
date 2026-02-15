#!/bin/bash

# Setup script for Claude Docs Monitor Cloudflare Worker
# Makes deployment easier with interactive prompts (100% CLI)

set -e

echo "🚀 Claude Code Docs Monitor - Setup Script"
echo "=========================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found"
    echo "📦 Installing wrangler..."
    npm install -g wrangler
fi

echo "✅ Wrangler CLI found"
echo ""

# Check if logged in
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "📝 Please login to Cloudflare (via CLI)"
    wrangler login
else
    echo "✅ Already authenticated"
fi
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo ""

# Create KV namespace if needed
echo "🗄️  Setting up KV namespace (via CLI)..."
echo "Do you need to create a KV namespace? (y/n)"
read -r create_kv

if [ "$create_kv" = "y" ]; then
    echo "Creating KV namespace via CLI..."
    wrangler kv:namespace create DOCS_MONITOR_KV
    echo ""
    echo "⚠️  IMPORTANT: Copy the 'id' from above and paste it in wrangler.toml"
    echo "Press Enter when you've updated wrangler.toml..."
    read -r
fi
echo ""

# Configure secrets (via CLI)
echo "🔑 Configuring secrets via CLI..."
echo ""

echo "1️⃣  Telegram Bot Token"
echo "   Get it from @BotFather on Telegram"
echo "   Do you want to set it now via CLI? (y/n)"
read -r set_bot_token

if [ "$set_bot_token" = "y" ]; then
    wrangler secret put TELEGRAM_BOT_TOKEN
fi
echo ""

echo "2️⃣  Telegram Chat ID"
echo "   Get it from @userinfobot on Telegram"
echo "   Do you want to set it now via CLI? (y/n)"
read -r set_chat_id

if [ "$set_chat_id" = "y" ]; then
    wrangler secret put TELEGRAM_CHAT_ID
fi
echo ""

echo "3️⃣  Trigger Secret (optional)"
echo "   For manual trigger endpoint security"
echo "   Do you want to set it now via CLI? (y/n)"
read -r set_trigger_secret

if [ "$set_trigger_secret" = "y" ]; then
    wrangler secret put TRIGGER_SECRET
fi
echo ""

# Deploy
echo "🚀 Ready to deploy via CLI!"
echo "Deploy now? (y/n)"
read -r deploy_now

if [ "$deploy_now" = "y" ]; then
    npm run deploy
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "📊 Next steps (all via CLI):"
    echo "1. Check status: curl https://claude-docs-monitor.YOUR-USER.workers.dev/status"
    echo "2. View logs: npm run tail (or: wrangler tail)"
    echo "3. List secrets: wrangler secret list"
    echo "4. View deployments: wrangler deployments list"
else
    echo "Skipping deployment. Run 'npm run deploy' when ready."
fi

echo ""
echo "✨ Setup complete! Check README.md for more CLI commands."
