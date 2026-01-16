#!/bin/bash

# Telegram PR Notifications Setup Script
# This script helps you configure the Telegram PR notification system

set -e

echo "======================================================================"
echo "🚀 Telegram PR Notifications Setup"
echo "======================================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Step 1: Check environment variables
echo "======================================================================"
echo -e "${CYAN}📋 Checking Environment Variables${NC}"
echo "======================================================================"
echo ""

echo "Required variables:"

if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    echo -e "  ${GREEN}✅ TELEGRAM_BOT_TOKEN: Set${NC}"
else
    echo -e "  ${RED}❌ TELEGRAM_BOT_TOKEN: Not set${NC}"
fi

if [ -n "$TELEGRAM_CHAT_ID" ] || [ -n "$TELEGRAM_PR_NOTIFICATION_CHAT_ID" ]; then
    echo -e "  ${GREEN}✅ TELEGRAM_CHAT_ID: Set${NC}"
else
    echo -e "  ${RED}❌ TELEGRAM_CHAT_ID: Not set${NC}"
fi

if [ -n "$NEON_DATABASE_URL" ]; then
    echo -e "  ${GREEN}✅ NEON_DATABASE_URL: Set${NC}"
else
    echo -e "  ${RED}❌ NEON_DATABASE_URL: Not set${NC}"
fi

if [ -n "$GITHUB_WEBHOOK_SECRET" ]; then
    echo -e "  ${GREEN}✅ GITHUB_WEBHOOK_SECRET: Set${NC}"
else
    echo -e "  ${RED}❌ GITHUB_WEBHOOK_SECRET: Not set${NC}"
fi

echo ""

# Step 2: Generate webhook secret if needed
if [ -z "$GITHUB_WEBHOOK_SECRET" ]; then
    echo "======================================================================"
    echo -e "${CYAN}🔐 Generating GitHub Webhook Secret${NC}"
    echo "======================================================================"
    echo ""

    NEW_SECRET=$(openssl rand -hex 32)
    echo -e "${YELLOW}Generated webhook secret:${NC}"
    echo "  $NEW_SECRET"
    echo ""
    echo -e "${CYAN}📝 Add this to your environment:${NC}"
    echo "  GITHUB_WEBHOOK_SECRET=$NEW_SECRET"
    echo ""
    echo -e "export GITHUB_WEBHOOK_SECRET=$NEW_SECRET" >> .webhook-secret
    echo -e "${GREEN}✅ Saved to .webhook-secret file${NC}"
    echo ""
fi

# Step 3: Test Telegram bot
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    echo "======================================================================"
    echo -e "${CYAN}🤖 Testing Telegram Bot${NC}"
    echo "======================================================================"
    echo ""

    CHAT_ID="${TELEGRAM_PR_NOTIFICATION_CHAT_ID:-$TELEGRAM_CHAT_ID}"

    echo "Testing bot connection..."
    BOT_INFO=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe")

    if echo "$BOT_INFO" | grep -q '"ok":true'; then
        BOT_USERNAME=$(echo "$BOT_INFO" | grep -o '"username":"[^"]*' | cut -d'"' -f4)
        echo -e "${GREEN}✅ Bot connected: @${BOT_USERNAME}${NC}"

        echo ""
        echo "Sending test message..."
        TEST_MSG=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -H "Content-Type: application/json" \
            -d "{\"chat_id\":\"${CHAT_ID}\",\"text\":\"🧪 *Test Notification*\n\nTelegram PR notifications are configured correctly!\n\nSetup completed at: $(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"parse_mode\":\"Markdown\"}")

        if echo "$TEST_MSG" | grep -q '"ok":true'; then
            echo -e "${GREEN}✅ Test message sent successfully!${NC}"
            echo "Check your Telegram chat for the test message."
        else
            echo -e "${RED}❌ Failed to send test message${NC}"
            echo "Response: $TEST_MSG"
        fi
    else
        echo -e "${RED}❌ Invalid bot token${NC}"
    fi
    echo ""
fi

# Step 4: Run database migration
if [ -n "$NEON_DATABASE_URL" ]; then
    echo "======================================================================"
    echo -e "${CYAN}🗄️  Running Database Migration${NC}"
    echo "======================================================================"
    echo ""

    echo "Installing psql if needed..."
    if ! command -v psql &> /dev/null; then
        echo -e "${YELLOW}⚠️  psql not found. Install PostgreSQL client to run migration.${NC}"
        echo "   Ubuntu/Debian: sudo apt-get install postgresql-client"
        echo "   macOS: brew install postgresql"
    else
        echo "Running migration..."
        if psql "$NEON_DATABASE_URL" -f database/migrations/003_create_telegram_notifications_log.sql 2>&1; then
            echo -e "${GREEN}✅ Migration completed successfully!${NC}"
        else
            echo -e "${YELLOW}ℹ️  Migration may already be applied (table exists)${NC}"
        fi
    fi
    echo ""
fi

# Step 5: Display next steps
echo "======================================================================"
echo -e "${CYAN}📌 Next Steps${NC}"
echo "======================================================================"
echo ""

echo -e "${CYAN}1️⃣ Configure Environment Variables in Vercel:${NC}"
echo "   • Go to: Vercel Dashboard → Your Project → Settings → Environment Variables"
echo "   • Add these variables:"
echo ""
echo "     TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-your_bot_token}"
echo "     TELEGRAM_PR_NOTIFICATION_CHAT_ID=${TELEGRAM_CHAT_ID:-your_chat_id}"
echo "     GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET:-check_.webhook-secret_file}"
echo "     TELEGRAM_SKIP_DRAFT_PRS=true"
echo ""

echo -e "${CYAN}2️⃣ Deploy to Production:${NC}"
echo "   • Merge your PR to main (deploys automatically)"
echo "   • Or manually: vercel --prod"
echo ""

echo -e "${CYAN}3️⃣ Configure GitHub Webhook:${NC}"
echo "   • Go to: GitHub Repo → Settings → Webhooks → Add webhook"
echo "   • Payload URL: https://aitmpl.com/api/github-pr-webhook"
echo "   • Content type: application/json"
echo "   • Secret: (use GITHUB_WEBHOOK_SECRET value)"
echo "   • Events: Select 'Pull requests' only"
echo "   • Active: ✅ Checked"
echo ""

echo -e "${CYAN}4️⃣ Test the Setup:${NC}"
echo "   • Create a test Pull Request"
echo "   • Check your Telegram chat for notification"
echo "   • Check GitHub webhook deliveries for errors"
echo ""

echo -e "${CYAN}📚 Documentation:${NC}"
echo "   • Setup guide: docs/telegram-pr-notifications-setup.md"
echo "   • API docs: api/telegram/README.md"
echo ""

echo -e "${GREEN}✨ Setup script completed!${NC}"
echo ""
